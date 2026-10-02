/**
 * WAYSHARE Firestore Database Setup
 * Connects with real service account from .env and creates all required collections
 */
'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const admin = require('firebase-admin');
const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app');

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
const db = admin.firestore();

async function main() {
  console.log('\n🔥  Firebase project: ' + projectId);
  console.log('🔐  Authentication:   ' + (serviceAccount ? 'service account' : 'Application Default Credentials') + '\n');

  // 1. Verify connection
  console.log('📡  Testing Firestore connection...');
  try {
    await db.collection('_health').doc('ping').set({ ts: admin.firestore.FieldValue.serverTimestamp() });
    await db.collection('_health').doc('ping').delete();
    console.log('   ✅  Firestore connection OK\n');
  } catch (err) {
    console.error('   ❌  Firestore error:', err.message, '\n');
    process.exit(1);
  }

  // 2. Create trustedContacts collection marker
  console.log('📁  Creating trustedContacts collection...');
  await db.collection('trustedContacts').doc('__schema__').set({
    __description__: 'Trusted emergency contacts for WAYSHARE live location SMS alerts',
    __fields__: {
      userId:       'string — Firebase Auth UID of the owner',
      contactName:  'string — Display name',
      phoneNumber:  'string — E.164 format (+91XXXXXXXXXX)',
      relationship: 'string — Family / Friend / Colleague',
      createdAt:    'Firestore Timestamp'
    },
    __created__: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log('   ✅  trustedContacts collection ready\n');

  // 3. Create locationSessions collection marker
  console.log('📁  Creating locationSessions collection...');
  await db.collection('locationSessions').doc('__schema__').set({
    __description__: 'Live GPS tracking sessions for WAYSHARE safety feature',
    __fields__: {
      userId:       'string — Firebase Auth UID of the sharer',
      sharerName:   'string — Name shown to recipients on live map',
      sessionToken: 'string — 32-char hex token (public URL key)',
      latitude:     'number — Latest GPS latitude',
      longitude:    'number — Latest GPS longitude',
      active:       'boolean — true while sharing is active',
      startedAt:    'Firestore Timestamp',
      updatedAt:    'Firestore Timestamp',
      endedAt:      'Firestore Timestamp | null'
    },
    __created__: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log('   ✅  locationSessions collection ready\n');

  // 4. List existing collections to confirm
  console.log('📋  All collections in configured Firebase project:');
  const collections = await db.listCollections();
  collections.forEach(col => console.log('   •', col.id));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅  DATABASE SETUP COMPLETE!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Collections created:');
  console.log('  ✅  trustedContacts   — persistent trusted contacts');
  console.log('  ✅  locationSessions  — live GPS tracking sessions');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Fill in your Firebase Web API keys in .env');
  console.log('     (VITE_FIREBASE_API_KEY, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID)');
  console.log('  2. Run the app: npm run dev');
  console.log('  3. (Optional) Add Twilio keys for SMS alerts');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌  Setup failed:', err.message, '\n');
  process.exit(1);
});
