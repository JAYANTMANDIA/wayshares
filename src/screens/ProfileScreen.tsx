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
import { AppScreen, type VerificationDocumentType } from '../types';
import { store } from '../services/store';
import { canAccessAdminPortal } from '../lib/adminAccess';

interface ProfileScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onNavigate }) => {
  const [user, setUser] = useState(store.user);
  const [activeRole, setActiveRole] = useState(store.activeRole);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.fullName);
  const [editEmail, setEditEmail] = useState(user.email);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  // Verification states
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showRcRequiredModal, setShowRcRequiredModal] = useState(false);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [rcFile, setRcFile] = useState<File | null>(null);
  const [isSubmittingDocuments, setIsSubmittingDocuments] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [verificationError, setVerificationError] = useState('');
  const [verificationFeedback, setVerificationFeedback] = useState('');

  useEffect(() => {
    const update = () => {
      const u = store.user;
      setUser({ ...u });
      setActiveRole(store.activeRole);
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

  const handlePhotoUpload = async (file?: File) => {
    if (!file) return;
    setPhotoError('');
    setPhotoUploading(true);
    try {
      await store.uploadProfilePhoto(file);
      setUser({ ...store.user });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Unable to upload photo');
    } finally {
      setPhotoUploading(false);
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

  const handleSaveVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingDocuments(true);
    setUploadProgress(0);
    setVerificationError('');
    try {
      await store.submitVerificationDocuments({
        ...(aadhaarFile ? { aadhaarSelfie: aadhaarFile } : {}),
        ...(panFile ? { pan: panFile } : {}),
        ...(rcFile ? { rcSelfie: rcFile } : {})
      }, (progress) => setUploadProgress(progress));
      setVerificationFeedback('Images submitted securely. They are now in the admin review queue.');
      setAadhaarFile(null);
      setPanFile(null);
      setRcFile(null);
      window.setTimeout(() => {
      setVerificationFeedback('');
      setShowVerificationModal(false);
      }, 1500);
    } catch (error) {
      setVerificationError(error instanceof Error ? error.message : 'Unable to submit documents');
    } finally {
      setIsSubmittingDocuments(false);
    }
  };

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const confirmLogout = () => {
    store.logout();
    setShowLogoutModal(false);
    onNavigate('login');
  };

  const isEligibleToDrive = store.canProvideRide();
  const riderStatus = user.riderVerificationStatus || 'unverified';
  const driverStatus = user.driverVerificationStatus || 'unverified';
  const documentStatus = (type: VerificationDocumentType) => user.verificationDocuments?.[type]?.status || 'unverified';

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
                  src={user.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'U')}&background=f97316&color=fff&size=128`}
                  alt={user.fullName}
                  className="w-16 h-16 rounded-full object-cover border-2 border-neutral-100 shadow-md"
                />
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
                {/* Photo upload button */}
                <label
                  htmlFor="profile-photo-input"
                  className="absolute -top-1 -right-1 w-5 h-5 bg-black text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-neutral-700 border-2 border-white"
                  title="Change photo"
                >
                  {photoUploading ? (
                    <span className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Edit2 className="w-2.5 h-2.5" />
                  )}
                </label>
                <input
                  id="profile-photo-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => void handlePhotoUpload(e.target.files?.[0])}
                />
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

            {photoError && <p className="text-[11px] text-rose-600 mt-1">{photoError}</p>}

            {/* Quick Stats + Trust Score */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-neutral-100 text-center">
              <div>
                <span className="text-base font-black text-black block">{user.totalTrips || 0}</span>
                <span className="text-[10px] text-neutral-500 font-semibold uppercase">Rides Done</span>
              </div>
              <div>
                <span className="text-base font-black text-neutral-500 block">{user.cancelledRides || 0}</span>
                <span className="text-[10px] text-neutral-500 font-semibold uppercase">Cancelled</span>
              </div>
              <div>
                <span className={`text-base font-black block ${
                  (user.trustScore ?? 50) >= 80 ? 'text-emerald-600'
                  : (user.trustScore ?? 50) >= 55 ? 'text-amber-600'
                  : 'text-rose-500'
                }`}>{user.trustScore ?? 50}</span>
                <span className="text-[10px] text-neutral-500 font-semibold uppercase">Trust Score</span>
              </div>
            </div>

            {/* Trust Score bar */}
            {store.activeRole === 'driver' && (
              <div className="mt-3 pt-3 border-t border-neutral-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase text-neutral-500 flex items-center gap-1">
                    🛡️ Driver Trust Score
                  </span>
                  <span className={`text-xs font-extrabold ${
                    (user.trustScore ?? 50) >= 80 ? 'text-emerald-600'
                    : (user.trustScore ?? 50) >= 55 ? 'text-amber-600'
                    : 'text-rose-500'
                  }`}>{user.trustScore ?? 50}/100 · {
                    (user.trustScore ?? 50) >= 80 ? 'Highly Trusted'
                    : (user.trustScore ?? 50) >= 55 ? 'Trustworthy'
                    : 'Building Trust'
                  }</span>
                </div>
                <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (user.trustScore ?? 50) >= 80 ? 'bg-emerald-500'
                      : (user.trustScore ?? 50) >= 55 ? 'bg-amber-500'
                      : 'bg-rose-400'
                    }`}
                    style={{ width: `${user.trustScore ?? 50}%` }}
                  />
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">
                  Increases with completed rides, decreases with cancellations.
                </p>
              </div>
            )}
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
                  Admin-reviewed documents control passenger and driver access.
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
                    {isEligibleToDrive ? 'Driver verified' : `Rider verification: ${riderStatus}`}
                  </span>
                  <p className="text-[11px] mt-0.5 opacity-90">
                    {isEligibleToDrive
                      ? 'You can book rides and publish rides.'
                      : riderStatus === 'verified'
                        ? 'You can book rides. Upload your RC with your face visible and wait for driver approval to publish.'
                        : 'Booking is locked until an admin approves your Aadhaar photo and PAN image.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              {([
                ['aadhaarSelfie', 'Aadhaar held with your face visible'],
                ['pan', 'PAN card image'],
                ['rcSelfie', 'Vehicle RC held with your face visible']
              ] as const).map(([type, label]) => (
                <div key={type} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <span className="font-semibold text-neutral-800">{label}</span>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold capitalize text-neutral-700">
                    {documentStatus(type)}
                  </span>
                </div>
              ))}
              <p className="text-[10px] leading-relaxed text-neutral-500">
                Rider approval is required to book. Driver mode and ride publishing also require an approved RC photo.
              </p>
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
                    ? 'Approved to publish rides'
                    : driverStatus === 'pending'
                      ? 'Driver documents awaiting admin review'
                      : 'Requires approved rider identity and RC photo'}
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
                : driverStatus === 'pending' ? 'In Review' : 'Approval Needed'}
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

            {canAccessAdminPortal(store.user.email) && (
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
            )}
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

      {/* Verification document submission */}
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
                  Upload private images for manual admin review
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
              <label className="block space-y-1 text-[11px] font-bold text-neutral-700">
                Aadhaar card held beside your visible face <span className="text-rose-600">Required</span>
                <input required type="file" disabled={isSubmittingDocuments} accept="image/jpeg,image/png,image/webp" onChange={(e) => setAadhaarFile(e.target.files?.[0] || null)} className="block w-full text-[10px] font-normal" />
                <span className="block text-[10px] font-normal text-neutral-500">Current status: {documentStatus('aadhaarSelfie')}</span>
              </label>
              <label className="block space-y-1 text-[11px] font-bold text-neutral-700">
                PAN card image <span className="text-rose-600">Required</span>
                <input required type="file" disabled={isSubmittingDocuments} accept="image/jpeg,image/png,image/webp" onChange={(e) => setPanFile(e.target.files?.[0] || null)} className="block w-full text-[10px] font-normal" />
                <span className="block text-[10px] font-normal text-neutral-500">Current status: {documentStatus('pan')}</span>
              </label>
              <label className="block space-y-1 border-t border-neutral-200 pt-3 text-[11px] font-bold text-neutral-700">
                Vehicle RC held beside your visible face <span className="font-normal text-neutral-500">Needed to drive</span>
                <input type="file" disabled={isSubmittingDocuments} accept="image/jpeg,image/png,image/webp" onChange={(e) => setRcFile(e.target.files?.[0] || null)} className="block w-full text-[10px] font-normal" />
                <span className="block text-[10px] font-normal text-neutral-500">Current status: {documentStatus('rcSelfie')}</span>
              </label>
              <p className="text-[10px] leading-relaxed text-neutral-500">Images are stored in the administrator's private Google Drive and shown only in the protected admin portal. Accepted: JPEG, PNG, WebP, up to 5 MB each.</p>
              {isSubmittingDocuments && (
                <div className="space-y-1.5" role="status" aria-live="polite">
                  <div className="flex justify-between text-[10px] text-neutral-600">
                    <span>Uploading documents…</span><span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  {uploadProgress >= 95 && <p className="text-[10px] text-neutral-500">Saving images to the administrator's private Google Drive…</p>}
                </div>
              )}
              {verificationError && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-[11px] text-rose-700">{verificationError}</p>}

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  disabled={isSubmittingDocuments}
                  onClick={() => setShowVerificationModal(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-neutral-700 border border-neutral-300 rounded-xl hover:bg-neutral-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDocuments}
                  className="flex-1 py-2.5 text-xs font-bold bg-black text-white rounded-xl hover:bg-neutral-800 shadow-xs"
                >
                  {isSubmittingDocuments ? 'Uploading…' : 'Submit for admin review'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Driver eligibility explanation */}
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
              Admin Approval Required
            </h3>

            <p className="text-xs text-neutral-600 leading-relaxed">
              To book rides, an admin must approve your Aadhaar photo and PAN image.
            </p>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Driver mode additionally requires admin approval of your vehicle RC photo with your face visible.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  setShowRcRequiredModal(false);
                  setShowVerificationModal(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-[#EF4444] text-white text-xs font-bold hover:bg-rose-600 active:scale-95 shadow-xs"
              >
                Submit Verification Documents
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
