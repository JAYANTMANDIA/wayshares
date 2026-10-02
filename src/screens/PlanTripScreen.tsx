import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  MapPin,
  Calendar,
  Clock,
  Minus,
  Plus,
  Car,
  Bike,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen } from '../types';
import { store } from '../services/store';

interface PlanTripScreenProps {
  onNavigate: (screen: AppScreen) => void;
  tripParams?: {
    fromCity: string;
    toCity: string;
    date: string;
    passengers: number;
    luggage: boolean;
  };
  onUpdateParams?: (params: any) => void;
}

export const PlanTripScreen: React.FC<PlanTripScreenProps> = ({
  onNavigate,
  tripParams,
  onUpdateParams
}) => {
  const [user] = useState(store.user);
  const [canProvideRide] = useState(store.canProvideRide());

  // Location where to leave
  const [fromCity, setFromCity] = useState(tripParams?.fromCity || '');
  const [pickupSpot, setPickupSpot] = useState('');
  const [toCity, setToCity] = useState(tripParams?.toCity || '');
  const [dropSpot, setDropSpot] = useState('');

  // Time when to leave
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');

  // Available seats to give
  const [availableSeats, setAvailableSeats] = useState(1);

  // Fare and vehicle details
  const [pricePerSeat, setPricePerSeat] = useState(0);
  const [vehicleType, setVehicleType] = useState<'car' | 'bike'>('car');
  const [vehicleModel, setVehicleModel] = useState('');
  const [luggageCapacity, setLuggageCapacity] = useState('');

  // States for UI
  const [focusedField, setFocusedField] = useState<'origin' | 'destination' | 'date' | 'time' | 'seats' | 'price' | null>(null);
  const [error, setError] = useState('');
  const [showRcModal, setShowRcModal] = useState(false);
  const [publishedRideInfo, setPublishedRideInfo] = useState<any>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublishRide = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromCity.trim()) {
      setError('Please specify origin location where to leave');
      return;
    }
    if (!toCity.trim()) {
      setError('Please specify destination location where to drop');
      return;
    }
    if (fromCity.toLowerCase().trim() === toCity.toLowerCase().trim()) {
      setError('Origin and destination cannot be the same');
      return;
    }
    if (!departureTime.trim()) {
      setError('Please specify the time when to leave');
      return;
    }

    // RC Verification Check: user must have uploaded RC to give a ride!
    if (!store.canProvideRide()) {
      setShowRcModal(true);
      return;
    }

    setIsPublishing(true);
    setError('');

    try {
      const newRide = await store.createRide({
        fromCity: fromCity.trim(),
        toCity: toCity.trim(),
        pickupLocation: `${fromCity} (${pickupSpot})`,
        dropLocation: `${toCity} (${dropSpot})`,
        departureDate,
        departureTime,
        availableSeats,
        pricePerSeat,
        luggageCapacity,
        vehicleMakeModel: vehicleModel,
        vehicleRegNumber: user.rcNumber || ''
      });

      if (onUpdateParams) {
        onUpdateParams({
          fromCity,
          toCity,
          date: departureDate,
          passengers: availableSeats,
          luggage: Boolean(luggageCapacity.trim())
        });
      }

      setIsPublishing(false);
      setPublishedRideInfo(newRide);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Unable to publish ride');
      setIsPublishing(false);
    }
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-6 relative">
      <div>
        <TopBar
          title="Plan a Ride"
          onBack={() => onNavigate('home')}
          showMore={true}
        />

        <div className="px-5 pt-1 space-y-4">
          {/* Header banner explaining GIVING a ride */}
          <div className="p-3.5 rounded-2xl bg-neutral-900 text-white flex items-center justify-between shadow-md">
            <div>
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">
                Give a Ride Mode
              </span>
              <h3 className="text-sm font-bold text-white leading-tight">
                Offer Empty Seats on Your Route
              </h3>
              <p className="text-[11px] text-neutral-300 mt-0.5">
                Share fuel costs with verified co-passengers.
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
              <Car className="w-5 h-5 text-rose-400" />
            </div>
          </div>

          {/* RC Eligibility Status Banner */}
          {!canProvideRide ? (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold block">Vehicle RC Required to Give a Ride</span>
                  <button
                    type="button"
                    onClick={() => onNavigate('profile')}
                    className="text-[11px] font-bold text-amber-800 underline hover:text-amber-950"
                  >
                    Upload RC
                  </button>
                </div>
                <p className="text-[11px] text-amber-800/90 mt-0.5 leading-snug">
                  Without an uploaded RC, you can only take rides. Upload your Vehicle RC in Profile to unlock publishing rides.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">
                  RC Verified ({user.rcNumber || 'KA 05 MN 3291'}) • Eligible to Give Rides
                </span>
              </div>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>
          )}

          <form onSubmit={handlePublishRide} className="space-y-4">
            {/* 1. LOCATION WHERE TO LEAVE */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                1. Locations (Where to Leave & Drop)
              </span>

              {/* Leaving From */}
              <div
                onClick={() => setFocusedField('origin')}
                className={`p-3 rounded-2xl border-2 transition-all duration-200 bg-white space-y-1 cursor-pointer ${
                  focusedField === 'origin'
                    ? 'border-orange-500 ring-4 ring-orange-500/20 shadow-md'
                    : 'border-neutral-200 hover:border-orange-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">
                    Leaving From (Origin Location)
                  </span>
                </div>
                <input
                  type="text"
                  required
                  id="plan-ride-origin-input"
                  value={fromCity}
                  onFocus={() => setFocusedField('origin')}
                  onChange={(e) => {
                    setFromCity(e.target.value);
                    if (error) setError('');
                  }}
                  className="w-full text-sm font-bold text-black outline-hidden bg-transparent pl-6"
                  placeholder="e.g. Bangalore"
                />
                <input
                  type="text"
                  value={pickupSpot}
                  onFocus={() => setFocusedField('origin')}
                  onChange={(e) => setPickupSpot(e.target.value)}
                  className="w-full text-xs text-neutral-500 outline-hidden bg-transparent pl-6 border-t border-neutral-100 pt-1"
                  placeholder="Pickup Spot (e.g. Silk Board Metro)"
                />
              </div>

              {/* Where to Drop / Destination */}
              <div
                onClick={() => setFocusedField('destination')}
                className={`p-3 rounded-2xl border-2 transition-all duration-200 bg-white space-y-1 cursor-pointer ${
                  focusedField === 'destination'
                    ? 'border-orange-500 ring-4 ring-orange-500/20 shadow-md'
                    : 'border-neutral-200 hover:border-orange-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-neutral-400 shrink-0" />
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">
                    Where to Leave / Drop (Destination)
                  </span>
                </div>
                <input
                  type="text"
                  required
                  id="plan-ride-destination-input"
                  value={toCity}
                  onFocus={() => setFocusedField('destination')}
                  onChange={(e) => {
                    setToCity(e.target.value);
                    if (error) setError('');
                  }}
                  className="w-full text-sm font-bold text-neutral-900 outline-hidden bg-transparent pl-6"
                  placeholder="e.g. Mysore"
                />
                <input
                  type="text"
                  value={dropSpot}
                  onFocus={() => setFocusedField('destination')}
                  onChange={(e) => setDropSpot(e.target.value)}
                  className="w-full text-xs text-neutral-500 outline-hidden bg-transparent pl-6 border-t border-neutral-150 pt-1"
                  placeholder="Drop Spot (e.g. City Bus Stand)"
                />
              </div>

            </div>

            {/* 2. TIME WHEN TO LEAVE */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                2. Departure Date & Time (When to Leave)
              </span>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Date */}
                <div
                  onClick={() => setFocusedField('date')}
                  className={`p-3 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
                    focusedField === 'date'
                      ? 'border-orange-500 ring-4 ring-orange-500/20 shadow-md bg-white'
                      : 'border-neutral-200 bg-neutral-50/70 hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-neutral-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase">Date</span>
                  </div>
                  <input
                    type="date"
                    required
                    id="plan-ride-date-input"
                    value={departureDate}
                    onFocus={() => setFocusedField('date')}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full text-xs font-bold text-black bg-transparent outline-hidden"
                  />
                </div>

                {/* Time When to Leave */}
                <div
                  onClick={() => setFocusedField('time')}
                  className={`p-3 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
                    focusedField === 'time'
                      ? 'border-orange-500 ring-4 ring-orange-500/20 shadow-md bg-white'
                      : 'border-neutral-200 bg-neutral-50/70 hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-neutral-500">
                    <Clock className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-[10px] font-bold uppercase text-black">When to Leave</span>
                  </div>
                  <input
                    type="time"
                    required
                    id="plan-ride-time-input"
                    value={departureTime}
                    onFocus={() => setFocusedField('time')}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="w-full text-xs font-black text-black bg-transparent outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* 3. AVAILABLE SEATS TO GIVE */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                3. Available Seats & Pricing
              </span>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Available Seats Counter */}
                <div
                  onClick={() => setFocusedField('seats')}
                  className={`p-3 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between h-[95px] cursor-pointer ${
                    focusedField === 'seats'
                      ? 'border-orange-500 ring-4 ring-orange-500/20 shadow-md bg-white'
                      : 'border-neutral-200 bg-neutral-50/70 hover:border-orange-300'
                  }`}
                >
                  <span className="text-[10px] font-bold text-neutral-500 uppercase">
                    Available Seats
                  </span>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAvailableSeats(Math.max(1, availableSeats - 1));
                        setFocusedField('seats');
                      }}
                      className="w-8 h-8 rounded-xl bg-white border border-neutral-200 shadow-2xs flex items-center justify-center text-black font-bold active:scale-95 hover:border-orange-400"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="text-center">
                      <span className="text-xl font-black text-black block leading-none">
                        {availableSeats}
                      </span>
                      <span className="text-[9px] text-neutral-400 font-bold uppercase">
                        {availableSeats === 1 ? 'Seat' : 'Seats'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAvailableSeats(Math.min(6, availableSeats + 1));
                        setFocusedField('seats');
                      }}
                      className="w-8 h-8 rounded-xl bg-white border border-neutral-200 shadow-2xs flex items-center justify-center text-black font-bold active:scale-95 hover:border-orange-400"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Price Per Seat */}
                <div
                  onClick={() => setFocusedField('price')}
                  className={`p-3 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between h-[95px] cursor-pointer ${
                    focusedField === 'price'
                      ? 'border-orange-500 ring-4 ring-orange-500/20 shadow-md bg-white'
                      : 'border-neutral-200 bg-neutral-50/70 hover:border-orange-300'
                  }`}
                >
                  <span className="text-[10px] font-bold text-neutral-500 uppercase">
                    Price / Seat (₹)
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-black text-black">₹</span>
                    <input
                      type="number"
                      required
                      min={100}
                      max={5000}
                      step={50}
                      value={pricePerSeat}
                      onFocus={() => setFocusedField('price')}
                      onChange={(e) => setPricePerSeat(Number(e.target.value))}
                      className="w-full text-xl font-black text-black bg-transparent outline-hidden"
                    />
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold">
                    Est. Earn: ₹{availableSeats * pricePerSeat}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. VEHICLE TYPE: CAR OR BIKE ONLY */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                4. Vehicle (Car or Bike)
              </span>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setVehicleType('car');
                  }}
                  className={`p-3 rounded-2xl border-2 text-left flex items-center gap-2.5 transition-all duration-200 ${
                    vehicleType === 'car'
                      ? 'border-orange-500 ring-4 ring-orange-500/20 bg-orange-50/30 text-orange-950 shadow-xs'
                      : 'border-neutral-200 bg-white text-neutral-800 hover:border-orange-300'
                  }`}
                >
                  <Car className={`w-4 h-4 ${vehicleType === 'car' ? 'text-orange-600' : 'text-neutral-500'}`} />
                  <div>
                    <span className="text-xs font-bold block">Car</span>
                    <span className="text-[10px] opacity-75">Sedan / Hatch</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVehicleType('bike');
                    if (availableSeats > 1) setAvailableSeats(1);
                  }}
                  className={`p-3 rounded-2xl border-2 text-left flex items-center gap-2.5 transition-all duration-200 ${
                    vehicleType === 'bike'
                      ? 'border-orange-500 ring-4 ring-orange-500/20 bg-orange-50/30 text-orange-950 shadow-xs'
                      : 'border-neutral-200 bg-white text-neutral-800 hover:border-orange-300'
                  }`}
                >
                  <Bike className={`w-4 h-4 ${vehicleType === 'bike' ? 'text-orange-600' : 'text-neutral-500'}`} />
                  <div>
                    <span className="text-xs font-bold block">Bike</span>
                    <span className="text-[10px] opacity-75">1 Pillion Seat</span>
                  </div>
                </button>
              </div>
              <input
                type="text"
                required
                value={vehicleModel}
                onChange={(event) => setVehicleModel(event.target.value)}
                placeholder="Vehicle make and model"
                className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-hidden"
              />
              <input
                type="text"
                value={luggageCapacity}
                onChange={(event) => setLuggageCapacity(event.target.value)}
                placeholder="Luggage capacity"
                className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-hidden"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-600 font-semibold p-2 bg-rose-50 rounded-xl border border-rose-200">
                {error}
              </p>
            )}

            {/* 5. PRIMARY CTA: PUBLISH RIDE (Puts the ride at the find list) */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isPublishing}
                id="plan-trip-publish-button"
                className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-2xl text-base transition-all shadow-md shadow-orange-500/25 flex items-center justify-center gap-2"
              >
                {isPublishing ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Publishing Ride...
                  </span>
                ) : (
                  <>
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                    <span>Publish Ride</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-center text-neutral-500 mt-2">
                Clicking Publish Ride puts your ride live for passengers to find & book.
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* RC Required Modal */}
      {showRcModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-5 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-5 w-full max-w-[320px] shadow-2xl border border-neutral-100 text-center space-y-3"
          >
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-black">Vehicle RC Required to Give Rides</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              As per safety regulations, only vehicle owners with an uploaded Vehicle RC can give rides. Users without RC can only take rides.
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  setShowRcModal(false);
                  onNavigate('profile');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition-colors"
              >
                Go to Profile to Upload RC
              </button>
              <button
                onClick={() => setShowRcModal(false)}
                className="w-full py-2.5 px-4 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Ride Published Success Dialog */}
      {publishedRideInfo && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-5 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-5 w-full max-w-[330px] shadow-2xl border border-neutral-100 text-center space-y-3"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-bold text-black">Ride Published Successfully!</h3>
              <p className="text-xs text-neutral-500 mt-1">
                Your ride is now live for passengers to find & book.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200 text-left text-xs space-y-1">
              <div className="flex justify-between font-bold text-black">
                <span>{publishedRideInfo.fromCity} → {publishedRideInfo.toCity}</span>
                <span className="text-[#EF4444]">₹{publishedRideInfo.pricePerSeat}/seat</span>
              </div>
              <p className="text-neutral-500 text-[11px]">
                {publishedRideInfo.departureDate} at {publishedRideInfo.departureTime}
              </p>
              <p className="text-emerald-700 text-[11px] font-semibold">
                {publishedRideInfo.availableSeats} seats open • {publishedRideInfo.vehicleMakeModel}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setPublishedRideInfo(null);
                  onNavigate('available_rides');
                }}
                className="w-full py-3 px-4 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>View in Available Rides (Live)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setPublishedRideInfo(null);
                  onNavigate('driver_dashboard');
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-800 hover:bg-neutral-50"
              >
                Go to Driver Dashboard
              </button>

              <button
                onClick={() => {
                  setPublishedRideInfo(null);
                  onNavigate('home');
                }}
                className="w-full py-2 text-xs font-semibold text-neutral-500 hover:text-black"
              >
                Back to Home
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
