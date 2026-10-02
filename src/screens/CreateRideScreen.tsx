import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, Calendar, Clock, DollarSign, Users, Briefcase, Car, Check } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen } from '../types';
import { store } from '../services/store';

interface CreateRideScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const CreateRideScreen: React.FC<CreateRideScreenProps> = ({ onNavigate }) => {
  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropLocation, setDropLocation] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [availableSeats, setAvailableSeats] = useState(1);
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [luggageCapacity, setLuggageCapacity] = useState('');
  const [vehicleMakeModel, setVehicleMakeModel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    if (!store.canProvideRide()) {
      setIsSubmitting(false);
      onNavigate('profile');
      return;
    }

    try {
      await store.createRide({
        fromCity,
        toCity,
        pickupLocation,
        dropLocation,
        departureDate,
        departureTime,
        availableSeats,
        pricePerSeat: Number(pricePerSeat),
        luggageCapacity,
        vehicleMakeModel,
        vehicleRegNumber: store.user.rcNumber || ''
      });
      onNavigate('driver_dashboard');
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Unable to publish ride');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProvideRide = store.canProvideRide();

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-12">
      <div>
        <TopBar
          title="Publish Ride"
          onBack={() => onNavigate('driver_dashboard')}
          showMore={false}
        />

        {!canProvideRide && (
          <div className="mx-5 my-3 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
            <h4 className="text-xs font-bold flex items-center gap-1.5">
              <span>⚠️ Vehicle RC Required to Provide Rides</span>
            </h4>
            <p className="text-[11px] leading-relaxed">
              Without an uploaded Vehicle Registration Certificate (RC), you can only take rides as a passenger. Please upload your vehicle RC to publish rides.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="text-xs font-bold bg-amber-600 text-white px-3 py-1.5 rounded-xl hover:bg-amber-700"
            >
              Go to Profile to Upload RC
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-5 pt-1 space-y-3.5">
          {error && <p role="alert" className="text-xs font-medium text-rose-600">{error}</p>}
          {/* Origin & Destination */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                Origin City
              </label>
              <input
                type="text"
                required
                value={fromCity}
                onChange={(e) => setFromCity(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-xs font-semibold outline-hidden"
                placeholder="Origin city"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                Destination City
              </label>
              <input
                type="text"
                required
                value={toCity}
                onChange={(e) => setToCity(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-xs font-semibold outline-hidden"
                placeholder="Destination city"
              />
            </div>
          </div>

          {/* Pickup & Drop Points */}
          <div>
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
              Pickup Point
            </label>
            <input
              type="text"
              required
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-xs outline-hidden"
              placeholder="Pickup address"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
              Dropoff Point
            </label>
            <input
              type="text"
              required
              value={dropLocation}
              onChange={(e) => setDropLocation(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-xs outline-hidden"
              placeholder="Dropoff address"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                Departure Date
              </label>
              <input
                type="date"
                required
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-xs outline-hidden"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                Departure Time
              </label>
              <input
                type="time"
                required
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-xs outline-hidden"
              />
            </div>
          </div>

          {/* Seats & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                Seats Offered
              </label>
              <select
                value={availableSeats}
                onChange={(e) => setAvailableSeats(Number(e.target.value))}
                className="w-full border rounded-xl px-3 py-2 text-xs outline-hidden bg-white"
              >
                <option value={1}>1 Seat</option>
                <option value={2}>2 Seats</option>
                <option value={3}>3 Seats</option>
                <option value={4}>4 Seats</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                Price Per Seat (₹)
              </label>
              <input
                type="number"
                min={100}
                max={5000}
                required
                value={pricePerSeat}
                onChange={(e) => setPricePerSeat(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-xs font-bold outline-hidden"
              />
            </div>
          </div>

          {/* Vehicle info */}
          <div>
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                Car Model
              </label>
              <input
                type="text"
                value={vehicleMakeModel}
                onChange={(e) => setVehicleMakeModel(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-xs outline-hidden"
                placeholder="Vehicle make and model"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              id="submit-publish-ride-button"
              className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Publishing to Network...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 text-[#EF4444]" />
                  <span>Publish Ride (Go Live)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
