/**
 * WAYSHARE Firestore Database Setup — ESM version
 * Run with: npx tsx scripts/setup-db.ts
 */
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Manually parse .env since dotenv/config may not pick up single-quoted values
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.substring(0, idx).trim();
  let val = trimmed.substring(idx + 1).trim();
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    val = val.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = val;
}

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const serviceAccount = serviceAccountJson && !serviceAccountJson.startsWith('PASTE')
  ? JSON.parse(serviceAccountJson)
  : undefined;
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

if (!getApps().length) {
  initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    ...(projectId || serviceAccount?.project_id ? { projectId: projectId || serviceAccount.project_id } : {})
  });
}

const db = getFirestore();

console.log('\n🔥  Firebase project: ' + projectId);
console.log('🔐  Authentication:   ' + (serviceAccount ? 'service account' : 'Application Default Credentials') + '\n');

// 1. Connection test
console.log('📡  Testing Firestore connection...');
try {
  await db.collection('_health').doc('ping').set({ ts: FieldValue.serverTimestamp() });
  await db.collection('_health').doc('ping').delete();
  console.log('   ✅  Firestore connection OK\n');
} catch (err: any) {
  console.error('   ❌  Firestore error:', err.message);
  process.exit(1);
}

// 2. trustedContacts
console.log('📁  Creating trustedContacts collection...');
await db.collection('trustedContacts').doc('__schema__').set({
  __description__: 'Emergency contacts for WAYSHARE live location SMS alerts',
  __fields__: {
    userId:       'string — Firebase Auth UID',
    contactName:  'string — Display name',
    phoneNumber:  'string — E.164 (+91XXXXXXXXXX)',
    relationship: 'string — Family / Friend / Colleague',
    createdAt:    'Firestore Timestamp'
  },
  __created__: FieldValue.serverTimestamp()
});
console.log('   ✅  trustedContacts ready\n');

// 3. locationSessions
console.log('📁  Creating locationSessions collection...');
await db.collection('locationSessions').doc('__schema__').set({
  __description__: 'Live GPS tracking sessions for WAYSHARE safety',
  __fields__: {
    userId:       'string — sharer UID',
    sharerName:   'string — shown on live map',
    sessionToken: 'string — 32-char hex token',
    latitude:     'number',
    longitude:    'number',
    active:       'boolean',
    startedAt:    'Timestamp',
    updatedAt:    'Timestamp',
    endedAt:      'Timestamp | null'
  },
  __created__: FieldValue.serverTimestamp()
});
console.log('   ✅  locationSessions ready\n');

// 4. List all collections
console.log('📋  All collections in configured Firebase project:');
const cols = await db.listCollections();
cols.forEach(c => console.log('   •', c.id));

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  DATABASE SETUP COMPLETE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Collections created in Firestore:
  ✅  trustedContacts   — stores user trusted contacts
  ✅  locationSessions  — stores live GPS sessions

The backend API is ready to use these collections.
Run the app with:  npm run dev
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
process.exit(0);
