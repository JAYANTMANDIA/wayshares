import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Briefcase,
  Package,
  MapPin,
  User,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  LoaderCircle
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { CityRouteMap } from '../components/CityRouteMap';
import { IndianCityAutocomplete, INDIAN_CITIES } from '../components/IndianCityAutocomplete';
import { AppScreen } from '../types';
import { store } from '../services/store';
import { fetchRoadRoute } from '../lib/indiaRoute';
import type { RoadRoute } from '../lib/indiaRoute';

interface LuggageTransferScreenProps {
  onNavigate: (screen: AppScreen) => void;
  onSearchRides: (params: {
    fromCity: string;
    toCity: string;
    date: string;
    passengers: number;
    luggage: boolean;
  }) => void;
}

interface CargoTier {
  id: string;
  name: string;
  weightLimit: string;
  baseFee: number;
  ratePerKm: number;
  icon: string;
  desc: string;
}

const CARGO_TIERS: CargoTier[] = [
  {
    id: 'docs',
    name: 'Document / Envelope',
    weightLimit: 'Up to 1 kg',
    baseFee: 40,
    ratePerKm: 2,
    icon: '📄',
    desc: 'Passports, legal papers & small pouches'
  },
  {
    id: 'box',
    name: 'Small Parcel / Carton',
    weightLimit: 'Up to 5 kg',
    baseFee: 60,
    ratePerKm: 4,
    icon: '📦',
    desc: 'Electronics, shoes, apparel gifts'
  },
  {
    id: 'luggage',
    name: 'Suitcase / Heavy Bag',
    weightLimit: 'Up to 20 kg',
    baseFee: 100,
    ratePerKm: 7,
    icon: '🧳',
    desc: 'Travel luggage, airport bags & trolleys'
  },
  {
    id: 'cargo',
    name: 'Bulk / Commercial Box',
    weightLimit: 'Up to 50 kg',
    baseFee: 180,
    ratePerKm: 12,
    icon: '📦',
    desc: 'Furniture, appliances & moving boxes'
  }
];

export const LuggageTransferScreen: React.FC<LuggageTransferScreenProps> = ({ onNavigate, onSearchRides }) => {
  const [pickupCity, setPickupCity] = useState('');
  const [dropoffCity, setDropoffCity] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [selectedTier, setSelectedTier] = useState('luggage');
  const [isFragile, setIsFragile] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<{ trackingRef: string } | null>(null);
  const [step, setStep] = useState<'route' | 'package'>('route');
  const [route, setRoute] = useState<RoadRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  const activeTier = CARGO_TIERS.find((t) => t.id === selectedTier) || CARGO_TIERS[2];
  const totalPrice = route
    ? Math.round((activeTier.baseFee + route.distanceKm * activeTier.ratePerKm + (isFragile ? 40 : 0)) * 100) / 100
    : 0;

  const handleShowRoute = async () => {
    if (!deliveryDate || !pickupTime) {
      setRouteError('Select a pickup date and time first.');
      return;
    }
    const pickup = INDIAN_CITIES.find((city) => city.name.toLowerCase() === pickupCity.trim().toLowerCase());
    const dropoff = INDIAN_CITIES.find((city) => city.name.toLowerCase() === dropoffCity.trim().toLowerCase());
    if (!pickup || !dropoff) {
      setRouteError('Choose both cities from the suggestions to preview the route.');
      return;
    }
    if (pickup.name === dropoff.name) {
      setRouteError('Pickup and dropoff cities must be different.');
      return;
    }
    setRouteLoading(true);
    setRouteError('');
    try {
      onSearchRides({
        fromCity: pickup.name,
        toCity: dropoff.name,
        date: deliveryDate,
        passengers: 1,
        luggage: true
      });
      onNavigate('available_rides');
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : 'Unable to find rides.');
    } finally {
      setRouteLoading(false);
    }
  };

  const handleBookCargo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!route) return;
    const trackingRef = `UBX-CARGO-${Math.floor(10000 + Math.random() * 90000)}`;

    store.addNotification({
      title: 'Luggage Dispatch Confirmed',
      message: `${activeTier.name} routed ${route.distanceKm.toFixed(1)} km from ${pickupCity} to ${dropoffCity} on ${deliveryDate} at ${pickupTime}. Estimated delivery price ₹${totalPrice.toFixed(2)}. Tracking Code: ${trackingRef}`,
      type: 'booking'
    });

    setConfirmedBooking({ trackingRef });
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-8">
      <div>
        <TopBar
          title="Luggage & Cargo Transfer"
          onBack={() => step === 'package' ? setStep('route') : onNavigate('home')}
          showMore={false}
        />

        <div className="px-5 pt-1 space-y-4">
          {!confirmedBooking ? (
            step === 'route' ? (
              <div className="space-y-3.5">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3.5 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">1. Pickup and delivery route</p>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
                    <IndianCityAutocomplete id="cargo-pickup-city" label="Pickup city" value={pickupCity} onChange={(value) => { setPickupCity(value); setRoute(null); setRouteError(''); }} />
                  </div>
                  <input
                    type="text"
                    value={senderAddress}
                    onChange={(event) => { setSenderAddress(event.target.value); setRoute(null); }}
                    placeholder="Pickup street address (optional)"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-900 outline-hidden"
                  />
                  <div className="h-px bg-neutral-200" />
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-rose-600" />
                    <IndianCityAutocomplete id="cargo-dropoff-city" label="Delivery city" value={dropoffCity} onChange={(value) => { setDropoffCity(value); setRoute(null); setRouteError(''); }} />
                  </div>
                  <input
                    type="text"
                    value={destinationAddress}
                    onChange={(event) => { setDestinationAddress(event.target.value); setRoute(null); }}
                    placeholder="Delivery street address (optional)"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-900 outline-hidden"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[10px] font-bold uppercase text-neutral-500">
                      Pickup date
                      <input type="date" required min={new Date().toISOString().slice(0, 10)} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-xs font-semibold text-neutral-900" />
                    </label>
                    <label className="block text-[10px] font-bold uppercase text-neutral-500">
                      Pickup time
                      <input type="time" required value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} className="mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-xs font-semibold text-neutral-900" />
                    </label>
                  </div>
                </div>

                {routeError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{routeError}</p>}

                {route && (
                  <>
                    <CityRouteMap route={route} pickup={pickupCity} dropoff={dropoffCity} />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-neutral-200 bg-white p-3"><span className="block text-[10px] font-bold uppercase text-neutral-500">Road distance</span><span className="text-lg font-extrabold text-neutral-900">{route.distanceKm.toFixed(1)} km</span></div>
                      <div className="rounded-xl border border-neutral-200 bg-white p-3"><span className="block text-[10px] font-bold uppercase text-neutral-500">Driving time</span><span className="text-lg font-extrabold text-neutral-900">{Math.round(route.durationMinutes)} min</span></div>
                    </div>
                    <p className="text-[10px] text-neutral-500">Route by OpenStreetMap contributors and OSRM.</p>
                    <p className="text-xs font-semibold text-neutral-700">Pickup {deliveryDate} · {pickupTime}</p>
                  </>
                )}

                <button
                  type="button"
                  disabled={routeLoading}
                  onClick={() => void handleShowRoute()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {routeLoading ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Finding rides…</> : 'Find driver rides for this date'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleBookCargo} className="space-y-3.5">
                {route && <CityRouteMap route={route} pickup={pickupCity} dropoff={dropoffCity} />}
                <p className="text-xs font-semibold text-neutral-700">Pickup {deliveryDate} · {pickupTime}</p>

                <div>
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-neutral-400">2. Select package size</span>
                  <div className="grid grid-cols-2 gap-2">
                    {CARGO_TIERS.map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setSelectedTier(tier.id)}
                        aria-pressed={selectedTier === tier.id}
                        className={`rounded-2xl border p-3 text-left transition-all ${selectedTier === tier.id ? 'border-black bg-neutral-50 ring-1 ring-black' : 'border-neutral-200 bg-white hover:border-neutral-400'}`}
                      >
                        <span className="mb-1 block text-xl">{tier.icon}</span>
                        <span className="block text-xs font-bold text-black">{tier.name}</span>
                        <span className="block text-[10px] text-neutral-500">{tier.weightLimit}</span>
                        <span className="mt-2 block text-[10px] font-semibold text-neutral-700">₹{tier.baseFee} base + ₹{tier.ratePerKm}/km</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-orange-800">Estimated delivery price</span>
                  <span className="block text-3xl font-black text-neutral-950">₹{totalPrice.toFixed(2)}</span>
                  <span className="text-xs text-neutral-600">₹{activeTier.baseFee} base + {route?.distanceKm.toFixed(1)} km × ₹{activeTier.ratePerKm}/km{isFragile ? ' + ₹40 fragile handling' : ''}</span>
                </div>

                <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-neutral-200 bg-white p-3">
                  <span><span className="block text-xs font-bold text-neutral-900">Handle with care</span><span className="block text-[10px] text-neutral-500">Fragile handling +₹40</span></span>
                  <input type="checkbox" checked={isFragile} onChange={(event) => setIsFragile(event.target.checked)} className="h-4 w-4 accent-black" />
                </label>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 space-y-2">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500">3. Recipient details</span>
                  <input type="text" required value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Recipient name" className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold outline-hidden" />
                  <input type="tel" required value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} placeholder="Recipient phone number" className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold outline-hidden" />
                </div>

                <button type="button" onClick={() => setStep('route')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 py-2.5 text-xs font-semibold text-neutral-700"><ArrowLeft className="h-4 w-4" /> Change route</button>
                <button type="submit" className="flex w-full items-center justify-between rounded-2xl bg-black px-4 py-3.5 text-sm font-bold text-white hover:bg-neutral-800">
                  <span>Total: ₹{totalPrice.toFixed(2)}</span><span className="flex items-center gap-1">Dispatch luggage<ArrowRight className="h-4 w-4" /></span>
                </button>
              </form>
            )
          ) : (
            /* Confirmation Card */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-3xl border-2 border-emerald-500 bg-emerald-50/30 text-center space-y-3"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h3 className="text-lg font-bold text-black">Luggage Dispatch Confirmed!</h3>
              <p className="text-xs text-neutral-600">
                A verified courier partner has been assigned for doorstep pickup in 15 mins.
              </p>

              <div className="bg-white p-3 rounded-2xl border border-emerald-200 my-2">
                <span className="text-[10px] text-neutral-400 font-bold uppercase block">Cargo Tracking Code</span>
                <span className="text-lg font-mono font-black text-black">{confirmedBooking.trackingRef}</span>
              </div>

              <div className="text-xs text-left bg-white p-3 rounded-2xl border space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Recipient:</span>
                  <span className="font-bold text-neutral-900">{recipientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Destination:</span>
                  <span className="font-bold text-neutral-900">{destinationAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Pickup:</span>
                  <span className="font-bold text-neutral-900">{deliveryDate} · {pickupTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Amount Paid:</span>
                  <span className="font-bold text-black">₹{totalPrice.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setConfirmedBooking(null);
                  onNavigate('home');
                }}
                className="w-full bg-black text-white py-3 rounded-xl text-xs font-bold mt-3"
              >
                Return to Home
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
