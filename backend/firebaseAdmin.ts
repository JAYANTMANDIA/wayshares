import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import type { ServiceAccount } from 'firebase-admin/app';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
export let firebaseAdminInitError = '';

function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw?.trim()) return null;
  let text = raw.trim();
  if (
    (text.startsWith("'") && text.endsWith("'")) ||
    (text.startsWith('"') && text.endsWith('"'))
  ) {
    text = text.slice(1, -1);
  }
  try {
    const parsed = JSON.parse(text) as ServiceAccount;
    if (!parsed || typeof parsed !== 'object') throw new Error('Service account JSON is empty');
    return parsed;
  } catch (jsonError) {
    try {
      const decoded = Buffer.from(text, 'base64').toString('utf8');
      return JSON.parse(decoded) as ServiceAccount;
    } catch {
      throw jsonError;
    }
  }
}

if (!getApps().length) {
  try {
    const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
        ...(projectId ? { projectId } : {})
      });
    } else if (!process.env.VERCEL) {
      initializeApp({
        credential: applicationDefault(),
        ...(projectId ? { projectId } : {})
      });
    } else {
      firebaseAdminInitError = 'Set FIREBASE_SERVICE_ACCOUNT_JSON and FIREBASE_PROJECT_ID in Vercel → Settings → Environment Variables (Production), then redeploy.';
      initializeApp({ ...(projectId ? { projectId } : { projectId: 'unconfigured' }) });
    }
  } catch (error) {
    firebaseAdminInitError = error instanceof Error
      ? `Firebase Admin failed to start: ${error.message}`
      : 'Firebase Admin failed to start. Check FIREBASE_SERVICE_ACCOUNT_JSON.';
    console.error(firebaseAdminInitError);
    if (!getApps().length) {
      initializeApp({ ...(projectId ? { projectId } : { projectId: 'unconfigured' }) });
    }
  }
}

export const adminAuth = getAuth();
export const db = getFirestore();
export { FieldValue };
