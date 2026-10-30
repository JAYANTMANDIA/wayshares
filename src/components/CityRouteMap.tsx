import React, { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchRoadRoute, type RoadRoute } from '../lib/indiaRoute';

function FitRouteBounds({ coordinates }: { coordinates: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (coordinates.length > 1) map.fitBounds(coordinates, { padding: [28, 28] });
  }, [coordinates, map]);
  return null;
}

interface CityRouteMapProps {
  route: RoadRoute;
  pickup: string;
  dropoff: string;
  livePosition?: [number, number] | null;
  className?: string;
}

export const CityRouteMap: React.FC<CityRouteMapProps> = ({ route, pickup, dropoff, livePosition, className = 'h-56' }) => {
  const bounds = livePosition ? [...route.coordinates, livePosition] : route.coordinates;
  return (
  <div className={`${className} overflow-hidden rounded-2xl border border-neutral-200`}>
    <MapContainer center={route.coordinates[0]} zoom={6} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitRouteBounds coordinates={bounds} />
      <Polyline positions={route.coordinates} pathOptions={{ color: '#ea580c', weight: 5 }} />
      <CircleMarker center={route.coordinates[0]} radius={7} pathOptions={{ color: '#059669', fillColor: '#10b981', fillOpacity: 1 }}>
        <Tooltip>{pickup}</Tooltip>
      </CircleMarker>
      <CircleMarker center={route.coordinates[route.coordinates.length - 1]} radius={7} pathOptions={{ color: '#dc2626', fillColor: '#ef4444', fillOpacity: 1 }}>
        <Tooltip>{dropoff}</Tooltip>
      </CircleMarker>
      {livePosition && (
        <CircleMarker center={livePosition} radius={9} pathOptions={{ color: '#1d4ed8', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 }}>
          <Tooltip>Driver live location</Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  </div>
  );
};

interface CityRoutePreviewProps {
  origin: string;
  destination: string;
  pickup?: string;
  dropoff?: string;
}

export const CityRoutePreview: React.FC<CityRoutePreviewProps> = ({ origin, destination, pickup, dropoff }) => {
  const [route, setRoute] = useState<RoadRoute | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!origin.trim() || !destination.trim() || origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
      setRoute(null);
      setError('');
      return;
    }

    let cancelled = false;
    setRoute(null);
    setError('');
    const timeoutId = window.setTimeout(() => {
      void fetchRoadRoute(origin.trim(), destination.trim()).then((result) => {
        if (!cancelled) setRoute(result);
      }).catch((routeError) => {
        if (!cancelled) setError(routeError instanceof Error ? routeError.message : 'Unable to load road route');
      });
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [origin, destination]);

  if (!origin.trim() || !destination.trim() || origin.trim().toLowerCase() === destination.trim().toLowerCase()) return null;
  if (route) return <CityRouteMap route={route} pickup={pickup || origin} dropoff={dropoff || destination} className="h-40" />;

  return (
    <div role={error ? 'alert' : undefined} className="h-40 rounded-2xl border border-neutral-200 bg-neutral-100 flex items-center justify-center px-4 text-center text-xs text-neutral-600">
      {error || 'Loading real road route…'}
    </div>
  );
};