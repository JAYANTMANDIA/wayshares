import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Navigation, Compass } from 'lucide-react';
import { AppScreen, Booking } from '../types';
import { cleanCityName } from '../lib/cleanCityName';

interface BookingConfirmationScreenProps {
  booking: Booking;
  onNavigate: (screen: AppScreen) => void;
  onTrackRide: () => void;
}

export const BookingConfirmationScreen: React.FC<BookingConfirmationScreenProps> = ({
  booking,
  onNavigate,
  onTrackRide
}) => {
  useEffect(() => {
    if (booking.bookingStatus !== 'CONFIRMED') return;
    // Launch celebratory confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F97316', '#EA580C', '#10B981', '#F59E0B', '#FB923C']
      });
    } catch (e) {
      // ignore in environments without canvas support
    }
  }, []);

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none px-6 py-8">
      <div className="flex flex-col items-center text-center pt-4">
        {/* Animated Checkmark */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 border-2 shadow-sm ${
            booking.bookingStatus === 'CONFIRMED'
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
              : 'bg-amber-50 text-amber-600 border-amber-200'
          }`}
        >
          <CheckCircle2 className="w-10 h-10" />
        </motion.div>

        <h2 className="text-2xl font-black text-black tracking-tight">
          {booking.bookingStatus === 'CONFIRMED' ? 'Booking Confirmed!' : 'Waiting for Driver Confirmation'}
        </h2>
        <p className="text-xs text-neutral-500 mt-1 max-w-[280px]">
          {booking.bookingStatus === 'CONFIRMED'
            ? 'Your ride is confirmed. Driver and vehicle details are available below.'
            : 'Your seat is reserved. The driver will confirm the ride after verifying they received your payment.'}
        </p>

        {/* Reference Pill */}
        <div className="mt-3 bg-neutral-100 px-3 py-1 rounded-full text-xs font-mono font-bold text-neutral-800">
          Ref: {booking.bookingReference}
        </div>

        {/* Booking Summary Card */}
        <div className="w-full mt-6 p-4 rounded-2xl border border-neutral-200/90 bg-neutral-50/50 text-left shadow-2xs space-y-3">
          <div className="flex items-start justify-between border-b border-neutral-200/80 pb-3">
            <div>
              <h4 className="text-sm font-bold text-black">
                {cleanCityName(booking.fromCity)} → {cleanCityName(booking.toCity)}
              </h4>
              <p className="text-xs text-neutral-500 mt-0.5">
                {booking.departureDate} • {booking.departureTime}
              </p>
            </div>
            <span className="text-base font-extrabold text-black">
              ₹{booking.amount}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-neutral-400 block text-[10px] uppercase font-bold">Seats</span>
              <span className="font-bold text-neutral-800">
                Seat {booking.selectedSeats?.join(', ') || '1'} ({booking.seatsBooked} {booking.seatsBooked === 1 ? 'Seat' : 'Seats'})
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block text-[10px] uppercase font-bold">Driver</span>
              <span className="font-bold text-neutral-800 truncate block">
                {booking.driverName}
              </span>
            </div>
          </div>

          <div className="text-xs border-t border-neutral-200/80 pt-2.5">
            <span className="text-neutral-400 block text-[10px] uppercase font-bold">Pickup Spot</span>
            <span className="font-semibold text-neutral-800 text-[11px]">
              {booking.pickupLocation}
            </span>
          </div>

          <div className="text-xs border-t border-neutral-200/80 pt-2.5">
            <span className="text-neutral-400 block text-[10px] uppercase font-bold">Payment</span>
            <span className="font-semibold text-neutral-800 text-[11px]">
              {(booking.paymentMethod || 'upi').toUpperCase()} • ₹{booking.amount} • {booking.paymentStatus === 'PAID' ? 'Received' : booking.paymentMethod === 'cash' ? 'Due at pickup; awaiting driver confirmation' : 'Awaiting driver confirmation'}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-6">
        {booking.bookingStatus === 'CONFIRMED' && (
          <button
            onClick={onTrackRide}
            id="track-ride-live-button"
            className="w-full bg-black hover:bg-neutral-800 active:scale-[0.98] text-white font-semibold py-3.5 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 group cursor-pointer"
          >
            <Navigation className="w-4 h-4 text-orange-500 group-hover:scale-110 transition-transform" />
            <span>Track Ride Live</span>
          </button>
        )}

        <button
          onClick={() => onNavigate('my_trips')}
          id="view-my-trips-button"
          className="w-full border border-neutral-300 hover:bg-neutral-50 active:scale-[0.98] text-neutral-800 font-semibold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
        >
          <Compass className="w-4 h-4" />
          <span>View All My Trips</span>
        </button>
      </div>
    </div>
  );
};
