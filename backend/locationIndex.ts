/**
 * India Location Search Index
 * ===========================
 * Loads the NDJSON dataset produced by scripts/import-india-locations.mjs and
 * builds an in-memory index for fast prefix + substring search.
 *
 * The index supports:
 *   - Prefix match on the display name         ("Tamb" → "Tambaram")
 *   - Substring match on the normalized name   ("poth" → "Potheri")
 *   - State/district filtering
 *   - Fallback to a small built-in seed when the dataset file has not yet been imported
 *
 * Data source: India Post open data (Department of Posts, Government of India)
 * API mirror:  https://github.com/aniket-thapa/india-pincode-api  (MIT)
 * Coverage:    ~165,000 post offices / delivery areas covering every state and UT
 */

import { createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NDJSON_PATH = path.join(__dirname, '..', 'data', 'india-locations.ndjson');

export interface LocationRecord {
  id: string;
  name: string;          // original with suffix, e.g. "Tambaram H.O"
  displayName: string;   // cleaned, e.g. "Tambaram"
  normalized: string;    // lowercase normalised for matching
  type: 'HO' | 'BO' | 'SO' | 'OTHER';
  district: string;
  state: string;
  pincode: string;
  lat: number | null;
  lon: number | null;
  source: string;
}

// ─── State of the index ───────────────────────────────────────────────────────

let records: LocationRecord[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
let totalRecords = 0;
let datasetPresent = false;

// ─── Seed data (fallback while dataset hasn't been imported yet) ─────────────
// This is deliberately minimal — it only exists so the app boots cleanly on
// a fresh clone before `node scripts/import-india-locations.mjs` is run.
// It is NOT a replacement for the full dataset.
const SEED: LocationRecord[] = [
  { id: 'seed__tn__chennai', name: 'Chennai H.O', displayName: 'Chennai', normalized: 'chennai', type: 'HO', district: 'Chennai', state: 'Tamil Nadu', pincode: '600001', lat: 13.0827, lon: 80.2707, source: 'seed' },
  { id: 'seed__tn__mumbai', name: 'Mumbai G.P.O', displayName: 'Mumbai', normalized: 'mumbai', type: 'HO', district: 'Mumbai', state: 'Maharashtra', pincode: '400001', lat: 19.0760, lon: 72.8777, source: 'seed' },
  { id: 'seed__dl__delhi', name: 'New Delhi H.O', displayName: 'New Delhi', normalized: 'new delhi', type: 'HO', district: 'Central Delhi', state: 'Delhi', pincode: '110001', lat: 28.6139, lon: 77.2090, source: 'seed' },
  { id: 'seed__ka__bengaluru', name: 'Bengaluru H.O', displayName: 'Bengaluru', normalized: 'bengaluru', type: 'HO', district: 'Bengaluru Urban', state: 'Karnataka', pincode: '560001', lat: 12.9716, lon: 77.5946, source: 'seed' },
  { id: 'seed__ts__hyderabad', name: 'Hyderabad H.O', displayName: 'Hyderabad', normalized: 'hyderabad', type: 'HO', district: 'Hyderabad', state: 'Telangana', pincode: '500001', lat: 17.3850, lon: 78.4867, source: 'seed' },
  { id: 'seed__tn__coimbatore', name: 'Coimbatore H.O', displayName: 'Coimbatore', normalized: 'coimbatore', type: 'HO', district: 'Coimbatore', state: 'Tamil Nadu', pincode: '641001', lat: 11.0168, lon: 76.9558, source: 'seed' },
  { id: 'seed__tn__madurai', name: 'Madurai H.O', displayName: 'Madurai', normalized: 'madurai', type: 'HO', district: 'Madurai', state: 'Tamil Nadu', pincode: '625001', lat: 9.9252, lon: 78.1198, source: 'seed' },
  { id: 'seed__tn__trichy', name: 'Tiruchirappalli H.O', displayName: 'Tiruchirappalli', normalized: 'tiruchirappalli', type: 'HO', district: 'Tiruchirappalli', state: 'Tamil Nadu', pincode: '620001', lat: 10.7905, lon: 78.7047, source: 'seed' },
  { id: 'seed__pu__puducherry', name: 'Puducherry H.O', displayName: 'Puducherry', normalized: 'puducherry', type: 'HO', district: 'Puducherry', state: 'Puducherry', pincode: '605001', lat: 11.9416, lon: 79.8083, source: 'seed' },
  { id: 'seed__kl__kochi', name: 'Kochi H.O', displayName: 'Kochi', normalized: 'kochi', type: 'HO', district: 'Ernakulam', state: 'Kerala', pincode: '682001', lat: 9.9312, lon: 76.2673, source: 'seed' },
];

// ─── Postal suffix stripping ──────────────────────────────────────────────────
// India Post office names carry suffixes like "H.O", "B.O", "S.O", "H.Q.",
// "G.P.O.", "R.S." etc. Strip them all to produce a clean city/town name.
// The cleaned name is stored as `cityName` on search results.

// Strips trailing India Post office-type suffixes from a location name.
// Handles all real patterns found in the India Post dataset.
// eslint-disable-next-line no-useless-escape
const POSTAL_SUFFIX_RE = /\s+(Ho|Bo|So|H\.o\.|B\.o\.|S\.o\.|H\.O\.|B\.O\.|S\.O\.|H\.O|B\.O|S\.O|HO|BO|SO|H\.q\.|H\.Q\.|Hq|HQ|G\.p\.o\.|G\.P\.O\.?|G\.p\.o|GPO|Gpo|R\.s\.|R\.S\.|RS|M\.d\.o\.|MDG|MDO|Head Office|Branch Office|Sub Office|Collectorate)\s*$/;

// Also strip trailing bracketed district qualifiers added by some records,
// e.g. "Airport S.O (Mumbai)" → "Airport S.O" → "Airport"
const BRACKET_SUFFIX_RE = /\s*\([^)]{1,40}\)\s*$/;

function stripPostalSuffix(name: string): string {
  // 1. Strip postal suffix
  let s = name.replace(POSTAL_SUFFIX_RE, '').trim();
  // 2. Strip bracketed qualifier (e.g. "(guntur)", "(Mumbai)")
  s = s.replace(BRACKET_SUFFIX_RE, '').trim();
  // 3. If postal suffix is still present after bracket stripping (e.g. "S.O (Mumbai)" → "S.O"), strip again
  s = s.replace(POSTAL_SUFFIX_RE, '').trim();
  return s;
}

// Title-case a string (first letter of each word capitalised)
function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

// Derive a clean city name from a record:
// Prefer stripping the suffix from displayName.
// If the result is empty (name was just a suffix), fall back to district.
function deriveCityName(rec: LocationRecord): string {
  const stripped = stripPostalSuffix(rec.displayName);
  if (stripped.length >= 2) return toTitleCase(stripped);
  return toTitleCase(rec.district);
}

// ─── Normalise helper ─────────────────────────────────────────────────────────

export function normalizeQuery(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Index loader ─────────────────────────────────────────────────────────────

export async function loadLocationIndex(): Promise<void> {
  if (loaded) return;
  if (loading) return loading;

  loading = (async () => {
    if (!existsSync(NDJSON_PATH)) {
      console.warn('[locationIndex] Dataset file not found at', NDJSON_PATH);
      console.warn('[locationIndex] Using seed data. Run: node scripts/import-india-locations.mjs');
      records = [...SEED];
      datasetPresent = false;
      totalRecords = records.length;
      loaded = true;
      return;
    }

    console.log('[locationIndex] Loading India location dataset…');
    const t0 = Date.now();
    const rl = createInterface({ input: createReadStream(NDJSON_PATH, { encoding: 'utf8' }), crlfDelay: Infinity });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const rec = JSON.parse(trimmed) as LocationRecord;
        records.push(rec);
      } catch {
        // skip malformed lines
      }
    }

    totalRecords = records.length;
    datasetPresent = true;
    loaded = true;
    console.log(`[locationIndex] Loaded ${totalRecords.toLocaleString()} locations in ${Date.now() - t0}ms`);
  })();

  return loading;
}

// ─── Eager load on module import ──────────────────────────────────────────────
// This fires immediately when the module is first imported by the server so the
// index is warm before the first request arrives.
void loadLocationIndex();

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchOptions {
  query: string;
  limit?: number;
  state?: string;       // filter by state name (case-insensitive)
  district?: string;    // filter by district name (case-insensitive)
}

export interface SearchResult {
  id: string;
  /** Clean city/town/village name with postal suffixes stripped (e.g. "Chennai", "Tambaram", "Puducherry") */
  cityName: string;
  /** Original post-office display name (kept for internal use / coordinates lookup) */
  displayName: string;
  district: string;
  state: string;
  pincode: string;
  lat: number | null;
  lon: number | null;
  type: string;
  /** How the match was found: prefix | contains | word */
  matchType: 'prefix' | 'contains' | 'word';
}

export function searchLocations(opts: SearchOptions): SearchResult[] {
  const { query, limit = 20, state, district } = opts;
  const q = normalizeQuery(query);
  if (!q || q.length < 2) return [];

  const stateFilter = state ? normalizeQuery(state) : null;
  const districtFilter = district ? normalizeQuery(district) : null;

  const prefix: SearchResult[] = [];
  const wordStart: SearchResult[] = [];
  const contains: SearchResult[] = [];

  // Deduplicate: one result per unique (cityName, state) pair.
  // This prevents "Tambaram Ho", "Tambaram West So", "Tambaram East So" all
  // appearing — only the best-ranked one (HO > SO > BO > OTHER) is kept.
  const seen = new Set<string>();

  for (const rec of records) {
    // State / district filter
    if (stateFilter && !normalizeQuery(rec.state).includes(stateFilter)) continue;
    if (districtFilter && !normalizeQuery(rec.district).includes(districtFilter)) continue;

    const cityName = deriveCityName(rec);
    const dedupeKey = `${normalizeQuery(cityName)}||${normalizeQuery(rec.state)}`;

    // Search against the clean city name (after suffix stripping)
    const n = normalizeQuery(cityName);

    let matchType: SearchResult['matchType'] | null = null;
    if (n.startsWith(q)) {
      matchType = 'prefix';
    } else if (n.split(' ').some(word => word.startsWith(q))) {
      matchType = 'word';
    } else if (n.includes(q)) {
      matchType = 'contains';
    }

    if (!matchType) continue;

    // Only add if we haven't seen this cityName+state combo yet
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const result = toResult(rec, matchType, cityName);
    if (matchType === 'prefix') prefix.push(result);
    else if (matchType === 'word') wordStart.push(result);
    else contains.push(result);

    // Stop early once we have far more than needed
    if (prefix.length + wordStart.length + contains.length > limit * 10) break;
  }

  // Prioritise HO > SO > BO > OTHER within each tier; then alphabetical by cityName
  const typePriority: Record<string, number> = { HO: 0, SO: 1, BO: 2, OTHER: 3 };
  const rank = (r: SearchResult) => typePriority[r.type] ?? 4;
  const byName = (a: SearchResult, b: SearchResult) => a.cityName.localeCompare(b.cityName);
  prefix.sort((a, b) => rank(a) - rank(b) || byName(a, b));
  wordStart.sort((a, b) => rank(a) - rank(b) || byName(a, b));
  contains.sort((a, b) => rank(a) - rank(b) || byName(a, b));

  return [...prefix, ...wordStart, ...contains].slice(0, limit);
}

function toResult(rec: LocationRecord, matchType: SearchResult['matchType'], cityName: string): SearchResult {
  return {
    id: rec.id,
    cityName,
    displayName: rec.displayName,
    district: rec.district,
    state: rec.state,
    pincode: rec.pincode,
    lat: rec.lat,
    lon: rec.lon,
    type: rec.type,
    matchType,
  };
}

// ─── Index status ─────────────────────────────────────────────────────────────

export function getIndexStatus() {
  return {
    loaded,
    datasetPresent,
    totalRecords,
    dataFile: NDJSON_PATH,
  };
}
