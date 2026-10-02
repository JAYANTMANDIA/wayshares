import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Clock, ChevronDown } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen, Ride } from '../types';
import { store } from '../services/store';

interface AvailableRidesScreenProps {
  onNavigate: (screen: AppScreen) => void;
  tripParams: {
    fromCity: string;
    toCity: string;
    date: string;
    passengers: number;
    luggage: boolean;
  };
  onSelectRide: (ride: Ride) => void;
}

export const AvailableRidesScreen: React.FC<AvailableRidesScreenProps> = ({
  onNavigate,
  tripParams,
  onSelectRide
}) => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [activeFilter, setActiveFilter] = useState<'departure' | 'seats' | 'luggage'>('departure');
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadRides = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const fetched = await store.fetchAvailableRides({
          fromCity: tripParams.fromCity,
          toCity: tripParams.toCity,
          date: tripParams.date
        });
        if (!cancelled) setRides(fetched);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load rides from the database');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void loadRides();
    return () => {
      cancelled = true;
    };
  }, [tripParams.fromCity, tripParams.toCity, tripParams.date]);

  const matchedRides = useMemo(() => {
    const fromQ = tripParams.fromCity.toLowerCase().trim();
    const toQ = tripParams.toCity.toLowerCase().trim();
    const dateQ = String(tripParams.date || '').trim().slice(0, 10);
    const minSeats = tripParams.passengers || 1;
    const dateKey = (value: string) => {
      const raw = String(value || '').trim();
      const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      if (iso) return iso[1];
      const parsed = Date.parse(raw);
      if (Number.isNaN(parsed)) return raw.toLowerCase();
      const d = new Date(parsed);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const cityMatch = (value: string, query: string) => {
      const city = value.toLowerCase().trim();
      return !query || city === query || city.includes(query) || query.includes(city);
    };

    const filtered = rides.filter((r) => r.status === 'UPCOMING' && r.availableSeats >= minSeats && r.driverId && cityMatch(r.fromCity, fromQ) && cityMatch(r.toCity, toQ) && (!dateQ || dateKey(r.departureDate) === dateKey(dateQ)));

    // Sort according to active filter
    if (activeFilter === 'departure') {
      filtered.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    } else if (activeFilter === 'seats') {
      filtered.sort((a, b) => b.availableSeats - a.availableSeats);
    } else if (activeFilter === 'luggage') {
      filtered.sort((a, b) => a.pricePerSeat - b.pricePerSeat);
    }

    return filtered;
  }, [rides, tripParams, activeFilter]);

  const handleRideClick = (ride: Ride) => {
    setSelectedRideId(ride.id);
    setTimeout(() => {
      onSelectRide(ride);
      onNavigate('ride_details');
    }, 150);
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col select-none pb-8">
      {/* TopBar matching Screenshot 6 */}
      <TopBar
        title="Available Rides"
        onBack={() => onNavigate(tripParams.luggage ? 'luggage_transfer' : 'city_ride')}
        showMore={true}
      />

      {/* Route & Passenger Overview Bar matching Screenshot 6 */}
      <div className="px-5 py-3 border-b border-neutral-150 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-black tracking-tight leading-tight">
            {tripParams.fromCity || 'Origin'} → {tripParams.toCity || 'Destination'}
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {tripParams.date || 'Date not selected'} • {tripParams.passengers} {tripParams.passengers === 1 ? 'Passenger' : 'Passengers'}
          </p>
        </div>

        <button
          onClick={() => onNavigate(tripParams.luggage ? 'luggage_transfer' : 'city_ride')}
          className="border border-neutral-300 hover:border-black rounded-lg px-3 py-1 text-xs font-semibold text-neutral-800 transition-colors"
        >
          Edit
        </button>
      </div>

      {/* Filter Badges matching Screenshot 6 */}
      <div className="px-5 py-3 flex items-center gap-2.5 overflow-x-auto no-scrollbar">
        {/* Departure Time */}
        <button
          onClick={() => setActiveFilter('departure')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 shrink-0 active:scale-95 ${
            activeFilter === 'departure'
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-xs border-2 border-orange-600 font-bold'
              : 'border border-neutral-300 text-neutral-700 bg-white hover:border-orange-300'
          }`}
        >
          <span>Departure Time</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Seats Available */}
        <button
          onClick={() => setActiveFilter('seats')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 shrink-0 active:scale-95 ${
            activeFilter === 'seats'
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-xs border-2 border-orange-600 font-bold'
              : 'border border-neutral-300 text-neutral-700 bg-white hover:border-orange-300'
          }`}
        >
          <span>Seats Available</span>
        </button>

        {/* Luggage Capacity */}
        <button
          onClick={() => setActiveFilter('luggage')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 shrink-0 active:scale-95 ${
            activeFilter === 'luggage'
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-xs border-2 border-orange-600 font-bold'
              : 'border border-neutral-300 text-neutral-700 bg-white hover:border-orange-300'
          }`}
        >
          <span>Luggage Capacity</span>
        </button>
      </div>

      {/* Rides List matching Screenshot 6 */}
      <div className="px-5 pt-1 space-y-3.5 pb-6">
        {isLoading && (
          <p className="text-center py-10 text-sm font-semibold text-neutral-600">Loading rides from the database…</p>
        )}
        {loadError && !isLoading && (
          <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</p>
        )}
        {!isLoading && !loadError && matchedRides.length === 0 ? (
          <div className="text-center py-12 px-4 bg-neutral-50 rounded-2xl border border-neutral-200">
            <p className="text-sm font-semibold text-neutral-700">No rides for this date and route</p>
            <p className="text-xs text-neutral-500 mt-1">Only live driver listings from the database for {tripParams.date || 'the selected date'} on this route are shown.</p>
            <button
              onClick={() => onNavigate('plan_trip')}
              className="mt-3 px-4 py-1.5 bg-black hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg active:scale-95 transition-all shadow-xs"
            >
              Modify Search
            </button>
          </div>
        ) : !isLoading && !loadError ? (
          matchedRides.map((ride, index) => (
            <motion.div
              key={ride.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.05, ease: 'easeOut' }}
              onClick={() => handleRideClick(ride)}
              className={`p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer active:scale-[0.98] group hover:-translate-y-0.5 ${
                selectedRideId === ride.id
                  ? 'border-orange-500 ring-4 ring-orange-500/20 bg-orange-50/20 shadow-md scale-[1.01]'
                  : 'border-neutral-200/90 bg-white shadow-2xs hover:border-orange-400 hover:shadow-sm'
              }`}
            >
              {/* Top row: Driver avatar, name, rating, vehicle & price */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {ride.driverPhoto ? (
                      <img
                        src={ride.driverPhoto}
                        alt={ride.driverName}
                        className="w-11 h-11 rounded-full object-cover border border-neutral-200"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full border border-neutral-200 bg-neutral-100 text-neutral-700 flex items-center justify-center text-sm font-bold">
                        {(ride.driverName || 'D').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-black tracking-tight leading-tight group-hover:text-orange-600 transition-colors">
                      {ride.driverName}
                    </h3>
                    <p className="text-[11px] font-semibold text-neutral-500 mt-0.5">
                      {ride.fromCity} → {ride.toCity}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-neutral-600 mt-0.5 font-medium">
                      <span className="text-amber-500">★</span>
                      <span className="text-neutral-800 font-bold">{ride.driverRating || '—'}</span>
                      <span className="text-neutral-400">•</span>
                      <span className="text-neutral-500 truncate max-w-[130px]">{ride.vehicleMakeModel}</span>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="text-right">
                  <span className="text-lg font-extrabold text-black block">
                    ₹{ride.pricePerSeat}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-medium">per seat</span>
                </div>
              </div>

              {/* Subtle divider line */}
              <div className="border-t border-neutral-150 my-3" />

              {/* Bottom row: Departure time and Get the Ride CTA */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span>Departs {ride.departureTime}</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="bg-orange-50 text-orange-600 border border-orange-200 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-2xs">
                    {ride.availableSeats} {ride.availableSeats === 1 ? 'seat' : 'seats'} left
                  </div>
                  <span className="text-xs font-bold text-white bg-black group-hover:bg-orange-600 px-3 py-1 rounded-lg shadow-2xs transition-colors">
                    Get the Ride
                  </span>
                </div>
              </div>
            </motion.div>
          ))
        ) : null}
      </div>
    </div>
  );
};
