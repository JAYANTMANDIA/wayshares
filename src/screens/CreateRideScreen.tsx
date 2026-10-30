import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, Calendar, Clock, DollarSign, Users, Briefcase, Car, Check } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { LocationAutocomplete, type LocationSuggestion } from '../components/LocationAutocomplete';
import { AppScreen } from '../types';
import { store } from '../services/store';
import { CityRoutePreview } from '../components/CityRouteMap';

// All available ride preference tags
const ALL_PREFS = [
  { id: 'no_smoking',    emoji: '🚭', label: 'No Smoking' },
  { id: 'ac',            emoji: '❄️',  label: 'AC' },
  { id: 'no_audio',      emoji: '🔇', label: 'No Loud Audio' },
  { id: 'eating_allowed',emoji: '🍱', label: 'Eating Allowed' },
  { id: 'pets_allowed',  emoji: '🐾', label: 'Pets Allowed' },
];

interface CreateRideScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const CreateRideScreen: React.FC<CreateRideScreenProps> = ({ onNavigate }) => {
  const canPublishRides = store.canProvideRide();
  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  // Structured location records selected from the autocomplete
  const [selectedOrigin, setSelectedOrigin] = useState<LocationSuggestion | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<LocationSuggestion | null>(null);
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropLocation, setDropLocation] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [availableSeats, setAvailableSeats] = useState(1);
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [luggageCapacity, setLuggageCapacity] = useState('');
  const [vehicleMakeModel, setVehicleMakeModel] = useState('');
  const [driverUpiQrDataUrl, setDriverUpiQrDataUrl] = useState('');
  const [ridePreferences, setRidePreferences] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleQrUpload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      setError('Choose an image under 10 MB.');
      return;
    }

    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unable to read image'));
        reader.onerror = () => reject(new Error('Unable to read image'));
        reader.readAsDataURL(file);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const loadedImage = new Image();
        loadedImage.onload = () => resolve(loadedImage);
        loadedImage.onerror = () => reject(new Error('Unable to open image'));
        loadedImage.src = source;
      });
      const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/png');
      if (imageData.length > 750_000) throw new Error('QR image is too large. Upload a smaller or simpler image.');
      setDriverUpiQrDataUrl(imageData);
      setError('');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to prepare QR image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate that a location was actually picked from the suggestions
    if (!selectedOrigin) {
      setError('Choose an origin location from the suggestions.');
      return;
    }
    if (!selectedDestination) {
      setError('Choose a destination location from the suggestions.');
      return;
    }
    if (selectedOrigin.id === selectedDestination.id) {
      setError('Origin and destination must be different.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      await store.createRide({
        // Use the text the driver typed as the city name — this is what the user
        // sees and what other passengers will search for. The post office
        // displayName (e.g. "Chennai G.p.o.") is only used for coordinates.
        fromCity: fromCity.trim(),
        toCity: toCity.trim(),
        // Pass real coordinates from the location picker so the backend
        // can calculate and store the actual road route geometry.
        fromLat: selectedOrigin.lat ?? null,
        fromLon: selectedOrigin.lon ?? null,
        toLat: selectedDestination.lat ?? null,
        toLon: selectedDestination.lon ?? null,
        pickupLocation,
        dropLocation,
        departureDate,
        departureTime,
        availableSeats,
        pricePerSeat: Number(pricePerSeat),
        luggageCapacity,
        vehicleMakeModel,
        vehicleRegNumber: store.user.rcNumber || '',
        driverUpiQrDataUrl,
        ridePreferences,
      });
      onNavigate('driver_dashboard');
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Unable to publish ride');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-12">
      <div>
        <TopBar
          title="Publish Ride"
          onBack={() => onNavigate('driver_dashboard')}
          showMore={false}
        />

        <form onSubmit={handleSubmit} className="px-5 pt-1 space-y-3.5">
          {!canPublishRides && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Admin approval of your Aadhaar, PAN, and RC-with-face image is required before publishing.
              <button type="button" onClick={() => onNavigate('profile')} className="ml-1 font-bold underline">Open document center</button>
            </div>
          )}
          {error && <p role="alert" className="text-xs font-medium text-rose-600">{error}</p>}
          {/* Origin & Destination */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border px-3 py-2">
              <LocationAutocomplete
                id="publish-origin-city"
                label="Origin City"
                value={fromCity}
                onChange={(value) => { setFromCity(value); setSelectedOrigin(null); setError(''); }}
                onSelectLocation={(loc) => { setFromCity(loc.displayName); setSelectedOrigin(loc); setError(''); }}
              />
            </div>
            <div className="rounded-xl border px-3 py-2">
              <LocationAutocomplete
                id="publish-destination-city"
                label="Destination City"
                value={toCity}
                onChange={(value) => { setToCity(value); setSelectedDestination(null); setError(''); }}
                onSelectLocation={(loc) => { setToCity(loc.displayName); setSelectedDestination(loc); setError(''); }}
              />
            </div>
          </div>

          <CityRoutePreview origin={fromCity} destination={toCity} pickup={pickupLocation || fromCity} dropoff={dropLocation || toCity} />

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
          <div className="grid grid-cols-2 gap-3">
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
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                Luggage
              </label>
              <input
                type="text"
                value={luggageCapacity}
                onChange={(e) => setLuggageCapacity(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-xs outline-hidden"
                placeholder="Luggage allowance"
              />
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 p-3 space-y-2">
            <label htmlFor="driver-upi-qr" className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider block">
              UPI QR Code (optional)
            </label>
            <p className="text-[11px] text-neutral-500">Passengers can scan this to pay you directly.</p>
            <input
              id="driver-upi-qr"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void handleQrUpload(event.target.files?.[0])}
              className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-xs file:font-semibold"
            />
            {driverUpiQrDataUrl && (
              <div className="flex items-center gap-3">
                <img src={driverUpiQrDataUrl} alt="Your uploaded UPI QR code" className="h-20 w-20 rounded-lg border border-neutral-200 object-contain" />
                <button type="button" onClick={() => setDriverUpiQrDataUrl('')} className="text-xs font-semibold text-rose-600">Remove QR</button>
              </div>
            )}
          </div>

          {/* Ride Preferences / Rules */}
          <div className="rounded-xl border border-neutral-200 p-3 space-y-2">
            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider">Ride Preferences</p>
            <p className="text-[11px] text-neutral-500">Select rules for your ride — passengers will be matched based on these.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {ALL_PREFS.map((pref) => {
                const active = ridePreferences.includes(pref.id);
                return (
                  <button
                    key={pref.id}
                    type="button"
                    onClick={() => setRidePreferences(prev =>
                      prev.includes(pref.id) ? prev.filter(p => p !== pref.id) : [...prev, pref.id]
                    )}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      active
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-neutral-700 border-neutral-300 hover:border-neutral-500'
                    }`}
                  >
                    <span>{pref.emoji}</span>
                    <span>{pref.label}</span>
                    {active && <span className="text-[10px]">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !canPublishRides}
              id="submit-publish-ride-button"
              className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Publishing to Network...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 text-[#EF4444]" />
                  <span>{canPublishRides ? 'Publish Ride (Go Live)' : 'Admin Approval Required'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
