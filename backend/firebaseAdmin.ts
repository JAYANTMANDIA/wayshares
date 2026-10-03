import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;

if (!getApps().length) {
  if (serviceAccountJson) {
    initializeApp({
      credential: cert(JSON.parse(serviceAccountJson)),
      ...(projectId ? { projectId } : {})
    });
  } else if (process.env.VERCEL) {
    throw new Error('Set FIREBASE_SERVICE_ACCOUNT_JSON and FIREBASE_PROJECT_ID in the Vercel project environment variables.');
  } else {
    initializeApp({
      credential: applicationDefault(),
      ...(projectId ? { projectId } : {})
    });
  }
}

export const adminAuth = getAuth();
export const db = getFirestore();
export { FieldValue };