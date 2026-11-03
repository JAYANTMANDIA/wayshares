import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import type { Express, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { google } from 'googleapis';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, db, FieldValue, firebaseAdminInitError } from './firebaseAdmin.js';
import { searchLocations, getIndexStatus, loadLocationIndex } from './locationIndex.js';
import {
  geocodeLocation,
  fetchRouteFromOSRM,
  decodePolyline,
  checkSegmentCompatibility,
  calculateSegmentFare,
  MAX_SNAP_KM,
  MAX_DETOUR_KM,
} from './routeService.js';

type AuthRequest = Request & { uid: string; authEmail?: string; authPhone?: string; authEmailVerified?: boolean };

const users            = db.collection('users');
const rides            = db.collection('rides');
const bookings         = db.collection('bookings');
const payments         = db.collection('payments');
const reviews          = db.collection('reviews');
const scheduledRides   = db.collection('scheduledRides');
const trustedContacts  = db.collection('trustedContacts');
const locationSessions = db.collection('locationSessions');
const driveIntegration = db.collection('_privateIntegrations').doc('googleDrive');
const driveOAuthStates = new Map<string, number>();

const allowedAdminEmail = (process.env.WAYSHARE_ADMIN_EMAIL || 'mandiajayant@gmail.com').trim().toLowerCase();
const verificationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3, fields: 0 }
}).fields([
  { name: 'aadhaarSelfie', maxCount: 1 },
  { name: 'pan', maxCount: 1 },
  { name: 'rcSelfie', maxCount: 1 }
]);

function createDriveOAuthClient(redirectUri: string) {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error('Google Drive OAuth is not configured. Add GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET to the server environment.');
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function getDriveRedirectUri(req: Request) {
  const origin = process.env.GOOGLE_DRIVE_REDIRECT_ORIGIN?.trim() || 'http://localhost:3000';
  const url = new URL('/api/admin/drive/callback', origin);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Invalid Google Drive redirect origin');
  return url.toString();
}

async function getAuthorizedDriveClient() {
  const integration = await driveIntegration.get();
  const refreshToken = integration.get('refreshToken');
  const folderId = integration.get('folderId');
  if (typeof refreshToken !== 'string' || !refreshToken || typeof folderId !== 'string' || !folderId) {
    throw new Error('Connect the admin Google Drive account in the admin portal before uploading documents.');
  }
  const origin = process.env.GOOGLE_DRIVE_REDIRECT_ORIGIN?.trim() || 'http://localhost:3000';
  const auth = createDriveOAuthClient(new URL('/api/admin/drive/callback', origin).toString());
  auth.setCredentials({ refresh_token: refreshToken });
  return { drive: google.drive({ version: 'v3', auth }), folderId };
}

// SSE client registry
const sseClients = new Map<string, Set<Response>>();

function broadcastToSession(sessionToken: string, data: object) {
  const clients = sseClients.get(sessionToken);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}

function validatePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  if (!/^\+?\d{7,15}$/.test(cleaned)) {
    throw new Error(`Invalid phone number: "${phone}". Use international format like +91XXXXXXXXXX`);
  }
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

function getPublicAppUrl() {
  const configuredUrl = process.env.APP_URL?.trim();
  if (!configuredUrl) return null;
  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', 'yourdomain.com'].includes(url.hostname)) return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function errorResponse(res: Response, error: unknown, fallback = 'Request failed') {
  console.error(error);
  const message = error instanceof Error ? error.message : fallback;
  return res.status(500).json({ success: false, error: message });
}

function requiredString(value: unknown, label: string, maxLength = 160) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`${label} is required and must be at most ${maxLength} characters`);
  }
  return value.trim();
}

function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

async function razorpayRequest<T>(endpoint: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  if (!razorpayConfigured()) throw new Error('Razorpay is not configured on the server');
  const credentials = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/${endpoint}`, {
    method,
    headers: { Authorization: `Basic ${credentials}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json() as T & { error?: { description?: string } };
  if (!response.ok) throw new Error(result.error?.description || 'Payment provider request failed');
  return result;
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (firebaseAdminInitError) {
    return res.status(503).json({ success: false, error: firebaseAdminInitError });
  }
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return res.status(401).json({ success: false, error: 'Sign in to continue' });
  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    Object.assign(req, {
      uid: decoded.uid,
      authEmail: decoded.email,
      authPhone: decoded.phone_number,
      authEmailVerified: decoded.email_verified === true
    });
    next();
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    console.warn('Firebase ID token verification failed:', code);
    res.status(401).json({ success: false, error: 'Your session is invalid or expired. Sign in again.' });
  }
}

function verifiedSignature(orderId: string, paymentId: string, signature: string) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
  let received: Buffer;
  try { received = Buffer.from(signature, 'hex'); } catch { return false; }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function asAuthRequest(req: Request) { return req as AuthRequest; }

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const email = asAuthRequest(req).authEmail?.trim().toLowerCase();
  const allowedEmail = (process.env.WAYSHARE_ADMIN_EMAIL || 'mandiajayant@gmail.com').trim().toLowerCase();
  if (!email || email !== allowedEmail || asAuthRequest(req).authEmailVerified !== true) {
    return res.status(403).json({ success: false, error: 'Admin access is restricted to the verified administrator account.' });
  }
  next();
}

const verificationDocumentTypes = ['aadhaarSelfie', 'pan', 'rcSelfie'] as const;
type VerificationDocumentType = typeof verificationDocumentTypes[number];

function isVerificationDocumentType(value: unknown): value is VerificationDocumentType {
  return typeof value === 'string' && verificationDocumentTypes.includes(value as VerificationDocumentType);
}

function hasApprovedRiderIdentity(user: FirebaseFirestore.DocumentData) {
  const docs = user.verificationDocuments || {};
  return user.riderVerificationStatus === 'verified' &&
    docs.aadhaarSelfie?.status === 'verified' &&
    docs.pan?.status === 'verified';
}

function hasApprovedDriverIdentity(user: FirebaseFirestore.DocumentData) {
  const docs = user.verificationDocuments || {};
  return hasApprovedRiderIdentity(user) &&
    user.driverVerificationStatus === 'verified' &&
    docs.rcSelfie?.status === 'verified';
}

function timestampToIso(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === 'string' ? value : '';
}

function publicVerificationDocuments(documents: FirebaseFirestore.DocumentData | undefined) {
  return Object.fromEntries(verificationDocumentTypes
    .filter((type) => documents?.[type])
    .map((type) => [type, {
      status: documents[type].status || 'unverified',
      submittedAt: timestampToIso(documents[type].submittedAt),
      reviewedAt: timestampToIso(documents[type].reviewedAt),
      rejectionReason: String(documents[type].rejectionReason || '')
    }]));
}

function normalizeCity(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeDate(value: string) {
  const raw = String(value || '').trim();
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return raw.toLowerCase();
  const d = new Date(parsed);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Compute driver trust score 0–100 from completed vs cancelled rides.
 *  Formula: base completions score (70 pts) + low-cancel bonus (30 pts)
 *  - completions: min(completed, 100) / 100 * 70
 *  - cancel penalty: max(0, 30 - cancelRate*300)   where cancelRate = cancelled/(completed+cancelled)
 *  New drivers with 0 rides start at 50 (neutral).
 */
function computeTrustScore(completed: number, cancelled: number): number {
  const total = completed + cancelled;
  if (total === 0) return 50;
  const completionPts = Math.min(completed, 100) / 100 * 70;
  const cancelRate = cancelled / total;
  const cancelPts = Math.max(0, 30 - cancelRate * 300);
  return Math.round(Math.min(100, completionPts + cancelPts));
}

function cityMatch(value: string, query: string) {
  if (!query) return true;
  const city = normalizeCity(value);
  const needle = normalizeCity(query);
  return city === needle || city.startsWith(`${needle},`) || needle.startsWith(`${city},`);
}

function serializeRide(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data() || {};
  const verificationStatus = String(data.driverVerificationStatus || 'unverified');
  const driverVerified = data.driverVerified === true || data.driverRcVerified === true || verificationStatus === 'verified';
  return {
    id: doc.id,
    driverId: String(data.driverId || ''),
    driverName: String(data.driverName || ''),
    driverPhoto: String(data.driverPhoto || ''),
    driverRating: Number(data.driverRating) || 0,
    driverTripsCount: Number(data.driverTripsCount) || 0,
    driverVerificationStatus: verificationStatus,
    driverVerified,
    driverUpiQrDataUrl: String(data.driverUpiQrDataUrl || ''),
    vehicleMakeModel: String(data.vehicleMakeModel || ''),
    vehicleRegNumber: String(data.vehicleRegNumber || ''),
    vehicleId: String(data.vehicleId || ''),
    fromCity: String(data.fromCity || ''),
    toCity: String(data.toCity || ''),
    fromLat: typeof data.fromLat === 'number' ? data.fromLat : null,
    fromLon: typeof data.fromLon === 'number' ? data.fromLon : null,
    toLat: typeof data.toLat === 'number' ? data.toLat : null,
    toLon: typeof data.toLon === 'number' ? data.toLon : null,
    pickupLocation: String(data.pickupLocation || ''),
    dropLocation: String(data.dropLocation || ''),
    departureDate: String(data.departureDate || ''),
    departureTime: String(data.departureTime || ''),
    estimatedArrivalTime: String(data.estimatedArrivalTime || ''),
    duration: String(data.duration || ''),
    distance: String(data.distance || ''),
    availableSeats: Number(data.availableSeats) || 0,
    totalSeats: Number(data.totalSeats) || 0,
    occupiedSeats: Array.isArray(data.occupiedSeats) ? data.occupiedSeats : [],
    pricePerSeat: Number(data.pricePerSeat) || 0,
    luggageCapacity: String(data.luggageCapacity || ''),
    status: String(data.status || 'UPCOMING'),
    routePolyline: typeof data.routePolyline === 'string' ? data.routePolyline : undefined,
    ridePreferences: Array.isArray(data.ridePreferences) ? data.ridePreferences as string[] : [],
    driverTrustScore: typeof data.driverTrustScore === 'number' ? data.driverTrustScore : undefined,
    createdAt: timestampToIso(data.createdAt)
  };
}

function serializeBooking(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data() || {};
  const hasRated = data.hasRated === true || data.isRated === true || data.ratingGiven !== undefined;
  return {
    id: doc.id,
    rideId: String(data.rideId || ''),
    passengerId: String(data.passengerId || ''),
    passengerName: String(data.passengerName || ''),
    passengerPhone: String(data.passengerPhone || ''),
    seatsBooked: Number(data.seatsBooked) || 0,
    selectedSeats: Array.isArray(data.selectedSeats) ? data.selectedSeats : [],
    amount: Number(data.amount) || 0,
    paymentStatus: String(data.paymentStatus || 'PENDING'),
    paymentMethod: data.paymentMethod === 'upi' || data.paymentMethod === 'cash' ? data.paymentMethod : undefined,
    bookingStatus: String(data.bookingStatus || 'PENDING'),
    bookingReference: String(data.bookingReference || ''),
    pickupLocation: String(data.pickupLocation || ''),
    dropLocation: String(data.dropLocation || ''),
    fromCity: String(data.fromCity || ''),
    toCity: String(data.toCity || ''),
    departureDate: String(data.departureDate || ''),
    departureTime: String(data.departureTime || ''),
    driverName: String(data.driverName || ''),
    driverId: String(data.driverId || ''),
    vehicleInfo: String(data.vehicleInfo || ''),
    isRated: Boolean(data.isRated || hasRated),
    hasRated,
    rating: Number(data.rating) || Number(data.ratingGiven) || undefined,
    ratingGiven: Number(data.ratingGiven) || Number(data.rating) || undefined,
    reviewComment: typeof data.reviewComment === 'string' ? data.reviewComment : undefined,
    reviewTags: Array.isArray(data.reviewTags) ? data.reviewTags : [],
    // Segment-journey fields (present on intermediate-stop bookings)
    passengerFromLat: typeof data.passengerFromLat === 'number' ? data.passengerFromLat : null,
    passengerFromLon: typeof data.passengerFromLon === 'number' ? data.passengerFromLon : null,
    passengerToLat:   typeof data.passengerToLat   === 'number' ? data.passengerToLat   : null,
    passengerToLon:   typeof data.passengerToLon   === 'number' ? data.passengerToLon   : null,
    segmentFare: typeof data.segmentFare === 'number' ? data.segmentFare : undefined,
    isIntermediateBooking: data.isIntermediateBooking === true,
    createdAt: timestampToIso(data.createdAt)
  };
}

function serializeReview(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    rideId: String(data.rideId || ''),
    reviewerId: String(data.reviewerId || ''),
    reviewerName: String(data.reviewerName || ''),
    reviewerPhoto: String(data.reviewerPhoto || ''),
    driverId: String(data.driverId || ''),
    rating: Number(data.rating) || 0,
    comment: String(data.comment || ''),
    tags: Array.isArray(data.tags) ? data.tags : [],
    route: String(data.route || ''),
    createdAt: timestampToIso(data.createdAt)
  };
}

function requireVerifiedEmail(req: Request, res: Response, next: NextFunction) {
  const authRequest = asAuthRequest(req);
  if (authRequest.authEmail && !authRequest.authEmailVerified) {
    return res.status(403).json({ success: false, error: 'Verify your email before continuing.' });
  }
  next();
}

async function expireReservations() {
  const pending = await bookings.where('bookingStatus', '==', 'PENDING').limit(100).get();
  const expired = pending.docs.filter((booking) => {
    const expiresAt = booking.get('reservationExpiresAt') as Timestamp | undefined;
    return Boolean(expiresAt && expiresAt.toMillis() <= Date.now());
  });
  await Promise.all(expired.map((booking) => db.runTransaction(async (transaction) => {
    const current = await transaction.get(booking.ref);
    const expiresAt = current.get('reservationExpiresAt') as Timestamp | undefined;
    if (!current.exists || current.get('bookingStatus') !== 'PENDING' || !expiresAt || expiresAt.toMillis() > Date.now()) return;
    const rideRef = rides.doc(current.get('rideId'));
    const ride = await transaction.get(rideRef);
    if (ride.exists) {
      const occupied: number[] = ride.get('occupiedSeats') || [];
      const selected: number[] = current.get('selectedSeats') || [];
      const remaining = occupied.filter((seat) => !selected.includes(seat));
      transaction.update(rideRef, { occupiedSeats: remaining, availableSeats: ride.get('totalSeats') - remaining.length });
    }
    transaction.update(booking.ref, { bookingStatus: 'CANCELLED', updatedAt: FieldValue.serverTimestamp() });
  })));
}

export function registerApi(app: Express) {

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok', service: 'WAYSHARE Backend API', timestamp: new Date().toISOString(),
      firebaseConfigured: Boolean((process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT) && !firebaseAdminInitError),
      firebaseAdminError: firebaseAdminInitError || undefined,
      razorpayConfigured: razorpayConfigured(),
      twilioConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
      publicAppUrlConfigured: Boolean(getPublicAppUrl())
    });
  });

  // PUBLIC - no auth - SSE live stream
  app.get('/api/location-sharing/:sessionToken/stream', async (req, res) => {
    const { sessionToken } = req.params;
    if (!sessionToken || !/^[a-z0-9]{32,64}$/.test(sessionToken)) return res.status(400).json({ success: false, error: 'Invalid session token' });
    try {
      const snap = await locationSessions.where('sessionToken', '==', sessionToken).limit(1).get();
      if (snap.empty) return res.status(404).json({ success: false, error: 'Session not found' });
      const session = snap.docs[0].data();
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({ type: 'location', latitude: session.latitude, longitude: session.longitude, updatedAt: session.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(), active: session.active ?? true })}\n\n`);
      if (!sseClients.has(sessionToken)) sseClients.set(sessionToken, new Set());
      sseClients.get(sessionToken)!.add(res);
      const pingInterval = setInterval(() => { try { res.write(': ping\n\n'); } catch { clearInterval(pingInterval); } }, 20_000);
      req.on('close', () => { clearInterval(pingInterval); sseClients.get(sessionToken)?.delete(res); });
    } catch (error) { errorResponse(res, error, 'Unable to open location stream'); }
  });

  // PUBLIC - no auth - snapshot
  app.get('/api/location-sharing/:sessionToken/public', async (req, res) => {
    const { sessionToken } = req.params;
    if (!sessionToken || !/^[a-z0-9]{32,64}$/.test(sessionToken)) return res.status(400).json({ success: false, error: 'Invalid session token' });
    try {
      const snap = await locationSessions.where('sessionToken', '==', sessionToken).limit(1).get();
      if (snap.empty) return res.status(404).json({ success: false, error: 'Session not found' });
      const s = snap.docs[0].data();
      res.json({ success: true, session: { sessionToken: s.sessionToken, sharerName: s.sharerName || 'Someone', latitude: s.latitude, longitude: s.longitude, active: s.active ?? true, startedAt: s.startedAt?.toDate?.()?.toISOString() ?? null, updatedAt: s.updatedAt?.toDate?.()?.toISOString() ?? null, endedAt: s.endedAt?.toDate?.()?.toISOString() ?? null } });
    } catch (error) { errorResponse(res, error, 'Unable to fetch session'); }
  });

  app.post('/api/webhooks/razorpay', async (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.header('x-razorpay-signature') || '';
    if (!webhookSecret || !Buffer.isBuffer(req.body)) return res.status(400).json({ success: false, error: 'Webhook is not configured' });
    const expected = createHmac('sha256', webhookSecret).update(req.body).digest();
    const supplied = Buffer.from(signature, 'hex');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
    try {
      const event = JSON.parse(req.body.toString()) as { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } };
      const payment = event.payload?.payment?.entity;
      if (payment?.order_id && payment.id && ['payment.captured', 'payment.failed'].includes(event.event || '')) {
        const query = await bookings.where('razorpayOrderId', '==', payment.order_id).limit(1).get();
        if (!query.empty) {
          const bookingRef = query.docs[0].ref;
          await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(bookingRef);
            if (!snapshot.exists || snapshot.get('bookingStatus') !== 'PENDING') return;
            const isCaptured = event.event === 'payment.captured';
            const rideRef = rides.doc(snapshot.get('rideId'));
            const rideSnapshot = isCaptured ? null : await transaction.get(rideRef);
            if (rideSnapshot?.exists) {
              const occupied: number[] = rideSnapshot.get('occupiedSeats') || [];
              const selected: number[] = snapshot.get('selectedSeats') || [];
              transaction.update(rideRef, { occupiedSeats: occupied.filter(s => !selected.includes(s)), availableSeats: rideSnapshot.get('totalSeats') - occupied.filter(s => !selected.includes(s)).length });
            }
            transaction.update(bookingRef, { bookingStatus: isCaptured ? 'CONFIRMED' : 'CANCELLED', paymentStatus: isCaptured ? 'PAID' : 'FAILED', razorpayPaymentId: payment.id, updatedAt: FieldValue.serverTimestamp() });
            transaction.set(payments.doc(snapshot.id), { bookingId: snapshot.id, userId: snapshot.get('passengerId'), amount: snapshot.get('amount'), provider: 'razorpay', providerPaymentId: payment.id, status: isCaptured ? 'SUCCESS' : 'FAILED', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          });
        }
      }
      res.json({ received: true });
    } catch (error) { errorResponse(res, error, 'Unable to process webhook'); }
  });

  // PUBLIC — no auth required — location search backed by India Post dataset
  // Source: India Post open data (data.gov.in), ~165K post offices/villages/towns/cities
  // Import script: node scripts/import-india-locations.mjs
  app.get('/api/locations/search', async (req, res) => {
    await loadLocationIndex();
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const state  = typeof req.query.state === 'string' ? req.query.state.trim() : undefined;
    const district = typeof req.query.district === 'string' ? req.query.district.trim() : undefined;
    const limitRaw = parseInt(String(req.query.limit || '20'), 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;

    if (!query || query.length < 2) {
      return res.json({ success: true, results: [], query, total: 0 });
    }
    if (query.length > 120) {
      return res.status(400).json({ success: false, error: 'Query too long' });
    }

    const results = searchLocations({ query, limit, state, district });
    return res.json({ success: true, results, query, total: results.length });
  });

  // PUBLIC — index health/status
  app.get('/api/locations/status', (_req, res) => {
    res.json({ success: true, ...getIndexStatus() });
  });

  app.get('/api/admin/drive/callback', async (req, res) => {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const issuedAt = driveOAuthStates.get(state);
    driveOAuthStates.delete(state);
    if (!state || !issuedAt || Date.now() - issuedAt > 10 * 60 * 1000) {
      return res.status(400).send('Google Drive connection expired. Return to WAYSHARE and start the connection again.');
    }
    if (typeof req.query.error === 'string') {
      return res.status(400).send('Google Drive access was not granted. Return to WAYSHARE to try again.');
    }
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) return res.status(400).send('Google did not return an authorization code.');
    try {
      const redirectUri = getDriveRedirectUri(req);
      const auth = createDriveOAuthClient(redirectUri);
      const { tokens } = await auth.getToken(code);
      if (!tokens.refresh_token) {
        return res.status(400).send('Google did not provide offline access. Revoke WAYSHARE access in your Google Account and reconnect.');
      }
      auth.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth });
      const profile = await oauth2.userinfo.get();
      const googleEmail = profile.data.email?.trim().toLowerCase();
      if (googleEmail !== allowedAdminEmail || profile.data.verified_email !== true) {
        return res.status(403).send('Use the verified Google account configured as the WAYSHARE administrator.');
      }
      const drive = google.drive({ version: 'v3', auth });
      const existingIntegration = await driveIntegration.get();
      let folderId = existingIntegration.get('folderId');
      if (typeof folderId !== 'string' || !folderId) {
        const folder = await drive.files.create({
          requestBody: {
            name: 'WAYSHARE Private Identity Reviews',
            mimeType: 'application/vnd.google-apps.folder'
          },
          fields: 'id'
        });
        folderId = folder.data.id;
      }
      if (typeof folderId !== 'string' || !folderId) throw new Error('Google Drive did not create the private document folder');
      await driveIntegration.set({
        email: googleEmail,
        refreshToken: tokens.refresh_token,
        folderId,
        connectedAt: FieldValue.serverTimestamp(),
        scope: tokens.scope || ''
      });
      res.type('html').send('<!doctype html><html><head><title>WAYSHARE Drive connected</title></head><body style="font:16px system-ui;max-width:36rem;margin:15vh auto;padding:1rem"><h1>Google Drive connected</h1><p>Your private Drive folder is ready. Return to the WAYSHARE admin portal and refresh the page.</p></body></html>');
    } catch (error) {
      console.error('Google Drive OAuth callback failed', error);
      res.status(500).send('Google Drive connection could not be completed. Check the server OAuth configuration and try again.');
    }
  });

  app.use('/api', requireAuth);

  app.post('/api/user/session', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const userRef = users.doc(authRequest.uid);
      const snapshot = await userRef.get();
      const existing = snapshot.data() || {};
      const fullName = typeof req.body.fullName === 'string' ? req.body.fullName.trim().slice(0, 100) : '';
      const requestedPhone = typeof req.body.phoneNumber === 'string' ? req.body.phoneNumber : '';
      const phoneNumber = requestedPhone
        ? validatePhoneNumber(requestedPhone)
        : authRequest.authPhone || existing.phoneNumber || '';
      const profile = {
        id: authRequest.uid,
        fullName: fullName || existing.fullName || authRequest.authEmail || 'WAYSHARE rider',
        email: authRequest.authEmail || '',
        phoneNumber,
        profilePhoto: existing.profilePhoto || '',
        city: existing.city || '',
        verificationStatus: existing.verificationStatus || 'unverified',
        riderVerificationStatus: existing.riderVerificationStatus || 'unverified',
        driverVerificationStatus: existing.driverVerificationStatus || 'unverified',
        verificationDocuments: publicVerificationDocuments(existing.verificationDocuments),
        userRole: existing.userRole || 'passenger',
        rating: existing.rating || 0,
        totalTrips: existing.totalTrips || 0,
        rcVerified: existing.rcVerified === true,
        rcNumber: existing.rcNumber || null,
        createdAt: existing.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      await userRef.set(profile, { merge: true });
      res.json({ success: true, user: { ...profile, createdAt: undefined, updatedAt: undefined } });
    } catch (error) { errorResponse(res, error); }
  });

  app.use('/api', requireVerifiedEmail);

  app.use('/api/admin', requireAdmin);

  app.get('/api/admin/drive/status', async (_req, res) => {
    try {
      const integration = await driveIntegration.get();
      const configured = Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET);
      res.json({
        success: true,
        configured,
        connected: Boolean(integration.get('refreshToken') && integration.get('folderId')),
        email: String(integration.get('email') || ''),
        setupHelp: configured ? '' : 'In Google Cloud Console: enable Google Drive API, configure the OAuth consent screen and add the admin email as a test user, then create a Web application OAuth client. Add http://localhost:3000/api/admin/drive/callback as an authorized redirect URI and set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET in the server .env file.'
      });
    } catch (error) { errorResponse(res, error, 'Unable to check Google Drive connection'); }
  });

  app.post('/api/admin/drive/connect', (req, res) => {
    try {
      const redirectUri = getDriveRedirectUri(req);
      const auth = createDriveOAuthClient(redirectUri);
      const state = randomBytes(32).toString('hex');
      for (const [savedState, issuedAt] of driveOAuthStates) {
        if (Date.now() - issuedAt > 10 * 60 * 1000) driveOAuthStates.delete(savedState);
      }
      driveOAuthStates.set(state, Date.now());
      const url = auth.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: true,
        scope: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.email'
        ],
        state
      });
      res.json({ success: true, url });
    } catch (error) {
      res.status(503).json({
        success: false,
        error: error instanceof Error ? error.message : 'Google Drive OAuth is not configured'
      });
    }
  });

  app.get('/api/admin/overview', async (_req, res) => {
    try {
      const [
        totalUsers,
        totalRides,
        totalBookings,
        activeRides,
        completedRides,
        completedBookings,
        pendingRiderVerifications,
        pendingDriverVerifications,
        verifiedRiders,
        verifiedDrivers
      ] = await Promise.all([
        users.count().get(),
        rides.count().get(),
        bookings.count().get(),
        rides.where('status', '==', 'UPCOMING').count().get(),
        rides.where('status', '==', 'COMPLETED').count().get(),
        bookings.where('bookingStatus', '==', 'COMPLETED').count().get(),
        users.where('riderVerificationStatus', '==', 'pending').count().get(),
        users.where('driverVerificationStatus', '==', 'pending').count().get(),
        users.where('riderVerificationStatus', '==', 'verified').count().get(),
        users.where('driverVerificationStatus', '==', 'verified').count().get()
      ]);
      res.json({
        success: true,
        stats: {
          totalUsers: totalUsers.data().count,
          totalRides: totalRides.data().count,
          totalBookings: totalBookings.data().count,
          activeRides: activeRides.data().count,
          completedRides: completedRides.data().count,
          completedBookings: completedBookings.data().count,
          pendingRiderVerifications: pendingRiderVerifications.data().count,
          pendingDriverVerifications: pendingDriverVerifications.data().count,
          verifiedRiders: verifiedRiders.data().count,
          verifiedDrivers: verifiedDrivers.data().count
        }
      });
    } catch (error) { errorResponse(res, error, 'Unable to load admin dashboard'); }
  });

  app.get('/api/admin/rides', async (req, res) => {
    try {
      const pageSize = 25;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : '';
      let query: FirebaseFirestore.Query = rides.orderBy('createdAt', 'desc').limit(pageSize + 1);
      if (cursor) {
        const cursorSnapshot = await rides.doc(cursor).get();
        if (cursorSnapshot.exists) query = query.startAfter(cursorSnapshot);
      }
      const snapshot = await query.get();
      const page = snapshot.docs.slice(0, pageSize);
      const rideRows = page.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          driverId: String(data.driverId || ''),
          driverName: String(data.driverName || ''),
          driverEmail: '',
          fromCity: String(data.fromCity || ''),
          toCity: String(data.toCity || ''),
          departureDate: String(data.departureDate || ''),
          departureTime: String(data.departureTime || ''),
          status: String(data.status || 'UPCOMING'),
          availableSeats: Number(data.availableSeats) || 0,
          totalSeats: Number(data.totalSeats) || 0,
          pricePerSeat: Number(data.pricePerSeat) || 0,
          createdAt: timestampToIso(data.createdAt)
        };
      });
      const driverIds = [...new Set(rideRows.map((ride) => ride.driverId).filter(Boolean))];
      const drivers = await Promise.all(driverIds.map((id) => users.doc(id).get()));
      const emailByDriver = new Map(drivers.map((driver) => [driver.id, String(driver.get('email') || '')]));
      for (const ride of rideRows) ride.driverEmail = emailByDriver.get(ride.driverId) || '';
      res.json({
        success: true,
        rides: rideRows,
        nextCursor: snapshot.docs.length > pageSize ? page[page.length - 1]?.id : null
      });
    } catch (error) { errorResponse(res, error, 'Unable to load rides'); }
  });

  app.get('/api/admin/verifications', async (req, res) => {
    try {
      const pageSize = 25;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : '';
      let query: FirebaseFirestore.Query = users.orderBy('updatedAt', 'desc').limit(pageSize + 1);
      if (cursor) {
        const cursorSnapshot = await users.doc(cursor).get();
        if (cursorSnapshot.exists) query = query.startAfter(cursorSnapshot);
      }
      const snapshot = await query.get();
      const page = snapshot.docs.slice(0, pageSize);
      const hasMore = snapshot.docs.length > pageSize;
      const completedCounts = await Promise.all(page.map(async (userDoc) => {
        const [asPassenger, asDriver] = await Promise.all([
          bookings.where('passengerId', '==', userDoc.id).where('bookingStatus', '==', 'COMPLETED').count().get(),
          bookings.where('driverId', '==', userDoc.id).where('bookingStatus', '==', 'COMPLETED').count().get()
        ]);
        return [userDoc.id, asPassenger.data().count + asDriver.data().count] as const;
      }));
      const countByUser = new Map(completedCounts);
      const userRows = page.map((doc) => {
        const data = doc.data();
        const documents = data.verificationDocuments || {};
        return {
          id: doc.id,
          fullName: String(data.fullName || ''),
          email: String(data.email || ''),
          phoneNumber: String(data.phoneNumber || ''),
          profilePhoto: String(data.profilePhoto || ''),
          verificationStatus: String(data.verificationStatus || 'unverified'),
          riderVerificationStatus: String(data.riderVerificationStatus || 'unverified'),
          driverVerificationStatus: String(data.driverVerificationStatus || 'unverified'),
          verificationDocuments: publicVerificationDocuments(documents),
          documentAvailability: Object.fromEntries(verificationDocumentTypes
            .map((type) => [type, Boolean(documents[type]?.driveFileId)])),
          completedRides: countByUser.get(doc.id) || 0,
          createdAt: timestampToIso(data.createdAt)
        };
      });
      res.json({ success: true, users: userRows, nextCursor: hasMore ? page[page.length - 1]?.id : null });
    } catch (error) { errorResponse(res, error, 'Unable to load verification queue'); }
  });

  app.get('/api/admin/users/:userId/documents/:type', async (req, res) => {
    try {
      const type = req.params.type;
      if (!isVerificationDocumentType(type)) return res.status(400).json({ success: false, error: 'Unsupported document type' });
      const userSnapshot = await users.doc(req.params.userId).get();
      const document = userSnapshot.get(`verificationDocuments.${type}`);
      const fileId = document?.driveFileId;
      if (!userSnapshot.exists || typeof fileId !== 'string' || !fileId) {
        return res.status(404).json({ success: false, error: 'Verification document not found' });
      }
      const { drive } = await getAuthorizedDriveClient();
      const metadata = await drive.files.get({
        fileId,
        fields: 'mimeType,appProperties',
        supportsAllDrives: false
      });
      if (metadata.data.appProperties?.wayShareUserId !== req.params.userId ||
          metadata.data.appProperties?.wayShareDocumentType !== type) {
        return res.status(403).json({ success: false, error: 'This file does not belong to the requested verification record.' });
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(String(metadata.data.mimeType || ''))) {
        return res.status(415).json({ success: false, error: 'Unsupported verification image type' });
      }
      const image = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
      res.setHeader('Content-Type', String(metadata.data.mimeType));
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      image.data.on('error', (error: Error) => {
        console.error('Unable to stream private Drive document', error);
        if (!res.headersSent) res.status(502).end('Unable to read verification image');
        else res.destroy(error);
      });
      image.data.pipe(res);
    } catch (error) { errorResponse(res, error, 'Unable to open verification document'); }
  });

  app.patch('/api/admin/users/:userId/verification', async (req, res) => {
    try {
      const kind = req.body.kind;
      const status = req.body.status;
      if (!['rider', 'driver'].includes(kind) || !['verified', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Choose a valid verification type and decision' });
      }
      const userRef = users.doc(req.params.userId);
      const userSnapshot = await userRef.get();
      if (!userSnapshot.exists) return res.status(404).json({ success: false, error: 'User not found' });
      const user = userSnapshot.data()!;
      if (kind === 'driver' && !hasApprovedRiderIdentity(user)) {
        return res.status(409).json({ success: false, error: 'Approve the rider identity before reviewing driver eligibility' });
      }
      const requiredDocuments: VerificationDocumentType[] = kind === 'rider'
        ? ['aadhaarSelfie', 'pan']
        : ['aadhaarSelfie', 'pan', 'rcSelfie'];
      const documents = user.verificationDocuments || {};
      if (requiredDocuments.some((type) => !documents[type]?.driveFileId)) {
        return res.status(409).json({ success: false, error: 'Required identity documents have not been submitted' });
      }
      const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '';
      if (status === 'rejected' && !reason) return res.status(400).json({ success: false, error: 'Enter a reason for rejection' });
      const reviewedAt = FieldValue.serverTimestamp();
      const documentUpdates = Object.fromEntries(requiredDocuments.map((type) => [
        `verificationDocuments.${type}.status`, status
      ]));
      const updates: Record<string, unknown> = {
        ...documentUpdates,
        updatedAt: reviewedAt,
        [`${kind === 'rider' ? 'rider' : 'driver'}VerificationStatus`]: status
      };
      if (kind === 'rider') {
        updates.verificationStatus = status;
        if (status === 'rejected') updates.driverVerificationStatus = 'rejected';
      } else {
        updates.rcVerified = status === 'verified';
      }
      if (status === 'rejected') {
        for (const type of requiredDocuments) {
          updates[`verificationDocuments.${type}.rejectionReason`] = reason;
          updates[`verificationDocuments.${type}.reviewedAt`] = reviewedAt;
        }
      } else {
        for (const type of requiredDocuments) {
          updates[`verificationDocuments.${type}.rejectionReason`] = FieldValue.delete();
          updates[`verificationDocuments.${type}.reviewedAt`] = reviewedAt;
        }
      }
      await userRef.update(updates);
      res.json({ success: true, status });
    } catch (error) { errorResponse(res, error, 'Unable to update verification status'); }
  });

  app.get('/api/user', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const snapshot = await users.doc(authRequest.uid).get();
      const user = snapshot.data();
      if (!snapshot.exists || !user) return res.status(404).json({ success: false, error: 'Profile not found' });
      res.json({ success: true, user: { ...user, verificationDocuments: publicVerificationDocuments(user.verificationDocuments), id: authRequest.uid, canProvideRide: hasApprovedDriverIdentity(user) } });
    } catch (error) { errorResponse(res, error); }
  });

  app.put('/api/user', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const updates: Record<string, unknown> = {};
      for (const field of ['fullName', 'city', 'profilePhoto', 'gender', 'collegeOrOrganization']) {
        if (req.body[field] !== undefined) updates[field] = requiredString(req.body[field], field, field === 'profilePhoto' ? 500_000 : 120);
      }
      updates.updatedAt = FieldValue.serverTimestamp();
      await users.doc(authRequest.uid).set(updates, { merge: true });
      const updated = await users.doc(authRequest.uid).get();
      const user = updated.data();
      res.json({ success: true, user: { ...user, verificationDocuments: publicVerificationDocuments(user?.verificationDocuments), id: authRequest.uid } });
    } catch (error) { errorResponse(res, error); }
  });

  // TRUSTED CONTACTS
  // POST /api/user/photo — save profile photo as base64 data URL in Firestore user doc.
  // The client converts the selected image to a data URL and POSTs it here.
  // Max 400 KB encoded. For production, replace with Firebase Storage signed uploads.
  app.post('/api/user/photo', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const photo = typeof req.body.photo === 'string' ? req.body.photo : '';
      if (!photo) return res.status(400).json({ success: false, error: 'No photo provided' });
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(photo)) {
        return res.status(400).json({ success: false, error: 'Photo must be a PNG, JPEG, or WebP data URL' });
      }
      if (photo.length > 500_000) {
        return res.status(400).json({ success: false, error: 'Photo is too large. Please use an image under 350 KB.' });
      }
      await users.doc(authRequest.uid).update({ profilePhoto: photo, updatedAt: FieldValue.serverTimestamp() });
      res.json({ success: true, profilePhoto: photo });
    } catch (error) { errorResponse(res, error, 'Unable to save photo'); }
  });
  app.get('/api/trusted-contacts', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const snap = await trustedContacts.where('userId', '==', authRequest.uid).limit(10).get();
      const contacts = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((left, right) => {
          const leftTime = left.createdAt instanceof Timestamp ? left.createdAt.toMillis() : 0;
          const rightTime = right.createdAt instanceof Timestamp ? right.createdAt.toMillis() : 0;
          return leftTime - rightTime;
        });
      res.json({ success: true, contacts });
    } catch (error) { errorResponse(res, error, 'Unable to fetch trusted contacts'); }
  });

  app.post('/api/trusted-contacts', async (req, res) => {
    try {
      const authRequest  = asAuthRequest(req);
      const contactName  = requiredString(req.body.contactName, 'contactName', 100);
      const relationship = requiredString(req.body.relationship, 'relationship', 50);
      const phoneNumber  = validatePhoneNumber(requiredString(req.body.phoneNumber, 'phoneNumber', 20));
      const existingContacts = await trustedContacts.where('userId', '==', authRequest.uid).limit(10).get();
      if (existingContacts.docs.some((doc) => doc.get('phoneNumber') === phoneNumber)) {
        return res.status(409).json({ success: false, error: `${phoneNumber} is already a trusted contact.` });
      }
      if (existingContacts.size >= 10) return res.status(400).json({ success: false, error: 'You can save up to 10 trusted contacts.' });
      const ref = trustedContacts.doc();
      const contact = { id: ref.id, userId: authRequest.uid, contactName, phoneNumber, relationship, createdAt: FieldValue.serverTimestamp() };
      await ref.set(contact);
      res.status(201).json({ success: true, contact: { ...contact, createdAt: new Date().toISOString() } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to add contact';
      res.status(message.includes('Invalid phone') || message.includes('already') ? 400 : 500).json({ success: false, error: message });
    }
  });

  app.delete('/api/trusted-contacts/:id', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const ref = trustedContacts.doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ success: false, error: 'Contact not found' });
      if (snap.get('userId') !== authRequest.uid) return res.status(403).json({ success: false, error: 'Not your contact' });
      await ref.delete();
      res.json({ success: true });
    } catch (error) { errorResponse(res, error, 'Unable to delete contact'); }
  });

  // LIVE LOCATION SHARING
  app.post('/api/location-sharing/start', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const latitude = Number(req.body.latitude);
      const longitude = Number(req.body.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
        return res.status(400).json({ success: false, error: 'Invalid GPS coordinates' });
      const publicAppUrl = getPublicAppUrl();
      if (!publicAppUrl) {
        return res.status(503).json({ success: false, error: 'Set APP_URL to a public HTTPS address before sharing. Localhost links cannot be opened by your trusted contacts.' });
      }
      const existingSnap = await locationSessions.where('userId', '==', authRequest.uid).where('active', '==', true).limit(5).get();
      const batch = db.batch();
      existingSnap.docs.forEach((doc) => { batch.update(doc.ref, { active: false, endedAt: FieldValue.serverTimestamp() }); broadcastToSession(doc.get('sessionToken'), { type: 'ended' }); });
      if (!existingSnap.empty) await batch.commit();
      const userData = (await users.doc(authRequest.uid).get()).data() || {};
      const sharerName = userData.fullName || 'A WAYSHARE user';
      const sessionToken = randomBytes(24).toString('hex');
      const locationUrl = `${publicAppUrl}/live/${sessionToken}`;
      const ref = locationSessions.doc();
      const now = Timestamp.now();
      await ref.set({ id: ref.id, userId: authRequest.uid, sessionToken, sharerName, latitude, longitude, active: true, startedAt: now, updatedAt: now, endedAt: null });
      const contactsSnap = await trustedContacts.where('userId', '==', authRequest.uid).limit(20).get();
      const contacts = contactsSnap.docs.map((doc) => doc.data() as { contactName: string; phoneNumber: string });
      res.status(201).json({
        success: true,
        sessionToken,
        locationUrl,
        contactsCount: contacts.length,
        ...(contacts.length ? {} : { warning: 'No trusted contacts found. Add contacts before sending your location.' })
      });
    } catch (error) { errorResponse(res, error, 'Unable to start location sharing'); }
  });

  app.post('/api/location-sharing/:sessionToken/update', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const { sessionToken } = req.params;
      if (!sessionToken || !/^[a-z0-9]{32,64}$/.test(sessionToken)) return res.status(400).json({ success: false, error: 'Invalid session token' });
      const latitude = Number(req.body.latitude);
      const longitude = Number(req.body.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return res.status(400).json({ success: false, error: 'Invalid GPS coordinates' });
      const snap = await locationSessions.where('sessionToken', '==', sessionToken).where('userId', '==', authRequest.uid).limit(1).get();
      if (snap.empty) return res.status(404).json({ success: false, error: 'Session not found' });
      if (!snap.docs[0].get('active')) return res.status(409).json({ success: false, error: 'Session has already ended' });
      const updatedAt = Timestamp.now();
      await snap.docs[0].ref.update({ latitude, longitude, updatedAt });
      broadcastToSession(sessionToken, { type: 'location', latitude, longitude, updatedAt: updatedAt.toDate().toISOString(), active: true });
      res.json({ success: true });
    } catch (error) { errorResponse(res, error, 'Unable to update location'); }
  });

  app.post('/api/location-sharing/:sessionToken/stop', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const { sessionToken } = req.params;
      if (!sessionToken || !/^[a-z0-9]{32,64}$/.test(sessionToken)) return res.status(400).json({ success: false, error: 'Invalid session token' });
      const snap = await locationSessions.where('sessionToken', '==', sessionToken).where('userId', '==', authRequest.uid).limit(1).get();
      if (snap.empty) return res.status(404).json({ success: false, error: 'Session not found' });
      await snap.docs[0].ref.update({ active: false, endedAt: FieldValue.serverTimestamp() });
      broadcastToSession(sessionToken, { type: 'ended' });
      res.json({ success: true });
    } catch (error) { errorResponse(res, error, 'Unable to stop location sharing'); }
  });

  app.get('/api/location-sharing/my-session', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const snap = await locationSessions.where('userId', '==', authRequest.uid).where('active', '==', true).orderBy('startedAt', 'desc').limit(1).get();
      if (snap.empty) return res.json({ success: true, session: null });
      const s = snap.docs[0].data();
      const appUrl = (process.env.APP_URL || 'https://yourdomain.com').replace(/\/$/, '');
      res.json({ success: true, session: { sessionToken: s.sessionToken, locationUrl: `${appUrl}/live/${s.sessionToken}`, latitude: s.latitude, longitude: s.longitude, active: s.active, startedAt: s.startedAt?.toDate?.()?.toISOString() ?? null } });
    } catch (error) { errorResponse(res, error, 'Unable to fetch active session'); }
  });

  app.get('/api/scheduled-rides', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const snapshot = await scheduledRides.where('userId', '==', authRequest.uid).limit(100).get();
      res.json({ success: true, requests: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) });
    } catch (error) { errorResponse(res, error); }
  });

  app.post('/api/scheduled-rides', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const requestRef = scheduledRides.doc();
      const request = { id: requestRef.id, reference: `UBX-SCH-${randomBytes(4).toString('hex').toUpperCase()}`, userId: authRequest.uid, fromCity: requiredString(req.body.fromCity, 'fromCity'), pickupPoint: requiredString(req.body.pickupPoint, 'pickupPoint'), toCity: requiredString(req.body.toCity, 'toCity'), scheduledDate: requiredString(req.body.scheduledDate, 'scheduledDate', 80), scheduledTime: requiredString(req.body.scheduledTime, 'scheduledTime', 40), flightNote: typeof req.body.flightNote === 'string' ? req.body.flightNote.slice(0, 200) : '', remindPrior: req.body.remindPrior === true, requestStatus: 'REQUESTED', paymentStatus: 'NOT_DUE', createdAt: FieldValue.serverTimestamp() };
      await requestRef.set(request);
      res.status(201).json({ success: true, request: { ...request, createdAt: undefined } });
    } catch (error) { errorResponse(res, error); }
  });

  app.get('/api/user/verification-storage-status', async (_req, res) => {
    try {
      const integration = await driveIntegration.get();
      const configured = Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET);
      const available = configured && Boolean(integration.get('refreshToken') && integration.get('folderId'));
      res.status(available ? 200 : 503).json({
        success: available,
        available,
        error: available ? undefined : configured
          ? 'Identity uploads are unavailable until the admin connects Google Drive from the admin portal.'
          : 'The server owner must configure Google Drive OAuth before identity documents can be uploaded.'
      });
    } catch (error) { errorResponse(res, error, 'Unable to check private document storage'); }
  });

  app.post('/api/user/verification-documents', (req, res, next) => {
    verificationUpload(req, res, (error) => {
      if (!error) return next();
      if (error instanceof multer.MulterError) {
        const tooLarge = error.code === 'LIMIT_FILE_SIZE';
        return res.status(tooLarge ? 413 : 400).json({
          success: false,
          error: tooLarge ? 'Each image must be 5 MB or smaller.' : 'Upload at most one image for each verification document.'
        });
      }
      console.error('Unable to parse verification document upload', error);
      return res.status(400).json({ success: false, error: 'Unable to read uploaded image files.' });
    });
  }, async (req, res) => {
    let drive: ReturnType<typeof google.drive> | undefined;
    const createdFileIds: string[] = [];
    try {
      const authRequest = asAuthRequest(req);
      const filesByType = (req.files || {}) as Record<string, Express.Multer.File[]>;
      const submittedTypes = verificationDocumentTypes.filter((type) => Boolean(filesByType[type]?.length));
      if (!submittedTypes.includes('aadhaarSelfie') || !submittedTypes.includes('pan')) {
        return res.status(400).json({ success: false, error: 'Upload both the Aadhaar photo with your face and the PAN card image.' });
      }
      for (const type of submittedTypes) {
        const file = filesByType[type][0];
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) || file.size < 1) {
          return res.status(400).json({ success: false, error: 'Documents must be JPEG, PNG, or WebP images under 5 MB.' });
        }
      }
      const userRef = users.doc(authRequest.uid);
      const userSnapshot = await userRef.get();
      if (!userSnapshot.exists) return res.status(404).json({ success: false, error: 'Profile not found' });
      const previousDocs = userSnapshot.get('verificationDocuments') || {};
      const driveClient = await getAuthorizedDriveClient();
      drive = driveClient.drive;
      const uploadResults = await Promise.allSettled(submittedTypes.map(async (type) => {
        const file = filesByType[type][0];
        const created = await drive!.files.create({
          requestBody: {
            name: `${type}-${randomUUID()}`,
            mimeType: file.mimetype,
            parents: [driveClient.folderId],
            appProperties: { wayShareUserId: authRequest.uid, wayShareDocumentType: type }
          },
          media: { mimeType: file.mimetype, body: Readable.from(file.buffer) },
          fields: 'id'
        });
        if (!created.data.id) throw new Error(`Google Drive did not save the ${type} image`);
        createdFileIds.push(created.data.id);
        return [type, {
          driveFileId: created.data.id,
          status: 'pending',
          submittedAt: FieldValue.serverTimestamp(),
          contentType: file.mimetype
        }] as const;
      }));
      const failedUpload = uploadResults.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failedUpload) throw failedUpload.reason;
      const uploaded = uploadResults.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      const updates = Object.fromEntries(uploaded.flatMap(([type, record]) => [
        [`verificationDocuments.${type}.driveFileId`, record.driveFileId],
        [`verificationDocuments.${type}.status`, record.status],
        [`verificationDocuments.${type}.submittedAt`, record.submittedAt],
        [`verificationDocuments.${type}.contentType`, record.contentType],
        [`verificationDocuments.${type}.rejectionReason`, '']
      ]));
      const profileUpdates: Record<string, unknown> = {
        ...updates,
        riderVerificationStatus: 'pending',
        verificationStatus: 'pending',
        updatedAt: FieldValue.serverTimestamp()
      };
      if (submittedTypes.includes('rcSelfie')) {
        profileUpdates.driverVerificationStatus = 'pending';
        profileUpdates.rcVerified = false;
      } else if (previousDocs.rcSelfie?.driveFileId) {
        profileUpdates.driverVerificationStatus = 'pending';
        profileUpdates.rcVerified = false;
      }
      await userRef.update(profileUpdates);
      res.status(202).json({
        success: true,
        submittedTypes,
        riderVerificationStatus: 'pending',
        driverVerificationStatus: profileUpdates.driverVerificationStatus || userSnapshot.get('driverVerificationStatus') || 'unverified'
      });
    } catch (error) {
      if (drive && createdFileIds.length) {
        const cleanup = await Promise.allSettled(createdFileIds.map((fileId) => drive!.files.delete({ fileId })));
        const cleanupFailures = cleanup.filter((result) => result.status === 'rejected').length;
        if (cleanupFailures) console.error(`Could not remove ${cleanupFailures} incomplete Google Drive verification upload(s)`);
      }
      const message = error instanceof Error ? error.message : 'Unable to submit verification documents';
      console.error('Unable to submit verification documents', error);
      res.status(message.includes('Connect the admin Google Drive') || message.includes('Google Drive OAuth is not configured') ? 503 : 500)
        .json({ success: false, error: message });
    }
  });

  app.get('/api/rides', async (req, res) => {
    try {
      try { await expireReservations(); } catch (expireError) { console.error('Unable to expire reservations', expireError); }
      const snapshot = await rides.where('status', '==', 'UPCOMING').limit(200).get();
      let results = snapshot.docs.map(serializeRide).filter((ride) => Boolean(ride.driverId));
      const fromCity = typeof req.query.fromCity === 'string' ? req.query.fromCity.trim() : '';
      const toCity = typeof req.query.toCity === 'string' ? req.query.toCity.trim() : '';
      const date = typeof req.query.date === 'string' ? req.query.date.trim() : '';
      results = results.filter((ride) => cityMatch(ride.fromCity, fromCity) && cityMatch(ride.toCity, toCity) && (!date || normalizeDate(ride.departureDate) === normalizeDate(date)));
      res.json({ success: true, count: results.length, rides: results });
    } catch (error) { errorResponse(res, error); }
  });

  app.get('/api/driver/rides', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const snapshot = await rides.where('driverId', '==', authRequest.uid).limit(100).get();
      const bookingSnap = await bookings.where('driverId', '==', authRequest.uid).limit(200).get();
      const bookingsByRide = new Map<string, ReturnType<typeof serializeBooking>[]>();
      for (const doc of bookingSnap.docs) {
        const booking = serializeBooking(doc);
        if (booking.bookingStatus === 'CANCELLED') continue;
        const list = bookingsByRide.get(booking.rideId) || [];
        list.push(booking);
        bookingsByRide.set(booking.rideId, list);
      }
      const results = snapshot.docs.map((doc) => {
        const ride = serializeRide(doc);
        return { ...ride, passengerBookings: bookingsByRide.get(ride.id) || [] };
      });
      res.json({ success: true, count: results.length, rides: results });
    } catch (error) { errorResponse(res, error); }
  });

  // ── Route-based ride search ────────────────────────────────────────────────
  // GET /api/rides/route-match?fromLat=&fromLon=&toLat=&toLon=&date=&seats=
  //
  // Returns all UPCOMING rides whose stored road route passes within MAX_SNAP_KM
  // of both the passenger's pickup and drop-off coordinates, in the correct order.
  // Also falls back to name-based city matching for rides that have no geometry.
  //
  // Each result includes a segmentMatch object describing the compatibility,
  // estimated pickup time, segment distance, detour, and segment fare.
  //
  // Ranking: exact-endpoint matches first, then by ascending detour km.
  app.get('/api/rides/route-match', async (req, res) => {
    try {
      try { await expireReservations(); } catch { /* non-fatal */ }

      const fromLatRaw = parseFloat(String(req.query.fromLat ?? ''));
      const fromLonRaw = parseFloat(String(req.query.fromLon ?? ''));
      const toLatRaw   = parseFloat(String(req.query.toLat   ?? ''));
      const toLonRaw   = parseFloat(String(req.query.toLon   ?? ''));
      const date       = typeof req.query.date  === 'string' ? req.query.date.trim()  : '';
      const seatsNeeded = Math.max(1, parseInt(String(req.query.seats ?? '1'), 10));
      const fromCityName = typeof req.query.fromCity === 'string' ? req.query.fromCity.trim() : '';
      const toCityName   = typeof req.query.toCity   === 'string' ? req.query.toCity.trim()   : '';

      const hasCoords = isFinite(fromLatRaw) && isFinite(fromLonRaw) && isFinite(toLatRaw) && isFinite(toLonRaw);

      // Load all UPCOMING rides (max 200 — same as the normal search)
      const snapshot = await rides.where('status', '==', 'UPCOMING').limit(200).get();
      const allRides = snapshot.docs.map(serializeRide).filter(r => Boolean(r.driverId));

      // Date filter (applied to all results)
      const filterDate = date ? normalizeDate(date) : '';

      const results: Array<{
        ride: ReturnType<typeof serializeRide>;
        segmentMatch: {
          compatible: boolean; reason?: string;
          pickupFraction: number; dropFraction: number;
          segmentDistanceKm: number; pickupSnapKm: number; dropSnapKm: number;
          detourKm: number; segmentFare: number; estimatedPickupTime?: string;
          matchType: 'exact' | 'intermediate' | 'partial-origin' | 'partial-destination';
        };
      }> = [];

      const passengerFrom = hasCoords ? { lat: fromLatRaw, lon: fromLonRaw } : null;
      const passengerTo   = hasCoords ? { lat: toLatRaw,   lon: toLonRaw   } : null;

      for (const ride of allRides) {
        // Date filter
        if (filterDate && normalizeDate(ride.departureDate) !== filterDate) continue;
        // Seat availability
        if (ride.availableSeats < seatsNeeded) continue;

        // ── Case A: ride has a stored encoded polyline + origin/dest coordinates ──
        if (ride.routePolyline && ride.fromLat !== null && ride.toLat !== null && hasCoords && passengerFrom && passengerTo) {
          let routeCoords: [number, number][];
          try { routeCoords = decodePolyline(ride.routePolyline); } catch { continue; }
          if (routeCoords.length < 2) continue;

          const rideDistKm = parseFloat(ride.distance) || 0;
          const rideDurMin = 0; // duration not parsed from string here; estimated pickup uses fraction * stored duration
          // Parse duration from stored string e.g. "145 min"
          const durMatch = ride.duration.match(/(\d+(?:\.\d+)?)/);
          const rideDurationMinutes = durMatch ? parseFloat(durMatch[1]) : 0;

          const compat = checkSegmentCompatibility(
            passengerFrom, passengerTo,
            routeCoords,
            rideDistKm, rideDurationMinutes,
            ride.departureDate, ride.departureTime,
          );

          if (!compat.compatible) continue;

          // Determine match type
          const ENDPOINT_TOLERANCE = 0.02; // fraction ≤ 2% = effectively the endpoint
          let matchType: 'exact' | 'intermediate' | 'partial-origin' | 'partial-destination';
          const pickupIsOrigin = compat.pickupProjection.fraction <= ENDPOINT_TOLERANCE;
          const dropIsDestination = compat.dropProjection.fraction >= (1 - ENDPOINT_TOLERANCE);
          if (pickupIsOrigin && dropIsDestination) matchType = 'exact';
          else if (pickupIsOrigin) matchType = 'partial-destination';
          else if (dropIsDestination) matchType = 'partial-origin';
          else matchType = 'intermediate';

          const segmentFare = calculateSegmentFare(ride.pricePerSeat, compat.segmentFraction, seatsNeeded);

          results.push({
            ride,
            segmentMatch: {
              compatible: true,
              pickupFraction: compat.pickupProjection.fraction,
              dropFraction: compat.dropProjection.fraction,
              segmentDistanceKm: compat.segmentDistanceKm,
              pickupSnapKm: compat.pickupProjection.snapDistanceKm,
              dropSnapKm: compat.dropProjection.snapDistanceKm,
              detourKm: compat.detourKm,
              segmentFare,
              estimatedPickupTime: compat.estimatedPickupTime,
              matchType,
            },
          });
          continue;
        }

        // ── Case B: ride has no polyline — fall back to city name matching ────
        // This handles rides published before route geometry was implemented.
        const nameMatchFrom = !fromCityName || cityMatch(ride.fromCity, fromCityName);
        const nameMatchTo   = !toCityName   || cityMatch(ride.toCity,   toCityName);
        if (nameMatchFrom && nameMatchTo) {
          results.push({
            ride,
            segmentMatch: {
              compatible: true,
              pickupFraction: 0,
              dropFraction: 1,
              segmentDistanceKm: 0,
              pickupSnapKm: 0,
              dropSnapKm: 0,
              detourKm: 0,
              segmentFare: ride.pricePerSeat * seatsNeeded,
              estimatedPickupTime: undefined,
              matchType: 'exact',
            },
          });
        }
      }

      // Sort: exact matches first; then by ascending detour
      const typePriority: Record<string, number> = { exact: 0, 'partial-origin': 1, 'partial-destination': 1, intermediate: 2 };
      results.sort((a, b) =>
        (typePriority[a.segmentMatch.matchType] ?? 3) - (typePriority[b.segmentMatch.matchType] ?? 3) ||
        a.segmentMatch.detourKm - b.segmentMatch.detourKm
      );

      return res.json({
        success: true,
        count: results.length,
        rides: results.map(r => ({ ...r.ride, segmentMatch: r.segmentMatch })),
        config: { maxSnapKm: MAX_SNAP_KM, maxDetourKm: MAX_DETOUR_KM },
      });
    } catch (error) { errorResponse(res, error, 'Route-based ride search failed'); }
  });

  app.get('/api/rides/:id', async (req, res) => {
    try {
      const snapshot = await rides.doc(req.params.id).get();
      if (!snapshot.exists) return res.status(404).json({ success: false, error: 'Ride not found' });
      res.json({ success: true, ride: serializeRide(snapshot) });
    } catch (error) { errorResponse(res, error); }
  });

  app.post('/api/rides', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const userSnapshot = await users.doc(authRequest.uid).get();
      const user = userSnapshot.data();
      if (!userSnapshot.exists || !user) return res.status(404).json({ success: false, error: 'Profile not found' });
      if (!hasApprovedDriverIdentity(user)) return res.status(403).json({ success: false, error: 'Admin approval of your Aadhaar, PAN, and vehicle RC with face image is required before publishing rides.' });
      const fromCity = requiredString(req.body.fromCity, 'fromCity');
      const toCity = requiredString(req.body.toCity, 'toCity');
      const departureTime = requiredString(req.body.departureTime, 'departureTime', 50);
      const departureDate = normalizeDate(requiredString(req.body.departureDate, 'departureDate', 80));
      const availableSeats = Number(req.body.availableSeats);
      const pricePerSeat = Number(req.body.pricePerSeat);
      const luggageCapacity = typeof req.body.luggageCapacity === 'string' ? req.body.luggageCapacity.trim().slice(0, 80) : '';
      const vehicleMakeModel = requiredString(req.body.vehicleMakeModel, 'vehicleMakeModel', 100);
      const driverUpiQrDataUrl = typeof req.body.driverUpiQrDataUrl === 'string' ? req.body.driverUpiQrDataUrl : '';
      if (driverUpiQrDataUrl && (!/^data:image\/(png|jpeg|webp);base64,/.test(driverUpiQrDataUrl) || driverUpiQrDataUrl.length > 750_000)) {
        return res.status(400).json({ success: false, error: 'Upload a PNG, JPEG, or WebP QR image under 550 KB.' });
      }
      const pickupLocation = requiredString(req.body.pickupLocation || fromCity, 'pickupLocation');
      const dropLocation = requiredString(req.body.dropLocation || toCity, 'dropLocation');
      if (normalizeCity(fromCity) === normalizeCity(toCity) || !Number.isInteger(availableSeats) || availableSeats < 1 || availableSeats > 8 || !Number.isFinite(pricePerSeat) || pricePerSeat < 1 || pricePerSeat > 100000) return res.status(400).json({ success: false, error: 'Invalid route, seat count, or price' });
      const driverVerified = hasApprovedDriverIdentity(user);
      const rideRef = rides.doc();
      const createdAt = new Date().toISOString();

      // ── Geocode origin & destination and calculate real road route ──────────
      // Caller may supply lat/lon directly (from the LocationAutocomplete picker).
      // If not supplied, we geocode from the city name string.
      // Route geometry is stored as an encoded polyline so passengers can be
      // matched against intermediate stops without recalculating the route each time.
      let fromLat: number | null = null;
      let fromLon: number | null = null;
      let toLat:   number | null = null;
      let toLon:   number | null = null;
      let routePolyline: string | undefined;
      let distanceStr = '';
      let durationStr = '';
      let estimatedArrivalTime = '';

      try {
        const suppliedFromLat = typeof req.body.fromLat === 'number' ? req.body.fromLat : null;
        const suppliedFromLon = typeof req.body.fromLon === 'number' ? req.body.fromLon : null;
        const suppliedToLat   = typeof req.body.toLat   === 'number' ? req.body.toLat   : null;
        const suppliedToLon   = typeof req.body.toLon   === 'number' ? req.body.toLon   : null;

        const originCoord = await geocodeLocation(fromCity, suppliedFromLat, suppliedFromLon);
        const destCoord   = await geocodeLocation(toCity,   suppliedToLat,   suppliedToLon);
        fromLat = originCoord.lat;
        fromLon = originCoord.lon;
        toLat   = destCoord.lat;
        toLon   = destCoord.lon;

        const roadRoute = await fetchRouteFromOSRM(originCoord, destCoord);
        routePolyline = roadRoute.encodedPolyline;
        distanceStr   = `${roadRoute.distanceKm.toFixed(1)} km`;
        durationStr   = `${Math.round(roadRoute.durationMinutes)} min`;

        // Estimate arrival time from departure time + driving duration
        try {
          const [h, m] = departureTime.split(':').map(Number);
          if (isFinite(h) && isFinite(m)) {
            const dep = new Date(`${departureDate}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
            dep.setMinutes(dep.getMinutes() + Math.round(roadRoute.durationMinutes));
            estimatedArrivalTime = `${String(dep.getHours()).padStart(2,'0')}:${String(dep.getMinutes()).padStart(2,'0')}`;
          }
        } catch { /* non-fatal */ }
      } catch (routeErr) {
        // Route calculation is non-fatal — ride is still published without geometry.
        // Passengers will fall back to the name-based cityMatch search for this ride.
        console.warn('[POST /api/rides] Route geometry unavailable:', routeErr instanceof Error ? routeErr.message : routeErr);
      }

      const ride = {
        id: rideRef.id,
        driverId: authRequest.uid,
        driverName: user.fullName || '',
        driverPhoto: user.profilePhoto || '',
        driverRating: user.rating || 0,
        driverTripsCount: user.totalTrips || 0,
        driverVerificationStatus: user.verificationStatus || 'unverified',
        driverRcVerified: user.rcVerified === true,
        driverVerified,
        vehicleMakeModel,
        driverUpiQrDataUrl,
        vehicleRegNumber: user.rcNumber || '',
        vehicleId: user.vehicleId || '',
        fromCity,
        toCity,
        fromLat,
        fromLon,
        toLat,
        toLon,
        pickupLocation,
        dropLocation,
        departureDate,
        departureTime,
        estimatedArrivalTime,
        duration: durationStr,
        distance: distanceStr,
        availableSeats,
        totalSeats: availableSeats,
        occupiedSeats: [],
        pricePerSeat,
        luggageCapacity,
        status: 'UPCOMING',
        ridePreferences: Array.isArray(req.body.ridePreferences)
          ? (req.body.ridePreferences as unknown[]).filter((p): p is string => typeof p === 'string').slice(0, 10)
          : [],
        driverTrustScore: computeTrustScore(user.totalTrips || 0, user.cancelledRides || 0),
        ...(routePolyline ? { routePolyline } : {}),
        createdAt
      };
      await rideRef.set({ ...ride, createdAt: FieldValue.serverTimestamp() });
      res.status(201).json({ success: true, message: 'Ride published', ride });
    } catch (error) { errorResponse(res, error); }
  });

  app.patch('/api/rides/:id/status', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const rideRef = rides.doc(req.params.id);
      const allowed = ['UPCOMING', 'DRIVER_ON_WAY', 'ARRIVING', 'STARTED', 'COMPLETED', 'CANCELLED'];
      const status = requiredString(req.body.status, 'status', 30);
      if (!allowed.includes(status)) return res.status(400).json({ success: false, error: 'Invalid ride status' });
      await db.runTransaction(async (transaction) => {
        const rideSnapshot = await transaction.get(rideRef);
        if (!rideSnapshot.exists) throw new Error('Ride not found');
        if (rideSnapshot.get('driverId') !== authRequest.uid) throw new Error('Only the ride driver can update this ride');
        const currentStatus = rideSnapshot.get('status');
        const transitions: Record<string, string[]> = { UPCOMING: ['DRIVER_ON_WAY', 'CANCELLED'], DRIVER_ON_WAY: ['ARRIVING', 'CANCELLED'], ARRIVING: ['STARTED', 'CANCELLED'], STARTED: ['COMPLETED'], COMPLETED: [], CANCELLED: [] };
        if (!transitions[currentStatus]?.includes(status)) throw new Error(`Ride cannot move from ${currentStatus} to ${status}`);
        if (status === 'CANCELLED') {
          const activeBookings = await transaction.get(bookings.where('rideId', '==', req.params.id).where('bookingStatus', 'in', ['PENDING', 'CONFIRMED']));
          if (!activeBookings.empty) throw new Error('Ride has active passenger bookings; process passenger refunds before cancelling');
        }
        if (status === 'COMPLETED') {
          const bookingSnapshot = await transaction.get(bookings.where('rideId', '==', req.params.id).where('bookingStatus', 'in', ['PENDING', 'CONFIRMED']));
          bookingSnapshot.docs.forEach((bookingDoc) => {
            transaction.update(bookingDoc.ref, { bookingStatus: 'COMPLETED', updatedAt: FieldValue.serverTimestamp() });
          });
        }
        transaction.update(rideRef, {
          status,
          updatedAt: FieldValue.serverTimestamp(),
          ...(status === 'COMPLETED' || status === 'CANCELLED' ? { liveLocation: FieldValue.delete() } : {})
        });
        // Update driver trust score on terminal status
        if (status === 'COMPLETED' || status === 'CANCELLED') {
          const driverRef = users.doc(authRequest.uid);
          const driverSnap = await transaction.get(driverRef);
          if (driverSnap.exists) {
            const d = driverSnap.data()!;
            const newTrips     = (d.totalTrips     || 0) + (status === 'COMPLETED' ? 1 : 0);
            const newCancelled = (d.cancelledRides || 0) + (status === 'CANCELLED'  ? 1 : 0);
            const newTrust     = computeTrustScore(newTrips, newCancelled);
            transaction.update(driverRef, {
              totalTrips:     newTrips,
              cancelledRides: newCancelled,
              trustScore:     newTrust,
              updatedAt:      FieldValue.serverTimestamp()
            });
          }
        }
      });
      res.json({ success: true, status });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update ride';
      res.status(message.includes('not found') ? 404 : message.includes('active passenger') ? 409 : message.includes('Only') || message.includes('cannot move') ? 403 : 500).json({ success: false, error: message });
    }
  });

  app.patch('/api/rides/:id/location', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const rideRef = rides.doc(req.params.id);
      const latitude = Number(req.body.latitude);
      const longitude = Number(req.body.longitude);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return res.status(400).json({ success: false, error: 'Valid GPS coordinates are required' });
      }
      let updatedAt = new Date();
      await db.runTransaction(async (transaction) => {
        const rideSnapshot = await transaction.get(rideRef);
        if (!rideSnapshot.exists) throw new Error('Ride not found');
        if (rideSnapshot.get('driverId') !== authRequest.uid) throw new Error('Only the ride driver can share its live location');
        if (!['DRIVER_ON_WAY', 'ARRIVING', 'STARTED'].includes(rideSnapshot.get('status'))) throw new Error('Live GPS is available only while the ride is active');
        transaction.update(rideRef, { liveLocation: { latitude, longitude, updatedAt: FieldValue.serverTimestamp() } });
      });
      res.json({ success: true, location: { latitude, longitude, updatedAt: updatedAt.toISOString() } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update ride location';
      res.status(message.includes('not found') ? 404 : message.includes('Only') ? 403 : message.includes('active') ? 409 : 500).json({ success: false, error: message });
    }
  });

  app.get('/api/rides/:id/location', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const rideSnapshot = await rides.doc(req.params.id).get();
      if (!rideSnapshot.exists) return res.status(404).json({ success: false, error: 'Ride not found' });
      const isDriver = rideSnapshot.get('driverId') === authRequest.uid;
      if (!isDriver) {
        const bookingSnapshot = await bookings.where('rideId', '==', req.params.id).limit(100).get();
        const isPassenger = bookingSnapshot.docs.some((booking) => booking.get('passengerId') === authRequest.uid && booking.get('bookingStatus') !== 'CANCELLED');
        if (!isPassenger) return res.status(403).json({ success: false, error: 'Only this ride’s driver and passengers can view its location' });
      }
      const liveLocation = rideSnapshot.get('liveLocation');
      if (!liveLocation || !(liveLocation.updatedAt instanceof Timestamp)) return res.json({ success: true, location: null });
      const updatedAt = liveLocation.updatedAt.toDate();
      const locationIsFresh = Date.now() - updatedAt.getTime() < 60_000;
      res.json({
        success: true,
        location: locationIsFresh ? {
          latitude: Number(liveLocation.latitude),
          longitude: Number(liveLocation.longitude),
          updatedAt: updatedAt.toISOString()
        } : null
      });
    } catch (error) { errorResponse(res, error, 'Unable to read ride location'); }
  });

  app.post('/api/payments/orders', async (req, res) => {
    let bookingRef: FirebaseFirestore.DocumentReference | undefined;
    let reservedRideRef: FirebaseFirestore.DocumentReference | undefined;
    try {
      await expireReservations();
      const authRequest = asAuthRequest(req);
      const rideId = requiredString(req.body.rideId, 'rideId', 120);
      const selectedSeats = req.body.selectedSeats;
      if (!Array.isArray(selectedSeats) || selectedSeats.length < 1 || selectedSeats.length > 8 || selectedSeats.some((seat: unknown) => !Number.isInteger(seat)) || new Set(selectedSeats).size !== selectedSeats.length) return res.status(400).json({ success: false, error: 'Select between one and eight unique seats' });
      const rideRef = rides.doc(rideId);
      const rideSnapshot = await rideRef.get();
      if (!rideSnapshot.exists) return res.status(404).json({ success: false, error: 'Ride not found' });
      const ride = rideSnapshot.data()!;
      if (ride.driverId === authRequest.uid) return res.status(403).json({ success: false, error: 'This ride is listed under your account, so you cannot book it. Choose another driver’s ride or sign in with the passenger account.' });
      if (ride.status !== 'UPCOMING') return res.status(409).json({ success: false, error: 'This ride is no longer available' });
      const passenger = (await users.doc(authRequest.uid).get()).data() || {};
      if (!hasApprovedRiderIdentity(passenger)) return res.status(403).json({ success: false, error: 'Admin approval of your Aadhaar photo and PAN image is required before booking rides.' });
      // Segment fare: if the passenger is booking an intermediate stop the caller supplies
      // segmentFare (calculated by the route-match endpoint). Validate it is reasonable
      // (must be ≥ 20% of full fare) and use it; otherwise default to full fare.
      const seatsCount = selectedSeats.length;
      const fullAmount = Number((seatsCount * Number(ride.pricePerSeat)).toFixed(2));
      const suppliedSegmentFare = typeof req.body.segmentFare === 'number' && isFinite(req.body.segmentFare) ? req.body.segmentFare : null;
      const minAllowedFare = Number((fullAmount * 0.2).toFixed(2));
      const amount = suppliedSegmentFare !== null && suppliedSegmentFare >= minAllowedFare
        ? Number(suppliedSegmentFare.toFixed(2))
        : fullAmount;
      const isIntermediateBooking = suppliedSegmentFare !== null && suppliedSegmentFare < fullAmount - 0.01;

      // Passenger segment coordinates (optional — present for intermediate stops)
      const passengerFromLat = typeof req.body.passengerFromLat === 'number' ? req.body.passengerFromLat : null;
      const passengerFromLon = typeof req.body.passengerFromLon === 'number' ? req.body.passengerFromLon : null;
      const passengerToLat   = typeof req.body.passengerToLat   === 'number' ? req.body.passengerToLat   : null;
      const passengerToLon   = typeof req.body.passengerToLon   === 'number' ? req.body.passengerToLon   : null;
      // Passenger's actual city names for the segment (may differ from ride's fromCity/toCity)
      const passengerFromCity = typeof req.body.passengerFromCity === 'string' ? req.body.passengerFromCity.trim().slice(0, 100) : ride.fromCity;
      const passengerToCity   = typeof req.body.passengerToCity   === 'string' ? req.body.passengerToCity.trim().slice(0, 100)   : ride.toCity;

      const order = await razorpayRequest<{ id: string; amount: number; currency: string }>('orders', 'POST', { amount: Math.round(amount * 100), currency: 'INR', receipt: `ubx_${randomUUID().replaceAll('-', '').slice(0, 24)}`, notes: { userId: authRequest.uid, rideId } });
      bookingRef = bookings.doc();
      reservedRideRef = rideRef;
      const reservationExpiry = Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000));
      await db.runTransaction(async (transaction) => {
        const freshRide = await transaction.get(rideRef);
        if (!freshRide.exists || freshRide.get('status') !== 'UPCOMING') throw new Error('This ride is no longer available');
        const occupiedSeats: number[] = freshRide.get('occupiedSeats') || [];
        if (selectedSeats.some((seat: number) => seat < 1 || seat > freshRide.get('totalSeats') || occupiedSeats.includes(seat))) throw new Error('One or more selected seats are no longer available');
        const nextOccupied = [...occupiedSeats, ...selectedSeats];
        transaction.update(rideRef, { occupiedSeats: nextOccupied, availableSeats: freshRide.get('totalSeats') - nextOccupied.length });
        transaction.set(bookingRef!, {
          id: bookingRef!.id, rideId,
          passengerId: authRequest.uid,
          passengerName: passenger.fullName || authRequest.authEmail || authRequest.authPhone || '',
          passengerPhone: passenger.phoneNumber || authRequest.authPhone || '',
          seatsBooked: selectedSeats.length, selectedSeats, amount,
          paymentStatus: 'PENDING', bookingStatus: 'PENDING',
          bookingReference: `UBX-${randomBytes(4).toString('hex').toUpperCase()}`,
          pickupLocation: ride.pickupLocation, dropLocation: ride.dropLocation,
          fromCity: passengerFromCity, toCity: passengerToCity,
          departureDate: ride.departureDate, departureTime: ride.departureTime,
          driverId: ride.driverId, driverName: ride.driverName,
          vehicleInfo: `${ride.vehicleMakeModel} (${ride.vehicleRegNumber})`,
          razorpayOrderId: order.id, reservationExpiresAt: reservationExpiry,
          // Segment journey fields
          ...(passengerFromLat !== null ? { passengerFromLat } : {}),
          ...(passengerFromLon !== null ? { passengerFromLon } : {}),
          ...(passengerToLat   !== null ? { passengerToLat   } : {}),
          ...(passengerToLon   !== null ? { passengerToLon   } : {}),
          ...(isIntermediateBooking ? { segmentFare: amount, isIntermediateBooking: true } : {}),
          createdAt: FieldValue.serverTimestamp()
        });
      });
      res.status(201).json({ success: true, bookingId: bookingRef.id, order, keyId: process.env.RAZORPAY_KEY_ID });
    } catch (error) {
      if (bookingRef && reservedRideRef) {
        try {
          await db.runTransaction(async (transaction) => {
            const bookingSnapshot = await transaction.get(bookingRef!);
            if (!bookingSnapshot.exists || bookingSnapshot.get('bookingStatus') !== 'PENDING') return;
            const rideSnapshot = await transaction.get(reservedRideRef!);
            if (rideSnapshot.exists) {
              const occupied: number[] = rideSnapshot.get('occupiedSeats') || [];
              const selected: number[] = bookingSnapshot.get('selectedSeats') || [];
              const remaining = occupied.filter((seat) => !selected.includes(seat));
              transaction.update(reservedRideRef!, { occupiedSeats: remaining, availableSeats: rideSnapshot.get('totalSeats') - remaining.length });
            }
            transaction.delete(bookingRef!);
          });
        } catch (cleanupError) { console.error('Unable to release failed seat reservation', cleanupError); }
      }
      const message = error instanceof Error ? error.message : 'Could not create payment order';
      res.status(message.includes('no longer') || message.includes('available') ? 409 : message.includes('configured') ? 503 : 500).json({ success: false, error: message });
    }
  });

  app.post('/api/payments/verify', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const orderId = requiredString(req.body.razorpay_order_id, 'razorpay_order_id', 120);
      const paymentId = requiredString(req.body.razorpay_payment_id, 'razorpay_payment_id', 120);
      const signature = requiredString(req.body.razorpay_signature, 'razorpay_signature', 256);
      if (!verifiedSignature(orderId, paymentId, signature)) return res.status(400).json({ success: false, error: 'Payment signature verification failed' });
      const matching = await bookings.where('razorpayOrderId', '==', orderId).limit(1).get();
      if (matching.empty) return res.status(404).json({ success: false, error: 'Booking for this payment was not found' });
      const bookingRef = matching.docs[0].ref;
      const initialBooking = matching.docs[0].data();
      if (initialBooking.passengerId !== authRequest.uid) return res.status(403).json({ success: false, error: 'You cannot verify this payment' });
      const expectedAmountPaise = Math.round(Number(initialBooking.amount) * 100);
      const paymentInfo = await razorpayRequest<{ id: string; order_id: string; amount: number; status: string }>(`payments/${encodeURIComponent(paymentId)}`, 'GET');
      if (paymentInfo.order_id !== orderId || paymentInfo.amount !== expectedAmountPaise || !['captured', 'authorized'].includes(paymentInfo.status)) return res.status(409).json({ success: false, error: 'Payment amount or status does not match this booking' });
      if (paymentInfo.status === 'authorized') await razorpayRequest(`payments/${encodeURIComponent(paymentId)}/capture`, 'POST', { amount: expectedAmountPaise, currency: 'INR' });
      let booking: FirebaseFirestore.DocumentData | undefined;
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(bookingRef);
        if (!snapshot.exists || snapshot.get('passengerId') !== authRequest.uid) throw new Error('Booking not found');
        if (snapshot.get('bookingStatus') === 'CANCELLED') throw new Error('Booking reservation expired');
        if (snapshot.get('bookingStatus') === 'PENDING') {
          transaction.update(bookingRef, { bookingStatus: 'CONFIRMED', paymentStatus: 'PAID', razorpayPaymentId: paymentId, updatedAt: FieldValue.serverTimestamp() });
          transaction.set(payments.doc(snapshot.id), { bookingId: snapshot.id, userId: authRequest.uid, amount: snapshot.get('amount'), method: 'razorpay', provider: 'razorpay', providerOrderId: orderId, providerPaymentId: paymentId, status: 'SUCCESS', createdAt: FieldValue.serverTimestamp() });
        }
        booking = { ...serializeBooking(snapshot), bookingStatus: 'CONFIRMED', paymentStatus: 'PAID' };
      });
      res.json({ success: true, booking });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment verification failed';
      res.status(message.includes('not found') ? 404 : message.includes('expired') ? 409 : 400).json({ success: false, error: message });
    }
  });

  app.post('/api/payments/reservations/:bookingId/cancel', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const bookingRef = bookings.doc(req.params.bookingId);
      let released = false;
      await db.runTransaction(async (transaction) => {
        const bookingSnapshot = await transaction.get(bookingRef);
        if (!bookingSnapshot.exists || bookingSnapshot.get('passengerId') !== authRequest.uid) return;
        if (bookingSnapshot.get('bookingStatus') !== 'PENDING') return;
        const rideRef = rides.doc(bookingSnapshot.get('rideId'));
        const rideSnapshot = await transaction.get(rideRef);
        if (rideSnapshot.exists) {
          const occupied: number[] = rideSnapshot.get('occupiedSeats') || [];
          const selected: number[] = bookingSnapshot.get('selectedSeats') || [];
          transaction.update(rideRef, { occupiedSeats: occupied.filter(s => !selected.includes(s)), availableSeats: rideSnapshot.get('totalSeats') - occupied.filter(s => !selected.includes(s)).length });
        }
        transaction.update(bookingRef, { bookingStatus: 'CANCELLED', updatedAt: FieldValue.serverTimestamp() });
        released = true;
      });
      res.json({ success: true, released });
    } catch (error) { errorResponse(res, error, 'Unable to release seat reservation'); }
  });

  app.get('/api/bookings', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const snapshot = await bookings.where('passengerId', '==', authRequest.uid).limit(100).get();
      const bookingsList = snapshot.docs.map(serializeBooking);
      bookingsList.sort((left, right) => {
        const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
        const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
        return rightTime - leftTime;
      });
      res.json({ success: true, count: bookingsList.length, bookings: bookingsList });
    } catch (error) { errorResponse(res, error); }
  });

  app.post(['/api/bookings/cash', '/api/bookings/upi'], async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const paymentMethod = req.path.endsWith('/upi') ? 'upi' : 'cash';
      const rideId = requiredString(req.body.rideId, 'rideId', 120);
      const selectedSeats = req.body.selectedSeats;

      if (!Array.isArray(selectedSeats) || selectedSeats.length < 1 || selectedSeats.length > 8 || selectedSeats.some((seat: unknown) => !Number.isInteger(seat)) || new Set(selectedSeats).size !== selectedSeats.length) {
        return res.status(400).json({ success: false, error: 'Select between one and eight unique seats' });
      }

      const rideRef = rides.doc(rideId);
      const rideSnapshot = await rideRef.get();
      if (!rideSnapshot.exists) return res.status(404).json({ success: false, error: 'Ride not found' });

      const ride = rideSnapshot.data()!;
      if (ride.driverId === authRequest.uid) return res.status(403).json({ success: false, error: 'This ride is listed under your account, so you cannot book it. Choose another driver’s ride or sign in with the passenger account.' });
      if (ride.status !== 'UPCOMING') return res.status(409).json({ success: false, error: 'This ride is no longer available' });
      if (paymentMethod === 'upi' && !ride.driverUpiQrDataUrl) return res.status(409).json({ success: false, error: 'This driver has not provided a UPI QR code' });

      const passenger = (await users.doc(authRequest.uid).get()).data() || {};
      if (!hasApprovedRiderIdentity(passenger)) return res.status(403).json({ success: false, error: 'Admin approval of your Aadhaar photo and PAN image is required before booking rides.' });
      const seatsCount = selectedSeats.length;
      const fullAmount = Number((seatsCount * Number(ride.pricePerSeat)).toFixed(2));
      const suppliedSegmentFare = typeof req.body.segmentFare === 'number' && isFinite(req.body.segmentFare) ? req.body.segmentFare : null;
      const minAllowedFare = Number((fullAmount * 0.2).toFixed(2));
      const amount = suppliedSegmentFare !== null && suppliedSegmentFare >= minAllowedFare
        ? Number(suppliedSegmentFare.toFixed(2))
        : fullAmount;
      const isIntermediateBooking = suppliedSegmentFare !== null && suppliedSegmentFare < fullAmount - 0.01;

      // Passenger segment coordinates (intermediate-stop bookings)
      const passengerFromLat = typeof req.body.passengerFromLat === 'number' ? req.body.passengerFromLat : null;
      const passengerFromLon = typeof req.body.passengerFromLon === 'number' ? req.body.passengerFromLon : null;
      const passengerToLat   = typeof req.body.passengerToLat   === 'number' ? req.body.passengerToLat   : null;
      const passengerToLon   = typeof req.body.passengerToLon   === 'number' ? req.body.passengerToLon   : null;
      const passengerFromCity = typeof req.body.passengerFromCity === 'string' ? req.body.passengerFromCity.trim().slice(0, 100) : ride.fromCity;
      const passengerToCity   = typeof req.body.passengerToCity   === 'string' ? req.body.passengerToCity.trim().slice(0, 100)   : ride.toCity;

      const bookingRef = bookings.doc();

      await db.runTransaction(async (transaction) => {
        const freshRide = await transaction.get(rideRef);
        if (!freshRide.exists || freshRide.get('status') !== 'UPCOMING') throw new Error('This ride is no longer available');

        const occupiedSeats: number[] = freshRide.get('occupiedSeats') || [];
        if (selectedSeats.some((seat: number) => seat < 1 || seat > freshRide.get('totalSeats') || occupiedSeats.includes(seat))) {
          throw new Error('One or more selected seats are no longer available');
        }

        const nextOccupied = [...occupiedSeats, ...selectedSeats];
        transaction.update(rideRef, {
          occupiedSeats: nextOccupied,
          availableSeats: freshRide.get('totalSeats') - nextOccupied.length,
          updatedAt: FieldValue.serverTimestamp()
        });

        transaction.set(bookingRef, {
          id: bookingRef.id,
          rideId,
          passengerId: authRequest.uid,
          passengerName: passenger.fullName || authRequest.authEmail || authRequest.authPhone || '',
          passengerPhone: passenger.phoneNumber || authRequest.authPhone || '',
          seatsBooked: selectedSeats.length,
          selectedSeats,
          amount,
          paymentStatus: paymentMethod === 'cash' ? 'CASH_PENDING' : 'UPI_PENDING',
          paymentMethod,
          bookingStatus: 'PENDING',
          bookingReference: `UBX-${randomBytes(4).toString('hex').toUpperCase()}`,
          pickupLocation: ride.pickupLocation,
          dropLocation: ride.dropLocation,
          fromCity: passengerFromCity,
          toCity: passengerToCity,
          departureDate: ride.departureDate,
          departureTime: ride.departureTime,
          driverId: ride.driverId,
          driverName: ride.driverName,
          vehicleInfo: `${ride.vehicleMakeModel} (${ride.vehicleRegNumber})`,
          // Segment journey fields
          ...(passengerFromLat !== null ? { passengerFromLat } : {}),
          ...(passengerFromLon !== null ? { passengerFromLon } : {}),
          ...(passengerToLat   !== null ? { passengerToLat   } : {}),
          ...(passengerToLon   !== null ? { passengerToLon   } : {}),
          ...(isIntermediateBooking ? { segmentFare: amount, isIntermediateBooking: true } : {}),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      const booking = serializeBooking(await bookingRef.get());
      res.status(201).json({ success: true, booking });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to confirm booking';
      res.status(message.includes('no longer') || message.includes('available') ? 409 : 400).json({ success: false, error: message });
    }
  });

  app.patch('/api/bookings/:id/payment-confirmation', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const bookingRef = bookings.doc(req.params.id);
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(bookingRef);
        if (!snapshot.exists) throw new Error('Booking not found');
        if (snapshot.get('driverId') !== authRequest.uid) throw new Error('Only the ride driver can confirm payment');
        if (!['PENDING', 'CONFIRMED'].includes(snapshot.get('bookingStatus'))) throw new Error('This booking cannot be confirmed');
        if (!['CASH_PENDING', 'UPI_PENDING'].includes(snapshot.get('paymentStatus'))) throw new Error('This payment is not awaiting confirmation');
        transaction.update(bookingRef, {
          bookingStatus: 'CONFIRMED',
          paymentStatus: 'PAID',
          paymentConfirmedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      });
      res.json({ success: true, booking: serializeBooking(await bookingRef.get()) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to confirm payment';
      res.status(message.includes('not found') ? 404 : message.includes('Only') ? 403 : 409).json({ success: false, error: message });
    }
  });

  app.get('/api/bookings/:id/messages', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const bookingRef = bookings.doc(req.params.id);
      const bookingSnapshot = await bookingRef.get();
      if (!bookingSnapshot.exists) return res.status(404).json({ success: false, error: 'Booking not found' });
      const booking = bookingSnapshot.data()!;
      if (![booking.passengerId, booking.driverId].includes(authRequest.uid)) return res.status(403).json({ success: false, error: 'Only this booking passenger and driver can access its chat' });
      if (booking.bookingStatus === 'CANCELLED') return res.status(409).json({ success: false, error: 'Chat is unavailable for a cancelled booking' });

      const peerId = booking.passengerId === authRequest.uid ? String(booking.driverId || '') : String(booking.passengerId || '');
      const peerSnapshot = peerId ? await users.doc(peerId).get() : null;
      const peer = peerSnapshot?.data() || {};
      const messageSnapshot = await bookingRef.collection('messages').orderBy('createdAt', 'asc').limit(100).get();
      const messages = messageSnapshot.docs.map((messageDoc) => {
        const message = messageDoc.data();
        const createdAt = message.createdAt instanceof Timestamp ? message.createdAt.toMillis() : Date.now();
        return { id: messageDoc.id, senderId: String(message.senderId || ''), text: String(message.text || ''), time: new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), timestamp: createdAt };
      });

      res.json({
        success: true,
        conversation: {
          id: bookingSnapshot.id,
          bookingId: bookingSnapshot.id,
          peerId,
          peerName: String(peer.fullName || (peerId === booking.driverId ? booking.driverName : booking.passengerName) || 'Ride participant'),
          peerPhoto: String(peer.profilePhoto || ''),
          driverId: String(booking.driverId || ''),
          driverName: String(booking.driverName || 'Driver'),
          driverPhoto: String(booking.driverId === authRequest.uid ? peer.profilePhoto || '' : peer.profilePhoto || ''),
          driverRating: Number(peer.rating) || 0,
          vehicleMakeModel: String(booking.vehicleInfo || ''),
          rideRoute: `${String(booking.fromCity || '')} → ${String(booking.toCity || '')}`,
          lastMessage: String(booking.lastMessage || ''),
          lastMessageTime: timestampToIso(booking.lastMessageAt),
          unreadCount: 0,
          isOnline: false,
          messages
        }
      });
    } catch (error) { errorResponse(res, error, 'Unable to load booking chat'); }
  });

  app.post('/api/bookings/:id/messages', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const text = requiredString(req.body.text, 'text', 2000);
      const bookingRef = bookings.doc(req.params.id);
      const bookingSnapshot = await bookingRef.get();
      if (!bookingSnapshot.exists) return res.status(404).json({ success: false, error: 'Booking not found' });
      const booking = bookingSnapshot.data()!;
      if (![booking.passengerId, booking.driverId].includes(authRequest.uid)) return res.status(403).json({ success: false, error: 'Only this booking passenger and driver can send messages' });
      if (booking.bookingStatus === 'CANCELLED') return res.status(409).json({ success: false, error: 'Chat is unavailable for a cancelled booking' });

      const userSnapshot = await users.doc(authRequest.uid).get();
      const senderName = String(userSnapshot.get('fullName') || (authRequest.uid === booking.driverId ? booking.driverName : booking.passengerName) || 'Ride participant');
      const messageRef = bookingRef.collection('messages').doc();
      const createdAt = new Date();
      await db.runTransaction(async (transaction) => {
        const freshBooking = await transaction.get(bookingRef);
        if (!freshBooking.exists || freshBooking.get('bookingStatus') === 'CANCELLED') throw new Error('Chat is unavailable for this booking');
        if (![freshBooking.get('passengerId'), freshBooking.get('driverId')].includes(authRequest.uid)) throw new Error('Only this booking passenger and driver can send messages');
        transaction.set(messageRef, { id: messageRef.id, senderId: authRequest.uid, senderName, text, createdAt: FieldValue.serverTimestamp() });
        transaction.update(bookingRef, { lastMessage: text, lastMessageAt: FieldValue.serverTimestamp() });
      });
      res.status(201).json({ success: true, message: { id: messageRef.id, senderId: authRequest.uid, senderName, text, time: createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), timestamp: createdAt.getTime() } });
    } catch (error) { errorResponse(res, error, 'Unable to send booking chat message'); }
  });

  app.post('/api/reviews', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const rideId = requiredString(req.body.rideId, 'rideId', 120);
      const driverId = requiredString(req.body.driverId, 'driverId', 120);
      const rating = Number(req.body.rating);
      const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
      const tags = Array.isArray(req.body.tags) ? req.body.tags.filter((tag) => typeof tag === 'string').slice(0, 8).map((tag) => tag.trim()).filter(Boolean) : [];
      const bookingId = typeof req.body.bookingId === 'string' ? req.body.bookingId : '';
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5 stars.' });
      }
      const bookingRef = bookingId ? bookings.doc(bookingId) : null;
      let bookingDoc: FirebaseFirestore.DocumentSnapshot | null = null;
      if (bookingRef) {
        bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) return res.status(404).json({ success: false, error: 'Booking not found' });
        if (bookingDoc.get('passengerId') !== authRequest.uid) return res.status(403).json({ success: false, error: 'You cannot review this ride' });
      } else {
        const existing = await bookings.where('passengerId', '==', authRequest.uid).where('rideId', '==', rideId).limit(20).get();
        bookingDoc = existing.docs[0] || null;
      }
      if (!bookingDoc) return res.status(404).json({ success: false, error: 'No booking found for this trip' });
      const booking = bookingDoc.data() || {};
      const route = `${String(booking.fromCity || '').trim() || 'Trip'} → ${String(booking.toCity || '').trim() || 'Destination'}`;
      const reviewRef = reviews.doc();
      const payload = {
        id: reviewRef.id,
        rideId,
        driverId,
        reviewerId: authRequest.uid,
        reviewerName: booking.passengerName || 'Passenger',
        reviewerPhoto: '',
        rating,
        comment: comment || 'Great ride and safe journey.',
        tags,
        route,
        createdAt: FieldValue.serverTimestamp()
      };
      await reviewRef.set(payload);

      const rideRef = rides.doc(rideId);
      const rideSnap = await rideRef.get();
      const driverRatingAverage = await reviews.where('driverId', '==', driverId).get();
      const reviewRatings = driverRatingAverage.docs.map((doc) => Number(doc.get('rating') || 0)).filter((value) => Number.isFinite(value));
      const nextDriverRating = reviewRatings.length ? Number((reviewRatings.reduce((sum, value) => sum + value, 0) / reviewRatings.length).toFixed(1)) : Number(rating.toFixed(1));
      await users.doc(driverId).set({ rating: nextDriverRating, totalTrips: reviewRatings.length }, { merge: true });
      if (rideSnap.exists) {
        const rideReviews = await reviews.where('rideId', '==', rideId).get();
        const rideRatings = rideReviews.docs.map((doc) => Number(doc.get('rating') || 0)).filter((value) => Number.isFinite(value));
        const nextRideRating = rideRatings.length ? Number((rideRatings.reduce((sum, value) => sum + value, 0) / rideRatings.length).toFixed(1)) : Number(rating.toFixed(1));
        await rideRef.set({ driverRating: nextRideRating, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }

      const updatedBookingData = {
        ...booking,
        isRated: true,
        hasRated: true,
        rating,
        ratingGiven: rating,
        reviewComment: payload.comment,
        reviewTags: tags,
        updatedAt: FieldValue.serverTimestamp()
      };
      await bookingDoc.ref.set(updatedBookingData, { merge: true });

      const updatedBooking = {
        id: bookingDoc.id,
        rideId: String(booking.rideId || rideId),
        passengerId: String(booking.passengerId || authRequest.uid),
        passengerName: String(booking.passengerName || 'Passenger'),
        passengerPhone: String(booking.passengerPhone || ''),
        seatsBooked: Number(booking.seatsBooked) || 0,
        selectedSeats: Array.isArray(booking.selectedSeats) ? booking.selectedSeats : [],
        amount: Number(booking.amount) || 0,
        paymentStatus: String(booking.paymentStatus || 'PAID'),
        bookingStatus: String(booking.bookingStatus || 'CONFIRMED'),
        bookingReference: String(booking.bookingReference || ''),
        pickupLocation: String(booking.pickupLocation || ''),
        dropLocation: String(booking.dropLocation || ''),
        fromCity: String(booking.fromCity || ''),
        toCity: String(booking.toCity || ''),
        departureDate: String(booking.departureDate || ''),
        departureTime: String(booking.departureTime || ''),
        driverName: String(booking.driverName || ''),
        driverId: String(booking.driverId || driverId),
        vehicleInfo: String(booking.vehicleInfo || ''),
        isRated: true,
        hasRated: true,
        rating,
        ratingGiven: rating,
        reviewComment: payload.comment,
        reviewTags: tags,
        createdAt: timestampToIso(booking.createdAt) || new Date().toISOString()
      };
      const createdReview = {
        id: reviewRef.id,
        rideId,
        reviewerId: authRequest.uid,
        reviewerName: booking.passengerName || 'Passenger',
        reviewerPhoto: '',
        driverId,
        rating,
        comment: payload.comment,
        tags,
        route,
        createdAt: new Date().toISOString()
      };
      res.status(201).json({ success: true, review: createdReview, booking: updatedBooking });
    } catch (error) { errorResponse(res, error); }
  });

  app.get('/api/reviews/driver/:driverId', async (req, res) => {
    try {
      const snapshot = await reviews.where('driverId', '==', req.params.driverId).orderBy('createdAt', 'desc').limit(25).get();
      res.json({ success: true, reviews: snapshot.docs.map(serializeReview) });
    } catch (error) { errorResponse(res, error); }
  });

  app.patch('/api/bookings/:id/cancel', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const bookingRef = bookings.doc(req.params.id);
      const bookingSnapshot = await bookingRef.get();
      if (!bookingSnapshot.exists) return res.status(404).json({ success: false, error: 'Booking not found' });
      const booking = bookingSnapshot.data()!;
      if (booking.passengerId !== authRequest.uid) return res.status(403).json({ success: false, error: 'You cannot cancel this booking' });
      if (booking.bookingStatus !== 'CONFIRMED' && booking.bookingStatus !== 'PENDING') return res.status(409).json({ success: false, error: 'This booking cannot be cancelled' });
      let refundStatus = booking.paymentStatus;
      if (booking.paymentStatus === 'PAID' && booking.razorpayPaymentId) {
        const refund = await razorpayRequest<{ id: string; status: string }>(`payments/${encodeURIComponent(booking.razorpayPaymentId)}/refund`, 'POST', { amount: Math.round(Number(booking.amount) * 100) });
        refundStatus = refund.status === 'processed' ? 'REFUNDED' : 'REFUND_PENDING';
      }
      await db.runTransaction(async (transaction) => {
        const freshBooking = await transaction.get(bookingRef);
        if (!freshBooking.exists || freshBooking.get('bookingStatus') === 'CANCELLED') return;
        const rideRef = rides.doc(freshBooking.get('rideId'));
        const rideSnapshot = await transaction.get(rideRef);
        if (rideSnapshot.exists) {
          const occupied: number[] = rideSnapshot.get('occupiedSeats') || [];
          const selected: number[] = freshBooking.get('selectedSeats') || [];
          transaction.update(rideRef, { occupiedSeats: occupied.filter(s => !selected.includes(s)), availableSeats: rideSnapshot.get('totalSeats') - occupied.filter(s => !selected.includes(s)).length });
        }
        transaction.update(bookingRef, { bookingStatus: 'CANCELLED', paymentStatus: refundStatus, updatedAt: FieldValue.serverTimestamp() });
      });
      res.json({ success: true, message: 'Booking cancelled', booking: { ...serializeBooking(bookingSnapshot), bookingStatus: 'CANCELLED', paymentStatus: refundStatus } });
    } catch (error) { errorResponse(res, error, 'Unable to cancel booking'); }
  });
}
