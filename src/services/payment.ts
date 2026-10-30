import { auth } from '../lib/firebase';
import { readApiJson } from '../lib/apiJson';
import type { Booking } from '../types';

async function apiRequest<T>(url: string, body: unknown): Promise<T> {
  const currentUser = auth?.currentUser;
  if (!currentUser) throw new Error('Sign in before booking a ride');
  const request = async (forceRefresh: boolean) => fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await currentUser.getIdToken(forceRefresh)}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  let response = await request(false);
  if (response.status === 401) response = await request(true);
  const result = await readApiJson<T & { error?: string }>(response);
  if (!response.ok) throw new Error(result.error || 'Unable to complete payment');
  return result as T;
}

export async function payForRide(
  rideId: string,
  selectedSeats: number[],
  method: 'upi' | 'cash'
): Promise<Booking> {
  if (method === 'cash') {
    const result = await apiRequest<{ booking: Booking }>('/api/bookings/cash', { rideId, selectedSeats });
    return result.booking;
  }
  const result = await apiRequest<{ booking: Booking }>('/api/bookings/upi', { rideId, selectedSeats });
  return result.booking;
}