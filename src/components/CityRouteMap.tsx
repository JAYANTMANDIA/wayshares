import React from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { RoadRoute } from '../lib/indiaRoute';

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
}

export const CityRouteMap: React.FC<CityRouteMapProps> = ({ route, pickup, dropoff }) => (
  <div className="h-56 overflow-hidden rounded-2xl border border-neutral-200">
    <MapContainer center={route.coordinates[0]} zoom={6} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitRouteBounds coordinates={route.coordinates} />
      <Polyline positions={route.coordinates} pathOptions={{ color: '#ea580c', weight: 5 }} />
      <CircleMarker center={route.coordinates[0]} radius={7} pathOptions={{ color: '#059669', fillColor: '#10b981', fillOpacity: 1 }}>
        <Tooltip>{pickup}</Tooltip>
      </CircleMarker>
      <CircleMarker center={route.coordinates[route.coordinates.length - 1]} radius={7} pathOptions={{ color: '#dc2626', fillColor: '#ef4444', fillOpacity: 1 }}>
        <Tooltip>{dropoff}</Tooltip>
      </CircleMarker>
    </MapContainer>
  </div>
);