import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Clock,
  MapPin,
  Briefcase,
  Star,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  ThumbsUp,
  Award,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen, Ride, Review } from '../types';
import { store } from '../services/store';
import { CityRouteMap } from '../components/CityRouteMap';
import { fetchRoadRoute, RoadRoute } from '../lib/indiaRoute';
import { cleanCityName } from '../lib/cleanCityName';

interface RideDetailsScreenProps {
  ride: Ride;
  passengersCount: number;
  onNavigate: (screen: AppScreen) => void;
}

export const RideDetailsScreen: React.FC<RideDetailsScreenProps> = ({
  ride,
  passengersCount = 1,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'reviews'>('details');
  const [selectedFilter, setSelectedFilter] = useState<'all' | '5' | '4'>('all');
  const [roadRoute, setRoadRoute] = useState<RoadRoute | null>(null);
  const [routeError, setRouteError] = useState('');

  const allReviews: Review[] = ride.reviews || [];

  const filteredReviews = allReviews.filter((r) => {
    if (selectedFilter === '5') return r.rating === 5;
    if (selectedFilter === '4') return r.rating === 4;
    return true;
  });

  const ratingFiveCount = allReviews.filter((r) => r.rating === 5).length;
  const ratingFourCount = allReviews.filter((r) => r.rating === 4).length;
  const fivePercent = Math.round((ratingFiveCount / Math.max(1, allReviews.length)) * 100);
  const fourPercent = Math.round((ratingFourCount / Math.max(1, allReviews.length)) * 100);

  useEffect(() => {
    let cancelled = false;
    setRoadRoute(null);
    setRouteError('');
    void fetchRoadRoute(ride.fromCity, ride.toCity).then((route) => {
      if (!cancelled) setRoadRoute(route);
    }).catch((error) => {
      if (!cancelled) setRouteError(error instanceof Error ? error.message : 'Unable to load road map');
    });
    return () => { cancelled = true; };
  }, [ride.fromCity, ride.toCity]);

  return (
    <div className="w-full min-h-[720px] bg-neutral-50 flex flex-col justify-between select-none pb-24 relative">
      <div>
        {/* TopBar */}
        <TopBar
          title="Ride Details"
          onBack={() => onNavigate('available_rides')}
          showMore={true}
        />

        {/* Tab switch between Details and Ratings & Reviews */}
        <div className="px-5 pt-1 pb-2">
          <div className="grid grid-cols-2 bg-neutral-200/70 p-1 rounded-xl text-xs font-bold text-neutral-600">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-2 rounded-lg transition-all ${
                activeTab === 'details'
                  ? 'bg-white text-neutral-900 shadow-2xs font-extrabold'
                  : 'hover:text-black'
              }`}
            >
              Ride Overview
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'reviews'
                  ? 'bg-white text-orange-600 shadow-2xs font-extrabold'
                  : 'hover:text-black'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-current text-amber-500" />
              <span>Reliability & Reviews ({allReviews.length})</span>
            </button>
          </div>
        </div>

        <div className="px-5 space-y-4">
          {activeTab === 'details' ? (
            <>
              {roadRoute ? (
                <CityRouteMap route={roadRoute} pickup={`${ride.pickupLocation}, ${cleanCityName(ride.fromCity)}`} dropoff={`${ride.dropLocation}, ${cleanCityName(ride.toCity)}`} className="h-36" />
              ) : (
                <div role={routeError ? 'alert' : undefined} className="h-36 rounded-2xl border border-neutral-200 bg-neutral-100 flex items-center justify-center px-5 text-center text-xs text-neutral-600">
                  {routeError || 'Loading real road route…'}
                </div>
              )}

              {/* Driver Card with Reliability Score Pill and Direct Chat Action */}
              <div className="p-4 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="relative">
                      <img
                        src={ride.driverPhoto}
                        alt={ride.driverName}
                        className="w-13 h-13 rounded-full object-cover border-2 border-orange-500/20"
                      />
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] ring-2 ring-white">
                        ✓
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-extrabold text-black tracking-tight leading-tight">
                          {ride.driverName}
                        </h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                          ride.driverVerified
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : 'text-neutral-600 bg-neutral-50 border-neutral-200'
                        }`}>
                          {ride.driverVerified ? 'Verified' : 'Unverified'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-neutral-600 mt-1 font-medium">
                        <div className="flex items-center text-amber-500 font-bold bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/60">
                          <span>{ride.driverRating}</span>
                          <span className="ml-0.5">★</span>
                        </div>
                        <span className="text-neutral-400">•</span>
                        <span className="font-semibold text-neutral-700">{ride.driverTripsCount} verified trips</span>
                        <span className="text-neutral-400">•</span>
                        {/* Trust Score pill */}
                        <span className={`font-bold px-1.5 py-0.5 rounded-md border text-[10px] ${
                          (ride.driverTrustScore ?? 50) >= 80
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : (ride.driverTrustScore ?? 50) >= 55
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-rose-700 bg-rose-50 border-rose-200'
                        }`}>
                          🛡️ Trust {ride.driverTrustScore ?? 50}/100
                        </span>
                      </div>

                      <p className="text-xs text-neutral-500 mt-0.5">
                        {ride.vehicleMakeModel} • {ride.vehicleRegNumber}
                      </p>
                    </div>
                  </div>

                  <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>

                {/* Quick Driver Action Bar: Message Driver & View Reliability */}
                <div className="grid grid-cols-1 gap-2 pt-1 border-t border-neutral-100">
                  <button
                    onClick={() => setActiveTab('reviews')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs transition-colors"
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    <span>View Reliability</span>
                  </button>
                </div>
              </div>

              {/* 3 Stat Badges Row: Duration, Distance, Luggage */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-white rounded-2xl p-3 border border-neutral-200/80 shadow-2xs text-center">
                  <div className="flex justify-center text-orange-600 mb-1">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-black block leading-tight">
                    {ride.duration || '—'}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-medium">Duration</span>
                </div>

                <div className="bg-white rounded-2xl p-3 border border-neutral-200/80 shadow-2xs text-center">
                  <div className="flex justify-center text-orange-600 mb-1">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-black block leading-tight">
                    {ride.distance || '—'}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-medium">Distance</span>
                </div>

                <div className="bg-white rounded-2xl p-3 border border-neutral-200/80 shadow-2xs text-center">
                  <div className="flex justify-center text-orange-600 mb-1">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-black block leading-tight">
                    {ride.luggageCapacity || '—'}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-medium">Luggage</span>
                </div>
              </div>

              {/* Route Stops Timeline */}
              <div className="p-4 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs">
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                  Route & Timings
                </h4>

                <div className="space-y-4 relative">
                  <div className="absolute top-2 left-2 bottom-3 w-0.5 bg-neutral-200" />

                  <div className="flex items-start gap-3 relative z-10">
                    <div className="w-4 h-4 rounded-full bg-black ring-4 ring-white shrink-0 mt-0.5" />
                    <div className="flex-1 flex items-start justify-between">
                      <div>
                        <h5 className="text-sm font-bold text-black">
                          {ride.pickupLocation}
                        </h5>
                        <p className="text-xs text-neutral-500">{cleanCityName(ride.fromCity)}</p>
                      </div>
                      <span className="text-xs font-bold text-black">
                        {ride.departureTime}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 relative z-10">
                    <div className="w-4 h-4 rounded-full bg-[#EF4444] ring-4 ring-white shrink-0 mt-0.5" />
                    <div className="flex-1 flex items-start justify-between">
                      <div>
                        <h5 className="text-sm font-bold text-black">
                          {ride.dropLocation}
                        </h5>
                        <p className="text-xs text-neutral-500">{cleanCityName(ride.toCity)}</p>
                      </div>
                      <span className="text-xs font-bold text-black">
                        {ride.estimatedArrivalTime || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {/* Review summaries are shown only after a trip is completed and a booking is rated. */}
          {activeTab === 'reviews' && (
            <div className="p-4 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Star className="w-5 h-5 fill-current" />
              </div>
              <h4 className="text-sm font-extrabold text-neutral-900">Reviews unlock after trip completion</h4>
              <p className="mt-1 text-xs text-neutral-500">
                Passengers can rate and review the driver only after booking and completing the ride.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-neutral-200 px-6 py-3.5 flex items-center justify-between z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div>
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
            TOTAL PRICE ({passengersCount} {passengersCount > 1 ? 'SEATS' : 'SEAT'})
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-black">
              ₹{ride.pricePerSeat * passengersCount}
            </span>
            <span className="text-xs text-neutral-500">/ ₹{ride.pricePerSeat} each</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('select_seat')}
            id="ride-details-continue-button"
            className="bg-black hover:bg-neutral-800 active:scale-[0.98] text-white font-bold py-3 px-6 rounded-xl text-sm transition-all shadow-md flex items-center gap-1.5"
          >
            <span>Get the Ride</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};
