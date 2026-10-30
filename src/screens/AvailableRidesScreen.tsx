import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Clock, ChevronDown, MapPin, Navigation, Star } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen, Ride } from '../types';
import { store } from '../services/store';
import { auth } from '../lib/firebase';
import { cleanCityName } from '../lib/cleanCityName';
import { ALL_PREFS } from './CityRideScreen';

// ─── Smart Match Score ────────────────────────────────────────────────────────
// Produces a 0–100 score for how well a ride matches a passenger.
// Components:
//   Rating      (0–5)  → up to 30 pts
//   Experience  (trips)→ up to 25 pts   (capped at 50 trips)
//   Preferences        → up to 30 pts   (how many pax prefs the ride satisfies)
//   Verified           →      10 pts    (binary)
//   Has experience     →       5 pts    (any trips at all)
function computeMatchScore(ride: Ride, passengerPrefs: string[]): number {
  const ratingPts     = ((ride.driverRating || 0) / 5) * 30;
  const tripsPts      = (Math.min(ride.driverTripsCount || 0, 50) / 50) * 25;
  const verifiedPts   = ride.driverVerified ? 10 : 0;
  const hasTrips      = (ride.driverTripsCount || 0) > 0 ? 5 : 0;

  let prefPts = 0;
  if (passengerPrefs.length > 0) {
    const ridePrefs = ride.ridePreferences ?? [];
    const matched = passengerPrefs.filter(p => ridePrefs.includes(p)).length;
    prefPts = (matched / passengerPrefs.length) * 30;
  } else {
    // no passenger prefs selected → give full preference points (neutral)
    prefPts = 30;
  }

  return Math.round(ratingPts + tripsPts + verifiedPts + hasTrips + prefPts);
}

// Score colour band
function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-300';
  if (score >= 55) return 'text-amber-700 bg-amber-50 border-amber-300';
  return 'text-rose-700 bg-rose-50 border-rose-300';
}
function scoreLabel(score: number): string {
  if (score >= 80) return 'Great match';
  if (score >= 55) return 'Good match';
  return 'Low match';
}

interface AvailableRidesScreenProps {
  onNavigate: (screen: AppScreen) => void;
  tripParams: {
    fromCity: string;
    toCity: string;
    date: string;
    passengers: number;
    luggage: boolean;
    fromLat?: number | null;
    fromLon?: number | null;
    toLat?: number | null;
    toLon?: number | null;
    passengerPrefs?: string[];
  };
  onSelectRide: (ride: Ride) => void;
}

export const AvailableRidesScreen: React.FC<AvailableRidesScreenProps> = ({
  onNavigate,
  tripParams,
  onSelectRide
}) => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [activeFilter, setActiveFilter] = useState<'match' | 'departure' | 'seats' | 'price'>('match');
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const currentUserId = auth?.currentUser?.uid;
  const passengerPrefs = tripParams.passengerPrefs ?? [];

  const hasCoords = typeof tripParams.fromLat === 'number' && isFinite(tripParams.fromLat) &&
                    typeof tripParams.fromLon === 'number' && isFinite(tripParams.fromLon) &&
                    typeof tripParams.toLat   === 'number' && isFinite(tripParams.toLat)   &&
                    typeof tripParams.toLon   === 'number' && isFinite(tripParams.toLon);

  useEffect(() => {
    let cancelled = false;
    const loadRides = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        let fetched: Ride[];
        if (hasCoords) {
          fetched = await store.fetchRidesByRoute({
            fromCity: tripParams.fromCity,
            toCity:   tripParams.toCity,
            date:     tripParams.date,
            seats:    tripParams.passengers,
            fromLat:  tripParams.fromLat,
            fromLon:  tripParams.fromLon,
            toLat:    tripParams.toLat,
            toLon:    tripParams.toLon,
          });
        } else {
          fetched = await store.fetchAvailableRides({
            fromCity: tripParams.fromCity,
            toCity:   tripParams.toCity,
            date:     tripParams.date,
          });
        }
        if (!cancelled) setRides(fetched);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load rides from the database');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void loadRides();
    return () => { cancelled = true; };
  }, [tripParams.fromCity, tripParams.toCity, tripParams.date, tripParams.fromLat, tripParams.fromLon, tripParams.toLat, tripParams.toLon, hasCoords]);

  const matchedRides = useMemo(() => {
    const minSeats = tripParams.passengers || 1;
    let filtered = rides.filter(r =>
      r.status === 'UPCOMING' && r.availableSeats >= minSeats && r.driverId
    );

    if (!hasCoords) {
      const fromQ = tripParams.fromCity.toLowerCase().trim();
      const toQ   = tripParams.toCity.toLowerCase().trim();
      const dateQ = String(tripParams.date || '').trim().slice(0, 10);
      const dateKey = (v: string) => {
        const iso = v.match(/^(\d{4}-\d{2}-\d{2})/);
        if (iso) return iso[1];
        const p = Date.parse(v);
        if (isNaN(p)) return v.toLowerCase();
        const d = new Date(p);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      };
      const cityMatch = (val: string, q: string) => {
        const c = val.toLowerCase().trim();
        return !q || c === q || c.includes(q) || q.includes(c);
      };
      filtered = filtered.filter(r =>
        cityMatch(r.fromCity, fromQ) && cityMatch(r.toCity, toQ) &&
        (!dateQ || dateKey(r.departureDate) === dateKey(dateQ))
      );
    }

    // Attach match score to every ride
    const withScores = filtered.map(r => ({ ...r, matchScore: computeMatchScore(r, passengerPrefs) }));

    if (activeFilter === 'match') {
      withScores.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
    } else if (activeFilter === 'departure') {
      withScores.sort((a, b) => {
        const aType = a.segmentMatch?.matchType ?? 'exact';
        const bType = b.segmentMatch?.matchType ?? 'exact';
        const tp: Record<string, number> = { exact: 0, 'partial-origin': 1, 'partial-destination': 1, intermediate: 2 };
        return (tp[aType] ?? 3) - (tp[bType] ?? 3) || a.departureTime.localeCompare(b.departureTime);
      });
    } else if (activeFilter === 'seats') {
      withScores.sort((a, b) => b.availableSeats - a.availableSeats);
    } else {
      withScores.sort((a, b) => {
        const fa = a.segmentMatch?.segmentFare ?? a.pricePerSeat;
        const fb = b.segmentMatch?.segmentFare ?? b.pricePerSeat;
        return fa - fb;
      });
    }

    return withScores;
  }, [rides, tripParams, activeFilter, hasCoords, passengerPrefs]);

  const handleRideClick = (ride: Ride) => {
    setSelectedRideId(ride.id);
    setTimeout(() => { onSelectRide(ride); onNavigate('ride_details'); }, 150);
  };

  const matchLabel = (type: string) => {
    if (type === 'partial-origin') return 'Drop off early';
    if (type === 'partial-destination') return 'Join en route';
    if (type === 'intermediate') return 'Intermediate stop';
    return null;
  };
  const matchColor = (type: string) => {
    if (type === 'intermediate') return 'bg-violet-50 text-violet-700 border-violet-200';
    if (type === 'partial-origin') return 'bg-sky-50 text-sky-700 border-sky-200';
    if (type === 'partial-destination') return 'bg-amber-50 text-amber-700 border-amber-200';
    return '';
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col select-none pb-8">
      <TopBar
        title="Available Rides"
        onBack={() => onNavigate(tripParams.luggage ? 'luggage_transfer' : 'city_ride')}
        showMore={true}
      />

      {/* Route overview */}
      <div className="px-5 py-3 border-b border-neutral-150 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-black tracking-tight leading-tight">
            {tripParams.fromCity || 'Origin'} → {tripParams.toCity || 'Destination'}
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {tripParams.date || 'Any date'} • {tripParams.passengers} {tripParams.passengers === 1 ? 'Passenger' : 'Passengers'}
            {passengerPrefs.length > 0 && (
              <span className="ml-1 text-violet-600 font-semibold">· {passengerPrefs.length} pref{passengerPrefs.length > 1 ? 's' : ''} active</span>
            )}
          </p>
        </div>
        <button
          onClick={() => onNavigate(tripParams.luggage ? 'luggage_transfer' : 'city_ride')}
          className="border border-neutral-300 hover:border-black rounded-lg px-3 py-1 text-xs font-semibold text-neutral-800 transition-colors"
        >
          Edit
        </button>
      </div>

      {/* Filter badges */}
      <div className="px-5 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {(['match', 'departure', 'seats', 'price'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 shrink-0 transition-all active:scale-95 ${
              activeFilter === f
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white border-2 border-orange-600 font-bold'
                : 'border border-neutral-300 text-neutral-700 bg-white hover:border-orange-300'
            }`}
          >
            {f === 'match' && <Star className="w-3 h-3" />}
            <span>{f === 'match' ? 'Best Match' : f === 'departure' ? 'Departure' : f === 'seats' ? 'Seats' : 'Lowest Fare'}</span>
          </button>
        ))}
      </div>

      {/* Rides list */}
      <div className="px-5 pt-1 space-y-3.5 pb-6">
        {isLoading && (
          <p className="text-center py-10 text-sm font-semibold text-neutral-600">Finding best matched rides…</p>
        )}
        {loadError && !isLoading && (
          <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</p>
        )}
        {!isLoading && !loadError && matchedRides.length === 0 && (
          <div className="text-center py-12 px-4 bg-neutral-50 rounded-2xl border border-neutral-200">
            <p className="text-sm font-semibold text-neutral-700">No rides found</p>
            <p className="text-xs text-neutral-500 mt-1">Try a different date or adjust your route.</p>
            <button onClick={() => onNavigate('city_ride')} className="mt-3 px-4 py-1.5 bg-black text-white text-xs font-semibold rounded-lg">Modify Search</button>
          </div>
        )}

        {!isLoading && !loadError && matchedRides.map((ride, index) => {
          const isOwnRide = ride.driverId === currentUserId;
          const seg = ride.segmentMatch;
          const segBadge = seg ? matchLabel(seg.matchType) : null;
          const segBadgeClass = seg ? matchColor(seg.matchType) : '';
          const displayFare = seg ? seg.segmentFare : ride.pricePerSeat * (tripParams.passengers || 1);
          const isIntermediate = seg && seg.matchType !== 'exact';
          const score = ride.matchScore ?? 0;
          const ridePrefs = ride.ridePreferences ?? [];

          return (
            <motion.div
              key={ride.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04, ease: 'easeOut' }}
              onClick={() => { if (!isOwnRide) handleRideClick(ride); }}
              aria-disabled={isOwnRide}
              className={`p-4 rounded-2xl border-2 transition-all duration-200 group ${
                isOwnRide
                  ? 'cursor-not-allowed border-neutral-200 bg-neutral-50 opacity-80'
                  : 'cursor-pointer active:scale-[0.98] hover:-translate-y-0.5'
              } ${
                selectedRideId === ride.id
                  ? 'border-orange-500 ring-4 ring-orange-500/20 bg-orange-50/20 shadow-md'
                  : 'border-neutral-200/90 bg-white shadow-2xs hover:border-orange-400 hover:shadow-sm'
              }`}
            >
              {/* Top row: score + segment badge */}
              <div className="flex items-center gap-2 mb-2.5">
                {/* Smart match score pill */}
                <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full border ${scoreColor(score)}`}>
                  <Star className="w-2.5 h-2.5 fill-current" />
                  {score}/100 · {scoreLabel(score)}
                </span>
                {segBadge && (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${segBadgeClass}`}>
                    <Navigation className="w-2.5 h-2.5" />{segBadge}
                  </span>
                )}
              </div>

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {ride.driverPhoto ? (
                      <img src={ride.driverPhoto} alt={ride.driverName} className="w-11 h-11 rounded-full object-cover border border-neutral-200" />
                    ) : (
                      <div className="w-11 h-11 rounded-full border border-neutral-200 bg-neutral-100 text-neutral-700 flex items-center justify-center text-sm font-bold">
                        {(ride.driverName || 'D').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold text-black tracking-tight leading-tight group-hover:text-orange-600 transition-colors">
                      {ride.driverName}
                    </h3>
                    <p className="text-[11px] font-semibold text-neutral-500 mt-0.5">
                      {cleanCityName(ride.fromCity)} → {cleanCityName(ride.toCity)}
                    </p>
                    {isIntermediate && (
                      <p className="text-[11px] font-bold text-orange-600 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        Your trip: {tripParams.fromCity} → {tripParams.toCity}
                        {seg && seg.segmentDistanceKm > 0 && <span className="text-neutral-400 font-normal ml-1">({seg.segmentDistanceKm.toFixed(0)} km)</span>}
                      </p>
                    )}
                    <div className="flex items-center gap-1 text-xs text-neutral-600 mt-0.5 font-medium">
                      <span className="text-amber-500">★</span>
                      <span className="text-neutral-800 font-bold">{ride.driverRating > 0 ? ride.driverRating.toFixed(1) : '—'}</span>
                      <span className="text-neutral-400">·</span>
                      <span className="text-neutral-500">{ride.driverTripsCount || 0} trips</span>
                      <span className="text-neutral-400">·</span>
                      <span className="text-neutral-500 truncate max-w-[100px]">{ride.vehicleMakeModel}</span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {ride.departureDate} • {ride.departureTime}
                      {seg?.estimatedPickupTime && isIntermediate && (
                        <> · <span className="text-orange-600 font-semibold">~{new Date(seg.estimatedPickupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></>
                      )}
                    </p>
                    {/* Verified badge */}
                    {ride.driverVerified && (
                      <span className="mt-1 inline-flex text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border text-emerald-700 bg-emerald-50 border-emerald-200">
                        Verified
                      </span>
                    )}
                    {isOwnRide && (
                      <span className="mt-1 inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        Your ride
                      </span>
                    )}
                  </div>
                </div>

                {/* Fare */}
                <div className="text-right shrink-0 ml-2">
                  <span className="text-lg font-extrabold text-black block">₹{displayFare.toFixed(0)}</span>
                  {isIntermediate
                    ? <span className="text-[10px] text-orange-600 font-semibold">segment fare</span>
                    : <span className="text-[10px] text-neutral-400">{tripParams.passengers > 1 ? `${tripParams.passengers} seats` : 'per seat'}</span>
                  }
                </div>
              </div>

              {/* Preference tags row — show matched ones green, others neutral */}
              {ridePrefs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-neutral-100">
                  {ALL_PREFS.filter(p => ridePrefs.includes(p.id)).map(pref => {
                    const passengerWants = passengerPrefs.includes(pref.id);
                    return (
                      <span
                        key={pref.id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          passengerWants
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-neutral-50 text-neutral-600 border-neutral-200'
                        }`}
                      >
                        {pref.emoji} {pref.label}
                        {passengerWants && <span className="text-emerald-600">✓</span>}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-neutral-150 my-2.5" />

              {/* Bottom row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span>{ride.departureTime}</span>
                  {ride.distance && <span className="text-neutral-400 font-normal">· {ride.distance}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-orange-50 text-orange-600 border border-orange-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
                    {ride.availableSeats} seat{ride.availableSeats !== 1 ? 's' : ''} left
                  </div>
                  <span className={`text-xs font-bold text-white px-3 py-1 rounded-lg transition-colors ${
                    isOwnRide ? 'bg-neutral-400' : 'bg-black group-hover:bg-orange-600'
                  }`}>
                    {isOwnRide ? 'Your listing' : 'Book'}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
