import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const firebaseConfigValues = {
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  VITE_FIREBASE_STORAGE_BUCKET: firebaseConfig.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
  VITE_FIREBASE_APP_ID: firebaseConfig.appId
};
const isConfiguredValue = (value: string | undefined) => {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return false;
  return !/^(your[-_ ]|replace[-_ ]|paste|placeholder)/i.test(trimmedValue);
};

export const missingFirebaseConfig = Object.entries(firebaseConfigValues)
  .filter(([, value]) => !isConfiguredValue(value))
  .map(([key]) => key);
export const firebaseConfigError = missingFirebaseConfig.length
  ? `Firebase is not configured. Missing or placeholder values: ${missingFirebaseConfig.join(', ')}. ${
      import.meta.env.PROD
        ? 'Set these in Vercel Project Settings > Environment Variables, then redeploy.'
        : 'Set these in .env.local, then restart the dev server.'
    }`
  : 'Firebase is not configured. Check the Firebase web app settings and restart or redeploy.';

export const app = missingFirebaseConfig.length === 0 ? getApps().length ? getApp() : initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;

if (app && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectAuthEmulator(auth!, 'http://127.0.0.1:9099');
  connectFirestoreEmulator(db!, '127.0.0.1', 8080);
  connectStorageEmulator(storage!, '127.0.0.1', 9199);
}
