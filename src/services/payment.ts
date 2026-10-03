import { auth } from '../lib/firebase';
import { readApiJson } from '../lib/apiJson';
import type { Booking } from '../types';

interface RazorpayCheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', callback: (event: { error?: { description?: string } }) => void): void;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  method: { card: boolean; upi: boolean; wallet: boolean; netbanking: boolean };
  handler(response: RazorpayCheckoutResponse): void;
  modal: { ondismiss(): void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

async function apiRequest<T>(url: string, body: unknown): Promise<T> {
  const currentUser = auth?.currentUser;
  if (!currentUser) throw new Error('Sign in before booking a ride');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await currentUser.getIdToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const result = await readApiJson<T & { error?: string }>(response);
  if (!response.ok) throw new Error(result.error || 'Unable to complete payment');
  return result as T;
}

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Unable to load payment checkout')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load payment checkout'));
    document.body.appendChild(script);
  });
}

export async function payForRide(
  rideId: string,
  selectedSeats: number[],
  method: 'card' | 'upi' | 'wallet' | 'netbanking'
): Promise<Booking> {
  const orderResult = await apiRequest<{
    bookingId: string;
    keyId: string;
    order: { id: string; amount: number; currency: string };
  }>('/api/payments/orders', { rideId, selectedSeats });

  const releaseReservation = () => apiRequest(
    `/api/payments/reservations/${encodeURIComponent(orderResult.bookingId)}/cancel`,
    {}
  ).catch((error) => console.error('Unable to release payment reservation', error));
  try {
    await loadRazorpayCheckout();
  } catch (error) {
    await releaseReservation();
    throw error;
  }
  if (!window.Razorpay) {
    await releaseReservation();
    throw new Error('Payment checkout is unavailable');
  }

  return new Promise<Booking>((resolve, reject) => {
    let settled = false;
    let verificationStarted = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const checkout = new window.Razorpay!({
      key: orderResult.keyId,
      amount: orderResult.order.amount,
      currency: orderResult.order.currency,
      order_id: orderResult.order.id,
      name: 'UberX',
      description: 'Ride booking',
      method: {
        card: method === 'card',
        upi: method === 'upi',
        wallet: method === 'wallet',
        netbanking: method === 'netbanking'
      },
      handler: async (paymentResponse) => {
        verificationStarted = true;
        try {
          const verification = await apiRequest<{ booking: Booking }>('/api/payments/verify', paymentResponse);
          if (settled) return;
          settled = true;
          resolve(verification.booking);
        } catch (error) {
          fail(error instanceof Error ? error : new Error('Payment verification failed'));
        }
      },
      modal: {
        ondismiss: () => {
          if (!verificationStarted) {
            void releaseReservation();
            fail(new Error('Payment was cancelled'));
          }
        }
      }
    });
    checkout.on('payment.failed', (event) => {
      releaseReservation();
      fail(new Error(event.error?.description || 'Payment was declined'));
    });
    checkout.open();
  });
}