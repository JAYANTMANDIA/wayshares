import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  MapPin,
  Navigation,
  Calendar,
  User,
  Clock,
  FileText,
  XCircle,
  Star,
  MessageSquare,
  CheckCircle2
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen, Booking } from '../types';
import { store } from '../services/store';
import { RateDriverModal } from '../components/RateDriverModal';

interface MyTripsScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const MyTripsScreen: React.FC<MyTripsScreenProps> = ({ onNavigate }) => {
  const [bookings, setBookings] = useState<Booking[]>(store.bookings);
  const [activeTab, setActiveTab] = useState<'all' | 'confirmed' | 'completed' | 'cancelled'>('all');
  const [selectedReceipt, setSelectedReceipt] = useState<Booking | null>(null);
  const [ratingBooking, setRatingBooking] = useState<Booking | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const update = () => setBookings([...store.bookings]);
    return store.subscribe(update);
  }, []);

  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'confirmed') return b.bookingStatus === 'CONFIRMED';
    if (activeTab === 'completed') return b.bookingStatus === 'COMPLETED';
    if (activeTab === 'cancelled') return b.bookingStatus === 'CANCELLED';
    return true;
  });

  const handleCancelBooking = async (bookingId: string) => {
    if (window.confirm('Are you sure you want to cancel this booking? Full fare refund will be credited.')) {
      setActionError('');
      try {
        await store.cancelBooking(bookingId);
      } catch (cancelError) {
        setActionError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel booking');
      }
    }
  };

  const handleOpenChat = (bk: Booking) => {
    store.startOrGetConversationWithDriver(
      bk.driverId || 'driver_rajesh_01',
      bk.driverName || 'Driver',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
      'Verified Intercity Vehicle',
      `${bk.fromCity} → ${bk.toCity}`
    );
    onNavigate('chat');
  };

  return (
    <div className="w-full min-h-[720px] bg-neutral-50 flex flex-col justify-between select-none pb-20">
      <div>
        <TopBar
          title="My Trips"
          onBack={() => onNavigate('home')}
          showMore={true}
        />
        {actionError && <p role="alert" className="px-5 py-2 text-xs font-medium text-rose-700">{actionError}</p>}

        {/* Tab Selector */}
        <div className="px-5 pt-1 pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-neutral-100 bg-white">
          {[
            { id: 'all', label: 'All Trips' },
            { id: 'confirmed', label: 'Upcoming' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-black text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Trips List */}
        <div className="px-5 pt-4 space-y-3.5">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white rounded-2xl border border-neutral-200 shadow-2xs">
              <Calendar className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-neutral-800">No trips in this category</p>
              <p className="text-xs text-neutral-500 mt-0.5">Explore available highway rides to book.</p>
              <button
                onClick={() => onNavigate('plan_trip')}
                className="mt-3 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Plan a Trip
              </button>
            </div>
          ) : (
            filteredBookings.map((bk) => {
              const isCompleted = bk.bookingStatus === 'COMPLETED';
              return (
                <motion.div
                  key={bk.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs space-y-3"
                >
                  {/* Header: route and status pill */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-black tracking-tight leading-tight">
                        {bk.fromCity} → {bk.toCity}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-0.5 font-medium">
                        {bk.departureDate} • {bk.departureTime}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full tracking-wider ${
                        bk.bookingStatus === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : bk.bookingStatus === 'COMPLETED'
                          ? 'bg-neutral-100 text-neutral-700'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {bk.bookingStatus}
                    </span>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-neutral-50 p-2.5 rounded-xl border border-neutral-150">
                    <div>
                      <span className="text-neutral-400 block text-[10px] uppercase font-bold">Driver</span>
                      <span className="font-semibold text-neutral-800 truncate block">
                        {bk.driverName}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[10px] uppercase font-bold">Seats & Fare</span>
                      <span className="font-semibold text-neutral-800">
                        Seat {bk.selectedSeats?.join(', ')} • ₹{bk.amount}
                      </span>
                    </div>
                  </div>

                  {/* Post-ride rating prompt when completed */}
                  {isCompleted && (
                    <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-500 shrink-0" />
                        <div>
                          <span className="font-bold text-neutral-900 block leading-tight">
                            {bk.hasRated ? 'Trip Rated & Reviewed' : 'Rate Your Driver'}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            {bk.hasRated
                              ? `You gave ${bk.ratingGiven || 5} Stars`
                              : 'Help other passengers with your review'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setRatingBooking(bk)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                          bk.hasRated
                            ? 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
                            : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
                        }`}
                      >
                        {bk.hasRated ? 'Edit Rating' : '★ Rate Now'}
                      </button>
                    </div>
                  )}

                  {/* Actions row */}
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                    <span className="text-[11px] font-mono font-medium text-neutral-400">
                      Ref: {bk.bookingReference}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {/* Direct Chat with Driver button */}
                      <button
                        onClick={() => handleOpenChat(bk)}
                        className="text-xs text-orange-600 hover:text-orange-700 font-bold px-2 py-1 flex items-center gap-1 rounded-md hover:bg-orange-50 transition-colors"
                        title="Chat with driver"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat</span>
                      </button>

                      {bk.bookingStatus === 'CONFIRMED' && (
                        <>
                          <button
                            onClick={() => handleCancelBooking(bk.id)}
                            className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => onNavigate('ride_tracking')}
                            className="bg-black hover:bg-neutral-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-2xs"
                          >
                            <Navigation className="w-3.5 h-3.5 text-orange-400" />
                            <span>Track</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setSelectedReceipt(bk)}
                        className="border border-neutral-200 hover:border-black text-neutral-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Ticket</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Ticket / Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded flex items-center justify-center">
                  UX
                </div>
                <h4 className="text-sm font-bold text-black">Official e-Ticket</h4>
              </div>
              <button onClick={() => setSelectedReceipt(null)} className="text-xs text-neutral-500 font-bold">
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-neutral-50 p-3 rounded-xl border">
                <div className="text-[10px] text-neutral-400 font-bold uppercase">Booking Reference</div>
                <div className="text-lg font-mono font-black text-black">{selectedReceipt.bookingReference}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-neutral-400 block text-[10px] uppercase font-bold">From</span>
                  <span className="font-bold text-neutral-900">{selectedReceipt.fromCity}</span>
                  <p className="text-[10px] text-neutral-500">{selectedReceipt.pickupLocation}</p>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px] uppercase font-bold">To</span>
                  <span className="font-bold text-neutral-900">{selectedReceipt.toCity}</span>
                  <p className="text-[10px] text-neutral-500">{selectedReceipt.dropLocation}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                <div>
                  <span className="text-neutral-400 block text-[10px] uppercase font-bold">Driver</span>
                  <span className="font-bold text-neutral-900">{selectedReceipt.driverName}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px] uppercase font-bold">Fare Paid</span>
                  <span className="font-bold text-neutral-900">₹{selectedReceipt.amount}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedReceipt(null)}
              className="w-full bg-neutral-900 text-white font-bold py-2.5 rounded-xl text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Post-Ride Rate Driver Modal */}
      {ratingBooking && (
        <RateDriverModal
          isOpen={!!ratingBooking}
          onClose={() => setRatingBooking(null)}
          rideId={ratingBooking.rideId}
          driverId={ratingBooking.driverId || 'driver_rajesh_01'}
          driverName={ratingBooking.driverName}
          driverPhoto="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250"
          vehicleInfo="Maruti Swift Dzire"
          route={`${ratingBooking.fromCity} → ${ratingBooking.toCity}`}
          bookingId={ratingBooking.id}
        />
      )}
    </div>
  );
};
