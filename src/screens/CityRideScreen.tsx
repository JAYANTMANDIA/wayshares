import React, { useState } from 'react';
import { Search, LoaderCircle } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { LocationAutocomplete, type LocationSuggestion } from '../components/LocationAutocomplete';
import { AppScreen } from '../types';

// Shared preference definitions (same IDs as CreateRideScreen)
export const ALL_PREFS = [
  { id: 'no_smoking',     emoji: '🚭', label: 'No Smoking' },
  { id: 'ac',             emoji: '❄️',  label: 'AC' },
  { id: 'no_audio',       emoji: '🔇', label: 'No Loud Audio' },
  { id: 'eating_allowed', emoji: '🍱', label: 'Eating Allowed' },
  { id: 'pets_allowed',   emoji: '🐾', label: 'Pets Allowed' },
];

interface CityRideScreenProps {
  onNavigate: (screen: AppScreen) => void;
  onSearchRides: (params: {
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
  }) => void;
}

export const CityRideScreen: React.FC<CityRideScreenProps> = ({ onNavigate, onSearchRides }) => {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [selectedPickup, setSelectedPickup] = useState<LocationSuggestion | null>(null);
  const [selectedDropoff, setSelectedDropoff] = useState<LocationSuggestion | null>(null);
  const [travelDate, setTravelDate] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [passengerPrefs, setPassengerPrefs] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleFindRides = () => {
    if (!selectedPickup) { setError('Choose a pickup location from the suggestions.'); return; }
    if (!selectedDropoff) { setError('Choose a dropoff location from the suggestions.'); return; }
    if (selectedPickup.id === selectedDropoff.id) { setError('Pickup and dropoff locations must be different.'); return; }
    if (!travelDate) { setError('Choose a travel date.'); return; }
    setError('');
    setIsSearching(true);
    onSearchRides({
      fromCity: pickup.trim(),
      toCity: dropoff.trim(),
      date: travelDate,
      passengers,
      luggage: false,
      fromLat: selectedPickup.lat ?? null,
      fromLon: selectedPickup.lon ?? null,
      toLat: selectedDropoff.lat ?? null,
      toLon: selectedDropoff.lon ?? null,
      passengerPrefs,
    });
    onNavigate('available_rides');
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col select-none pb-6">
      <TopBar title="Take a Ride" onBack={() => onNavigate('home')} showMore={false} />

      <div className="px-5 pt-3 pb-8 space-y-5">
        <div className="p-5 rounded-3xl bg-neutral-50 border border-neutral-200 space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
            <LocationAutocomplete
              id="take-ride-pickup-city"
              label="Pickup city"
              size="lg"
              value={pickup}
              onChange={(value) => { setPickup(value); setSelectedPickup(null); setError(''); }}
              onSelectLocation={(loc) => { setPickup(loc.cityName); setSelectedPickup(loc); setError(''); }}
            />
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
            <LocationAutocomplete
              id="take-ride-dropoff-city"
              label="Dropoff city"
              size="lg"
              value={dropoff}
              onChange={(value) => { setDropoff(value); setSelectedDropoff(null); setError(''); }}
              onSelectLocation={(loc) => { setDropoff(loc.cityName); setSelectedDropoff(loc); setError(''); }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold uppercase tracking-wide text-neutral-500">
              Travel date
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={travelDate}
                onChange={(event) => setTravelDate(event.target.value)}
                className="mt-1.5 block w-full min-h-12 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-base font-semibold text-neutral-900"
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wide text-neutral-500">
              Passengers
              <input
                type="number"
                min={1}
                max={8}
                value={passengers}
                onChange={(event) => setPassengers(Math.max(1, Math.min(8, Number(event.target.value) || 1)))}
                className="mt-1.5 block w-full min-h-12 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-base font-semibold text-neutral-900"
              />
            </label>
          </div>

          {/* Passenger preference filter */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-2">Your ride preferences (optional)</p>
            <p className="text-[11px] text-neutral-400 mb-2">Rides matching more of your preferences rank higher.</p>
            <div className="flex flex-wrap gap-2">
              {ALL_PREFS.map((pref) => {
                const active = passengerPrefs.includes(pref.id);
                return (
                  <button
                    key={pref.id}
                    type="button"
                    onClick={() => setPassengerPrefs(prev =>
                      prev.includes(pref.id) ? prev.filter(p => p !== pref.id) : [...prev, pref.id]
                    )}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      active
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-500'
                    }`}
                  >
                    <span>{pref.emoji}</span>
                    <span>{pref.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={isSearching}
          onClick={handleFindRides}
          className="w-full rounded-2xl bg-black px-4 py-4 text-base font-bold text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {isSearching ? (
            <span className="inline-flex items-center justify-center gap-2">
              <LoaderCircle className="h-5 w-5 animate-spin" /> Finding driver rides…
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              <Search className="h-5 w-5" /> Find driver rides
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
