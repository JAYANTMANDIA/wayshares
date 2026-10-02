import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Phone,
  MessageCircle,
  Share2,
  Shield,
  Navigation,
  CheckCircle2,
  Clock,
  MapPin,
  X,
  Play,
  Pause,
  RotateCcw,
  Flag,
  Car,
  Star
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen } from '../types';
import { store } from '../services/store';
import { RateDriverModal } from '../components/RateDriverModal';

interface RideTrackingScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const RideTrackingScreen: React.FC<RideTrackingScreenProps> = ({ onNavigate }) => {
  const [tracking, setTracking] = useState(store.activeTracking);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'driver', text: 'Hello Priya, I am on the highway route. Arriving on schedule.', time: 'Just now' }
  ]);
  const [inputMessage, setInputMessage] = useState('');

  // Active trip details from store
  const activeBooking = store.bookings[0] || null;
  const activeRide = store.rides.find((r) => r.id === tracking?.rideId) || store.rides[0] || null;

  const fromCity = activeBooking?.fromCity || activeRide?.fromCity || 'Bangalore';
  const toCity = activeBooking?.toCity || activeRide?.toCity || 'Mysore';
  const pickupLocation = activeBooking?.pickupLocation || activeRide?.pickupLocation || 'Silk Board Junction';
  const dropLocation = activeBooking?.dropLocation || activeRide?.dropLocation || 'Mysore Suburb Stand';
  const totalKm = 145;

  // Interactive journey progress state (0 to 100)
  const [journeyProgress, setJourneyProgress] = useState<number>(() => tracking?.progressPercent ?? 42);
  const [isSimulating, setIsSimulating] = useState(true);

  useEffect(() => {
    const update = () => setTracking(store.activeTracking ? { ...store.activeTracking } : null);
    return store.subscribe(update);
  }, []);

  // Smooth simulation loop that moves the car along the SVG highway path
  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(() => {
      setJourneyProgress((prev) => {
        if (prev >= 100) return 0; // loop simulation
        return Number((prev + 0.6).toFixed(1));
      });
    }, 200);
    return () => clearInterval(interval);
  }, [isSimulating]);

  // Cubic Bezier interpolation along highway path:
  // p0=(55, 215), p1=(130, 225), p2=(215, 85), p3=(345, 75)
  const getPointOnRoute = (t: number) => {
    const clampedT = Math.max(0, Math.min(1, t));
    const p0 = { x: 55, y: 215 };
    const p1 = { x: 130, y: 225 };
    const p2 = { x: 215, y: 85 };
    const p3 = { x: 345, y: 75 };

    const cx = 3 * (p1.x - p0.x);
    const bx = 3 * (p2.x - p1.x) - cx;
    const ax = p3.x - p0.x - cx - bx;

    const cy = 3 * (p1.y - p0.y);
    const by = 3 * (p2.y - p1.y) - cy;
    const ay = p3.y - p0.y - cy - by;

    const x = ax * Math.pow(clampedT, 3) + bx * Math.pow(clampedT, 2) + cx * clampedT + p0.x;
    const y = ay * Math.pow(clampedT, 3) + by * Math.pow(clampedT, 2) + cy * clampedT + p0.y;

    // Tangent for vehicle rotation angle
    const dx = 3 * ax * Math.pow(clampedT, 2) + 2 * bx * clampedT + cx;
    const dy = 3 * ay * Math.pow(clampedT, 2) + 2 * by * clampedT + cy;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    return { x, y, angle };
  };

  const currentCarPos = getPointOnRoute(journeyProgress / 100);
  const distanceCovered = Math.round((journeyProgress / 100) * totalKm);
  const remainingKm = Math.max(0, totalKm - distanceCovered);
  const estimatedRemainingMins = Math.max(1, Math.round(((100 - journeyProgress) / 100) * 115));

  const handleShareTrip = () => {
    const tripUrl = `https://uberx.app/track/UBX-98231`;
    navigator.clipboard?.writeText(tripUrl);
    setCopiedLink(true);
    store.addNotification({
      title: 'Trip Link Shared',
      message: 'Live tracking link copied to clipboard. Share with your family or friends.',
      type: 'safety'
    });
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    const newMsg = { sender: 'user', text: inputMessage, time: 'Just now' };
    setChatMessages((prev) => [...prev, newMsg]);
    setInputMessage('');

    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'driver', text: 'Got it, maintaining steady 70 km/h on the highway.', time: 'Just now' }
      ]);
    }, 1500);
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-8 relative">
      <div>
        {/* TopBar */}
        <TopBar
          title="Ride Tracking"
          onBack={() => onNavigate('home')}
          showMore={true}
        />

        {/* Simplified Map Visualization Area */}
        <div className="w-full bg-neutral-100 relative overflow-hidden border-y border-neutral-200">
          {/* Top Corridor Banner showing Origin -> Destination */}
          <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 border-b border-neutral-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-neutral-900">
              <span className="text-emerald-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                {fromCity}
              </span>
              <span className="text-neutral-400">→</span>
              <span className="text-orange-600 flex items-center gap-1">
                <Flag className="w-3 h-3 text-orange-600" />
                {toCity}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-extrabold text-[11px] border border-orange-200">
                {journeyProgress.toFixed(0)}%
              </span>
              <span className="text-neutral-500 text-[11px] font-medium">
                {estimatedRemainingMins}m left
              </span>
            </div>
          </div>

          {/* SVG Map Canvas */}
          <div className="relative w-full h-[270px]">
            <svg
              className="w-full h-full"
              viewBox="0 0 400 290"
              fill="none"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Geographic background & terrain tiles */}
              <rect width="400" height="290" fill="#F8FAFC" />

              {/* Faint geographical grid lines */}
              <path d="M 0 70 L 400 70" stroke="#F1F5F9" strokeWidth="1" />
              <path d="M 0 145 L 400 145" stroke="#F1F5F9" strokeWidth="1" />
              <path d="M 0 220 L 400 220" stroke="#F1F5F9" strokeWidth="1" />
              <path d="M 100 0 L 100 290" stroke="#F1F5F9" strokeWidth="1" />
              <path d="M 200 0 L 200 290" stroke="#F1F5F9" strokeWidth="1" />
              <path d="M 300 0 L 300 290" stroke="#F1F5F9" strokeWidth="1" />

              {/* Natural reserves & green belt patches */}
              <rect x="70" y="30" width="80" height="45" rx="12" fill="#DCFCE7" opacity="0.6" />
              <rect x="230" y="180" width="90" height="50" rx="14" fill="#DCFCE7" opacity="0.5" />
              <rect x="15" y="120" width="60" height="40" rx="10" fill="#F1F5F9" />

              {/* Cauvery River Waterway Curve */}
              <path
                d="M 30 260 C 120 250, 180 180, 270 230 C 320 250, 360 210, 400 220"
                stroke="#E0F2FE"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M 30 260 C 120 250, 180 180, 270 230 C 320 250, 360 210, 400 220"
                stroke="#BAE6FD"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
              />

              {/* Secondary Highway Crossings (Gray Lines) */}
              <path d="M 10 180 L 160 280" stroke="#E2E8F0" strokeWidth="4" strokeLinecap="round" />
              <path d="M 240 10 L 390 120" stroke="#E2E8F0" strokeWidth="4" strokeLinecap="round" />

              {/* Main Expressway Outer Base (Roadbed Border) */}
              <path
                d="M 55 215 C 130 225, 215 85, 345 75"
                stroke="#CBD5E1"
                strokeWidth="14"
                strokeLinecap="round"
                fill="none"
              />

              {/* Main Expressway Asphalt Roadbed */}
              <path
                d="M 55 215 C 130 225, 215 85, 345 75"
                stroke="#334155"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />

              {/* Yellow Road Center Divider Line */}
              <path
                d="M 55 215 C 130 225, 215 85, 345 75"
                stroke="#FDE047"
                strokeWidth="1.5"
                strokeDasharray="5 5"
                strokeLinecap="round"
                fill="none"
              />

              {/* ACTIVE JOURNEY PROGRESS PATH (Dynamic SVG Stroke Dashoffset) */}
              <path
                d="M 55 215 C 130 225, 215 85, 345 75"
                stroke="#EA580C"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
                pathLength={100}
                strokeDasharray="100"
                strokeDashoffset={100 - journeyProgress}
              />

              {/* Milestone: Intermediate Expressway Toll / Waypoint at t ≈ 0.5 (185, 148) */}
              <g transform="translate(185, 148)">
                <circle r="4" fill="#64748B" />
                <rect x="-38" y="8" width="76" height="15" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.8" />
                <text x="0" y="19" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#475569">
                  Ramanagara Toll
                </text>
              </g>

              {/* STARTING CITY PIN (Origin: Bangalore) */}
              <g transform="translate(55, 215)">
                {/* Pulsing Emerald Radar Aura */}
                <circle r="14" fill="#10B981" opacity="0.25" className="animate-ping" />
                <circle r="8" fill="#10B981" stroke="#FFFFFF" strokeWidth="2.5" />
                <circle r="3" fill="#FFFFFF" />

                {/* City Label Badge */}
                <g transform="translate(0, 18)">
                  <rect x="-35" y="0" width="70" height="20" rx="5" fill="#FFFFFF" stroke="#10B981" strokeWidth="1.2" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.08))" />
                  <text x="0" y="10" textAnchor="middle" fontSize="8" fontWeight="800" fill="#0F172A">
                    {fromCity}
                  </text>
                  <text x="0" y="17" textAnchor="middle" fontSize="6.5" fontWeight="600" fill="#10B981">
                    START
                  </text>
                </g>
              </g>

              {/* DESTINATION CITY PIN (Mysore) */}
              <g transform="translate(345, 75)">
                {/* Pulsing Orange Radar Aura */}
                <circle r="15" fill="#EA580C" opacity="0.25" className="animate-pulse" />
                <circle r="8" fill="#EA580C" stroke="#FFFFFF" strokeWidth="2.5" />
                <circle r="3" fill="#FFFFFF" />

                {/* Destination Label Badge */}
                <g transform="translate(0, -28)">
                  <rect x="-35" y="0" width="70" height="20" rx="5" fill="#FFFFFF" stroke="#EA580C" strokeWidth="1.2" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.08))" />
                  <text x="0" y="10" textAnchor="middle" fontSize="8" fontWeight="800" fill="#0F172A">
                    {toCity}
                  </text>
                  <text x="0" y="17" textAnchor="middle" fontSize="6.5" fontWeight="600" fill="#EA580C">
                    DESTINATION
                  </text>
                </g>
              </g>

              {/* DYNAMIC VEHICLE / CAR MARKER (Moving along SVG path) */}
              <g transform={`translate(${currentCarPos.x}, ${currentCarPos.y})`}>
                {/* Vehicle shadow and halo */}
                <circle r="15" fill="#EA580C" opacity="0.2" />

                {/* Direction-oriented vehicle icon */}
                <g transform={`rotate(${currentCarPos.angle})`}>
                  <rect x="-8" y="-5" width="16" height="10" rx="3" fill="#1E293B" stroke="#FFFFFF" strokeWidth="1.5" />
                  {/* Windshields */}
                  <rect x="-4" y="-3.5" width="4" height="7" rx="1" fill="#93C5FD" />
                  {/* Headlights beam forward */}
                  <circle cx="8" cy="-3" r="1.5" fill="#FEF08A" />
                  <circle cx="8" cy="3" r="1.5" fill="#FEF08A" />
                  {/* Roof light */}
                  <circle cx="1" cy="0" r="1.5" fill="#F97316" />
                </g>

                {/* Floating Driver Info Tag Above Car */}
                <g transform="translate(0, -18)">
                  <rect
                    x="-34"
                    y="-12"
                    width="68"
                    height="14"
                    rx="4"
                    fill="#0F172A"
                    fillOpacity="0.9"
                  />
                  <text
                    x="0"
                    y="-2.5"
                    textAnchor="middle"
                    fontSize="7"
                    fontWeight="bold"
                    fill="#FFFFFF"
                  >
                    Rajak • {Math.round(62 + Math.sin(journeyProgress) * 6)} km/h
                  </text>
                </g>
              </g>
            </svg>

            {/* Recenter Button */}
            <button
              onClick={() => setJourneyProgress(45)}
              className="absolute bottom-3 right-3 bg-white hover:bg-neutral-50 active:scale-95 p-2 rounded-full shadow-md border border-neutral-200 text-neutral-800 transition-all"
              title="Recenter Map"
            >
              <Navigation className="w-3.5 h-3.5 fill-black" />
            </button>
          </div>

          {/* Interactive Simulation & Progress Scrubber Bar */}
          <div className="bg-white px-4 py-2.5 border-t border-neutral-200 flex items-center gap-3">
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className="p-1.5 rounded-lg bg-neutral-100 hover:bg-orange-50 hover:text-orange-600 text-neutral-700 active:scale-95 transition-colors border border-neutral-200"
              title={isSimulating ? 'Pause Journey Simulation' : 'Play Journey Simulation'}
            >
              {isSimulating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <button
              onClick={() => setJourneyProgress(0)}
              className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 active:scale-95 transition-colors border border-neutral-200"
              title="Restart Journey"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Scrubber slider */}
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[10px] font-bold text-neutral-500">{fromCity}</span>
              <input
                type="range"
                min="0"
                max="100"
                value={journeyProgress}
                onChange={(e) => {
                  setIsSimulating(false);
                  setJourneyProgress(Number(e.target.value));
                }}
                className="flex-1 h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <span className="text-[10px] font-bold text-orange-600">{toCity}</span>
            </div>

            <span className="text-[11px] font-extrabold text-neutral-800 w-12 text-right">
              {distanceCovered} <span className="font-normal text-[9px] text-neutral-500">/ {totalKm} km</span>
            </span>
          </div>
        </div>

        {/* Driver Detail Card */}
        <div className="px-5 pt-3">
          <div className="p-4 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250"
                  alt="Rajak Kumar"
                  className="w-12 h-12 rounded-full object-cover border border-neutral-200 shadow-2xs"
                />
                <div>
                  <h3 className="text-base font-bold text-black tracking-tight leading-tight">
                    Rajak Kumar
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-neutral-600 mt-0.5 font-medium">
                    <span className="text-orange-500 font-bold">4.8</span>
                    <span className="text-orange-500">★</span>
                    <span className="text-neutral-400">•</span>
                    <span>1,203 Trips</span>
                  </div>
                  <p className="text-xs font-bold text-neutral-900 mt-0.5">
                    DL 1ZB 3384 • White Swift Dzire
                  </p>
                </div>
              </div>
            </div>

            {/* 4 Action Buttons: Call, Message, Share, Safety */}
            <div className="grid grid-cols-4 gap-3 mt-4 pt-3 border-t border-neutral-150 text-center">
              {/* Call */}
              <button
                type="button"
                onClick={() => setShowCallModal(true)}
                className="flex flex-col items-center gap-1 text-neutral-700 hover:text-black group active:scale-95 transition-transform"
              >
                <div className="w-11 h-11 rounded-full bg-neutral-100 group-hover:bg-neutral-200 transition-colors flex items-center justify-center text-neutral-800">
                  <Phone className="w-5 h-5 stroke-[2]" />
                </div>
                <span className="text-[11px] font-semibold">Call</span>
              </button>

              {/* Message */}
              <button
                type="button"
                onClick={() => {
                  store.startOrGetConversationWithDriver(
                    activeRide?.driverId || 'driver_rajesh_01',
                    activeRide?.driverName || 'Rajesh Kumar',
                    activeRide?.driverPhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
                    activeRide ? `${activeRide.vehicleMakeModel} (${activeRide.vehicleRegNumber})` : 'Maruti Swift Dzire',
                    `${fromCity} → ${toCity}`
                  );
                  onNavigate('chat');
                }}
                className="flex flex-col items-center gap-1 text-neutral-700 hover:text-black group active:scale-95 transition-transform"
              >
                <div className="w-11 h-11 rounded-full bg-neutral-100 group-hover:bg-neutral-200 transition-colors flex items-center justify-center text-neutral-800">
                  <MessageCircle className="w-5 h-5 stroke-[2]" />
                </div>
                <span className="text-[11px] font-semibold">Message</span>
              </button>

              {/* Share */}
              <button
                type="button"
                onClick={handleShareTrip}
                className="flex flex-col items-center gap-1 text-neutral-700 hover:text-black group active:scale-95 transition-transform"
              >
                <div className="w-11 h-11 rounded-full bg-neutral-100 group-hover:bg-neutral-200 transition-colors flex items-center justify-center text-neutral-800">
                  <Share2 className="w-5 h-5 stroke-[2]" />
                </div>
                <span className="text-[11px] font-semibold">
                  {copiedLink ? 'Copied!' : 'Share'}
                </span>
              </button>

              {/* Safety */}
              <button
                type="button"
                onClick={() => onNavigate('safety')}
                className="flex flex-col items-center gap-1 text-orange-600 group active:scale-95 transition-transform"
              >
                <div className="w-11 h-11 rounded-full bg-orange-50 border border-orange-100 group-hover:bg-orange-100 transition-colors flex items-center justify-center text-orange-600">
                  <Shield className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span className="text-[11px] font-bold">Safety</span>
              </button>
            </div>
          </div>

          {/* Post-Ride / During-Ride Rate Driver Experience Banner */}
          <div className="mt-3.5 p-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/70 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 block">
                {journeyProgress >= 90 ? 'Trip Almost Complete!' : 'Post-Ride Review'}
              </span>
              <h4 className="text-xs font-extrabold text-neutral-900 mt-0.5">
                Rate {activeRide?.driverName || 'Rajesh Kumar'}
              </h4>
              <p className="text-[11px] text-neutral-500">Share stars & compliment badges</p>
            </div>

            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setShowRateModal(true)}
              className="py-2 px-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>Rate Driver</span>
            </motion.button>
          </div>

          {/* Live Trip Status Timeline */}
          <div className="mt-3.5 p-4 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
              Journey Milestones
            </h4>

            <div className="space-y-3.5 text-xs font-semibold">
              <div className={`flex items-center gap-3 ${journeyProgress >= 10 ? 'text-black' : 'text-neutral-400'}`}>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Pickup: {pickupLocation}, {fromCity}</span>
              </div>
              <div className={`flex items-center gap-3 ${journeyProgress >= 20 && journeyProgress < 95 ? 'text-orange-600 font-bold' : 'text-neutral-700'}`}>
                <Clock className="w-4 h-4 text-orange-500 shrink-0" />
                <span>En Route: Bangalore-Mysore Expressway ({distanceCovered} / {totalKm} km)</span>
              </div>
              <div className={`flex items-center gap-3 ${journeyProgress >= 95 ? 'text-black font-bold' : 'text-neutral-400 font-normal'}`}>
                <MapPin className={`w-4 h-4 shrink-0 ${journeyProgress >= 95 ? 'text-orange-600' : 'text-neutral-300'}`} />
                <span>Dropoff: {dropLocation}, {toCity}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Simulated Call Modal */}
      {showCallModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Phone className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-lg font-bold text-black">Calling Driver...</h3>
            <p className="text-xs text-neutral-500 mt-1">Rajak Kumar (+91 98450 11992)</p>
            <p className="text-[11px] text-neutral-400 mt-3">Number masking active for passenger privacy.</p>
            <button
              onClick={() => setShowCallModal(false)}
              className="mt-5 w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 rounded-xl text-sm"
            >
              End Call
            </button>
          </div>
        </div>
      )}

      {/* Simulated In-App Chat Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm h-[480px] flex flex-col justify-between p-4 shadow-2xl">
            {/* Chat header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250"
                  alt="Rajak Kumar"
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div>
                  <h4 className="text-xs font-bold text-black">Rajak Kumar</h4>
                  <span className="text-[10px] text-emerald-600 font-semibold">Online</span>
                </div>
              </div>
              <button onClick={() => setShowMessageModal(false)} className="p-1">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2 text-xs">
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-2xl ${
                      m.sender === 'user'
                        ? 'bg-black text-white rounded-br-none'
                        : 'bg-neutral-100 text-neutral-900 rounded-bl-none'
                    }`}
                  >
                    <p>{m.text}</p>
                    <span className="text-[9px] opacity-60 block mt-1 text-right">{m.time}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="flex gap-2 border-t pt-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type a message to driver..."
                className="flex-1 text-xs border rounded-xl px-3 py-2 outline-hidden"
              />
              <button
                type="submit"
                className="bg-black text-white text-xs px-3 py-2 rounded-xl font-bold"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Post-Ride Rate Driver Modal */}
      {showRateModal && (
        <RateDriverModal
          isOpen={showRateModal}
          onClose={() => setShowRateModal(false)}
          rideId={activeRide?.id || 'ride_blr_mys_01'}
          driverId={activeRide?.driverId || 'driver_rajesh_01'}
          driverName={activeRide?.driverName || 'Rajesh Kumar'}
          driverPhoto={activeRide?.driverPhoto || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250'}
          vehicleInfo={activeRide ? `${activeRide.vehicleMakeModel} (${activeRide.vehicleRegNumber})` : 'Maruti Swift Dzire'}
          route={`${fromCity} → ${toCity}`}
          bookingId={activeBooking?.id}
        />
      )}
    </div>
  );
};
