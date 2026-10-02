import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, AlertCircle, Loader2, Signal, Clock } from 'lucide-react';

interface LocationData {
  sessionToken: string;
  sharerName: string;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  startedAt: string | null;
  updatedAt: string | null;
  endedAt: string | null;
}

export function LiveLocationPage({ sessionToken }: { sessionToken: string }) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sessionToken) { setError('Invalid location link.'); setLoading(false); return; }

    // Fetch initial snapshot
    fetch(`/api/location-sharing/${sessionToken}/public`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) throw new Error(data.error || 'Session not found');
        setLocation(data.session);
        setLoading(false);
        if (data.session.active) connectSSE();
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not load location');
        setLoading(false);
      });

    return () => {
      eventSourceRef.current?.close();
    };
  }, [sessionToken]);

  const connectSSE = () => {
    const es = new EventSource(`/api/location-sharing/${sessionToken}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as { type: string; latitude?: number; longitude?: number; updatedAt?: string; active?: boolean };
        if (data.type === 'location' && data.latitude != null && data.longitude != null) {
          setLocation((prev) => prev ? { ...prev, latitude: data.latitude!, longitude: data.longitude!, active: true, updatedAt: data.updatedAt || null } : prev);
          setLastUpdate(new Date());
          setUpdateCount((n) => n + 1);
        } else if (data.type === 'ended') {
          setLocation((prev) => prev ? { ...prev, active: false } : prev);
          es.close();
        }
      } catch { /* ignore parse error */ }
    };

    es.onerror = () => { es.close(); };
  };

  const openInMaps = () => {
    if (!location?.latitude || !location?.longitude) return;
    window.open(`https://www.google.com/maps?q=${location.latitude},${location.longitude}`, '_blank');
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return 'Unknown';
    return new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  };

  // --- Loading ---
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
          <p className="text-white font-semibold">Loading live location…</p>
          <p className="text-gray-400 text-sm">Connecting to WAYSHARE Safety</p>
        </div>
      </div>
    );
  }

  // --- Error ---
  if (error || !location) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-rose-400" />
          </div>
          <h1 className="text-white font-bold text-lg">Location Not Found</h1>
          <p className="text-gray-400 text-sm">{error || 'This location link is invalid or has expired.'}</p>
          <p className="text-gray-500 text-xs">If you received this link recently, the sharer may have stopped sharing.</p>
        </div>
      </div>
    );
  }

  const hasCoords = location.latitude != null && location.longitude != null;
  const mapsUrl = hasCoords ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}` : null;
  const embedUrl = hasCoords
    ? `https://www.google.com/maps/embed/v1/place?key=AIzaSyD-placeholder&q=${location.latitude},${location.longitude}&zoom=15`
    : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
            <Navigation className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base leading-tight truncate">
              {location.sharerName}'s Live Location
            </h1>
            <p className="text-xs text-gray-400">Shared via WAYSHARE Safety</p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${location.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}>
            {location.active && <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping inline-block" />}
            {location.active ? 'LIVE' : 'ENDED'}
          </div>
        </div>
      </div>

      {/* Map Placeholder (iframe-based) */}
      <div className="relative bg-gray-900 flex-1 min-h-[300px]">
        {hasCoords ? (
          <iframe
            title="Live Location Map"
            className="w-full h-full min-h-[300px] border-0"
            src={`https://maps.google.com/maps?q=${location.latitude},${location.longitude}&z=15&output=embed`}
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full min-h-[300px] flex items-center justify-center">
            <div className="text-center space-y-3">
              <MapPin className="w-10 h-10 text-gray-600 mx-auto" />
              <p className="text-gray-500 text-sm">Waiting for location data…</p>
            </div>
          </div>
        )}

        {/* Live pulse overlay */}
        {location.active && hasCoords && (
          <div className="absolute top-3 left-3 bg-gray-900/90 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2">
            <Signal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-bold">Live</span>
            {updateCount > 0 && <span className="text-xs text-gray-400">· {updateCount} update{updateCount !== 1 ? 's' : ''}</span>}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-4 space-y-3 max-w-lg mx-auto w-full">
        {hasCoords && (
          <div className="bg-gray-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-sm font-bold text-white">Current Coordinates</p>
            </div>
            <p className="text-sm font-mono text-gray-300 pl-6">
              {location.latitude!.toFixed(6)}, {location.longitude!.toFixed(6)}
            </p>
            {lastUpdate && (
              <div className="flex items-center gap-1.5 pl-6">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                <p className="text-xs text-gray-500">Updated {lastUpdate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
          <div className="bg-gray-800 rounded-xl p-3">
            <p className="text-gray-500 mb-0.5">Started</p>
            <p className="font-semibold text-white">{formatTime(location.startedAt)}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3">
            <p className="text-gray-500 mb-0.5">Status</p>
            <p className={`font-bold ${location.active ? 'text-emerald-400' : 'text-gray-400'}`}>
              {location.active ? 'Sharing Now' : 'Stopped'}
            </p>
          </div>
        </div>

        {!location.active && (
          <div className="p-3 bg-gray-800 border border-gray-700 rounded-xl text-center">
            <p className="text-sm text-gray-400">{location.sharerName} has stopped sharing their location.</p>
            {location.endedAt && <p className="text-xs text-gray-500 mt-1">Ended at {formatTime(location.endedAt)}</p>}
          </div>
        )}

        {hasCoords && (
          <button
            onClick={openInMaps}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Navigation className="w-4 h-4" />
            Open in Google Maps
          </button>
        )}

        <p className="text-center text-xs text-gray-600 pb-2">
          This page auto-updates in real-time · Shared via WAYSHARE Safety
        </p>
      </div>
    </div>
  );
}
