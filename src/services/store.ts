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
  ChatConversation,
  ChatMessage,
  Review
} from '../types';
import { auth } from '../lib/firebase';
import { readApiJson } from '../lib/apiJson';
import { signOut } from 'firebase/auth';

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
    this.bookings = this.load(STORAGE_KEYS.BOOKINGS, []);
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
    this.rides = rides;
    this.notify();
    return this.rides;
  }

  public async syncWithBackend() {
    try {
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser) return;
      const authorization = { Authorization: `Bearer ${await firebaseUser.getIdToken()}` };
      const [rideResponse, driverRideResponse, bookingResponse] = await Promise.all([
        fetch('/api/rides', { headers: authorization }),
        fetch('/api/driver/rides', { headers: authorization }),
        fetch('/api/bookings', { headers: authorization })
      ]);
      const rideData = rideResponse.ok ? await rideResponse.json() : { rides: [] };
      const driverRideData = driverRideResponse.ok ? await driverRideResponse.json() : { rides: [] };
      const bookingData = bookingResponse.ok ? await bookingResponse.json() : { bookings: [] };
      const allRides: Ride[] = [...(rideData.rides || []), ...(driverRideData.rides || [])];
      this.rides = [...new Map(allRides.map((ride) => [ride.id, ride])).values()];
      this.bookings = Array.isArray(bookingData.bookings) ? bookingData.bookings : this.bookings;
      this.save(STORAGE_KEYS.BOOKINGS, this.bookings);
      this.notify();
    } catch {
      // Graceful offline fallback
    }
  }

  private load<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(key);
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
      localStorage.setItem(key, JSON.stringify(value));
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
    this.user = user;
    this.isAuthenticated = true;
    this.save(STORAGE_KEYS.USER, user);
    this.save(STORAGE_KEYS.IS_AUTHENTICATED, true);
    this.notify();
    void this.syncWithBackend();
  }

  public logout() {
    this.isAuthenticated = false;
    this.save(STORAGE_KEYS.IS_AUTHENTICATED, false);
    if (auth) void signOut(auth).catch((error) => console.error('Unable to sign out', error));
    this.notify();
  }

  public canProvideRide(): boolean {
    return Boolean(this.user.rcNumber && this.user.rcVerified);
  }

  public updateVerificationDocs(data: {
    aadhaarNumber?: string;
    aadhaarVerified?: boolean;
    aadhaarDoc?: string;
    panNumber?: string;
    panVerified?: boolean;
    panDoc?: string;
    rcNumber?: string | null;
    rcVerified?: boolean;
    rcDoc?: string | null;
  }) {
    const updated = { ...this.user };
    if (data.aadhaarNumber !== undefined) updated.aadhaarNumber = data.aadhaarNumber;
    if (data.aadhaarVerified !== undefined) updated.aadhaarVerified = data.aadhaarVerified;
    if (data.aadhaarDoc !== undefined) updated.aadhaarDoc = data.aadhaarDoc;

    if (data.panNumber !== undefined) updated.panNumber = data.panNumber;
    if (data.panVerified !== undefined) updated.panVerified = data.panVerified;
    if (data.panDoc !== undefined) updated.panDoc = data.panDoc;

    if (data.rcNumber !== undefined) updated.rcNumber = data.rcNumber || undefined;
    if (data.rcVerified !== undefined) updated.rcVerified = data.rcVerified;
    if (data.rcDoc !== undefined) updated.rcDoc = data.rcDoc || undefined;

    // RC is optional: if RC is uploaded & verified, user can provide rides; otherwise can only take a ride
    updated.canProvideRide = Boolean(updated.rcNumber && updated.rcVerified);

    this.user = updated;
    this.save(STORAGE_KEYS.USER, this.user);
    this.notify();

    // Sync to Express Backend API
    fetch('/api/user/verify-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentType: data.rcNumber ? 'rc' : data.aadhaarNumber ? 'aadhaar' : 'pan',
        documentNumber: data.rcNumber || data.aadhaarNumber || data.panNumber,
        action: 'upload'
      })
    }).catch(() => {});
  }

  public removeRC() {
    this.user = {
      ...this.user,
      rcNumber: undefined,
      rcVerified: false,
      rcDoc: undefined,
      canProvideRide: false
    };
    if (this.activeRole === 'driver') {
      this.activeRole = 'passenger';
      this.save(STORAGE_KEYS.ACTIVE_ROLE, 'passenger');
    }
    this.save(STORAGE_KEYS.USER, this.user);
    this.notify();

    // Sync to Express Backend API
    fetch('/api/user/verify-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentType: 'rc', action: 'remove' })
    }).catch(() => {});
  }

  public setActiveRole(role: 'passenger' | 'driver' | 'admin'): boolean {
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

  // Update local views only after the server confirms payment.
  public recordConfirmedBooking(booking: Booking) {
    if (this.bookings.some((existing) => existing.id === booking.id)) return;
    const ride = this.rides.find((item) => item.id === booking.rideId);
    if (ride) {
      ride.occupiedSeats = [...new Set([...ride.occupiedSeats, ...booking.selectedSeats])];
      ride.availableSeats = Math.max(0, ride.totalSeats - ride.occupiedSeats.length);
      this.save(STORAGE_KEYS.RIDES, this.rides);
    }
    this.bookings = [booking, ...this.bookings];
    this.save(STORAGE_KEYS.BOOKINGS, this.bookings);
    this.notify();
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
    this.save(STORAGE_KEYS.BOOKINGS, this.bookings);
    this.addNotification({
      title: 'Booking Cancelled',
      message: updatedBooking.paymentStatus === 'REFUND_PENDING'
        ? `Booking ${updatedBooking.bookingReference} cancelled. Your refund is being processed.`
        : `Booking ${updatedBooking.bookingReference} cancelled.`,
      type: 'payment'
    });
  }

  // Driver Operations
  public async createRide(rideData: {
    fromCity: string;
    toCity: string;
    pickupLocation: string;
    dropLocation: string;
    departureDate: string;
    departureTime: string;
    availableSeats: number;
    pricePerSeat: number;
    luggageCapacity: string;
    vehicleMakeModel: string;
    vehicleRegNumber: string;
  }): Promise<Ride> {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Sign in before publishing a ride');
    const response = await fetch('/api/rides', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rideData)
    });
    const result = await readApiJson<{ ride: Ride; error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to publish ride');
    const newRide = result.ride as Ride;
    this.rides = [newRide, ...this.rides.filter((ride) => ride.id !== newRide.id)];
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

  public addReview(params: {
    rideId: string;
    driverId: string;
    rating: number;
    comment: string;
    tags: string[];
    bookingId?: string;
  }) {
    const review: Review = {
      id: `rev_${Date.now()}`,
      rideId: params.rideId,
      reviewerId: this.user.id,
      reviewerName: this.user.fullName,
      reviewerPhoto: this.user.profilePhoto,
      driverId: params.driverId,
      rating: params.rating,
      comment: params.comment,
      tags: params.tags,
      createdAt: 'Just now'
    };

    // Add review to the matching ride
    const ride = this.rides.find((r) => r.id === params.rideId);
    if (ride) {
      ride.reviews = [review, ...(ride.reviews || [])];
      // Recalculate average rating
      const allRatings = ride.reviews.map((r) => r.rating);
      const avg = allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length;
      ride.driverRating = Number(avg.toFixed(1));
    }

    // Also update driver model if present
    const driver = this.drivers.find((d) => d.id === params.driverId);
    if (driver) {
      driver.rating = Number(((driver.rating * driver.totalTrips + params.rating) / (driver.totalTrips + 1)).toFixed(1));
      driver.totalTrips += 1;
      this.save(STORAGE_KEYS.DRIVERS, this.drivers);
    }

    // Update matching booking if any
    if (params.bookingId) {
      const booking = this.bookings.find((b) => b.id === params.bookingId);
      if (booking) {
        booking.isRated = true;
        booking.rating = params.rating;
        booking.reviewComment = params.comment;
        booking.reviewTags = params.tags;
        this.save(STORAGE_KEYS.BOOKINGS, this.bookings);
      }
    } else {
      // Find latest completed or unrated booking for this driver
      const latestBooking = this.bookings.find(
        (b) => (b.rideId === params.rideId || (driver?.fullName && b.driverName?.toLowerCase().includes(driver.fullName.toLowerCase()))) && !b.isRated
      );
      if (latestBooking) {
        latestBooking.isRated = true;
        latestBooking.hasRated = true;
        latestBooking.rating = params.rating;
        latestBooking.ratingGiven = params.rating;
        latestBooking.reviewComment = params.comment;
        latestBooking.reviewTags = params.tags;
        this.save(STORAGE_KEYS.BOOKINGS, this.bookings);
      }
    }

    this.save(STORAGE_KEYS.RIDES, this.rides);

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
        replyText = `Hello Priya! Vehicle is sanitized and ready for pickup.`;
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
        rideRoute: route || 'Bangalore → Mysore',
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
