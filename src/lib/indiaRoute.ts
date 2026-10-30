import { cleanCityName } from './cleanCityName';

export interface CityCoordinate {
  lat: number;
  lon: number;
}

export interface RoadRoute {
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
}

// Curated lat/lon for common Indian cities to avoid Nominatim ambiguity.
// City names are lowercase-normalised for matching.
const KNOWN_CITY_COORDS: Record<string, CityCoordinate> = {
  'mumbai': { lat: 19.0760, lon: 72.8777 },
  'delhi': { lat: 28.6139, lon: 77.2090 },
  'new delhi': { lat: 28.6139, lon: 77.2090 },
  'bangalore': { lat: 12.9716, lon: 77.5946 },
  'bengaluru': { lat: 12.9716, lon: 77.5946 },
  'hyderabad': { lat: 17.3850, lon: 78.4867 },
  'ahmedabad': { lat: 23.0225, lon: 72.5714 },
  'chennai': { lat: 13.0827, lon: 80.2707 },
  'kolkata': { lat: 22.5726, lon: 88.3639 },
  'surat': { lat: 21.1702, lon: 72.8311 },
  'pune': { lat: 18.5204, lon: 73.8567 },
  'jaipur': { lat: 26.9124, lon: 75.7873 },
  'lucknow': { lat: 26.8467, lon: 80.9462 },
  'kanpur': { lat: 26.4499, lon: 80.3319 },
  'nagpur': { lat: 21.1458, lon: 79.0882 },
  'indore': { lat: 22.7196, lon: 75.8577 },
  'thane': { lat: 19.2183, lon: 72.9781 },
  'bhopal': { lat: 23.2599, lon: 77.4126 },
  'visakhapatnam': { lat: 17.6868, lon: 83.2185 },
  'vizag': { lat: 17.6868, lon: 83.2185 },
  'pimpri': { lat: 18.6298, lon: 73.7997 },
  'patna': { lat: 25.5941, lon: 85.1376 },
  'vadodara': { lat: 22.3072, lon: 73.1812 },
  'ghaziabad': { lat: 28.6692, lon: 77.4538 },
  'ludhiana': { lat: 30.9010, lon: 75.8573 },
  'agra': { lat: 27.1767, lon: 78.0081 },
  'nashik': { lat: 19.9975, lon: 73.7898 },
  'faridabad': { lat: 28.4089, lon: 77.3178 },
  'meerut': { lat: 28.9845, lon: 77.7064 },
  'rajkot': { lat: 22.3039, lon: 70.8022 },
  'kalyan': { lat: 19.2437, lon: 73.1355 },
  'vasai': { lat: 19.3919, lon: 72.8397 },
  'varanasi': { lat: 25.3176, lon: 82.9739 },
  'srinagar': { lat: 34.0837, lon: 74.7973 },
  'aurangabad': { lat: 19.8762, lon: 75.3433 },
  'dhanbad': { lat: 23.7957, lon: 86.4304 },
  'amritsar': { lat: 31.6340, lon: 74.8723 },
  'navi mumbai': { lat: 19.0330, lon: 73.0297 },
  'allahabad': { lat: 25.4358, lon: 81.8463 },
  'prayagraj': { lat: 25.4358, lon: 81.8463 },
  'ranchi': { lat: 23.3441, lon: 85.3096 },
  'howrah': { lat: 22.5958, lon: 88.2636 },
  'coimbatore': { lat: 11.0168, lon: 76.9558 },
  'jabalpur': { lat: 23.1815, lon: 79.9864 },
  'gwalior': { lat: 26.2183, lon: 78.1828 },
  'vijayawada': { lat: 16.5062, lon: 80.6480 },
  'jodhpur': { lat: 26.2389, lon: 73.0243 },
  'madurai': { lat: 9.9252, lon: 78.1198 },
  'raipur': { lat: 21.2514, lon: 81.6296 },
  'kota': { lat: 25.2138, lon: 75.8648 },
  'guwahati': { lat: 26.1445, lon: 91.7362 },
  'chandigarh': { lat: 30.7333, lon: 76.7794 },
  'solapur': { lat: 17.6599, lon: 75.9064 },
  'hubballi': { lat: 15.3647, lon: 75.1240 },
  'hubli': { lat: 15.3647, lon: 75.1240 },
  'tiruchirappalli': { lat: 10.7905, lon: 78.7047 },
  'trichy': { lat: 10.7905, lon: 78.7047 },
  'bareilly': { lat: 28.3670, lon: 79.4304 },
  'moradabad': { lat: 28.8386, lon: 78.7733 },
  'mysuru': { lat: 12.2958, lon: 76.6394 },
  'mysore': { lat: 12.2958, lon: 76.6394 },
  'gurgaon': { lat: 28.4595, lon: 77.0266 },
  'gurugram': { lat: 28.4595, lon: 77.0266 },
  'aligarh': { lat: 27.8974, lon: 78.0880 },
  'jalandhar': { lat: 31.3260, lon: 75.5762 },
  'tirupppur': { lat: 11.1085, lon: 77.3411 },
  'tiruppur': { lat: 11.1085, lon: 77.3411 },
  'salem': { lat: 11.6643, lon: 78.1460 },
  'pondicherry': { lat: 11.9416, lon: 79.8083 },
  'puducherry': { lat: 11.9416, lon: 79.8083 },
  'mangaluru': { lat: 12.9141, lon: 74.8560 },
  'mangalore': { lat: 12.9141, lon: 74.8560 },
  'kochi': { lat: 9.9312, lon: 76.2673 },
  'cochin': { lat: 9.9312, lon: 76.2673 },
  'thiruvananthapuram': { lat: 8.5241, lon: 76.9366 },
  'trivandrum': { lat: 8.5241, lon: 76.9366 },
  'kozhikode': { lat: 11.2588, lon: 75.7804 },
  'calicut': { lat: 11.2588, lon: 75.7804 },
  'thrissur': { lat: 10.5276, lon: 76.2144 },
  'kollam': { lat: 8.8932, lon: 76.6141 },
  'ernakulam': { lat: 9.9816, lon: 76.2999 },
  'vellore': { lat: 12.9165, lon: 79.1325 },
  'tirunelveli': { lat: 8.7139, lon: 77.7567 },
  'thoothukudi': { lat: 8.7642, lon: 78.1348 },
  'tuticorin': { lat: 8.7642, lon: 78.1348 },
  'kurnool': { lat: 15.8281, lon: 78.0373 },
  'warangal': { lat: 17.9784, lon: 79.5941 },
  'guntur': { lat: 16.3067, lon: 80.4365 },
  'nellore': { lat: 14.4426, lon: 79.9865 },
  'kakinada': { lat: 16.9891, lon: 82.2475 },
  'rajahmundry': { lat: 17.0005, lon: 81.8040 },
  'tirupati': { lat: 13.6288, lon: 79.4192 },
  'anantapur': { lat: 14.6819, lon: 77.6006 },
  'bikaner': { lat: 28.0229, lon: 73.3119 },
  'udaipur': { lat: 24.5854, lon: 73.7125 },
  'bhilai': { lat: 21.1938, lon: 81.3509 },
  'cuttack': { lat: 20.4625, lon: 85.8828 },
  'bhubaneswar': { lat: 20.2961, lon: 85.8245 },
  'bhubaneshwar': { lat: 20.2961, lon: 85.8245 },
  'rourkela': { lat: 22.2604, lon: 84.8536 },
  'amravati': { lat: 20.9374, lon: 77.7796 },
  'nanded': { lat: 19.1383, lon: 77.3210 },
  'kolhapur': { lat: 16.7050, lon: 74.2433 },
  'akola': { lat: 20.7059, lon: 77.0074 },
  'latur': { lat: 18.4088, lon: 76.5604 },
  'sangli': { lat: 16.8524, lon: 74.5815 },
  'jamnagar': { lat: 22.4707, lon: 70.0577 },
  'bhavnagar': { lat: 21.7645, lon: 72.1519 },
  'junagadh': { lat: 21.5222, lon: 70.4579 },
  'gandhidham': { lat: 23.0753, lon: 70.1337 },
  'shimla': { lat: 31.1048, lon: 77.1734 },
  'dharamsala': { lat: 32.2190, lon: 76.3234 },
  'dehradun': { lat: 30.3165, lon: 78.0322 },
  'haridwar': { lat: 29.9457, lon: 78.1642 },
  'rishikesh': { lat: 30.0869, lon: 78.2676 },
  'nainital': { lat: 29.3803, lon: 79.4636 },
  'mussoorie': { lat: 30.4598, lon: 78.0664 },
  'agartala': { lat: 23.8315, lon: 91.2868 },
  'imphal': { lat: 24.8170, lon: 93.9368 },
  'shillong': { lat: 25.5788, lon: 91.8933 },
  'aizawl': { lat: 23.7307, lon: 92.7173 },
  'kohima': { lat: 25.6701, lon: 94.1077 },
  'itanagar': { lat: 27.0844, lon: 93.6053 },
  'panaji': { lat: 15.4909, lon: 73.8278 },
  'panjim': { lat: 15.4909, lon: 73.8278 },
  'port blair': { lat: 11.6234, lon: 92.7265 },
  'gangtok': { lat: 27.3389, lon: 88.6065 },
};

async function geocodePlace(place: string): Promise<CityCoordinate> {
  // Fast path: check curated list first to avoid Nominatim ambiguity issues.
  const cleanedPlace = cleanCityName(place).trim();
  const normalised = cleanedPlace.toLowerCase();
  const known = KNOWN_CITY_COORDS[normalised];
  if (known) return known;

  // Fetch multiple results and prefer city/town/village/suburb place types
  // over administrative boundaries, which often have off-centre centroids.
  const params = new URLSearchParams({
    q: `${cleanedPlace}, India`,
    format: 'jsonv2',
    limit: '10',
    countrycodes: 'in',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error('City lookup failed. Check your connection and try again.');
  const results = await response.json() as { lat: string; lon: string; class: string; type: string }[];
  if (!results.length) throw new Error(`Could not find ${place} on the map.`);

  // Prefer place-class results (city, town, village, suburb) over administrative boundaries.
  const placePriority = ['city', 'town', 'village', 'suburb', 'hamlet', 'municipality'];
  const best =
    results.find((r) => r.class === 'place' && placePriority.includes(r.type)) ??
    results.find((r) => r.class === 'place') ??
    results[0];

  return { lat: Number(best.lat), lon: Number(best.lon) };
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