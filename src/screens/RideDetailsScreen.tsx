import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Clock,
  MapPin,
  Briefcase,
  Star,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  ThumbsUp,
  Award,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen, Ride, Review } from '../types';
import { RateDriverModal } from '../components/RateDriverModal';
import { store } from '../services/store';

interface RideDetailsScreenProps {
  ride: Ride;
  passengersCount: number;
  onNavigate: (screen: AppScreen) => void;
}

export const RideDetailsScreen: React.FC<RideDetailsScreenProps> = ({
  ride,
  passengersCount = 1,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'reviews'>('details');
  const [selectedFilter, setSelectedFilter] = useState<'all' | '5' | '4'>('all');
  const [showRateModal, setShowRateModal] = useState<boolean>(false);

  // Combine default and live reviews from the ride
  const allReviews: Review[] = ride.reviews && ride.reviews.length > 0 ? ride.reviews : [
    {
      id: 'rev_default_01',
      rideId: ride.id,
      reviewerId: 'user_karthik',
      reviewerName: 'Karthik S.',
      driverId: ride.driverId,
      rating: 5,
      comment: 'Excellent driving discipline on the expressway. Reached before estimated time safely.',
      createdAt: '2 days ago',
      tags: ['Smooth & Safe Driving', 'On-Time Departure']
    },
    {
      id: 'rev_default_02',
      rideId: ride.id,
      reviewerId: 'user_deepa',
      reviewerName: 'Deepa V.',
      driverId: ride.driverId,
      rating: 5,
      comment: 'Very polite driver and smooth highway ride. Car was spotless with pleasant air conditioning.',
      createdAt: '5 days ago',
      tags: ['Clean & Sanitized Car', 'Polite & Courteous']
    },
    {
      id: 'rev_default_03',
      rideId: ride.id,
      reviewerId: 'user_rahul',
      reviewerName: 'Rahul M.',
      driverId: ride.driverId,
      rating: 4,
      comment: 'Comfortable commute. Driver maintained steady speeds within speed limits.',
      createdAt: '1 week ago',
      tags: ['Expressway Lane Discipline']
    }
  ];

  const filteredReviews = allReviews.filter((r) => {
    if (selectedFilter === '5') return r.rating === 5;
    if (selectedFilter === '4') return r.rating === 4;
    return true;
  });

  const ratingFiveCount = allReviews.filter((r) => r.rating === 5).length;
  const ratingFourCount = allReviews.filter((r) => r.rating === 4).length;
  const fivePercent = Math.round((ratingFiveCount / Math.max(1, allReviews.length)) * 100);
  const fourPercent = Math.round((ratingFourCount / Math.max(1, allReviews.length)) * 100);

  const handleOpenChatWithDriver = () => {
    store.startOrGetConversationWithDriver(
      ride.driverId,
      ride.driverName,
      ride.driverPhoto,
      `${ride.vehicleMakeModel} (${ride.vehicleRegNumber})`,
      `${ride.fromCity} → ${ride.toCity}`
    );
    onNavigate('chat');
  };

  return (
    <div className="w-full min-h-[720px] bg-neutral-50 flex flex-col justify-between select-none pb-24 relative">
      <div>
        {/* TopBar */}
        <TopBar
          title="Ride Details"
          onBack={() => onNavigate('available_rides')}
          showMore={true}
        />

        {/* Tab switch between Details and Ratings & Reviews */}
        <div className="px-5 pt-1 pb-2">
          <div className="grid grid-cols-2 bg-neutral-200/70 p-1 rounded-xl text-xs font-bold text-neutral-600">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-2 rounded-lg transition-all ${
                activeTab === 'details'
                  ? 'bg-white text-neutral-900 shadow-2xs font-extrabold'
                  : 'hover:text-black'
              }`}
            >
              Ride Overview
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'reviews'
                  ? 'bg-white text-orange-600 shadow-2xs font-extrabold'
                  : 'hover:text-black'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-current text-amber-500" />
              <span>Reliability & Reviews ({allReviews.length})</span>
            </button>
          </div>
        </div>

        <div className="px-5 space-y-4">
          {activeTab === 'details' ? (
            <>
              {/* Illustrated Scenic Route Map */}
              <div className="w-full h-36 rounded-2xl overflow-hidden relative border border-neutral-200/90 shadow-2xs bg-gradient-to-br from-emerald-50 via-teal-50 to-blue-50">
                <svg className="w-full h-full" viewBox="0 0 360 144" fill="none">
                  <path
                    d="M-20 60 C80 30, 160 90, 240 50 C300 20, 360 70, 400 40"
                    stroke="#D1FAE5"
                    strokeWidth="24"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                  <path
                    d="M-10 110 C90 80, 190 130, 270 90 C330 60, 370 110, 420 80"
                    stroke="#E0F2FE"
                    strokeWidth="18"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                  <path
                    d="M 50 100 C 110 90, 150 45, 220 55 C 270 62, 290 35, 310 35"
                    stroke="#000000"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="4 2"
                  />
                  <circle cx="50" cy="100" r="7" fill="#000000" />
                  <circle cx="50" cy="100" r="3" fill="#FFFFFF" />
                  <circle cx="310" cy="35" r="8" fill="#EF4444" />
                  <circle cx="310" cy="35" r="3" fill="#FFFFFF" />
                  <circle cx="120" cy="30" r="8" fill="#10B981" opacity="0.3" />
                  <circle cx="130" cy="34" r="6" fill="#10B981" opacity="0.4" />
                  <circle cx="210" cy="95" r="9" fill="#10B981" opacity="0.3" />
                  <circle cx="222" cy="100" r="7" fill="#10B981" opacity="0.4" />
                </svg>

                <div className="absolute bottom-2.5 left-3.5 bg-black/85 backdrop-blur-xs text-white text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{ride.fromCity}</span>
                </div>

                <div className="absolute top-2.5 right-3.5 bg-black/85 backdrop-blur-xs text-white text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                  <span>{ride.toCity}</span>
                </div>
              </div>

              {/* Driver Card with Reliability Score Pill and Direct Chat Action */}
              <div className="p-4 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="relative">
                      <img
                        src={ride.driverPhoto}
                        alt={ride.driverName}
                        className="w-13 h-13 rounded-full object-cover border-2 border-orange-500/20"
                      />
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] ring-2 ring-white">
                        ✓
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-extrabold text-black tracking-tight leading-tight">
                          {ride.driverName}
                        </h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                          Verified
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-neutral-600 mt-1 font-medium">
                        <div className="flex items-center text-amber-500 font-bold bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/60">
                          <span>{ride.driverRating}</span>
                          <span className="ml-0.5">★</span>
                        </div>
                        <span className="text-neutral-400">•</span>
                        <span className="font-semibold text-neutral-700">{ride.driverTripsCount} verified trips</span>
                        <span className="text-neutral-400">•</span>
                        <span className="text-emerald-600 font-bold">99% On-Time</span>
                      </div>

                      <p className="text-xs text-neutral-500 mt-0.5">
                        {ride.vehicleMakeModel} • {ride.vehicleRegNumber}
                      </p>
                    </div>
                  </div>

                  <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>

                {/* Quick Driver Action Bar: Message Driver & View Reliability */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-100">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={handleOpenChatWithDriver}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-xs border border-orange-200/80 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat with Driver</span>
                  </motion.button>

                  <button
                    onClick={() => setActiveTab('reviews')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs transition-colors"
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    <span>View Reliability</span>
                  </button>
                </div>
              </div>

              {/* 3 Stat Badges Row: Duration, Distance, Luggage */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-white rounded-2xl p-3 border border-neutral-200/80 shadow-2xs text-center">
                  <div className="flex justify-center text-orange-600 mb-1">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-black block leading-tight">
                    {ride.duration || '3h 15m'}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-medium">Duration</span>
                </div>

                <div className="bg-white rounded-2xl p-3 border border-neutral-200/80 shadow-2xs text-center">
                  <div className="flex justify-center text-orange-600 mb-1">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-black block leading-tight">
                    {ride.distance || '145 km'}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-medium">Distance</span>
                </div>

                <div className="bg-white rounded-2xl p-3 border border-neutral-200/80 shadow-2xs text-center">
                  <div className="flex justify-center text-orange-600 mb-1">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-black block leading-tight">
                    {ride.luggageCapacity || '2 bags max'}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-medium">Luggage</span>
                </div>
              </div>

              {/* Route Stops Timeline */}
              <div className="p-4 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs">
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                  Route & Timings
                </h4>

                <div className="space-y-4 relative">
                  <div className="absolute top-2 left-2 bottom-3 w-0.5 bg-neutral-200" />

                  <div className="flex items-start gap-3 relative z-10">
                    <div className="w-4 h-4 rounded-full bg-black ring-4 ring-white shrink-0 mt-0.5" />
                    <div className="flex-1 flex items-start justify-between">
                      <div>
                        <h5 className="text-sm font-bold text-black">
                          {ride.pickupLocation}
                        </h5>
                        <p className="text-xs text-neutral-500">{ride.fromCity}</p>
                      </div>
                      <span className="text-xs font-bold text-black">
                        {ride.departureTime}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 relative z-10">
                    <div className="w-4 h-4 rounded-full bg-[#EF4444] ring-4 ring-white shrink-0 mt-0.5" />
                    <div className="flex-1 flex items-start justify-between">
                      <div>
                        <h5 className="text-sm font-bold text-black">
                          {ride.dropLocation}
                        </h5>
                        <p className="text-xs text-neutral-500">{ride.toCity}</p>
                      </div>
                      <span className="text-xs font-bold text-black">
                        {ride.estimatedArrivalTime || '9:45 AM'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {/* Star-Based Rating & Driver Reliability Scores Display */}
          {(activeTab === 'reviews' || activeTab === 'details') && (
            <div className="p-4.5 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                <div>
                  <h4 className="text-sm font-extrabold text-neutral-900 tracking-tight flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-orange-500" />
                    <span>Driver Reliability Score</span>
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Pre-booking trust & performance metrics
                  </p>
                </div>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowRateModal(true)}
                  className="text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors"
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>Rate Driver</span>
                </motion.button>
              </div>

              {/* Big Reliability Score Breakdown Display */}
              <div className="grid grid-cols-12 gap-3 items-center bg-gradient-to-br from-amber-50/60 to-orange-50/60 p-3.5 rounded-2xl border border-amber-200/60">
                {/* Overall Score Pillar */}
                <div className="col-span-5 text-center border-r border-amber-200/80 pr-2">
                  <div className="flex items-center justify-center gap-1 text-3xl font-black text-neutral-900 leading-none">
                    <span>{ride.driverRating}</span>
                    <Star className="w-6 h-6 fill-amber-400 text-amber-500" />
                  </div>
                  <span className="text-[11px] font-extrabold text-orange-700 block mt-1">
                    Super Host Driver
                  </span>
                  <span className="text-[10px] text-neutral-500 font-medium">
                    {ride.driverTripsCount} highway trips
                  </span>
                </div>

                {/* Score Distribution Bars */}
                <div className="col-span-7 space-y-1.5 pl-1">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="w-8 font-bold text-neutral-600">5 ★</span>
                    <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${fivePercent}%` }}
                      />
                    </div>
                    <span className="w-6 text-right font-medium text-neutral-500">{fivePercent}%</span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="w-8 font-bold text-neutral-600">4 ★</span>
                    <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400/80 rounded-full"
                        style={{ width: `${fourPercent}%` }}
                      />
                    </div>
                    <span className="w-6 text-right font-medium text-neutral-500">{fourPercent}%</span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="w-8 font-bold text-neutral-600">3 ★</span>
                    <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400/30 rounded-full" style={{ width: '0%' }} />
                    </div>
                    <span className="w-6 text-right font-medium text-neutral-500">0%</span>
                  </div>
                </div>
              </div>

              {/* Reliability Sub-Scores Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-150 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                      ⏱
                    </div>
                    <span className="text-neutral-700 font-semibold text-[11px]">Punctuality</span>
                  </div>
                  <span className="font-extrabold text-neutral-900">4.9 ★</span>
                </div>

                <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-150 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                      🛡
                    </div>
                    <span className="text-neutral-700 font-semibold text-[11px]">Driving Safety</span>
                  </div>
                  <span className="font-extrabold text-neutral-900">5.0 ★</span>
                </div>

                <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-150 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px]">
                      ✨
                    </div>
                    <span className="text-neutral-700 font-semibold text-[11px]">Cleanliness & AC</span>
                  </div>
                  <span className="font-extrabold text-neutral-900">4.8 ★</span>
                </div>

                <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-150 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[10px]">
                      🤝
                    </div>
                    <span className="text-neutral-700 font-semibold text-[11px]">Polite Behavior</span>
                  </div>
                  <span className="font-extrabold text-neutral-900">5.0 ★</span>
                </div>
              </div>

              {/* Safety & Compliance Verification Badges */}
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/80 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-tight">
                  <span className="font-bold text-emerald-950 block">
                    UberX Verified Driver Identity
                  </span>
                  <span className="text-emerald-700 mt-0.5 block font-medium">
                    Aadhaar ID, Commercial Driving License, and Fastag are verified with zero cancellation records.
                  </span>
                </div>
              </div>

              {/* Filter Tabs for Reviews */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    Verified Passenger Reviews ({allReviews.length})
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedFilter('all')}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-bold transition-colors ${
                        selectedFilter === 'all'
                          ? 'bg-neutral-900 text-white'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      All ({allReviews.length})
                    </button>
                    <button
                      onClick={() => setSelectedFilter('5')}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-bold transition-colors ${
                        selectedFilter === '5'
                          ? 'bg-amber-500 text-white'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      5 ★ ({ratingFiveCount})
                    </button>
                    <button
                      onClick={() => setSelectedFilter('4')}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-bold transition-colors ${
                        selectedFilter === '4'
                          ? 'bg-amber-500 text-white'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      4 ★ ({ratingFourCount})
                    </button>
                  </div>
                </div>

                {/* Individual Review Cards */}
                <div className="space-y-3">
                  {filteredReviews.map((rv) => (
                    <div
                      key={rv.id}
                      className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center justify-center text-[11px] border border-orange-200">
                            {rv.reviewerName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-neutral-900 block leading-tight">
                              {rv.reviewerName}
                            </span>
                            <span className="text-[10px] text-neutral-400">
                              {rv.createdAt} • Verified Passenger
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center text-amber-500 font-bold bg-white px-2 py-0.5 rounded-md border border-neutral-200 shadow-2xs">
                          <span>{rv.rating}</span>
                          <span className="ml-0.5">★</span>
                        </div>
                      </div>

                      {rv.tags && rv.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {rv.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-semibold text-orange-700 bg-orange-100/70 px-2 py-0.5 rounded-full"
                            >
                              ✓ {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-neutral-700 leading-relaxed font-normal">
                        "{rv.comment}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-neutral-200 px-6 py-3.5 flex items-center justify-between z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div>
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
            TOTAL PRICE ({passengersCount} {passengersCount > 1 ? 'SEATS' : 'SEAT'})
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-black">
              ₹{ride.pricePerSeat * passengersCount}
            </span>
            <span className="text-xs text-neutral-500">/ ₹{ride.pricePerSeat} each</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenChatWithDriver}
            className="w-11 h-11 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-600 flex items-center justify-center border border-orange-200 transition-colors"
            title="Chat with driver"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <button
            onClick={() => onNavigate('select_seat')}
            id="ride-details-continue-button"
            className="bg-black hover:bg-neutral-800 active:scale-[0.98] text-white font-bold py-3 px-6 rounded-xl text-sm transition-all shadow-md flex items-center gap-1.5"
          >
            <span>Get the Ride</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Rate Driver Modal */}
      <RateDriverModal
        isOpen={showRateModal}
        onClose={() => setShowRateModal(false)}
        rideId={ride.id}
        driverId={ride.driverId}
        driverName={ride.driverName}
        driverPhoto={ride.driverPhoto}
        vehicleInfo={`${ride.vehicleMakeModel} (${ride.vehicleRegNumber})`}
        route={`${ride.fromCity} → ${ride.toCity}`}
      />
    </div>
  );
};
