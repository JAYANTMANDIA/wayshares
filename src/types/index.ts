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
  routePolyline?: string;
  createdAt: string;
  reviews?: Review[];
}

export type BookingStatus = 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'COMPLETED';
export type PaymentStatus = 'PAID' | 'PENDING' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED';

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
}

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  method: 'card' | 'upi' | 'wallet' | 'netbanking';
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
  | 'create_ride'
  | 'driver_verification'
  | 'notifications'
  | 'support'
  | 'admin_dashboard';
