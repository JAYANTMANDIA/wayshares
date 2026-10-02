export interface CityCoordinate {
  lat: number;
  lon: number;
}

export interface RoadRoute {
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
}

async function geocodePlace(place: string): Promise<CityCoordinate> {
  const params = new URLSearchParams({ q: `${place}, India`, format: 'jsonv2', limit: '1', countrycodes: 'in' });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error('City lookup failed. Check your connection and try again.');
  const results = await response.json() as { lat: string; lon: string }[];
  if (!results.length) throw new Error(`Could not find ${place} on the map.`);
  return { lat: Number(results[0].lat), lon: Number(results[0].lon) };
}

export async function fetchRoadRoute(origin: string, destination: string): Promise<RoadRoute> {
  const originPoint = await geocodePlace(origin);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const destinationPoint = await geocodePlace(destination);
  const params = new URLSearchParams({ overview: 'full', geometries: 'geojson', steps: 'false' });
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${originPoint.lon},${originPoint.lat};${destinationPoint.lon},${destinationPoint.lat}?${params}`
  );
  if (!response.ok) throw new Error('Could not calculate a driving route. Try again shortly.');
  const result = await response.json() as {
    code: string;
    routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
  };
  const roadRoute = result.routes?.[0];
  if (result.code !== 'Ok' || !roadRoute) throw new Error('No driving route found for those locations.');
  return {
    coordinates: roadRoute.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]),
    distanceKm: roadRoute.distance / 1000,
    durationMinutes: roadRoute.duration / 60
  };
}