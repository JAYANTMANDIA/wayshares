import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Express, Request, Response, NextFunction } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, db, FieldValue, firebaseAdminInitError } from './firebaseAdmin';

type AuthRequest = Request & { uid: string; authEmail?: string; authPhone?: string; authEmailVerified?: boolean };

const users            = db.collection('users');
const rides            = db.collection('rides');
const bookings         = db.collection('bookings');
const payments         = db.collection('payments');
const scheduledRides   = db.collection('scheduledRides');
const trustedContacts  = db.collection('trustedContacts');
const locationSessions = db.collection('locationSessions');

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
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
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

function timestampToIso(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === 'string' ? value : '';
}

function serializeRide(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    driverId: String(data.driverId || ''),
    driverName: String(data.driverName || 'Driver'),
    driverPhoto: String(data.driverPhoto || ''),
    driverRating: Number(data.driverRating) || 0,
    driverTripsCount: Number(data.driverTripsCount) || 0,
    vehicleMakeModel: String(data.vehicleMakeModel || ''),
    vehicleRegNumber: String(data.vehicleRegNumber || ''),
    vehicleId: String(data.vehicleId || ''),
    fromCity: String(data.fromCity || ''),
    toCity: String(data.toCity || ''),
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
      const profile = { id: authRequest.uid, fullName: fullName || existing.fullName || authRequest.authEmail || 'WAYSHARE rider', email: authRequest.authEmail || '', phoneNumber, profilePhoto: existing.profilePhoto || '', city: existing.city || '', verificationStatus: existing.verificationStatus || 'unverified', userRole: existing.userRole || 'passenger', rating: existing.rating || 0, totalTrips: existing.totalTrips || 0, rcVerified: existing.rcVerified === true, rcNumber: existing.rcNumber || null, createdAt: existing.createdAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      await userRef.set(profile, { merge: true });
      res.json({ success: true, user: { ...profile, createdAt: undefined, updatedAt: undefined } });
    } catch (error) { errorResponse(res, error); }
  });

  app.use('/api', requireVerifiedEmail);

  app.get('/api/user', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const snapshot = await users.doc(authRequest.uid).get();
      if (!snapshot.exists) return res.status(404).json({ success: false, error: 'Profile not found' });
      const user = snapshot.data();
      res.json({ success: true, user: { ...user, id: authRequest.uid, canProvideRide: user?.rcVerified === true && Boolean(user?.rcNumber) } });
    } catch (error) { errorResponse(res, error); }
  });

  app.put('/api/user', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const updates: Record<string, unknown> = {};
      for (const field of ['fullName', 'city', 'profilePhoto', 'gender', 'collegeOrOrganization']) {
        if (req.body[field] !== undefined) updates[field] = requiredString(req.body[field], field, field === 'profilePhoto' ? 1000 : 120);
      }
      updates.updatedAt = FieldValue.serverTimestamp();
      await users.doc(authRequest.uid).set(updates, { merge: true });
      const updated = await users.doc(authRequest.uid).get();
      res.json({ success: true, user: { ...updated.data(), id: authRequest.uid } });
    } catch (error) { errorResponse(res, error); }
  });

  // TRUSTED CONTACTS
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

  app.post('/api/user/verify-document', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const documentType = requiredString(req.body.documentType, 'documentType', 20).toLowerCase();
      if (!['rc', 'pan', 'aadhaar', 'license'].includes(documentType)) return res.status(400).json({ success: false, error: 'Unsupported document type' });
      const requestRef = db.collection('verificationRequests').doc();
      await requestRef.set({ id: requestRef.id, userId: authRequest.uid, documentType, status: req.body.action === 'remove' ? 'REMOVAL_REQUESTED' : 'PENDING', createdAt: FieldValue.serverTimestamp() });
      res.status(202).json({ success: true, status: req.body.action === 'remove' ? 'REMOVAL_REQUESTED' : 'PENDING', message: 'Verification is pending administrator review.' });
    } catch (error) { errorResponse(res, error); }
  });

  app.get('/api/rides', async (req, res) => {
    try {
      await expireReservations();
      const snapshot = await rides.where('status', '==', 'UPCOMING').limit(100).get();
      let results = snapshot.docs.map(serializeRide).filter((ride) => Boolean(ride.driverId));
      const fromCity = typeof req.query.fromCity === 'string' ? req.query.fromCity.toLowerCase().trim() : '';
      const toCity = typeof req.query.toCity === 'string' ? req.query.toCity.toLowerCase().trim() : '';
      const date = typeof req.query.date === 'string' ? String(req.query.date).trim().slice(0, 10) : '';
      const cityMatch = (value: string, query: string) => {
        const city = value.toLowerCase().trim();
        return !query || city === query || city.includes(query) || query.includes(city);
      };
      const dateKey = (value: string) => {
        const raw = String(value || '').trim();
        const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
        if (iso) return iso[1];
        const parsed = Date.parse(raw);
        if (Number.isNaN(parsed)) return raw.toLowerCase();
        const d = new Date(parsed);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      results = results.filter((ride) => cityMatch(ride.fromCity, fromCity) && cityMatch(ride.toCity, toCity) && (!date || dateKey(ride.departureDate) === dateKey(date)));
      res.json({ success: true, count: results.length, rides: results });
    } catch (error) { errorResponse(res, error); }
  });

  app.get('/api/driver/rides', async (req, res) => {
    try {
      const authRequest = asAuthRequest(req);
      const snapshot = await rides.where('driverId', '==', authRequest.uid).limit(100).get();
      const results = snapshot.docs.map(serializeRide);
      res.json({ success: true, count: results.length, rides: results });
    } catch (error) { errorResponse(res, error); }
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
      if (!userSnapshot.exists || user?.rcVerified !== true || !user.rcNumber) return res.status(403).json({ success: false, error: 'A verified vehicle registration is required to publish rides' });
      const fromCity = requiredString(req.body.fromCity, 'fromCity');
      const toCity = requiredString(req.body.toCity, 'toCity');
      const departureTime = requiredString(req.body.departureTime, 'departureTime', 50);
      const departureDate = requiredString(req.body.departureDate, 'departureDate', 80);
      const availableSeats = Number(req.body.availableSeats);
      const pricePerSeat = Number(req.body.pricePerSeat);
      if (fromCity.toLowerCase() === toCity.toLowerCase() || !Number.isInteger(availableSeats) || availableSeats < 1 || availableSeats > 8 || !Number.isFinite(pricePerSeat) || pricePerSeat < 1 || pricePerSeat > 100000) return res.status(400).json({ success: false, error: 'Invalid route, seat count, or price' });
      const rideRef = rides.doc();
      const createdAt = new Date().toISOString();
      const ride = { id: rideRef.id, driverId: authRequest.uid, driverName: user.fullName || 'WAYSHARE driver', driverPhoto: user.profilePhoto || '', driverRating: user.rating || 0, driverTripsCount: user.totalTrips || 0, vehicleMakeModel: requiredString(req.body.vehicleMakeModel, 'vehicleMakeModel', 100), vehicleRegNumber: user.rcNumber, vehicleId: user.vehicleId || '', fromCity, toCity, pickupLocation: requiredString(req.body.pickupLocation || `${fromCity} Central`, 'pickupLocation'), dropLocation: requiredString(req.body.dropLocation || `${toCity} Junction`, 'dropLocation'), departureDate, departureTime, estimatedArrivalTime: '', duration: '', distance: '', availableSeats, totalSeats: availableSeats, occupiedSeats: [], pricePerSeat, luggageCapacity: String(req.body.luggageCapacity || '2 bags max').slice(0, 80), status: 'UPCOMING', createdAt };
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
        transaction.update(rideRef, { status, updatedAt: FieldValue.serverTimestamp() });
      });
      res.json({ success: true, status });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update ride';
      res.status(message.includes('not found') ? 404 : message.includes('active passenger') ? 409 : message.includes('Only') || message.includes('cannot move') ? 403 : 500).json({ success: false, error: message });
    }
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
      if (ride.driverId === authRequest.uid) return res.status(403).json({ success: false, error: 'Drivers cannot book their own ride' });
      if (ride.status !== 'UPCOMING') return res.status(409).json({ success: false, error: 'This ride is no longer available' });
      const amount = Number((selectedSeats.length * Number(ride.pricePerSeat)).toFixed(2));
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
        transaction.set(bookingRef!, { id: bookingRef!.id, rideId, passengerId: authRequest.uid, passengerName: authRequest.authEmail || authRequest.authPhone || 'WAYSHARE passenger', passengerPhone: authRequest.authPhone || '', seatsBooked: selectedSeats.length, selectedSeats, amount, paymentStatus: 'PENDING', bookingStatus: 'PENDING', bookingReference: `UBX-${randomBytes(4).toString('hex').toUpperCase()}`, pickupLocation: ride.pickupLocation, dropLocation: ride.dropLocation, fromCity: ride.fromCity, toCity: ride.toCity, departureDate: ride.departureDate, departureTime: ride.departureTime, driverId: ride.driverId, driverName: ride.driverName, vehicleInfo: `${ride.vehicleMakeModel} (${ride.vehicleRegNumber})`, razorpayOrderId: order.id, reservationExpiresAt: reservationExpiry, createdAt: FieldValue.serverTimestamp() });
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
        booking = { id: snapshot.id, ...snapshot.data(), bookingStatus: 'CONFIRMED', paymentStatus: 'PAID' };
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
      res.json({ success: true, count: snapshot.size, bookings: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) });
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
      res.json({ success: true, message: 'Booking cancelled', booking: { ...booking, bookingStatus: 'CANCELLED', paymentStatus: refundStatus } });
    } catch (error) { errorResponse(res, error, 'Unable to cancel booking'); }
  });
}
