import React, { useEffect, useState } from 'react';
import { MapPin, MessageCircle, RefreshCw } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { CityRouteMap } from '../components/CityRouteMap';
import { fetchRoadRoute, type RoadRoute } from '../lib/indiaRoute';
import { auth } from '../lib/firebase';
import { store } from '../services/store';
import type { AppScreen, Booking, LiveRideLocation, Ride } from '../types';

interface RideTrackingScreenProps {
  onNavigate: (screen: AppScreen) => void;
  onOpenBookingChat: (bookingId: string) => void;
  rideId?: string;
}

const activeRideStatuses = ['DRIVER_ON_WAY', 'ARRIVING', 'STARTED'];

export const RideTrackingScreen: React.FC<RideTrackingScreenProps> = ({ onNavigate, onOpenBookingChat, rideId }) => {
  const selectedRideId = rideId || store.bookings[0]?.rideId || store.rides[0]?.id || '';
  const [ride, setRide] = useState<Ride | null>(() => store.rides.find((item) => item.id === selectedRideId) || null);
  const [booking, setBooking] = useState<Booking | null>(() => store.bookings.find((item) => item.rideId === selectedRideId && item.bookingStatus !== 'CANCELLED') || null);
  const [roadRoute, setRoadRoute] = useState<RoadRoute | null>(null);
  const [routeError, setRouteError] = useState('');
  const [liveLocation, setLiveLocation] = useState<LiveRideLocation | null>(null);
  const [locationMessage, setLocationMessage] = useState('Waiting for the driver’s live location.');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentUserId = auth?.currentUser?.uid;
  const isDriver = Boolean(currentUserId && ride?.driverId === currentUserId);
  const fromCity = booking?.fromCity || ride?.fromCity || '';
  const toCity = booking?.toCity || ride?.toCity || '';
  const pickup = booking?.pickupLocation || ride?.pickupLocation || fromCity;
  const dropoff = booking?.dropLocation || ride?.dropLocation || toCity;

  useEffect(() => {
    if (!selectedRideId) return;
    const syncFromStore = () => {
      setRide(store.rides.find((item) => item.id === selectedRideId) || null);
      setBooking(store.bookings.find((item) => item.rideId === selectedRideId && item.bookingStatus !== 'CANCELLED') || null);
    };
    const unsubscribe = store.subscribe(syncFromStore);
    syncFromStore();
    void store.fetchRideById(selectedRideId).catch((error) => {
      setRouteError(error instanceof Error ? error.message : 'Unable to load ride details');
    });
    return unsubscribe;
  }, [selectedRideId]);

  useEffect(() => {
    if (!fromCity || !toCity) return;
    let cancelled = false;
    setRoadRoute(null);
    setRouteError('');
    void fetchRoadRoute(fromCity, toCity).then((result) => {
      if (!cancelled) setRoadRoute(result);
    }).catch((error) => {
      if (!cancelled) setRouteError(error instanceof Error ? error.message : 'Unable to load the road route');
    });
    return () => { cancelled = true; };
  }, [fromCity, toCity]);

  useEffect(() => {
    if (!ride) return;
    let cancelled = false;
    let watchId: number | undefined;
    let lastSentAt = 0;

    const readLocation = async () => {
      try {
        const location = await store.fetchRideLiveLocation(ride.id);
        if (cancelled) return;
        setLiveLocation(location);
        setLocationMessage(location ? `Driver location updated ${new Date(location.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for the driver’s live location.');
      } catch (error) {
        if (!cancelled) setLocationMessage(error instanceof Error ? error.message : 'Unable to read live location');
      }
    };

    if (isDriver) {
      if (!activeRideStatuses.includes(ride.status)) {
        setLocationMessage('Live GPS sharing starts when the ride is active.');
      } else if (!navigator.geolocation) {
        setLocationMessage('This browser does not support GPS location.');
      } else {
        setLocationMessage('Allow location access to share your live position with passengers.');
        watchId = navigator.geolocation.watchPosition((position) => {
          if (cancelled) return;
          const { latitude, longitude } = position.coords;
          setLiveLocation({ latitude, longitude, updatedAt: new Date().toISOString() });
          setLocationMessage('Sharing your live location with this ride’s passengers.');
          if (Date.now() - lastSentAt < 8000) return;
          lastSentAt = Date.now();
          void store.updateRideLiveLocation(ride.id, latitude, longitude).catch((error) => {
            if (!cancelled) setLocationMessage(error instanceof Error ? error.message : 'Unable to publish live GPS');
          });
        }, (error) => {
          if (!cancelled) setLocationMessage(error.code === error.PERMISSION_DENIED ? 'Location permission is blocked. Enable it in browser settings to share GPS.' : 'Unable to read GPS location. Check device location services.');
        }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
      }
    } else {
      void readLocation();
      const intervalId = window.setInterval(() => void readLocation(), 5000);
      return () => {
        cancelled = true;
        window.clearInterval(intervalId);
      };
    }

    return () => {
      cancelled = true;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, [ride?.id, ride?.driverId, ride?.status, isDriver]);

  const refreshLocation = async () => {
    if (!ride) return;
    setIsRefreshing(true);
    try {
      setLiveLocation(await store.fetchRideLiveLocation(ride.id));
    } catch (error) {
      setLocationMessage(error instanceof Error ? error.message : 'Unable to refresh live location');
    } finally {
      setIsRefreshing(false);
    }
  };

  const livePosition: [number, number] | null = liveLocation ? [liveLocation.latitude, liveLocation.longitude] : null;

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col pb-20">
      <TopBar title="Ride Tracking" onBack={() => onNavigate(isDriver ? 'driver_dashboard' : 'my_trips')} showMore />

      {!selectedRideId ? (
        <div className="px-6 py-16 text-center text-sm text-neutral-600">Choose a booked ride to view its route.</div>
      ) : (
        <>
          <div className="px-5 py-3 border-b border-neutral-200 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-neutral-900 truncate">{fromCity || 'Loading ride'} → {toCity}</h2>
              <p className="mt-1 text-xs text-neutral-500 truncate">{pickup} → {dropoff}</p>
            </div>
            <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold text-neutral-700">{ride?.status || 'Loading'}</span>
          </div>

          {roadRoute ? (
            <CityRouteMap
              route={roadRoute}
              pickup={`${pickup}, ${fromCity}`}
              dropoff={`${dropoff}, ${toCity}`}
              livePosition={livePosition}
              className="h-[320px] rounded-none border-x-0"
            />
          ) : (
            <div role={routeError ? 'alert' : undefined} className="h-[320px] bg-neutral-100 flex items-center justify-center px-6 text-center text-sm text-neutral-600">
              {routeError || 'Loading real road route…'}
            </div>
          )}

          <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${livePosition ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
              <p className="text-xs text-neutral-600">{locationMessage}</p>
            </div>
            {!isDriver && (
              <button type="button" onClick={() => void refreshLocation()} disabled={isRefreshing} className="shrink-0 p-2 rounded-lg border border-neutral-200 text-neutral-700 disabled:opacity-50" title="Refresh live location">
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          <div className="px-5 py-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-neutral-200 p-3">
              <span className="block text-[10px] uppercase font-bold text-neutral-500">Road distance</span>
              <span className="mt-1 block text-lg font-extrabold text-neutral-900">{roadRoute ? `${Math.round(roadRoute.distanceKm)} km` : '—'}</span>
            </div>
            <div className="rounded-xl border border-neutral-200 p-3">
              <span className="block text-[10px] uppercase font-bold text-neutral-500">Estimated drive time</span>
              <span className="mt-1 block text-lg font-extrabold text-neutral-900">{roadRoute ? `${Math.round(roadRoute.durationMinutes / 60)} hr ${Math.round(roadRoute.durationMinutes % 60)} min` : '—'}</span>
            </div>
          </div>

          <div className="mx-5 rounded-xl bg-neutral-50 border border-neutral-200 p-3 flex items-start gap-2 text-xs text-neutral-600">
            <MapPin className="h-4 w-4 shrink-0 text-orange-600" />
            <span>The route follows real roads. The blue marker appears only when the driver shares fresh GPS coordinates.</span>
          </div>

          {booking && !isDriver && (
            <div className="px-5 pt-4">
              <button type="button" onClick={() => onOpenBookingChat(booking.id)} className="w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-bold text-white flex items-center justify-center gap-2">
                <MessageCircle className="h-4 w-4" /> Chat with driver
              </button>
            </div>
          )}

          {isDriver && activeRideStatuses.includes(ride?.status || '') && (
            <p className="px-5 pt-3 text-center text-[11px] text-neutral-500">Keep this screen open during the ride to share live GPS with passengers.</p>
          )}
        </>
      )}
    </div>
  );
};