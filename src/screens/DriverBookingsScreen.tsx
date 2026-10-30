import React, { useEffect, useState } from 'react';
import { ArrowDownLeft, MessageSquare, RefreshCw, Users } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen, Booking, Ride } from '../types';
import { store } from '../services/store';
import { cleanCityName } from '../lib/cleanCityName';

interface DriverBookingsScreenProps {
  onNavigate: (screen: AppScreen) => void;
  onOpenBookingChat: (bookingId: string) => void;
}

interface BookingRow {
  ride: Ride;
  booking: Booking;
}

export const DriverBookingsScreen: React.FC<DriverBookingsScreenProps> = ({ onNavigate, onOpenBookingChat }) => {
  const [rides, setRides] = useState<Ride[]>(store.rides);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const update = () => setRides([...store.rides]);
    const unsubscribe = store.subscribe(update);
    let active = true;
    let loading = false;
    const refresh = async () => {
      if (!active || loading || document.visibilityState === 'hidden') return;
      loading = true;
      try {
        await store.fetchDriverRides();
        if (active) setError('');
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load bookings');
      } finally {
        loading = false;
        if (active) setIsLoading(false);
      }
    };
    const onFocus = () => void refresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const interval = window.setInterval(onFocus, 15000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    void refresh();
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unsubscribe();
    };
  }, []);

  const myRides = rides.filter((ride) => ride.driverId === store.user.id);
  const bookingRows: BookingRow[] = myRides.flatMap((ride) => (ride.passengerBookings || [])
    .filter((booking) => booking.bookingStatus !== 'CANCELLED')
    .map((booking) => ({ ride, booking })));
  const receivedAmount = bookingRows.reduce((total, { booking }) => total + (booking.paymentStatus === 'PAID' ? booking.amount : 0), 0);
  const awaitingAmount = bookingRows.reduce((total, { booking }) => total + (booking.paymentStatus === 'PAID' ? 0 : booking.amount), 0);

  const handleConfirmPayment = async (bookingId: string) => {
    setConfirmingId(bookingId);
    setError('');
    try {
      await store.confirmBookingPayment(bookingId);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'Unable to confirm payment');
    } finally {
      setConfirmingId('');
    }
  };

  return (
    <div className="w-full min-h-[720px] bg-neutral-50 flex flex-col pb-20">
      <TopBar title="Bookings & Payments" onBack={() => onNavigate('driver_dashboard')} showMore={false} />

      <div className="px-5 pt-4 space-y-4">
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <span className="block text-[10px] uppercase font-bold text-neutral-500">Passengers</span>
            <span className="mt-1 block text-2xl font-black text-neutral-900">{bookingRows.length}</span>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <span className="block text-[10px] uppercase font-bold text-neutral-500">Received</span>
            <span className="mt-1 block text-2xl font-black text-emerald-700">₹{receivedAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>
        <p className="text-xs text-neutral-500">₹{awaitingAmount.toLocaleString('en-IN')} awaiting collection or driver confirmation.</p>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-500">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading bookings from your rides…
          </div>
        ) : bookingRows.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-12 text-center">
            <Users className="mx-auto h-8 w-8 text-neutral-400" />
            <h2 className="mt-3 text-sm font-bold text-neutral-900">No passenger bookings yet</h2>
            <p className="mt-1 text-xs text-neutral-500">Bookings and payment status will appear here after passengers reserve seats on your rides.</p>
            <button type="button" onClick={() => onNavigate('create_ride')} className="mt-4 rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white">
              Publish a ride
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {bookingRows.map(({ ride, booking }) => {
              const paymentStatus = booking.paymentStatus === 'PAID'
                ? 'Received'
                : booking.paymentMethod === 'cash'
                  ? 'Cash due at pickup'
                  : 'UPI awaiting confirmation';
              return (
                <article key={booking.id} className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-neutral-900">{cleanCityName(booking.fromCity)} → {cleanCityName(booking.toCity)}</h2>
                      <p className="mt-0.5 text-xs text-neutral-500">{booking.departureDate} · {booking.departureTime}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold text-neutral-700">{booking.bookingStatus}</span>
                  </header>

                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-neutral-50 p-3 text-xs">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-neutral-500">Passenger</span>
                      <span className="font-semibold text-neutral-900">{booking.passengerName || 'Passenger'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-neutral-500">Phone</span>
                      <span className="font-semibold text-neutral-900">{booking.passengerPhone || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-neutral-500">Seats</span>
                      <span className="font-semibold text-neutral-900">{booking.selectedSeats.join(', ') || booking.seatsBooked}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-neutral-500">Pickup</span>
                      <span className="font-semibold text-neutral-900">{booking.pickupLocation || ride.pickupLocation}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-xs">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-neutral-500">Payment</span>
                      <span className="font-semibold text-neutral-900">{(booking.paymentMethod || 'upi').toUpperCase()} · {paymentStatus}</span>
                    </div>
                    <span className="text-lg font-extrabold text-neutral-900">₹{booking.amount}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {booking.paymentStatus !== 'PAID' && (
                      <button
                        type="button"
                        disabled={confirmingId === booking.id}
                        onClick={() => void handleConfirmPayment(booking.id)}
                        className="rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
                      >
                        {confirmingId === booking.id ? 'Saving…' : `Confirm ${(booking.paymentMethod || 'upi').toUpperCase()} received & confirm ride`}
                      </button>
                    )}
                    <button type="button" onClick={() => onOpenBookingChat(booking.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-[11px] font-bold text-neutral-800 hover:border-orange-400">
                      <MessageSquare className="h-3.5 w-3.5" /> Chat passenger
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <button type="button" onClick={() => onNavigate('driver_dashboard')} className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-600">
          <ArrowDownLeft className="h-3.5 w-3.5" /> Back to Driver Mode
        </button>
      </div>
    </div>
  );
};
