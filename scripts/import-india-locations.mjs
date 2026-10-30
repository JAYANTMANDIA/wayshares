/**
 * India Geographic Database Import Script
 * ========================================
 * Source: India Post open data via https://github.com/aniket-thapa/india-pincode-api
 * License: Data is from India Post (government open data). The static API is MIT-licensed.
 * Attribution: Department of Posts, Government of India; OpenStreetMap contributors.
 *
 * This script fetches every state → district → post office from the static API
 * (~165,000+ records covering every post office / delivery area across India, including
 * villages, towns, cities, localities and suburbs) and writes them to:
 *   data/india-locations.ndjson
 *
 * Each line is a JSON record:
 * {
 *   id: string,           // unique: state-district-office slug
 *   name: string,         // original office name (e.g. "Tambaram H.O", "Potheri B.O")
 *   displayName: string,  // cleaned name without office-type suffix
 *   normalized: string,   // lowercase, diacritic-stripped, for search indexing
 *   type: string,         // "HO" | "BO" | "SO"
 *   district: string,
 *   state: string,
 *   pincode: string,
 *   lat: number | null,
 *   lon: number | null,
 *   source: "india-post"
 * }
 *
 * Usage:
 *   node scripts/import-india-locations.mjs
 *   node scripts/import-india-locations.mjs --dry-run   (fetch only first 3 states)
 *
 * Re-running is safe — output file is fully overwritten.
 */

import { createWriteStream, mkdirSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const OUT_FILE = join(DATA_DIR, 'india-locations.ndjson');
const STATS_FILE = join(DATA_DIR, 'india-locations-import-stats.json');

const BASE_URL = 'https://aniket-thapa.github.io/india-pincode-api';
const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = 5; // parallel district fetches
const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 1500;

// ─── helpers ─────────────────────────────────────────────────────────────────

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'WAYSHARE-location-importer/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } catch (err) {
    if (attempt < RETRY_LIMIT) {
      await sleep(RETRY_DELAY_MS * attempt);
      return fetchJson(url, attempt + 1);
    }
    throw err;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Clean office name: strip suffix like "H.O", "B.O", "S.O", "Head Office", etc.
 * Also title-cases the result.
 */
function cleanName(raw) {
  return raw
    .replace(/\s+[HhBbSs]\.[Oo]\.?\s*$/g, '')
    .replace(/\s+(Head\s+Office|Branch\s+Office|Sub\s+Office)\s*$/gi, '')
    .trim();
}

/**
 * Normalize for search: lowercase, strip common punctuation/diacritics.
 */
function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Title-case a string
function titleCase(s) {
  return s
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, c => c.toUpperCase());
}

// ─── worker pool ─────────────────────────────────────────────────────────────

async function runWithConcurrency(tasks, concurrency) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  WAYSHARE — India Geographic Database Import         ║');
  console.log('║  Source: India Post open data (data.gov.in)          ║');
  console.log('║  API mirror: aniket-thapa.github.io/india-pincode-api║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  // ── 1. Fetch state list ──
  console.log('Fetching state list…');
  /** @type {{ name: string, slug: string, districtCount: number, officeCount: number }[]} */
  let states = await fetchJson(`${BASE_URL}/states.json`);

  if (DRY_RUN) {
    console.log('DRY RUN mode — limiting to first 3 states');
    states = states.slice(0, 3);
  }

  console.log(`Found ${states.length} states/UTs. Total offices across all states: ${states.reduce((s, st) => s + st.officeCount, 0).toLocaleString()}`);
  console.log('');

  // ── 2. Fetch all districts per state ──
  const allDistricts = []; // { stateName, stateSlug, districtName, districtSlug }

  console.log('Fetching district lists for all states…');
  await runWithConcurrency(states.map(st => async () => {
    const data = await fetchJson(`${BASE_URL}/states/${st.slug}.json`);
    for (const d of data.districts || []) {
      allDistricts.push({
        stateName: st.name,
        stateSlug: st.slug,
        districtName: d.name,
        districtSlug: d.slug,
        officeCount: d.officeCount
      });
    }
    process.stdout.write('.');
  }), CONCURRENCY);
  console.log(`\nFound ${allDistricts.length} districts total.\n`);

  // ── 3. Stream all offices to output file ──
  const stream = createWriteStream(OUT_FILE, { encoding: 'utf8' });
  const writeRecord = (rec) => new Promise((resolve, reject) => {
    const line = JSON.stringify(rec) + '\n';
    if (!stream.write(line)) {
      stream.once('drain', resolve);
    } else {
      resolve();
    }
  });

  // Counters
  const statsCounts = {}; // stateName -> { total, withCoords }
  const typeCount = { HO: 0, BO: 0, SO: 0, OTHER: 0 };
  let total = 0;
  let withCoords = 0;
  const seenIds = new Set();
  let duplicates = 0;

  let done = 0;
  const total_districts = allDistricts.length;

  // Process in batches to stay within memory
  const BATCH = 20;
  for (let i = 0; i < allDistricts.length; i += BATCH) {
    const batch = allDistricts.slice(i, i + BATCH);
    await runWithConcurrency(batch.map(({ stateName, stateSlug, districtName, districtSlug }) => async () => {
      let data;
      try {
        data = await fetchJson(`${BASE_URL}/districts/${stateSlug}/${districtSlug}.json`);
      } catch (err) {
        console.error(`\n  ⚠ Failed to fetch ${stateSlug}/${districtSlug}: ${err.message}`);
        return;
      }

      const offices = data.offices || [];
      const stateKey = titleCase(stateName.toLowerCase());
      if (!statsCounts[stateKey]) statsCounts[stateKey] = { total: 0, withCoords: 0, districts: 0 };
      statsCounts[stateKey].districts++;

      for (const office of offices) {
        const rawName = String(office.officeName || '').trim();
        if (!rawName) continue;

        const officeType = String(office.officeType || '').toUpperCase();
        const pincode = String(office.pincode || '').trim();
        const lat = typeof office.latitude === 'number' ? office.latitude : null;
        const lon = typeof office.longitude === 'number' ? office.longitude : null;

        const displayName = titleCase(cleanName(rawName));
        const id = `${stateSlug}__${districtSlug}__${slugify(rawName)}`;

        if (seenIds.has(id)) { duplicates++; continue; }
        seenIds.add(id);

        const rec = {
          id,
          name: titleCase(rawName),
          displayName,
          normalized: normalize(displayName),
          type: ['HO', 'BO', 'SO'].includes(officeType) ? officeType : 'OTHER',
          district: titleCase(districtName.toLowerCase()),
          state: stateKey,
          pincode,
          lat,
          lon,
          source: 'india-post'
        };

        await writeRecord(rec);
        total++;
        statsCounts[stateKey].total++;

        if (lat !== null && lon !== null) {
          withCoords++;
          statsCounts[stateKey].withCoords++;
        }

        typeCount[rec.type] = (typeCount[rec.type] || 0) + 1;
      }
    }), CONCURRENCY);

    done += batch.length;
    const pct = Math.round((done / total_districts) * 100);
    process.stdout.clearLine?.(0);
    process.stdout.cursorTo?.(0);
    process.stdout.write(`  Districts processed: ${done}/${total_districts} (${pct}%) — records written: ${total.toLocaleString()}`);
  }

  await new Promise(resolve => stream.end(resolve));
  console.log('\n');

  // ── 4. Print summary ──
  const stats = {
    importedAt: new Date().toISOString(),
    source: 'India Post open data via aniket-thapa.github.io/india-pincode-api',
    license: 'India Post open government data; API MIT-licensed',
    attribution: 'Department of Posts, Government of India',
    totalRecords: total,
    duplicatesSkipped: duplicates,
    recordsWithCoordinates: withCoords,
    recordsWithoutCoordinates: total - withCoords,
    byType: typeCount,
    byState: statsCounts
  };

  await writeFile(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');

  console.log('══════════════════════════════════════════════════════');
  console.log(`  ✅  Import complete`);
  console.log(`  Total records:         ${total.toLocaleString()}`);
  console.log(`  Duplicates skipped:    ${duplicates.toLocaleString()}`);
  console.log(`  With coordinates:      ${withCoords.toLocaleString()} (${Math.round(withCoords/total*100)}%)`);
  console.log(`  Without coordinates:   ${(total-withCoords).toLocaleString()}`);
  console.log('');
  console.log('  Breakdown by office type:');
  for (const [type, count] of Object.entries(typeCount)) {
    console.log(`    ${type.padEnd(8)} ${count.toLocaleString()}`);
  }
  console.log('');
  console.log('  Records by state (top 10 by count):');
  Object.entries(statsCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .forEach(([state, s]) => {
      console.log(`    ${state.padEnd(35)} ${String(s.total).padStart(6)} records  (${s.districts} districts)`);
    });
  console.log('');
  console.log(`  Output: ${OUT_FILE}`);
  console.log(`  Stats:  ${STATS_FILE}`);
  console.log('══════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('\nImport failed:', err);
  process.exitCode = 1;
});
