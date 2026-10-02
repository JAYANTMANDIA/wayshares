import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  User,
  ShieldCheck,
  Star,
  Car,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  Shield,
  Smartphone,
  Edit2,
  FileCheck2,
  Upload,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
  Check,
  Plus
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen } from '../types';
import { store } from '../services/store';

interface ProfileScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onNavigate }) => {
  const [user, setUser] = useState(store.user);
  const [activeRole, setActiveRole] = useState(store.activeRole);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.fullName);
  const [editEmail, setEditEmail] = useState(user.email);

  // Verification states
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showRcRequiredModal, setShowRcRequiredModal] = useState(false);
  const [aadhaarInput, setAadhaarInput] = useState(user.aadhaarNumber || '2345 6789 4921');
  const [panInput, setPanInput] = useState(user.panNumber || 'ABCDE1234F');
  const [rcInput, setRcInput] = useState(user.rcNumber || 'KA 05 MN 3291');
  const [hasRc, setHasRc] = useState(Boolean(user.rcNumber && user.rcVerified));
  const [verificationFeedback, setVerificationFeedback] = useState('');

  useEffect(() => {
    const update = () => {
      const u = store.user;
      setUser({ ...u });
      setActiveRole(store.activeRole);
      setAadhaarInput(u.aadhaarNumber || '2345 6789 4921');
      setPanInput(u.panNumber || 'ABCDE1234F');
      setRcInput(u.rcNumber || 'KA 05 MN 3291');
      setHasRc(Boolean(u.rcNumber && u.rcVerified));
    };
    return store.subscribe(update);
  }, []);

  const handleRoleSwitch = (newRole: 'passenger' | 'driver') => {
    if (newRole === 'driver') {
      if (!store.canProvideRide()) {
        setShowRcRequiredModal(true);
        return;
      }
      store.setActiveRole('driver');
      onNavigate('driver_dashboard');
    } else {
      store.setActiveRole('passenger');
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateUserProfile({
      fullName: editName,
      email: editEmail
    });
    setIsEditing(false);
  };

  const handleSaveVerification = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateVerificationDocs({
      aadhaarNumber: aadhaarInput.trim() || '2345 6789 4921',
      aadhaarVerified: true,
      aadhaarDoc: 'aadhaar_card_verified.pdf',
      panNumber: panInput.trim().toUpperCase() || 'ABCDE1234F',
      panVerified: true,
      panDoc: 'pan_card_verified.pdf',
      rcNumber: hasRc ? (rcInput.trim().toUpperCase() || 'KA 05 MN 3291') : null,
      rcVerified: hasRc,
      rcDoc: hasRc ? 'vehicle_rc_smartcard.pdf' : null
    });
    setVerificationFeedback('Verification documents saved & synced.');
    setTimeout(() => {
      setVerificationFeedback('');
      setShowVerificationModal(false);
    }, 1200);
  };

  const handleRemoveRc = () => {
    store.removeRC();
    setHasRc(false);
    setRcInput('');
    setVerificationFeedback('RC removed. You are now in Passenger-only mode.');
    setTimeout(() => setVerificationFeedback(''), 2500);
  };

  const handleAddDefaultRc = () => {
    store.updateVerificationDocs({
      rcNumber: 'KA 05 MN 3291',
      rcVerified: true,
      rcDoc: 'vehicle_rc_smartcard.pdf'
    });
    setHasRc(true);
    setRcInput('KA 05 MN 3291');
    setVerificationFeedback('RC uploaded & verified. You can now provide rides!');
    setTimeout(() => setVerificationFeedback(''), 2500);
  };

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const confirmLogout = () => {
    store.logout();
    setShowLogoutModal(false);
    onNavigate('login');
  };

  const isEligibleToDrive = Boolean(user.rcNumber && user.rcVerified);

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-24 relative">
      <div>
        <TopBar
          title="Account & Profile"
          onBack={() => onNavigate('home')}
          showMore={true}
        />

        <div className="px-5 pt-2 space-y-4">
          {/* Feedback Banner */}
          {verificationFeedback && (
            <div className="p-3 bg-neutral-900 text-white text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-lg animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{verificationFeedback}</span>
            </div>
          )}

          {/* User Card */}
          <div className="p-4 rounded-3xl border border-neutral-200/90 bg-white shadow-2xs">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={user.profilePhoto}
                  alt={user.fullName}
                  className="w-16 h-16 rounded-full object-cover border-2 border-neutral-100 shadow-md"
                />
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-black tracking-tight">
                    {user.fullName}
                  </h3>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="p-1.5 text-neutral-400 hover:text-black rounded-lg hover:bg-neutral-100"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-neutral-500">{user.phoneNumber}</p>

                {/* Dynamic Status badge based on verification & RC */}
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border">
                  {isEligibleToDrive ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border-emerald-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>RC Verified • Can Provide & Take Rides</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 border-blue-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>ID Verified • Can Only Take Rides</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Editing form */}
            {isEditing && (
              <form onSubmit={handleSaveProfile} className="mt-4 pt-3 border-t border-neutral-150 space-y-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs border rounded-xl px-3 py-2 outline-hidden"
                  placeholder="Full Name"
                />
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full text-xs border rounded-xl px-3 py-2 outline-hidden"
                  placeholder="Email"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-xs text-neutral-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs bg-black text-white rounded-lg font-bold"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-neutral-100 text-center">
              <div>
                <span className="text-base font-black text-black block">{user.totalTrips}</span>
                <span className="text-[10px] text-neutral-500 font-semibold uppercase">Total Trips</span>
              </div>
              <div>
                <span className="text-base font-black text-[#EF4444] block">4.9 ★</span>
                <span className="text-[10px] text-neutral-500 font-semibold uppercase">Passenger Rating</span>
              </div>
              <div>
                <span className="text-base font-black text-emerald-600 block">₹4,200</span>
                <span className="text-[10px] text-neutral-500 font-semibold uppercase">Highway Saved</span>
              </div>
            </div>
          </div>

          {/* VERIFICATION SECTION: Aadhaar, PAN, and RC (Optional) */}
          <div className="p-4 rounded-3xl border border-neutral-200/90 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-black flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#EF4444]" />
                  <span>Document Verification</span>
                </h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Aadhaar & PAN are mandatory. RC is optional.
                </p>
              </div>

              <button
                onClick={() => setShowVerificationModal(true)}
                className="text-[11px] font-bold text-[#EF4444] hover:underline"
              >
                Manage
              </button>
            </div>

            {/* Policy Rule Box */}
            <div
              className={`p-3 rounded-2xl border text-xs leading-relaxed ${
                isEligibleToDrive
                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/60 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-start gap-2">
                {isEligibleToDrive ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-bold block">
                    {isEligibleToDrive
                      ? 'Eligible to Provide & Take Rides'
                      : 'Passenger Only (Can Take Rides)'}
                  </span>
                  <p className="text-[11px] mt-0.5 opacity-90">
                    {isEligibleToDrive
                      ? 'Vehicle RC is verified. You can publish rides, accept bookings, or take rides as a passenger.'
                      : 'Vehicle RC is not uploaded. You can take rides as a passenger. Upload your RC (optional) to provide rides.'}
                  </p>
                </div>
              </div>
            </div>

            {/* List of 3 Documents */}
            <div className="space-y-2 pt-1">
              {/* 1. Aadhaar Card */}
              <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/70 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-neutral-900">Aadhaar Card</span>
                      <span className="text-[9px] bg-neutral-200 text-neutral-700 font-bold px-1.5 py-0.2 rounded-sm">
                        Mandatory
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-500 font-mono">
                      {user.aadhaarNumber || 'XXXX-XXXX-4921'}
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3 stroke-[3]" />
                  Verified
                </span>
              </div>

              {/* 2. PAN Card */}
              <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/70 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-neutral-900">PAN Card</span>
                      <span className="text-[9px] bg-neutral-200 text-neutral-700 font-bold px-1.5 py-0.2 rounded-sm">
                        Mandatory
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-500 font-mono">
                      {user.panNumber || 'ABCDE1234F'}
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3 stroke-[3]" />
                  Verified
                </span>
              </div>

              {/* 3. Vehicle RC (Optional) */}
              <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/70 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isEligibleToDrive
                        ? 'bg-[#EF4444]/10 text-[#EF4444]'
                        : 'bg-neutral-200 text-neutral-500'
                    }`}
                  >
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-neutral-900">Vehicle RC</span>
                      <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-sm">
                        Optional
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-500 font-mono">
                      {isEligibleToDrive
                        ? `${user.rcNumber} • Verified`
                        : 'Not uploaded • Passenger only'}
                    </p>
                  </div>
                </div>

                {isEligibleToDrive ? (
                  <button
                    onClick={handleRemoveRc}
                    className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg border border-rose-200 transition-colors"
                    title="Remove RC to test Passenger-only mode"
                  >
                    Remove RC
                  </button>
                ) : (
                  <button
                    onClick={handleAddDefaultRc}
                    className="text-[10px] font-bold text-black hover:bg-neutral-200 bg-white px-2.5 py-1 rounded-lg border border-neutral-300 shadow-2xs transition-colors flex items-center gap-1"
                    title="Upload RC to enable providing rides"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    Upload RC
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Dual Role Switch Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-neutral-900 to-black text-white shadow-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                <Car className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold leading-tight">Driver Mode</h4>
                <p className="text-[11px] text-neutral-300">
                  {isEligibleToDrive
                    ? 'Publish rides & earn on empty seats'
                    : 'Requires Vehicle RC to provide rides'}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleRoleSwitch(activeRole === 'driver' ? 'passenger' : 'driver')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeRole === 'driver'
                  ? 'bg-[#EF4444] text-white'
                  : isEligibleToDrive
                  ? 'bg-white text-black hover:bg-neutral-100'
                  : 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:border-neutral-500'
              }`}
            >
              {activeRole === 'driver'
                ? 'Active ✓'
                : isEligibleToDrive
                ? 'Switch Mode'
                : 'RC Needed'}
            </button>
          </div>

          {/* Menu Items */}
          <div className="space-y-1 rounded-2xl border border-neutral-200/90 bg-white overflow-hidden divide-y divide-neutral-100 shadow-2xs">
            <button
              onClick={() => setShowVerificationModal(true)}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-neutral-50"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-neutral-600" />
                <span className="text-xs font-bold text-neutral-800">Verification & Document Center</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </button>

            <button
              onClick={() => onNavigate('trusted_contacts')}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-neutral-50"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-neutral-600" />
                <span className="text-xs font-bold text-neutral-800">Trusted Safety Contacts</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </button>

            <button
              onClick={() => onNavigate('notifications')}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-neutral-50"
            >
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-neutral-600" />
                <span className="text-xs font-bold text-neutral-800">Notifications & Alerts</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </button>

            <button
              onClick={() => onNavigate('support')}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-neutral-50"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4 text-neutral-600" />
                <span className="text-xs font-bold text-neutral-800">Help & 24/7 Support</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </button>

            <button
              onClick={() => onNavigate('admin_dashboard')}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-neutral-50 text-amber-700"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-bold">Admin Management Console</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </button>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => setShowLogoutModal(true)}
            id="profile-signout-button"
            className="w-full mt-2 mb-4 p-3.5 rounded-2xl border border-rose-200 bg-rose-50/50 text-rose-600 hover:bg-rose-100/70 active:scale-[0.98] flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-2xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* MODAL 1: Full Document Verification Center */}
      {showVerificationModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-5 w-full max-w-[350px] shadow-2xl border border-neutral-150 space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-black">
                  Identity & Vehicle Verification
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Manage Aadhaar, PAN, and RC documents
                </p>
              </div>
              <button
                onClick={() => setShowVerificationModal(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVerification} className="space-y-3.5">
              {/* 1. Aadhaar Card Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-neutral-700">
                    Aadhaar Card Number <span className="text-[#EF4444]">*</span>
                  </label>
                  <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-sm">
                    Verified ✓
                  </span>
                </div>
                <input
                  type="text"
                  value={aadhaarInput}
                  onChange={(e) => setAadhaarInput(e.target.value)}
                  placeholder="2345 6789 4921"
                  className="w-full text-xs font-mono border border-neutral-300 rounded-xl px-3 py-2 outline-hidden focus:border-black"
                  required
                />
                <p className="text-[10px] text-neutral-400">
                  Uploaded doc: aadhaar_card_verified.pdf
                </p>
              </div>

              {/* 2. PAN Card Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-neutral-700">
                    PAN Card Number <span className="text-[#EF4444]">*</span>
                  </label>
                  <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-sm">
                    Verified ✓
                  </span>
                </div>
                <input
                  type="text"
                  value={panInput}
                  onChange={(e) => setPanInput(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="w-full text-xs font-mono uppercase border border-neutral-300 rounded-xl px-3 py-2 outline-hidden focus:border-black"
                  required
                />
                <p className="text-[10px] text-neutral-400">
                  Uploaded doc: pan_card_verified.pdf
                </p>
              </div>

              {/* 3. Vehicle RC Section (Optional) */}
              <div className="pt-2 border-t border-neutral-150 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-black block">
                      Vehicle RC (Registration Certificate)
                    </span>
                    <span className="text-[10px] text-neutral-500 font-medium">
                      Optional: Required ONLY to provide rides
                    </span>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasRc}
                      onChange={(e) => setHasRc(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#EF4444]"></div>
                  </label>
                </div>

                {hasRc ? (
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
                    <label className="text-[11px] font-bold text-neutral-700 block">
                      Vehicle Registration Number
                    </label>
                    <input
                      type="text"
                      value={rcInput}
                      onChange={(e) => setRcInput(e.target.value.toUpperCase())}
                      placeholder="KA 05 MN 3291"
                      className="w-full text-xs font-mono uppercase border border-neutral-300 rounded-xl px-3 py-2 outline-hidden focus:border-black bg-white"
                    />
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>RC Attached: vehicle_rc_smartcard.pdf</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-[11px] text-neutral-600 leading-tight">
                    <span className="font-semibold text-neutral-800 block mb-0.5">
                      No RC uploaded (Passenger Mode)
                    </span>
                    You can take rides with your verified Aadhaar & PAN. You will not be able to offer rides or switch to Driver Mode.
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowVerificationModal(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-neutral-700 border border-neutral-300 rounded-xl hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-bold bg-black text-white rounded-xl hover:bg-neutral-800 shadow-xs"
                >
                  Save & Apply
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: RC Required Alert Modal */}
      {showRcRequiredModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-5 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-5 w-full max-w-[320px] shadow-2xl border border-neutral-150 text-center space-y-3"
          >
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Car className="w-6 h-6 text-[#EF4444]" />
            </div>

            <h3 className="text-sm font-extrabold text-black">
              Vehicle RC Required to Provide Rides
            </h3>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Your <strong>Aadhaar</strong> and <strong>PAN</strong> cards are verified, which allows you to <strong>take rides as a passenger</strong>.
            </p>
            <p className="text-xs text-neutral-600 leading-relaxed">
              However, <strong>Vehicle RC is required to provide rides</strong> or activate Driver Mode. Without RC, you can only take rides.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  setShowRcRequiredModal(false);
                  setHasRc(true);
                  if (!rcInput) setRcInput('KA 05 MN 3291');
                  setShowVerificationModal(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-[#EF4444] text-white text-xs font-bold hover:bg-rose-600 active:scale-95 shadow-xs"
              >
                Upload Vehicle RC Now
              </button>
              <button
                onClick={() => setShowRcRequiredModal(false)}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-neutral-500 hover:text-black"
              >
                Continue as Passenger (Take Rides Only)
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* In-App Sign Out Confirmation Modal */}
      {showLogoutModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-5 w-full max-w-[320px] shadow-2xl border border-neutral-100 text-center space-y-3"
          >
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-black">Sign Out of UberX?</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              You will be redirected to the login screen. You can log back in with your phone number or email.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                id="confirm-logout-button"
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 active:scale-95 shadow-xs"
              >
                Sign Out
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
