import {
  User as FirebaseUser,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  updateProfile
} from 'firebase/auth';
import { User } from '../types';
import { readApiJson } from './apiJson';
import { auth, db } from './firebase';

const EMAIL_LINK_KEY = 'uberx_email_link';
const EMAIL_NAME_KEY = 'uberx_email_name';

function requireFirebaseAuth() {
  if (!auth || !db) {
    throw new Error('Firebase is not configured. Add the Firebase settings to .env.local.');
  }
  return { auth, db };
}

export function isEmailSignInLink() {
  return Boolean(auth && isSignInWithEmailLink(auth, window.location.href));
}

export async function sendEmailSignInLink(email: string, fullName?: string) {
  const { auth: firebaseAuth } = requireFirebaseAuth();
  const actionCodeSettings = {
    url: `${window.location.origin}/?auth=email-link`,
    handleCodeInApp: true
  };

  localStorage.setItem(EMAIL_LINK_KEY, email);
  if (fullName) localStorage.setItem(EMAIL_NAME_KEY, fullName);
  else localStorage.removeItem(EMAIL_NAME_KEY);

  await sendSignInLinkToEmail(firebaseAuth, email, actionCodeSettings);
}

export async function completeEmailSignIn(email: string) {
  const { auth: firebaseAuth } = requireFirebaseAuth();
  if (!isSignInWithEmailLink(firebaseAuth, window.location.href)) {
    throw new Error('Open the sign-in link from your email to continue.');
  }

  const credential = await signInWithEmailLink(firebaseAuth, email, window.location.href);
  const fullName = localStorage.getItem(EMAIL_NAME_KEY) || undefined;
  if (fullName) await updateProfile(credential.user, { displayName: fullName });
  localStorage.removeItem(EMAIL_LINK_KEY);
  localStorage.removeItem(EMAIL_NAME_KEY);
  window.history.replaceState({}, document.title, window.location.pathname);
  return credential.user;
}

export function getPendingEmail() {
  return localStorage.getItem(EMAIL_LINK_KEY) || '';
}

export async function saveFirebaseUserProfile(
  firebaseUser: FirebaseUser,
  suppliedName?: string,
  suppliedPhone?: string,
  requireServerProfile = false
): Promise<User> {
  requireFirebaseAuth();
  const preferredName = suppliedName || firebaseUser.displayName || '';
  let serverProfile: Partial<User> = {};
  try {
    const response = await fetch('/api/user/session', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...(preferredName ? { fullName: preferredName } : {}),
        ...(suppliedPhone ? { phoneNumber: suppliedPhone } : {})
      })
    });
    const result = await readApiJson<{ user?: Partial<User>; error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to create your profile');
    serverProfile = result.user as Partial<User>;
  } catch (error) {
    console.warn('Firebase sign-in succeeded, but server profile sync failed', error);
    if (requireServerProfile) throw error;
  }
  const now = new Date().toISOString();
  const profile: User = {
    ...serverProfile,
    id: firebaseUser.uid,
    fullName: preferredName || serverProfile.fullName || firebaseUser.email || 'UberX rider',
    email: firebaseUser.email || serverProfile.email || '',
    phoneNumber: suppliedPhone || firebaseUser.phoneNumber || serverProfile.phoneNumber || '',
    profilePhoto: firebaseUser.photoURL || serverProfile.profilePhoto || '',
    city: serverProfile.city || '',
    verificationStatus: serverProfile.verificationStatus || 'unverified',
    userRole: serverProfile.userRole || 'passenger',
    rating: Number(serverProfile.rating) || 0,
    totalTrips: Number(serverProfile.totalTrips) || 0,
    aadhaarNumber: undefined,
    aadhaarVerified: false,
    aadhaarDoc: undefined,
    panNumber: undefined,
    panVerified: false,
    panDoc: undefined,
    rcNumber: serverProfile.rcNumber,
    rcVerified: serverProfile.rcVerified === true,
    rcDoc: undefined,
    canProvideRide: serverProfile.rcVerified === true && Boolean(serverProfile.rcNumber),
    createdAt: now,
    updatedAt: now
  };

  if (suppliedName && firebaseUser.displayName !== suppliedName) {
    await updateProfile(firebaseUser, { displayName: suppliedName });
  }
  return profile;
}

export function firebaseErrorMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    'auth/invalid-phone-number': 'Enter a valid phone number including its country code.',
    'auth/invalid-verification-code': 'That verification code is incorrect. Try again.',
    'auth/code-expired': 'That verification code expired. Request a new one.',
    'auth/too-many-requests': 'Firebase temporarily blocked verification attempts. Wait before retrying, and check spam or junk for earlier emails.',
    'auth/quota-exceeded': 'Firebase email sending is temporarily rate-limited. Email/password sign-in does not use this quota; try password reset later.',
    'auth/email-already-in-use': 'An account already exists for this email. Log in instead.',
    'auth/weak-password': 'Choose a password with at least 8 characters.',
    'auth/invalid-credential': 'Email or password is incorrect. Check your details and try again.',
    'auth/invalid-login-credentials': 'Email or password is incorrect. Check your details and try again.',
    'auth/operation-not-allowed': 'This sign-in method is disabled in Firebase Authentication settings.',
    'auth/configuration-not-found': 'Firebase Authentication is not initialized. In Firebase Console, enable Email/Password sign-in.',
    'auth/unauthorized-continue-uri': 'This domain is not authorized for Firebase sign-in links.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.'
  };
  return messages[code] || (error instanceof Error ? error.message : 'Authentication failed. Please try again.');
}