import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, Car, Briefcase, MapPin, Bell } from 'lucide-react';
import { AppScreen } from '../types';
import { store } from '../services/store';

interface HomeScreenProps {
  onNavigate: (screen: AppScreen) => void;
  onSelectRecentTrip?: (from: string, to: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, onSelectRecentTrip }) => {
  const [user, setUser] = useState(store.user);
  const [selectedService, setSelectedService] = useState<'ride' | 'luggage' | null>(null);
  const [unreadCount, setUnreadCount] = useState(store.notifications.filter((n) => !n.read).length);
  const [recentTrips, setRecentTrips] = useState(store.bookings.slice(0, 3));

  useEffect(() => {
    const update = () => {
      setUser({ ...store.user });
      setUnreadCount(store.notifications.filter((n) => !n.read).length);
      setRecentTrips(store.bookings.slice(0, 3));
    };
    return store.subscribe(update);
  }, []);

  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);

  const handleServiceClick = (service: 'ride' | 'luggage') => {
    setSelectedService(service);
    // Smooth micro-feedback allowing the animated orange border to illuminate before flow transition
    setTimeout(() => {
      if (service === 'ride') {
        onNavigate('city_ride');
      } else if (service === 'luggage') {
        onNavigate('luggage_transfer');
      }
    }, 150);
  };

  const handleRecentTrip = (from: string, to: string) => {
    const tripKey = `${from}-${to}`;
    setSelectedTrip(tripKey);
    setTimeout(() => {
      if (onSelectRecentTrip) {
        onSelectRecentTrip(from, to);
      }
      onNavigate('available_rides');
    }, 150);
  };

  return (
    <div className="w-full min-h-[720px] bg-white px-5 pt-3 pb-8 select-none">
      {/* Top Profile & Greeting Row */}
      <div className="flex items-center justify-between gap-2.5 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-neutral-500 text-xs font-medium">Good Morning,</span>
            {user.verificationStatus === 'verified' && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                Verified
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-black tracking-tight leading-tight truncate">
            {user.fullName}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Profile Avatar */}
          <button
            onClick={() => onNavigate('profile')}
            id="home-profile-button"
            className="relative active:scale-95 shrink-0"
            aria-label="View Profile"
            title="View Profile & Settings"
          >
            <img
              src={user.profilePhoto}
              alt={user.fullName}
              className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs ring-1 ring-neutral-200"
            />
            {user.verificationStatus === 'verified' && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Search Bar for Finding Available Rides */}
      <button
        onClick={() => onNavigate('city_ride')}
        id="home-search-button"
        className="w-full bg-neutral-50 hover:bg-white active:scale-[0.99] border border-neutral-200/80 hover:border-orange-400 hover:ring-4 hover:ring-orange-500/10 rounded-2xl px-4 py-3.5 flex items-center gap-3.5 shadow-2xs hover:shadow-sm transition-all duration-200 text-left mb-6 group cursor-pointer"
      >
        <div className="w-8 h-8 rounded-xl bg-orange-50 group-hover:bg-orange-500 flex items-center justify-center transition-all duration-200 shadow-2xs">
          <Search className="w-4 h-4 text-orange-600 group-hover:text-white stroke-[2.4] transition-colors" />
        </div>
        <div className="flex-1">
          <span className="text-neutral-800 text-sm font-semibold tracking-tight block">
            Where are you going?
          </span>
          <span className="text-neutral-400 text-xs">Search intercity rides & carpools...</span>
        </div>
      </button>

      {/* Our Services Section */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-lg font-bold text-black tracking-tight">
            Our Services
          </h2>
          <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">
            Explore All
          </span>
        </div>

        {/* 2x2 Services Grid */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* 1. Take a Ride (Car & Bike) */}
          <div
            onClick={() => handleServiceClick('ride')}
            id="service-take-a-ride"
            className={`p-4 rounded-2xl flex flex-col justify-between h-[130px] cursor-pointer transition-all duration-200 active:scale-[0.97] hover:-translate-y-0.5 ${
              selectedService === 'ride'
                ? 'bg-white border-2 border-orange-500 ring-4 ring-orange-500/20 shadow-md scale-[1.02]'
                : 'bg-neutral-50/90 border border-neutral-200/80 hover:border-orange-400 hover:bg-orange-50/15 hover:shadow-xs'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 shadow-2xs ${
              selectedService === 'ride'
                ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-sm shadow-orange-500/30'
                : 'bg-white text-neutral-800 border border-neutral-200/60'
            }`}>
              <Car className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-black tracking-tight leading-snug">
                Take a Ride
              </h3>
              <p className="text-[11px] text-neutral-500 mt-0.5">Car & bike rides</p>
            </div>
          </div>

          {/* 3. Luggage Transfer */}
          <div
            onClick={() => handleServiceClick('luggage')}
            className={`p-4 rounded-2xl flex flex-col justify-between h-[130px] cursor-pointer transition-all duration-200 active:scale-[0.97] hover:-translate-y-0.5 ${
              selectedService === 'luggage'
                ? 'bg-white border-2 border-orange-500 ring-4 ring-orange-500/20 shadow-md scale-[1.02]'
                : 'bg-neutral-50/90 border border-neutral-200/80 hover:border-orange-400 hover:bg-orange-50/15 hover:shadow-xs'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 shadow-2xs ${
              selectedService === 'luggage'
                ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-sm shadow-orange-500/30'
                : 'bg-white text-neutral-800 border border-neutral-200/60'
            }`}>
              <Briefcase className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-black tracking-tight leading-snug">
                Luggage Transfer
              </h3>
              <p className="text-[11px] text-neutral-500 mt-0.5">Door-to-door cargo</p>
            </div>
          </div>

        </div>
      </div>

      {/* Recent trips from the signed-in user's bookings */}
      <div>
        <h2 className="text-lg font-bold text-black tracking-tight mb-3.5">
          Recent Trips
        </h2>

        <div className="space-y-3">
          {recentTrips.length === 0 ? (
            <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-5 text-center text-xs text-neutral-500">
              Your booked trips will appear here.
            </p>
          ) : recentTrips.map((trip) => (
            <div
              key={trip.id}
              onClick={() => handleRecentTrip(trip.fromCity, trip.toCity)}
              className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between shadow-2xs active:scale-[0.98] hover:-translate-y-0.5 ${
                selectedTrip === `${trip.fromCity}-${trip.toCity}`
                  ? 'border-2 border-orange-500 ring-4 ring-orange-500/20 bg-orange-50/25 shadow-sm scale-[1.01]'
                  : 'border-neutral-200/90 bg-white hover:border-orange-400 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100/80 shadow-2xs">
                  <MapPin className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-black tracking-tight">
                    {trip.fromCity} → {trip.toCity}
                  </h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {trip.departureDate} · {trip.departureTime}
                  </p>
                </div>
              </div>
              <span className="text-base font-extrabold text-black">
                ₹{trip.amount.toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
