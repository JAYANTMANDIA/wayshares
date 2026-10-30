/**
 * UberX Mobility Data Models and Types
 */

export type UserRole = 'passenger' | 'driver' | 'dual' | 'admin';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface User {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  profilePhoto: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  age?: number;
  city: string;
  collegeOrOrganization?: string;
  verificationStatus: VerificationStatus;
  userRole: UserRole;
  rating: number;
  totalTrips: number;
  createdAt: string;
  updatedAt: string;

  // Identity & Vehicle Verification (Aadhaar, PAN mandatory, RC optional)
  aadhaarNumber?: string;
  aadhaarVerified?: boolean;
  aadhaarDoc?: string;
  panNumber?: string;
  panVerified?: boolean;
  panDoc?: string;
  rcNumber?: string; // Optional: Registration Certificate of Vehicle
  rcVerified?: boolean;
  rcDoc?: string;
  canProvideRide?: boolean; // Computed: True if RC is uploaded & verified. Otherwise rider can only take rides!
  /** Number of rides cancelled by this driver (for trust score) */
  cancelledRides?: number;
  /** Trust score 0-100 computed from completed vs cancelled rides */
  trustScore?: number;
  riderVerificationStatus?: VerificationStatus;
  driverVerificationStatus?: VerificationStatus;
  verificationDocuments?: Partial<Record<VerificationDocumentType, VerificationDocumentRecord>>;
}

export type VerificationDocumentType = 'aadhaarSelfie' | 'pan' | 'rcSelfie';

export interface VerificationDocumentRecord {
  status: VerificationStatus;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface AdminVerificationUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  profilePhoto: string;
  verificationStatus: VerificationStatus;
  riderVerificationStatus: VerificationStatus;
  driverVerificationStatus: VerificationStatus;
  verificationDocuments: Partial<Record<VerificationDocumentType, VerificationDocumentRecord>>;
  documentAvailability: Partial<Record<VerificationDocumentType, boolean>>;
  createdAt: string;
  completedRides: number;
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalRides: number;
  totalBookings: number;
  activeRides: number;
  completedRides: number;
  completedBookings: number;
  pendingRiderVerifications: number;
  pendingDriverVerifications: number;
  verifiedRiders: number;
  verifiedDrivers: number;
}

export interface AdminRide {
  id: string;
  driverId: string;
  driverName: string;
  driverEmail: string;
  fromCity: string;
  toCity: string;
  departureDate: string;
  departureTime: string;
  status: string;
  availableSeats: number;
  totalSeats: number;
  pricePerSeat: number;
  createdAt: string;
}

export interface Driver {
  id: string;
  userId: string;
  fullName?: string;
  phoneNumber?: string;
  photoUrl?: string;
  drivingLicense: string;
  licensePhotoUrl?: string;
  verificationStatus: VerificationStatus;
  rating: number;
  totalTrips: number;
  joinedDate?: string;
}

export interface Vehicle {
  id: string;
  driverId: string;
  vehicleType: string;
  make: string;
  model: string;
  registrationNumber: string;
  color: string;
  seatingCapacity: number;
  luggageCapacity: string;
  verificationStatus: VerificationStatus;
  documents?: {
    rcNumber?: string;
    insuranceValidTill?: string;
  };
}

export type RideStatus = 'UPCOMING' | 'DRIVER_ON_WAY' | 'ARRIVING' | 'STARTED' | 'COMPLETED' | 'CANCELLED';

export interface Ride {
  id: string;
  driverId: string;
  driverName: string;
  driverPhoto: string;
  driverRating: number;
  driverTripsCount: number;
  vehicleMakeModel: string;
  vehicleRegNumber: string;
  vehicleColor?: string;
  fromCity: string;
  toCity: string;
  /** Latitude of the driver's origin (stored on ride creation) */
  fromLat?: number | null;
  /** Longitude of the driver's origin */
  fromLon?: number | null;
  /** Latitude of the driver's destination */
  toLat?: number | null;
  /** Longitude of the driver's destination */
  toLon?: number | null;
  pickupLocation: string;
  dropLocation: string;
  departureDate: string;
  departureTime: string;
  estimatedArrivalTime: string;
  duration: string;
  distance: string;
  availableSeats: number;
  totalSeats: number;
  occupiedSeats: number[]; // e.g. [2]
  pricePerSeat: number;
  luggageCapacity: string;
  vehicleId: string;
  status: RideStatus;
  /** Google Encoded Polyline of the actual road route (stored on ride creation) */
  routePolyline?: string;
  /** Driver's ride preference tags e.g. ['no_smoking','ac','pets_allowed'] */
  ridePreferences?: string[];
  createdAt: string;
  reviews?: Review[];
  driverVerificationStatus?: VerificationStatus;
  driverVerified?: boolean;
  driverUpiQrDataUrl?: string;
  /** Driver's trust score snapshot at ride creation time (0-100) */
  driverTrustScore?: number;
  passengerBookings?: Booking[];
  /** Populated only in route-match search results — not stored in Firestore */
  segmentMatch?: RouteSegmentMatch;
  /** 0–100 smart match score computed at search time */
  matchScore?: number;
}

/**
 * Describes how a passenger's journey fits within a driver's route.
 * Attached to a Ride when returned from GET /api/rides/route-match.
 */
export interface RouteSegmentMatch {
  /** true if the passenger's pickup and drop-off lie along the driver's route */
  compatible: boolean;
  /** Human-readable reason when not compatible */
  reason?: string;
  /** 0–1 fraction along the route where the passenger boards */
  pickupFraction: number;
  /** 0–1 fraction along the route where the passenger alights */
  dropFraction: number;
  /** Distance in km of the passenger's segment */
  segmentDistanceKm: number;
  /** Straight-line snap distance from passenger pickup to nearest route point (km) */
  pickupSnapKm: number;
  /** Straight-line snap distance from passenger drop-off to nearest route point (km) */
  dropSnapKm: number;
  /** Estimated extra km the driver must travel to serve this passenger */
  detourKm: number;
  /** Fare for the passenger's segment only */
  segmentFare: number;
  /** ISO timestamp estimate of when the driver arrives at the passenger's pickup */
  estimatedPickupTime?: string;
  /** Whether this is an exact endpoint match or an intermediate segment match */
  matchType: 'exact' | 'intermediate' | 'partial-origin' | 'partial-destination';
}

export interface RouteMatchResult {
  ride: Ride;
  segmentMatch: RouteSegmentMatch;
}

export type BookingStatus = 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'COMPLETED';
export type PaymentStatus = 'PAID' | 'PENDING' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED' | 'CASH_PENDING' | 'UPI_PENDING';

export interface Booking {
  id: string;
  rideId: string;
  passengerId: string;
  passengerName: string;
  passengerPhone: string;
  seatsBooked: number;
  selectedSeats: number[];
  amount: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: 'upi' | 'cash';
  bookingStatus: BookingStatus;
  bookingReference: string;
  pickupLocation: string;
  dropLocation: string;
  fromCity: string;
  toCity: string;
  departureDate: string;
  departureTime: string;
  driverName: string;
  driverPhone?: string;
  driverId?: string;
  vehicleInfo: string;
  createdAt: string;
  isRated?: boolean;
  hasRated?: boolean;
  rating?: number;
  ratingGiven?: number;
  reviewComment?: string;
  reviewTags?: string[];
  /** Coordinates of the passenger's actual boarding point (may differ from driver's origin) */
  passengerFromLat?: number | null;
  passengerFromLon?: number | null;
  /** Coordinates of the passenger's actual alighting point */
  passengerToLat?: number | null;
  passengerToLon?: number | null;
  /** Segment fare the passenger was charged (may be less than pricePerSeat × seats) */
  segmentFare?: number;
  /** Whether this was an intermediate stop booking */
  isIntermediateBooking?: boolean;
}

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  method: 'upi' | 'cash';
  transactionId: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  createdAt: string;
}

export interface Review {
  id: string;
  rideId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerPhoto?: string;
  driverId: string;
  rating: number;
  comment: string;
  createdAt: string;
  tags?: string[];
  route?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'driver';
  text: string;
  time: string;
  timestamp: number;
}

export interface ChatConversation {
  id: string;
  bookingId?: string;
  peerId?: string;
  peerName?: string;
  peerPhoto?: string;
  driverId: string;
  driverName: string;
  driverPhoto: string;
  driverRating: number;
  vehicleMakeModel: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
  messages: ChatMessage[];
  rideRoute?: string;
}

export interface TrackingState {
  id: string;
  rideId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  progressPercent: number; // 0 to 100
  currentStatus: RideStatus;
  etaMinutes: number;
  updatedAt: string;
}

export interface LiveRideLocation {
  latitude: number;
  longitude: number;
  updatedAt: string;
}

export interface SafetyContact {
  id: string;
  userId: string;
  contactName: string;
  phoneNumber: string;
  relationship: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'booking' | 'driver' | 'payment' | 'safety' | 'system';
  read: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  category: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: string;
}

export type AppScreen =
  | 'splash'
  | 'login'
  | 'home'
  | 'city_ride'
  | 'luggage_transfer'
  | 'schedule_ride'
  | 'plan_trip'
  | 'available_rides'
  | 'ride_details'
  | 'select_seat'
  | 'payment'
  | 'booking_confirmation'
  | 'ride_tracking'
  | 'safety'
  | 'trusted_contacts'
  | 'my_trips'
  | 'trip_details'
  | 'chat'
  | 'profile'
  | 'driver_dashboard'
  | 'driver_bookings'
  | 'create_ride'
  | 'driver_verification'
  | 'notifications'
  | 'support'
  | 'admin_dashboard';
