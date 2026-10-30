/**
 * Route Service
 * =============
 * Geocoding, road routing (OSRM public API), polyline encoding/decoding, and
 * route-compatibility matching for intermediate passenger pickup/drop-off.
 *
 * Routing provider: OSRM public demo server (router.project-osrm.org)
 *   - Free, no key required, fair-use only.
 *   - For production replace OSRM_BASE_URL env var with a self-hosted or
 *     commercial OSRM / Valhalla / GraphHopper endpoint.
 *
 * Geographic data: India Post open dataset (162K locations) via locationIndex,
 *   supplemented by Nominatim OpenStreetMap geocoding for fallback.
 *
 * Attribution: © OpenStreetMap contributors, OSRM project.
 *
 * Configuration (env vars):
 *   OSRM_BASE_URL         override OSRM endpoint (default: https://router.project-osrm.org)
 *   ROUTE_MAX_DETOUR_KM   max extra km a passenger detour may add (default: 15)
 *   ROUTE_MAX_SNAP_KM     max straight-line distance from passenger point to route (default: 5)
 */

import { loadLocationIndex } from './locationIndex.js';

// ─── OSRM config ─────────────────────────────────────────────────────────────

const OSRM_BASE = (process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org').replace(/\/$/, '');

// ─── Tunables (configurable via env) ─────────────────────────────────────────

/** Maximum km a passenger pickup/drop-off may deviate from the route line */
export const MAX_SNAP_KM  = Number(process.env.ROUTE_MAX_SNAP_KM  ?? '5');
/** Maximum extra driving km the driver would add by serving an intermediate passenger */
export const MAX_DETOUR_KM = Number(process.env.ROUTE_MAX_DETOUR_KM ?? '15');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LatLon { lat: number; lon: number }

export interface RoadRouteResult {
  /** [lat, lon] pairs along the route (Leaflet-compatible) */
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
  /** Google Encoded Polyline format string for compact Firestore storage */
  encodedPolyline: string;
}

export interface RouteProjection {
  /** Normalised 0–1 position along the driver's route (0=start, 1=end) */
  fraction: number;
  /** Straight-line distance in km from the point to the nearest route vertex */
  snapDistanceKm: number;
  /** Index of the nearest route vertex */
  vertexIndex: number;
}

export interface SegmentCompatibility {
  compatible: boolean;
  /** Why it was rejected (if not compatible) */
  reason?: string;
  pickupProjection: RouteProjection;
  dropProjection: RouteProjection;
  /** km of route used by the passenger segment */
  segmentDistanceKm: number;
  /** fractional distance share of the total route (0–1) */
  segmentFraction: number;
  /** Estimated extra detour km (usually 0 if both points are on-route) */
  detourKm: number;
  /** Estimated departure time from passenger pickup (ISO string) */
  estimatedPickupTime?: string;
}

// ─── Haversine distance ───────────────────────────────────────────────────────

export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const sin2 = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(sin2));
}

// ─── Polyline encode / decode (Google format) ────────────────────────────────

export function encodePolyline(coords: [number, number][]): string {
  // coords are [lat, lon]
  let result = '';
  let prevLat = 0, prevLon = 0;
  for (const [lat, lon] of coords) {
    for (const [raw, prev] of [[lat * 1e5, prevLat], [lon * 1e5, prevLon]] as [number, number][]) {
      let val = Math.round(raw) - Math.round(prev);
      val = val < 0 ? ~(val << 1) : val << 1;
      while (val >= 0x20) {
        result += String.fromCharCode((0x20 | (val & 0x1f)) + 63);
        val >>= 5;
      }
      result += String.fromCharCode(val + 63);
    }
    prevLat = Math.round(lat * 1e5);
    prevLon = Math.round(lon * 1e5);
  }
  return result;
}

export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let idx = 0, lat = 0, lon = 0;
  while (idx < encoded.length) {
    let shift = 0, result = 0, b: number;
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(idx++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lon += (result & 1) ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lon / 1e5]);
  }
  return points;
}

// ─── Geocode a location name to coordinates ───────────────────────────────────
// First checks the location index (India Post dataset, 162K records with lat/lon).
// Falls back to Nominatim for names not present in the index.

export async function geocodeLocation(name: string, lat?: number | null, lon?: number | null): Promise<LatLon> {
  // If caller already has coordinates from the location picker, use them directly.
  if (typeof lat === 'number' && typeof lon === 'number' && isFinite(lat) && isFinite(lon)) {
    return { lat, lon };
  }

  // Search the location index first (no rate limit, no external call)
  await loadLocationIndex();
  const { searchLocations } = await import('./locationIndex.js');
  const hits = searchLocations({ query: name, limit: 5 });
  const withCoords = hits.find(h => h.lat !== null && h.lon !== null);
  if (withCoords && withCoords.lat !== null && withCoords.lon !== null) {
    return { lat: withCoords.lat, lon: withCoords.lon };
  }

  // Nominatim fallback
  const params = new URLSearchParams({ q: `${name}, India`, format: 'jsonv2', limit: '10', countrycodes: 'in' });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'WAYSHARE-route-service/1.0', Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`Geocoding failed for "${name}"`);
  const results = await res.json() as { lat: string; lon: string; class: string; type: string }[];
  if (!results.length) throw new Error(`Location not found: "${name}"`);
  const priority = ['city', 'town', 'village', 'suburb', 'hamlet', 'municipality'];
  const best = results.find(r => r.class === 'place' && priority.includes(r.type)) ?? results[0];
  return { lat: Number(best.lat), lon: Number(best.lon) };
}

// ─── Fetch road route from OSRM ───────────────────────────────────────────────

export async function fetchRouteFromOSRM(origin: LatLon, destination: LatLon): Promise<RoadRouteResult> {
  const url = `${OSRM_BASE}/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url, { headers: { 'User-Agent': 'WAYSHARE-route-service/1.0' } });
  if (!res.ok) throw new Error('Road routing unavailable. Please try again.');
  const data = await res.json() as {
    code: string;
    routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
  };
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No driving route found between these locations.');
  const route = data.routes[0];
  // OSRM returns [lon, lat] — convert to [lat, lon] for Leaflet / internal use
  const coordinates: [number, number][] = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  return {
    coordinates,
    distanceKm: route.distance / 1000,
    durationMinutes: route.duration / 60,
    encodedPolyline: encodePolyline(coordinates),
  };
}

// ─── Project a point onto a decoded route polyline ────────────────────────────
// Uses the vertex with minimum straight-line distance.
// Returns fraction 0–1 (position along route), snap distance, and vertex index.

export function projectPointOnRoute(point: LatLon, routeCoords: [number, number][]): RouteProjection {
  let minDist = Infinity;
  let bestIdx = 0;

  for (let i = 0; i < routeCoords.length; i++) {
    const [lat, lon] = routeCoords[i];
    const d = haversineKm(point, { lat, lon });
    if (d < minDist) { minDist = d; bestIdx = i; }
  }

  return {
    fraction: routeCoords.length > 1 ? bestIdx / (routeCoords.length - 1) : 0,
    snapDistanceKm: minDist,
    vertexIndex: bestIdx,
  };
}

// ─── Estimate cumulative distance up to a vertex index ───────────────────────

function cumulativeDistanceKm(coords: [number, number][], fromIdx: number, toIdx: number): number {
  let d = 0;
  const start = Math.min(fromIdx, toIdx);
  const end   = Math.max(fromIdx, toIdx);
  for (let i = start; i < end; i++) {
    d += haversineKm({ lat: coords[i][0], lon: coords[i][1] }, { lat: coords[i + 1][0], lon: coords[i + 1][1] });
  }
  return d;
}

// ─── Estimate passenger pickup time from departure time + route fraction ──────

function estimatePickupTime(departureDate: string, departureTime: string, routeFraction: number, totalDurationMinutes: number): string | undefined {
  try {
    const [h, m] = departureTime.split(':').map(Number);
    if (!isFinite(h) || !isFinite(m)) return undefined;
    const base = new Date(`${departureDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    const offsetMs = routeFraction * totalDurationMinutes * 60 * 1000;
    const arrival = new Date(base.getTime() + offsetMs);
    return arrival.toISOString();
  } catch {
    return undefined;
  }
}

// ─── Core compatibility check ─────────────────────────────────────────────────
// Given a decoded route polyline and the driver's total distance/duration,
// checks whether the passenger's (pickupPt, dropPt) are compatible.

export function checkSegmentCompatibility(
  pickupPt: LatLon,
  dropPt: LatLon,
  routeCoords: [number, number][],
  rideDistanceKm: number,
  rideDurationMinutes: number,
  departureDate: string,
  departureTime: string,
): SegmentCompatibility {
  const pickupProj = projectPointOnRoute(pickupPt, routeCoords);
  const dropProj   = projectPointOnRoute(dropPt,   routeCoords);

  // Guard: passenger points must be close enough to the route
  if (pickupProj.snapDistanceKm > MAX_SNAP_KM) {
    return { compatible: false, reason: `Pickup is ${pickupProj.snapDistanceKm.toFixed(1)} km from the route (max ${MAX_SNAP_KM} km)`, pickupProjection: pickupProj, dropProjection: dropProj, segmentDistanceKm: 0, segmentFraction: 0, detourKm: 0 };
  }
  if (dropProj.snapDistanceKm > MAX_SNAP_KM) {
    return { compatible: false, reason: `Drop-off is ${dropProj.snapDistanceKm.toFixed(1)} km from the route (max ${MAX_SNAP_KM} km)`, pickupProjection: pickupProj, dropProjection: dropProj, segmentDistanceKm: 0, segmentFraction: 0, detourKm: 0 };
  }

  // Guard: pickup must precede drop-off along the route direction
  if (pickupProj.fraction >= dropProj.fraction - 0.01) {
    return { compatible: false, reason: 'Drop-off location comes before the pickup along this route', pickupProjection: pickupProj, dropProjection: dropProj, segmentDistanceKm: 0, segmentFraction: 0, detourKm: 0 };
  }

  // Measure segment distance along the route polyline
  const segmentDistanceKm = cumulativeDistanceKm(routeCoords, pickupProj.vertexIndex, dropProj.vertexIndex);
  const segmentFraction   = dropProj.fraction - pickupProj.fraction;

  // Detour: snap distances are small deviations; we add both snap distances as the detour estimate.
  // This is a conservative upper bound — a driver going to a nearby road does not add both full snap distances,
  // but it keeps the estimate simple and safe.
  const detourKm = pickupProj.snapDistanceKm + dropProj.snapDistanceKm;

  if (detourKm > MAX_DETOUR_KM) {
    return { compatible: false, reason: `Total detour ${detourKm.toFixed(1)} km exceeds limit (${MAX_DETOUR_KM} km)`, pickupProjection: pickupProj, dropProjection: dropProj, segmentDistanceKm, segmentFraction, detourKm };
  }

  const estimatedPickupTime = estimatePickupTime(departureDate, departureTime, pickupProj.fraction, rideDurationMinutes);

  return {
    compatible: true,
    pickupProjection: pickupProj,
    dropProjection: dropProj,
    segmentDistanceKm,
    segmentFraction,
    detourKm,
    estimatedPickupTime,
  };
}

// ─── Segment fare calculation ─────────────────────────────────────────────────
// The passenger pays proportional to the segment distance vs total route distance.
// A minimum floor of 20% of pricePerSeat is enforced so very short segments
// remain financially viable for drivers.
// This is configurable via ROUTE_MIN_FARE_FRACTION env (default 0.2).

const MIN_FARE_FRACTION = Number(process.env.ROUTE_MIN_FARE_FRACTION ?? '0.2');

export function calculateSegmentFare(pricePerSeat: number, segmentFraction: number, seats: number): number {
  const fraction = Math.max(MIN_FARE_FRACTION, Math.min(1, segmentFraction));
  return Math.round(pricePerSeat * fraction * seats * 100) / 100;
}
