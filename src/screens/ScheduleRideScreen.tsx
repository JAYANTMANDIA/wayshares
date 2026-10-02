import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plane,
  ShieldCheck,
  CheckCircle2,
  Bell,
  MapPin,
  ArrowRight
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen } from '../types';
import { auth } from '../lib/firebase';

interface ScheduleRideScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const ScheduleRideScreen: React.FC<ScheduleRideScreenProps> = ({ onNavigate }) => {
  const [fromCity, setFromCity] = useState('');
  const [pickupPoint, setPickupPoint] = useState('');
  const [toCity, setToCity] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [flightNote, setFlightNote] = useState('');
  const [remindPrior, setRemindPrior] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleRef, setScheduleRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) {
      setError('Sign in before requesting a scheduled ride');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/scheduled-rides', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fromCity,
          pickupPoint,
          toCity,
          scheduledDate: selectedDate,
          scheduledTime: selectedTime,
          flightNote,
          remindPrior
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to submit ride request');
      setScheduleRef(result.request.reference);
      setIsScheduled(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to submit ride request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-8">
      <div>
        <TopBar
          title="Schedule Future Ride"
          onBack={() => onNavigate('home')}
          showMore={false}
        />

        <div className="px-5 pt-1 space-y-4">
          {!isScheduled ? (
            <form onSubmit={handleSchedule} className="space-y-4">
              {/* Pickup & Destination */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2.5">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    Origin City
                  </span>
                  <input
                    type="text"
                    required
                    value={fromCity}
                    onChange={(e) => setFromCity(e.target.value)}
                    placeholder="Origin city"
                    className="w-full text-xs font-semibold text-neutral-900 bg-white border border-neutral-200 rounded-xl px-3 py-2 outline-hidden"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    Pickup Location
                  </span>
                  <input
                    type="text"
                    required
                    value={pickupPoint}
                    onChange={(e) => setPickupPoint(e.target.value)}
                    placeholder="Pickup address"
                    className="w-full text-xs font-semibold text-neutral-900 bg-white border border-neutral-200 rounded-xl px-3 py-2 outline-hidden"
                  />
                </div>

                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    Dropoff City or Destination
                  </span>
                  <input
                    type="text"
                    required
                    value={toCity}
                    onChange={(e) => setToCity(e.target.value)}
                    placeholder="Destination"
                    className="w-full text-xs font-semibold text-neutral-900 bg-white border border-neutral-200 rounded-xl px-3 py-2 outline-hidden"
                  />
                </div>
              </div>

              {/* Date Selection */}
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
                  Select Departure Date
                </span>
                <input
                  type="date"
                  required
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full border border-neutral-200 bg-white rounded-xl px-3 py-2 text-xs font-semibold"
                />
              </div>

              {/* Time Selection */}
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
                  Select Pickup Time
                </span>
                <input
                  type="time"
                  required
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full border border-neutral-200 bg-white rounded-xl px-3 py-2 text-xs font-semibold"
                />
              </div>

              {/* Optional Flight or Train Note */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Plane className="w-3.5 h-3.5 text-neutral-500" />
                  <span className="text-xs font-bold text-neutral-800">Flight / Train Details (Optional)</span>
                </div>
                <input
                  type="text"
                  value={flightNote}
                  onChange={(e) => setFlightNote(e.target.value)}
                  placeholder="Flight or train details"
                  className="w-full text-xs font-medium text-neutral-900 bg-white border border-neutral-200 rounded-xl px-3 py-2 outline-hidden"
                />
              </div>

              {/* Reminder toggle */}
              <div
                onClick={() => setRemindPrior(!remindPrior)}
                className="p-3 rounded-2xl border border-neutral-200 bg-white flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-[#EF4444]" />
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900">SMS & Notification Reminder</h4>
                    <p className="text-[10px] text-neutral-500">Alert me 45 minutes before scheduled pickup</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={remindPrior}
                  onChange={(e) => setRemindPrior(e.target.checked)}
                  className="w-4 h-4 accent-black rounded"
                />
              </div>

              {/* Submit */}
              {error && <p role="alert" className="text-xs font-medium text-rose-700">{error}</p>}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-black hover:bg-neutral-800 disabled:opacity-60 text-white font-bold py-3.5 px-4 rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
              >
                <CalendarIcon className="w-4 h-4 text-rose-400" />
                <span>{isSubmitting ? 'Submitting request...' : 'Request scheduled ride'}</span>
              </button>
            </form>
          ) : (
            /* Confirmation Card */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-3xl border-2 border-emerald-500 bg-emerald-50/30 text-center space-y-3.5"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h3 className="text-lg font-bold text-black">Ride request received</h3>
              <p className="text-xs text-neutral-600">
                Driver assignment and payment are not confirmed yet. We have not charged you for this request.
              </p>

              <div className="bg-white p-3.5 rounded-2xl border border-emerald-200">
                <span className="text-[10px] text-neutral-400 font-bold uppercase block">Reservation ID</span>
                <span className="text-lg font-mono font-black text-black">{scheduleRef}</span>
              </div>

              <div className="text-xs text-left bg-white p-3 rounded-2xl border space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Date & Time:</span>
                  <span className="font-bold text-neutral-900">{selectedDate} at {selectedTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">From:</span>
                  <span className="font-bold text-neutral-900">{pickupPoint}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">To:</span>
                  <span className="font-bold text-neutral-900">{toCity}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsScheduled(false)}
                  className="flex-1 bg-black text-white py-2.5 rounded-xl text-xs font-bold"
                >
                  New request
                </button>
                <button
                  onClick={() => {
                    setIsScheduled(false);
                    onNavigate('home');
                  }}
                  className="flex-1 border border-neutral-300 py-2.5 rounded-xl text-xs font-semibold text-neutral-700"
                >
                  Home
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
