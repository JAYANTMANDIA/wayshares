import {
  User,
  Ride,
  Booking,
  SafetyContact,
  NotificationItem,
  SupportTicket,
  Driver,
  Vehicle,
  UserRole,
  RideStatus,
  TrackingState,
  LiveRideLocation,
  ChatConversation,
  ChatMessage,
  Review,
  AdminDashboardStats,
  AdminRide,
  AdminVerificationUser,
  VerificationDocumentType
} from '../types';
import { app, auth } from '../lib/firebase';
import { readApiJson } from '../lib/apiJson';
import { signOut } from 'firebase/auth';
import { canAccessAdminPortal } from '../lib/adminAccess';

const STORAGE_KEYS = {
  USER: 'uberx_user_v1',
  ACTIVE_ROLE: 'uberx_active_role_v1',
  RIDES: 'uberx_rides_v1',
  BOOKINGS: 'uberx_bookings_v1',
  SAFETY_CONTACTS: 'uberx_contacts_v1',
  NOTIFICATIONS: 'uberx_notifs_v1',
  TICKETS: 'uberx_tickets_v1',
  DRIVERS: 'uberx_drivers_v1',
  VEHICLES: 'uberx_vehicles_v1',
  ALL_USERS: 'uberx_all_users_v1',
  IS_AUTHENTICATED: 'uberx_auth_v1',
  CONVERSATIONS: 'uberx_conversations_v1'
};

const CACHE_MIGRATION_KEY = 'uberx_seeded_cache_removed_v1';
const EMPTY_USER: User = {
  id: '',
  fullName: '',
  phoneNumber: '',
  email: '',
  profilePhoto: '',
  city: '',
  verificationStatus: 'unverified',
  userRole: 'passenger',
  rating: 0,
  totalTrips: 0,
  createdAt: '',
  updatedAt: ''
};

function removeLegacySeededCache() {
  try {
    if (localStorage.getItem(CACHE_MIGRATION_KEY) === 'done') return;
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(CACHE_MIGRATION_KEY, 'done');
  } catch (error) {
    console.warn('Unable to clear legacy demo cache', error);
  }
}

class UberXStore {
  private listeners: Set<() => void> = new Set();

  public user: User;
  public activeRole: 'passenger' | 'driver' | 'admin';
  public isAuthenticated: boolean;
  public rides: Ride[];
  public bookings: Booking[];
  public safetyContacts: SafetyContact[];
  public notifications: NotificationItem[];
  public tickets: SupportTicket[];
  public drivers: Driver[];
  public vehicles: Vehicle[];
  public allUsers: User[];
  public conversations: ChatConversation[];

  // Live simulation tracking state
  public activeTracking: TrackingState | null = null;
  private trackingInterval: any = null;

  constructor() {
    removeLegacySeededCache();
    this.user = this.load(STORAGE_KEYS.USER, EMPTY_USER);
    this.activeRole = this.load(STORAGE_KEYS.ACTIVE_ROLE, 'passenger');
    this.isAuthenticated = false;
    this.rides = [];
    this.bookings = [];
    this.safetyContacts = this.load(STORAGE_KEYS.SAFETY_CONTACTS, []);
    this.notifications = this.load(STORAGE_KEYS.NOTIFICATIONS, []);
    this.tickets = this.load(STORAGE_KEYS.TICKETS, []);
    this.drivers = this.load(STORAGE_KEYS.DRIVERS, []);
    this.vehicles = this.load(STORAGE_KEYS.VEHICLES, []);
    this.conversations = this.load(STORAGE_KEYS.CONVERSATIONS, []);
    this.allUsers = this.load(STORAGE_KEYS.ALL_USERS, []);
    this.syncWithBackend();
  }

  private async authHeaders() {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Sign in to continue');
    return { Authorization: `Bearer ${await firebaseUser.getIdToken()}` };
  }

  private mergeRides(incoming: Ride[]) {
    this.rides = [...new Map([...this.rides, ...incoming].map((ride) => [ride.id, ride])).values()];
  }

  public async fetchAvailableRides(filters?: { fromCity?: string; toCity?: string; date?: string }) {
    const headers = await this.authHeaders();
    const params = new URLSearchParams();
    if (filters?.fromCity?.trim()) params.set('fromCity', filters.fromCity.trim());
    if (filters?.toCity?.trim()) params.set('toCity', filters.toCity.trim());
    if (filters?.date?.trim()) params.set('date', filters.date.trim());
    const query = params.toString();
    const response = await fetch(query ? `/api/rides?${query}` : '/api/rides', { headers });
    const result = await readApiJson<{ rides?: Ride[]; error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to load rides');
    const rides: Ride[] = Array.isArray(result.rides) ? result.rides : [];
    this.mergeRides(rides);
    this.notify();
    return rides;
  }

  /**
   * Route-based ride search. Uses the passenger's real coordinates to check
   * whether each driver's stored road route passes through the requested segment.
   * Falls back to name-based matching for rides published without geometry.
   */
  public async fetchRidesByRoute(filters: {
    fromCity: string;
    toCity: string;
    fromLat?: number | null;
    fromLon?: number | null;
    toLat?: number | null;
    toLon?: number | null;
    date?: string;
    seats?: number;
  }): Promise<Ride[]> {
    const headers = await this.authHeaders();
    const params = new URLSearchParams();
    params.set('fromCity', filters.fromCity.trim());
    params.set('toCity',   filters.toCity.trim());
    if (filters.date?.trim()) params.set('date', filters.date.trim());
    if (filters.seats) params.set('seats', String(filters.seats));
    if (typeof filters.fromLat === 'number' && isFinite(filters.fromLat)) params.set('fromLat', String(filters.fromLat));
    if (typeof filters.fromLon === 'number' && isFinite(filters.fromLon)) params.set('fromLon', String(filters.fromLon));
    if (typeof filters.toLat === 'number' && isFinite(filters.toLat)) params.set('toLat', String(filters.toLat));
    if (typeof filters.toLon === 'number' && isFinite(filters.toLon)) params.set('toLon', String(filters.toLon));
    const response = await fetch(`/api/rides/route-match?${params}`, { headers });
    const result = await readApiJson<{ rides?: Ride[]; error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to search rides');
    const rides: Ride[] = Array.isArray(result.rides) ? result.rides : [];
    this.mergeRides(rides);
    this.notify();
    return rides;
  }

  public async fetchDriverRides() {
    const userId = auth?.currentUser?.uid;
    const headers = await this.authHeaders();
    const response = await fetch('/api/driver/rides', { headers });
    const result = await readApiJson<{ rides?: Ride[]; error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to load your rides');
    const rides: Ride[] = Array.isArray(result.rides) ? result.rides : [];
    if (!userId || auth?.currentUser?.uid !== userId || this.user.id !== userId) return [];
    this.rides = [...this.rides.filter((ride) => ride.driverId !== userId), ...rides];
    this.notify();
    return rides;
  }

  public async fetchRideById(rideId: string): Promise<Ride> {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Sign in to view this ride');
    const send = async (forceRefresh: boolean) => fetch(`/api/rides/${encodeURIComponent(rideId)}`, {
      headers: { Authorization: `Bearer ${await firebaseUser.getIdToken(forceRefresh)}` }
    });
    let response = await send(false);
    if (response.status === 401) response = await send(true);
    const result = await readApiJson<{ ride?: Ride; error?: string }>(response);
    if (!response.ok || !result.ride) throw new Error(result.error || 'Unable to load this ride');
    this.rides = [result.ride, ...this.rides.filter((ride) => ride.id !== result.ride!.id)];
    this.notify();
    return result.ride;
  }

  public async fetchMyBookings() {
    const userId = auth?.currentUser?.uid;
    const headers = await this.authHeaders();
    const response = await fetch('/api/bookings', { headers });
    const result = await readApiJson<{ bookings?: Booking[]; error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to load bookings');
    if (!userId || auth?.currentUser?.uid !== userId || this.user.id !== userId) return [];
    this.bookings = Array.isArray(result.bookings) ? result.bookings : [];
    this.notify();
    return this.bookings;
  }

  public async syncWithBackend() {
    try {
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser) return;
      await Promise.all([this.fetchDriverRides(), this.fetchMyBookings()]);
    } catch (error) {
      console.error('Unable to sync account data with the database', error);
    }
  }

  private load<T>(key: string, defaultValue: T): T {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Store load error:', e);
    }
    return defaultValue;
  }

  private save(key: string, value: any) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Store save error:', e);
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  // Auth Operations
  public setAuthenticatedUser(user: User) {
    if (this.user.id && this.user.id !== user.id) {
      this.activeRole = 'passenger';
      this.rides = [];
      this.bookings = [];
      this.safetyContacts = [];
      this.notifications = [];
      this.tickets = [];
      this.drivers = [];
      this.vehicles = [];
      this.allUsers = [];
      this.conversations = [];
      sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_ROLE);
    }
    this.user = user;
    this.isAuthenticated = true;
    this.save(STORAGE_KEYS.USER, user);
    this.save(STORAGE_KEYS.IS_AUTHENTICATED, true);
    this.notify();
    void this.syncWithBackend();
  }

  public logout() {
    this.isAuthenticated = false;
    this.user = EMPTY_USER;
    this.activeRole = 'passenger';
    this.rides = [];
    this.bookings = [];
    this.safetyContacts = [];
    this.notifications = [];
    this.tickets = [];
    this.drivers = [];
    this.vehicles = [];
    this.allUsers = [];
    this.conversations = [];
    this.save(STORAGE_KEYS.IS_AUTHENTICATED, false);
    sessionStorage.removeItem(STORAGE_KEYS.USER);
    sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_ROLE);
    if (auth) void signOut(auth).catch((error) => console.error('Unable to sign out', error));
    this.notify();
  }

  public canProvideRide(): boolean {
    return this.user.riderVerificationStatus === 'verified' &&
      this.user.driverVerificationStatus === 'verified' &&
      this.user.verificationDocuments?.aadhaarSelfie?.status === 'verified' &&
      this.user.verificationDocuments?.pan?.status === 'verified' &&
      this.user.verificationDocuments?.rcSelfie?.status === 'verified';
  }

  public async submitVerificationDocuments(
    files: Partial<Record<VerificationDocumentType, File>>,
    onProgress?: (progress: number, current: number, total: number) => void
  ) {
    const firebaseUser = auth?.currentUser;
    if (!app || !firebaseUser || firebaseUser.uid !== this.user.id) throw new Error('Sign in before uploading documents');
    const selected = Object.entries(files).filter((entry): entry is [VerificationDocumentType, File] => entry[1] instanceof File);
    if (!selected.some(([type]) => type === 'aadhaarSelfie') || !selected.some(([type]) => type === 'pan')) {
      throw new Error('Upload both the Aadhaar photo with your face visible and the PAN card image.');
    }
    for (const [, file] of selected) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) {
        throw new Error('Choose JPEG, PNG, or WebP images under 5 MB each.');
      }
    }
    const body = new FormData();
    for (const [type, file] of selected) body.append(type, file, file.name);
    const headers = await this.authHeaders();
    const result = await new Promise<{
      error?: string;
      riderVerificationStatus?: User['riderVerificationStatus'];
      driverVerificationStatus?: User['driverVerificationStatus'];
      submittedTypes?: VerificationDocumentType[];
    }>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', '/api/user/verification-documents');
      request.setRequestHeader('Authorization', headers.Authorization);
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress?.(Math.min(95, Math.floor(event.loaded / event.total * 95)), 1, 1);
      });
      request.addEventListener('error', () => reject(new Error('Upload connection failed. Check your network and try again.')));
      request.addEventListener('timeout', () => reject(new Error('Upload timed out. Please retry on a stable connection.')));
      request.addEventListener('load', () => {
        let response: typeof result;
        try {
          response = JSON.parse(request.responseText) as typeof result;
        } catch {
          reject(new Error('The upload server returned an invalid response. Please retry.'));
          return;
        }
        if (request.status < 200 || request.status >= 300) {
          reject(new Error(response.error || 'Unable to upload identity documents'));
          return;
        }
        resolve(response);
      });
      request.timeout = 120_000;
      request.send(body);
    });
    onProgress?.(100, selected.length, selected.length);
    if (auth?.currentUser?.uid !== firebaseUser.uid || this.user.id !== firebaseUser.uid) {
      throw new Error('Your signed-in account changed during upload. Sign in again before submitting.');
    }
    this.user = {
      ...this.user,
      riderVerificationStatus: result.riderVerificationStatus || 'pending',
      verificationStatus: 'pending',
      driverVerificationStatus: result.driverVerificationStatus || (files.rcSelfie ? 'pending' : this.user.driverVerificationStatus),
      rcVerified: false,
      verificationDocuments: {
        ...this.user.verificationDocuments,
        ...Object.fromEntries((result.submittedTypes || selected.map(([type]) => type)).map((type) => [type, { status: 'pending' }]))
      }
    };
    this.save(STORAGE_KEYS.USER, this.user);
    if (this.activeRole === 'driver') {
      this.activeRole = 'passenger';
      this.save(STORAGE_KEYS.ACTIVE_ROLE, 'passenger');
    }
    this.notify();
  }

  public async fetchAdminVerificationUsers(cursor?: string) {
    const headers = await this.authHeaders();
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const response = await fetch(`/api/admin/verifications${query}`, { headers });
    const result = await readApiJson<{ users?: AdminVerificationUser[]; nextCursor?: string | null; error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to load verification requests');
    return { users: result.users || [], nextCursor: result.nextCursor || undefined };
  }

  public async fetchAdminDriveStatus() {
    const headers = await this.authHeaders();
    const response = await fetch('/api/admin/drive/status', { headers });
    const result = await readApiJson<{
      configured?: boolean;
      connected?: boolean;
      email?: string;
      setupHelp?: string;
      error?: string;
    }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to check Google Drive connection');
    return result;
  }

  public async connectAdminGoogleDrive() {
    const headers = await this.authHeaders();
    const response = await fetch('/api/admin/drive/connect', { method: 'POST', headers });
    const result = await readApiJson<{ url?: string; error?: string }>(response);
    if (!response.ok || !result.url) throw new Error(result.error || 'Unable to start Google Drive authorization');
    window.location.assign(result.url);
  }

  public async fetchAdminOverview() {
    const headers = await this.authHeaders();
    const response = await fetch('/api/admin/overview', { headers });
    const result = await readApiJson<{ stats?: AdminDashboardStats; error?: string }>(response);
    if (!response.ok || !result.stats) throw new Error(result.error || 'Unable to load admin dashboard');
    return result.stats;
  }

  public async fetchAdminRides(cursor?: string) {
    const headers = await this.authHeaders();
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const response = await fetch(`/api/admin/rides${query}`, { headers });
    const result = await readApiJson<{ rides?: AdminRide[]; nextCursor?: string | null; error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to load rides');
    return { rides: result.rides || [], nextCursor: result.nextCursor || undefined };
  }

  public async fetchAdminDocumentUrl(userId: string, type: VerificationDocumentType) {
    const headers = await this.authHeaders();
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/documents/${type}`, { headers });
    if (!response.ok) {
      const result = await readApiJson<{ error?: string }>(response);
      throw new Error(result.error || 'Unable to open identity image');
    }
    return URL.createObjectURL(await response.blob());
  }

  public async reviewUserVerification(userId: string, kind: 'rider' | 'driver', status: 'verified' | 'rejected', reason?: string) {
    const headers = await this.authHeaders();
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/verification`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, status, ...(reason ? { reason } : {}) })
    });
    const result = await readApiJson<{ error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to review identity documents');
  }

  public setActiveRole(role: 'passenger' | 'driver' | 'admin'): boolean {
    if (role === 'admin' && !canAccessAdminPortal(this.user.email)) return false;
    if (role === 'driver' && !this.canProvideRide()) {
      // Cannot become driver without uploading RC!
      return false;
    }
    this.activeRole = role;
    this.save(STORAGE_KEYS.ACTIVE_ROLE, role);
    this.notify();
    return true;
  }

  public updateUserProfile(updated: Partial<User>) {
    this.user = { ...this.user, ...updated, updatedAt: new Date().toISOString() };
    this.save(STORAGE_KEYS.USER, this.user);
    this.notify();
  }

  /** Upload a profile photo (converts file to base64, sends to backend, updates local user). */
  public async uploadProfilePhoto(file: File): Promise<string> {
    if (!file.type.startsWith('image/') || file.size > 800_000) {
      throw new Error('Choose a PNG or JPEG image under 800 KB');
    }
    // Resize to max 400×400 before encoding
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const size = 400;
          const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(img.naturalWidth  * scale);
          canvas.height = Math.round(img.naturalHeight * scale);
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => reject(new Error('Unable to load image'));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('Unable to read file'));
      reader.readAsDataURL(file);
    });
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Sign in to update your photo');
    const res = await fetch('/api/user/photo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo: dataUrl })
    });
    const result = await readApiJson<{ profilePhoto?: string; error?: string }>(res);
    if (!res.ok) throw new Error(result.error || 'Unable to save photo');
    this.user = { ...this.user, profilePhoto: dataUrl, updatedAt: new Date().toISOString() };
    this.save(STORAGE_KEYS.USER, this.user);
    this.notify();
    return dataUrl;
  }

  // Update local views only after the server confirms payment.
  public recordConfirmedBooking(booking: Booking) {
    if (this.bookings.some((existing) => existing.id === booking.id)) {
      this.bookings = this.bookings.map((existing) => existing.id === booking.id ? booking : existing);
    } else {
      this.bookings = [booking, ...this.bookings];
    }
    const ride = this.rides.find((item) => item.id === booking.rideId);
    if (ride) {
      ride.occupiedSeats = [...new Set([...ride.occupiedSeats, ...booking.selectedSeats])];
      ride.availableSeats = Math.max(0, ride.totalSeats - ride.occupiedSeats.length);
    }
    this.notify();
    void this.syncWithBackend();
  }

  // Cancel Booking
  public async cancelBooking(bookingId: string) {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Sign in before cancelling a booking');
    const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}` }
    });
    const result = await readApiJson<{ booking: Booking; error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to cancel booking');
    const updatedBooking = result.booking as Booking;
    this.bookings = this.bookings.map((booking) => booking.id === bookingId ? updatedBooking : booking);
    const ride = this.rides.find((item) => item.id === updatedBooking.rideId);
    if (ride) {
      ride.occupiedSeats = ride.occupiedSeats.filter((seat) => !updatedBooking.selectedSeats.includes(seat));
      ride.availableSeats = Math.min(ride.totalSeats, ride.totalSeats - ride.occupiedSeats.length);
      this.save(STORAGE_KEYS.RIDES, this.rides);
    }
    this.addNotification({
      title: 'Booking Cancelled',
      message: updatedBooking.paymentStatus === 'REFUND_PENDING'
        ? `Booking ${updatedBooking.bookingReference} cancelled. Your refund is being processed.`
        : `Booking ${updatedBooking.bookingReference} cancelled.`,
      type: 'payment'
    });
  }

  public async confirmBookingPayment(bookingId: string) {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Sign in before confirming payment');
    if (firebaseUser.uid !== this.user.id) throw new Error('Your signed-in account changed. Refresh the page and try again.');
    const send = async (forceRefresh: boolean) => fetch(`/api/bookings/${encodeURIComponent(bookingId)}/payment-confirmation`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${await firebaseUser.getIdToken(forceRefresh)}` }
    });
    let response = await send(false);
    if (response.status === 401) response = await send(true);
    const result = await readApiJson<{ booking?: Booking; error?: string }>(response);
    if (!response.ok || !result.booking) throw new Error(result.error || 'Unable to confirm payment');
    this.rides = this.rides.map((ride) => ride.id !== result.booking!.rideId ? ride : {
      ...ride,
      passengerBookings: (ride.passengerBookings || []).map((booking) => booking.id === bookingId ? result.booking! : booking)
    });
    this.save(STORAGE_KEYS.RIDES, this.rides);
    this.notify();
  }

  // Driver Operations
  public async createRide(rideData: {
    fromCity: string;
    toCity: string;
    /** Latitude of origin (from location picker) */
    fromLat?: number | null;
    /** Longitude of origin */
    fromLon?: number | null;
    /** Latitude of destination */
    toLat?: number | null;
    /** Longitude of destination */
    toLon?: number | null;
    pickupLocation: string;
    dropLocation: string;
    departureDate: string;
    departureTime: string;
    availableSeats: number;
    pricePerSeat: number;
    luggageCapacity: string;
    vehicleMakeModel: string;
    vehicleRegNumber: string;
    driverUpiQrDataUrl?: string;
    ridePreferences?: string[];
  }): Promise<Ride> {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Sign in before publishing a ride');
    const publish = (token: string) => fetch('/api/rides', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(rideData)
    });
    let response = await publish(await firebaseUser.getIdToken());
    if (response.status === 401) response = await publish(await firebaseUser.getIdToken(true));
    const result = await readApiJson<{ ride: Ride; error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to publish ride');
    const newRide = result.ride as Ride;
    this.rides = [newRide, ...this.rides.filter((ride) => ride.id !== newRide.id)];
    this.save(STORAGE_KEYS.RIDES, this.rides);
    this.notify();
    return newRide;
  }

  public async updateRideStatus(rideId: string, status: RideStatus) {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Sign in before managing a ride');
    const response = await fetch(`/api/rides/${encodeURIComponent(rideId)}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    const result = await readApiJson<{ status: RideStatus; error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to update ride');
    const ride = this.rides.find((r) => r.id === rideId);
    if (ride) {
      ride.status = result.status as RideStatus;
      this.save(STORAGE_KEYS.RIDES, this.rides);
      if (this.activeTracking && this.activeTracking.rideId === rideId) {
        this.activeTracking.currentStatus = status;
      }
      this.notify();
    }
  }

  public async updateRideLiveLocation(rideId: string, latitude: number, longitude: number) {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Sign in before sharing ride location');
    const send = async (forceRefresh: boolean) => fetch(`/api/rides/${encodeURIComponent(rideId)}/location`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${await firebaseUser.getIdToken(forceRefresh)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ latitude, longitude })
    });
    let response = await send(false);
    if (response.status === 401) response = await send(true);
    const result = await readApiJson<{ error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to share driver location');
  }

  public async fetchRideLiveLocation(rideId: string): Promise<LiveRideLocation | null> {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Sign in to view ride location');
    const send = async (forceRefresh: boolean) => fetch(`/api/rides/${encodeURIComponent(rideId)}/location`, {
      headers: { Authorization: `Bearer ${await firebaseUser.getIdToken(forceRefresh)}` }
    });
    let response = await send(false);
    if (response.status === 401) response = await send(true);
    const result = await readApiJson<{ location: LiveRideLocation | null; error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to load ride location');
    return result.location;
  }

  public addSafetyContact(contact: Omit<SafetyContact, 'id' | 'userId'>) {
    const newContact: SafetyContact = {
      id: `cnt_${Date.now()}`,
      userId: this.user.id,
      ...contact
    };
    this.safetyContacts = [...this.safetyContacts, newContact];
    this.save(STORAGE_KEYS.SAFETY_CONTACTS, this.safetyContacts);
    this.notify();
  }

  public deleteSafetyContact(id: string) {
    this.safetyContacts = this.safetyContacts.filter((c) => c.id !== id);
    this.save(STORAGE_KEYS.SAFETY_CONTACTS, this.safetyContacts);
    this.notify();
  }

  // Support
  public createSupportTicket(category: string, message: string) {
    const newTicket: SupportTicket = {
      id: `tkt_${Date.now()}`,
      userId: this.user.id,
      userName: this.user.fullName,
      category,
      message,
      status: 'OPEN',
      createdAt: new Date().toISOString()
    };
    this.tickets = [newTicket, ...this.tickets];
    this.save(STORAGE_KEYS.TICKETS, this.tickets);
    this.addNotification({
      title: 'Support Ticket Raised',
      message: `Your query under "${category}" has been sent to UberX 24/7 team.`,
      type: 'system'
    });
    this.notify();
  }

  public updateTicketStatus(ticketId: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') {
    const t = this.tickets.find((item) => item.id === ticketId);
    if (t) {
      t.status = status;
      this.save(STORAGE_KEYS.TICKETS, this.tickets);
      this.notify();
    }
  }

  // Admin Controls
  public verifyUser(userId: string) {
    const u = this.allUsers.find((user) => user.id === userId);
    if (u) {
      u.verificationStatus = 'verified';
      this.save(STORAGE_KEYS.ALL_USERS, this.allUsers);
      this.notify();
    }
  }

  public suspendUser(userId: string) {
    const u = this.allUsers.find((user) => user.id === userId);
    if (u) {
      u.verificationStatus = 'rejected';
      this.save(STORAGE_KEYS.ALL_USERS, this.allUsers);
      this.notify();
    }
  }

  public updateDriverStatus(driverId: string, status: 'verified' | 'rejected' | 'pending') {
    const d = this.drivers.find((driver) => driver.id === driverId);
    if (d) {
      d.verificationStatus = status;
      this.save(STORAGE_KEYS.DRIVERS, this.drivers);
      this.notify();
    }
  }

  public cancelRideByAdmin(rideId: string) {
    const r = this.rides.find((ride) => ride.id === rideId);
    if (r) {
      r.status = 'CANCELLED';
      this.save(STORAGE_KEYS.RIDES, this.rides);
      this.notify();
    }
  }

  // Notifications
  public addNotification(item: Omit<NotificationItem, 'id' | 'userId' | 'createdAt' | 'read'>) {
    const notif: NotificationItem = {
      id: `notif_${Date.now()}`,
      userId: this.user.id,
      read: false,
      createdAt: 'Just now',
      ...item
    };
    this.notifications = [notif, ...this.notifications];
    this.save(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
    this.notify();
  }

  public markNotificationAsRead(id: string) {
    const n = this.notifications.find((notif) => notif.id === id);
    if (n) {
      n.read = true;
      this.save(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
      this.notify();
    }
  }

  public clearAllNotifications() {
    this.notifications = [];
    this.save(STORAGE_KEYS.NOTIFICATIONS, this.notifications);
    this.notify();
  }

  public async addReview(params: {
    rideId: string;
    driverId: string;
    rating: number;
    comment: string;
    tags: string[];
    bookingId?: string;
  }): Promise<Review> {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Sign in before submitting a rating');

    const response = await fetch('/api/reviews', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rideId: params.rideId,
        driverId: params.driverId,
        rating: params.rating,
        comment: params.comment,
        tags: params.tags,
        bookingId: params.bookingId
      })
    });

    const result = await readApiJson<{ review?: Review; booking?: Booking; error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to submit your review');

    const review = result.review || {
      id: `rev_${Date.now()}`,
      rideId: params.rideId,
      reviewerId: this.user.id,
      reviewerName: this.user.fullName,
      reviewerPhoto: this.user.profilePhoto,
      driverId: params.driverId,
      rating: params.rating,
      comment: params.comment,
      tags: params.tags,
      createdAt: new Date().toISOString()
    } as Review;

    const ride = this.rides.find((r) => r.id === params.rideId);
    if (ride) {
      ride.reviews = [review, ...(ride.reviews || [])];
      ride.driverRating = Number((ride.driverRating || 0) > 0 ? ride.driverRating : params.rating);
      this.save(STORAGE_KEYS.RIDES, this.rides);
    }

    if (result.booking) {
      this.bookings = this.bookings.map((booking) => booking.id === result.booking!.id ? { ...booking, ...result.booking! } : booking);
    } else if (params.bookingId) {
      const booking = this.bookings.find((b) => b.id === params.bookingId);
      if (booking) {
        booking.isRated = true;
        booking.hasRated = true;
        booking.rating = params.rating;
        booking.ratingGiven = params.rating;
        booking.reviewComment = params.comment;
        booking.reviewTags = params.tags;
      }
    }

    this.addNotification({
      title: 'Review Submitted!',
      message: `Thank you for rating with ${params.rating} stars! Your review helps keep rides safe and reliable.`,
      type: 'booking'
    });

    this.notify();
    return review;
  }

  public sendMessage(conversationId: string, text: string) {
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };

    conv.messages.push(userMsg);
    conv.lastMessage = text;
    conv.lastMessageTime = userMsg.time;
    this.save(STORAGE_KEYS.CONVERSATIONS, this.conversations);
    this.notify();

    // Contextual simulated driver reply after 1.2s
    setTimeout(() => {
      const lower = text.toLowerCase();
      let replyText = 'Got it! Looking forward to a smooth and safe trip.';
      if (lower.includes('where') || lower.includes('location') || lower.includes('reach')) {
        replyText = `I am currently near the pickup point, tracking real-time traffic. See you shortly!`;
      } else if (lower.includes('time') || lower.includes('eta') || lower.includes('late') || lower.includes('delay')) {
        replyText = `On schedule! We should arrive at the destination right on time.`;
      } else if (lower.includes('bag') || lower.includes('luggage') || lower.includes('boot')) {
        replyText = `Sure, the boot is completely clean and empty for your luggage!`;
      } else if (lower.includes('ac') || lower.includes('cool') || lower.includes('temp') || lower.includes('air')) {
        replyText = `AC is set to 23°C. Feel free to adjust the vents once onboard.`;
      } else if (lower.includes('stop') || lower.includes('tea') || lower.includes('coffee') || lower.includes('break')) {
        replyText = `We have a planned 10-minute quick refresh stop at the expressway food court.`;
      } else if (lower.includes('fast') || lower.includes('speed') || lower.includes('slow')) {
        replyText = `Always maintaining safe expressway speed limits under 80 km/h.`;
      } else if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
        replyText = `Hello! Vehicle is sanitized and ready for pickup.`;
      }

      const driverMsg: ChatMessage = {
        id: `msg_d_${Date.now()}`,
        sender: 'driver',
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      };
      conv.messages.push(driverMsg);
      conv.lastMessage = replyText;
      conv.lastMessageTime = driverMsg.time;
      this.save(STORAGE_KEYS.CONVERSATIONS, this.conversations);
      this.notify();
    }, 1200);
  }

  private async bookingChatRequest<T>(url: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Sign in before opening booking chat');
    const send = async (forceRefresh: boolean) => fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${await firebaseUser.getIdToken(forceRefresh)}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    let response = await send(false);
    if (response.status === 401) response = await send(true);
    const result = await readApiJson<T & { error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Booking chat request failed');
    return result as T;
  }

  public async fetchBookingConversation(bookingId: string): Promise<ChatConversation> {
    const result = await this.bookingChatRequest<{
      conversation: Omit<ChatConversation, 'messages'> & {
        messages: Array<Omit<ChatMessage, 'sender'> & { senderId: string }>;
      };
    }>(`/api/bookings/${encodeURIComponent(bookingId)}/messages`, 'GET');
    const currentUserId = auth?.currentUser?.uid;
    const conversation: ChatConversation = {
      ...result.conversation,
      messages: result.conversation.messages.map((message) => ({
        id: message.id,
        text: message.text,
        time: message.time,
        timestamp: message.timestamp,
        sender: message.senderId === currentUserId ? 'user' : 'driver'
      }))
    };
    this.conversations = [conversation, ...this.conversations.filter((item) => item.id !== conversation.id)];
    this.notify();
    return conversation;
  }

  public async sendBookingMessage(bookingId: string, text: string): Promise<void> {
    const result = await this.bookingChatRequest<{
      message: Omit<ChatMessage, 'sender'> & { senderId: string };
    }>(`/api/bookings/${encodeURIComponent(bookingId)}/messages`, 'POST', { text });
    const conversation = this.conversations.find((item) => item.id === bookingId);
    if (!conversation) return;
    conversation.messages = [...conversation.messages, {
      id: result.message.id,
      text: result.message.text,
      time: result.message.time,
      timestamp: result.message.timestamp,
      sender: 'user'
    }];
    conversation.lastMessage = result.message.text;
    conversation.lastMessageTime = result.message.time;
    this.notify();
  }

  public markConversationRead(conversationId: string) {
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (conv && conv.unreadCount > 0) {
      conv.unreadCount = 0;
      this.save(STORAGE_KEYS.CONVERSATIONS, this.conversations);
      this.notify();
    }
  }

  public startOrGetConversationWithDriver(
    driverId: string,
    driverName: string,
    driverPhoto: string,
    vehicleInfo: string,
    route?: string
  ): ChatConversation {
    let conv = this.conversations.find((c) => c.driverId === driverId);
    if (!conv) {
      conv = {
        id: `conv_${Date.now()}`,
        driverId,
        driverName,
        driverPhoto,
        driverRating: 4.9,
        vehicleMakeModel: vehicleInfo,
        lastMessage: 'Conversation started',
        lastMessageTime: 'Just now',
        unreadCount: 0,
        isOnline: true,
        rideRoute: route || '',
        messages: [
          {
            id: `msg_init_${Date.now()}`,
            sender: 'driver',
            text: `Hi! I will be your verified driver for ${route || 'this ride'}. Reach out anytime with questions.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now()
          }
        ]
      };
      this.conversations.unshift(conv);
      this.save(STORAGE_KEYS.CONVERSATIONS, this.conversations);
      this.notify();
    }
    return conv;
  }

}

export const store = new UberXStore();
