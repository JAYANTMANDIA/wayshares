import React, { useState } from 'react';
import { Search, LoaderCircle } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { IndianCityAutocomplete, INDIAN_CITIES } from '../components/IndianCityAutocomplete';
import { AppScreen } from '../types';

interface CityRideScreenProps {
  onNavigate: (screen: AppScreen) => void;
  onSearchRides: (params: {
    fromCity: string;
    toCity: string;
    date: string;
    passengers: number;
    luggage: boolean;
  }) => void;
}

export const CityRideScreen: React.FC<CityRideScreenProps> = ({ onNavigate, onSearchRides }) => {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleFindRides = () => {
    const pickupCity = INDIAN_CITIES.find((city) => city.name.toLocaleLowerCase('en-IN') === pickup.trim().toLocaleLowerCase('en-IN'));
    const dropoffCity = INDIAN_CITIES.find((city) => city.name.toLocaleLowerCase('en-IN') === dropoff.trim().toLocaleLowerCase('en-IN'));
    if (!pickupCity || !dropoffCity) {
      setError('Choose both cities from the suggestions.');
      return;
    }
    if (pickupCity.name === dropoffCity.name) {
      setError('Pickup and dropoff cities must be different.');
      return;
    }
    if (!travelDate) {
      setError('Choose a travel date.');
      return;
    }

    setError('');
    setIsSearching(true);
    onSearchRides({
      fromCity: pickupCity.name,
      toCity: dropoffCity.name,
      date: travelDate,
      passengers,
      luggage: false
    });
    onNavigate('available_rides');
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col select-none pb-6">
      <TopBar title="Take a Ride" onBack={() => onNavigate('home')} showMore={false} />

      <div className="px-5 pt-1 pb-6 space-y-3.5">
        <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2.5">
          <IndianCityAutocomplete
            id="take-ride-pickup-city"
            label="Pickup city"
            value={pickup}
            onChange={(value) => {
              setPickup(value);
              setError('');
            }}
          />
          <IndianCityAutocomplete
            id="take-ride-dropoff-city"
            label="Dropoff city"
            value={dropoff}
            onChange={(value) => {
              setDropoff(value);
              setError('');
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[10px] font-bold uppercase text-neutral-500">
              Travel date
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={travelDate}
                onChange={(event) => setTravelDate(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-xs font-semibold text-neutral-900"
              />
            </label>
            <label className="block text-[10px] font-bold uppercase text-neutral-500">
              Passengers
              <input
                type="number"
                min={1}
                max={8}
                value={passengers}
                onChange={(event) => setPassengers(Math.max(1, Math.min(8, Number(event.target.value) || 1)))}
                className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-xs font-semibold text-neutral-900"
              />
            </label>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        )}

        <p className="text-xs text-neutral-500">
          Results are rides published by drivers in the database. No sample listings are shown.
        </p>

        <button
          type="button"
          disabled={isSearching}
          onClick={handleFindRides}
          className="w-full rounded-xl bg-black px-4 py-3.5 text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {isSearching ? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Finding driver rides…
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Search className="h-4 w-4" /> Find driver rides
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
