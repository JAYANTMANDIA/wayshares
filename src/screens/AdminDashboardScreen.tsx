import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CarFront, CheckCircle2, ClipboardCheck, Eye, RefreshCw, ShieldCheck, UsersRound, XCircle } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AdminDashboardStats, AdminRide, AppScreen, AdminVerificationUser, VerificationDocumentType } from '../types';
import { store } from '../services/store';

interface AdminDashboardScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

const documentLabels: Record<VerificationDocumentType, string> = {
  aadhaarSelfie: 'Aadhaar held with face',
  pan: 'PAN card',
  rcSelfie: 'Vehicle RC held with face'
};

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ onNavigate }) => {
  const [driveStatus, setDriveStatus] = useState<{ configured?: boolean; connected?: boolean; email?: string; setupHelp?: string }>();
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'rides' | 'verification'>('overview');
  const [stats, setStats] = useState<AdminDashboardStats>();
  const [rides, setRides] = useState<AdminRide[]>([]);
  const [ridesCursor, setRidesCursor] = useState<string>();
  const [hasMoreRides, setHasMoreRides] = useState(false);
  const [users, setUsers] = useState<AdminVerificationUser[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRides, setIsLoadingRides] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);

  const loadUsers = useCallback(async (nextCursor?: string, append = false) => {
    setIsLoading(true);
    setError('');
    try {
      const result = await store.fetchAdminVerificationUsers(nextCursor);
      setUsers((current) => append ? [...current, ...result.users] : result.users);
      setCursor(result.nextCursor);
      setHasMore(Boolean(result.nextCursor));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load verification queue');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    setError('');
    try {
      setStats(await store.fetchAdminOverview());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin dashboard');
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  const loadDriveStatus = useCallback(async () => {
    try {
      setDriveStatus(await store.fetchAdminDriveStatus());
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to check Google Drive connection');
    }
  }, []);

  const loadRides = useCallback(async (nextCursor?: string, append = false) => {
    setIsLoadingRides(true);
    setError('');
    try {
      const result = await store.fetchAdminRides(nextCursor);
      setRides((current) => append ? [...current, ...result.rides] : result.rides);
      setRidesCursor(result.nextCursor);
      setHasMoreRides(Boolean(result.nextCursor));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load rides');
    } finally {
      setIsLoadingRides(false);
    }
  }, []);

  useEffect(() => {
    void loadDriveStatus();
  }, [loadDriveStatus]);

  useEffect(() => {
    if (activeTab === 'overview') void loadStats();
    if (activeTab === 'users' || activeTab === 'verification') void loadUsers();
    if (activeTab === 'rides') void loadRides();
  }, [activeTab, loadRides, loadStats, loadUsers]);

  useEffect(() => () => {
    if (preview?.url.startsWith('blob:')) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    setError('');
    try {
      await store.connectAdminGoogleDrive();
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Unable to connect Google Drive');
      setIsConnectingDrive(false);
    }
  };

  const handleReview = async (user: AdminVerificationUser, kind: 'rider' | 'driver', status: 'verified' | 'rejected') => {
    const reason = status === 'rejected' ? window.prompt('Enter the reason so the user can correct the documents:')?.trim() : undefined;
    if (status === 'rejected' && !reason) return;
    const key = `${user.id}:${kind}`;
    setBusyKey(key);
    setError('');
    try {
      await store.reviewUserVerification(user.id, kind, status, reason);
      await loadUsers();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to review documents');
    } finally {
      setBusyKey('');
    }
  };

  const handleViewDocument = async (user: AdminVerificationUser, type: VerificationDocumentType) => {
    setBusyKey(`${user.id}:${type}`);
    setError('');
    try {
      const url = await store.fetchAdminDocumentUrl(user.id, type);
      setPreview({ url, label: `${user.fullName || user.email} — ${documentLabels[type]}` });
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : 'Unable to open document');
    } finally {
      setBusyKey('');
    }
  };

  const visibleUsers = activeTab === 'verification'
    ? users.filter((user) =>
      ['pending', 'rejected'].includes(user.riderVerificationStatus) ||
      ['pending', 'rejected'].includes(user.driverVerificationStatus)
    )
    : users;

  return (
    <div className="flex min-h-[720px] w-full flex-col bg-neutral-50 pb-20">
      <TopBar title="WAYSHARE Admin Portal" onBack={() => onNavigate('home')} showMore={false} />
      <main className="space-y-4 px-4 py-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
          <ShieldCheck className="mr-1 inline h-4 w-4" />
          Private administration for users, rides, and manual identity review.
        </div>
        <section className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold text-neutral-900">Private Google Drive storage</h2>
              <p className="mt-1 text-[10px] text-neutral-600">
                {driveStatus?.connected
                  ? `Connected to ${driveStatus.email}. Documents are visible only through this protected portal.`
                  : driveStatus?.configured
                    ? 'Connect the administrator Google account before users upload identity images.'
                    : 'Server Google OAuth setup is required before uploads can be enabled.'}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${driveStatus?.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
              {driveStatus?.connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          {driveStatus?.setupHelp && !driveStatus.configured && (
            <p className="rounded-lg bg-neutral-50 p-2 text-[10px] leading-relaxed text-neutral-600">{driveStatus.setupHelp}</p>
          )}
          <div className="flex gap-2">
            {!driveStatus?.connected && (
              <button type="button" disabled={isConnectingDrive || !driveStatus?.configured} onClick={() => void handleConnectDrive()} className="flex-1 rounded-lg bg-neutral-900 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40">
                {isConnectingDrive ? 'Opening Google…' : 'Connect admin Google Drive'}
              </button>
            )}
            <button type="button" onClick={() => void loadDriveStatus()} className="rounded-lg border border-neutral-300 px-3 py-2 text-[10px] font-bold text-neutral-700">Refresh</button>
          </div>
        </section>
        <nav className="grid grid-cols-4 gap-1 rounded-xl bg-neutral-200/70 p-1" aria-label="Admin portal sections">
          {([
            ['overview', 'Overview', Activity],
            ['users', 'Users', UsersRound],
            ['rides', 'Rides', CarFront],
            ['verification', 'Verify', ClipboardCheck]
          ] as const).map(([tab, label, Icon]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-bold ${activeTab === tab ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-600'}`}
            >
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </nav>
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
        {activeTab === 'overview' && (
          isLoadingStats && !stats ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-500"><RefreshCw className="h-4 w-4 animate-spin" />Loading dashboard…</div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Total users', stats.totalUsers, UsersRound, 'bg-sky-50 text-sky-800'],
                  ['Published rides', stats.totalRides, CarFront, 'bg-violet-50 text-violet-800'],
                  ['Total bookings', stats.totalBookings, Activity, 'bg-emerald-50 text-emerald-800'],
                  ['Active rides', stats.activeRides, CarFront, 'bg-amber-50 text-amber-800'],
                  ['Verified riders', stats.verifiedRiders, ShieldCheck, 'bg-teal-50 text-teal-800'],
                  ['Verified drivers', stats.verifiedDrivers, ShieldCheck, 'bg-indigo-50 text-indigo-800'],
                  ['Rider reviews pending', stats.pendingRiderVerifications, ClipboardCheck, 'bg-orange-50 text-orange-800'],
                  ['Driver reviews pending', stats.pendingDriverVerifications, ClipboardCheck, 'bg-rose-50 text-rose-800']
                ].map(([label, value, Icon, color]) => (
                  <article key={String(label)} className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                    <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${String(color)}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-xl font-extrabold text-neutral-900">{Number(value).toLocaleString()}</p>
                    <p className="mt-0.5 text-[10px] font-medium text-neutral-500">{String(label)}</p>
                  </article>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                  <p className="text-[10px] text-neutral-500">Completed rides</p>
                  <p className="mt-1 text-lg font-bold">{stats.completedRides}</p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                  <p className="text-[10px] text-neutral-500">Completed bookings</p>
                  <p className="mt-1 text-lg font-bold">{stats.completedBookings}</p>
                </div>
              </div>
              <button type="button" onClick={() => void loadStats()} disabled={isLoadingStats} className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white p-3 text-xs font-bold disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${isLoadingStats ? 'animate-spin' : ''}`} />Refresh dashboard totals
              </button>
            </>
          ) : <p className="rounded-xl bg-white p-5 text-center text-sm text-neutral-500">Dashboard totals are unavailable.</p>
        )}
        {activeTab === 'rides' && (
          isLoadingRides && rides.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-500"><RefreshCw className="h-4 w-4 animate-spin" />Loading rides…</div>
          ) : rides.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">No published rides.</div>
          ) : (
            <>
              {rides.map((ride) => (
                <article key={ride.id} className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-neutral-900">{ride.fromCity} → {ride.toCity}</h2>
                      <p className="mt-1 text-[11px] text-neutral-600">{ride.driverName || 'Unknown driver'} · {ride.driverEmail || ride.driverId}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-[9px] font-bold">{ride.status.replaceAll('_', ' ')}</span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 border-t border-neutral-100 pt-2 text-[10px] text-neutral-600">
                    <span>{ride.departureDate} · {ride.departureTime}</span>
                    <span>{ride.availableSeats}/{ride.totalSeats} seats</span>
                    <span>₹{ride.pricePerSeat.toLocaleString('en-IN')} / seat</span>
                  </div>
                  <p className="break-all text-[9px] text-neutral-400">Ride ID: {ride.id}</p>
                </article>
              ))}
              {hasMoreRides && (
                <button type="button" disabled={isLoadingRides} onClick={() => void loadRides(ridesCursor, true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white p-3 text-xs font-bold disabled:opacity-50">
                  {isLoadingRides ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}Load more rides
                </button>
              )}
            </>
          )
        )}
        {(activeTab === 'users' || activeTab === 'verification') && (
          <>
            {isLoading && users.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-500"><RefreshCw className="h-4 w-4 animate-spin" />Loading users…</div>
            )}
            {!isLoading && visibleUsers.length === 0 && (
              <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
                {activeTab === 'verification' ? 'No pending identity reviews.' : 'No users found.'}
              </div>
            )}
            {visibleUsers.map((user) => {
          const riderReady = Boolean(user.documentAvailability.aadhaarSelfie && user.documentAvailability.pan);
          const driverReady = riderReady && Boolean(user.documentAvailability.rcSelfie);
          const isRiderPending = user.riderVerificationStatus === 'pending' || user.riderVerificationStatus === 'rejected';
          const isDriverPending = user.driverVerificationStatus === 'pending' || user.driverVerificationStatus === 'rejected';
          return (
            <article key={user.id} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <header className="flex items-start gap-3">
                {user.profilePhoto
                  ? <img src={user.profilePhoto} alt="" className="h-11 w-11 rounded-full object-cover" />
                  : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 font-bold">{user.fullName?.charAt(0) || '?'}</div>}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-bold text-neutral-900">{user.fullName || 'Unnamed account'}</h2>
                  <p className="break-all text-[11px] text-neutral-600">{user.email}</p>
                  <p className="text-[11px] text-neutral-600">{user.phoneNumber || 'No contact number'}</p>
                  <p className="mt-1 text-[10px] text-neutral-500">Account ID: <span className="font-mono">{user.id}</span> · {user.completedRides} completed rides</p>
                </div>
              </header>

              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(documentLabels) as VerificationDocumentType[]).map((type) => (
                  <div key={type} className="flex items-center justify-between rounded-xl bg-neutral-50 p-2.5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-neutral-800">{documentLabels[type]}</p>
                      <p className="text-[10px] capitalize text-neutral-500">
                        {user.documentAvailability[type] ? user.verificationDocuments[type]?.status || 'submitted' : 'not submitted'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!user.documentAvailability[type] || busyKey === `${user.id}:${type}`}
                      onClick={() => void handleViewDocument(user, type)}
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[10px] font-bold disabled:opacity-40"
                    >
                      <Eye className="h-3.5 w-3.5" />View
                    </button>
                  </div>
                ))}
              </div>

              {isRiderPending && (
                <section className="space-y-2 border-t border-neutral-100 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <strong>Rider access</strong><span className="capitalize text-neutral-500">{user.riderVerificationStatus}</span>
                  </div>
                  {!riderReady && <p className="text-[10px] text-amber-700">Waiting for both Aadhaar-with-face and PAN images.</p>}
                  <div className="flex gap-2">
                    <button type="button" disabled={!riderReady || busyKey === `${user.id}:rider`} onClick={() => void handleReview(user, 'rider', 'verified')} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />Approve rider</button>
                    <button type="button" disabled={!riderReady || busyKey === `${user.id}:rider`} onClick={() => void handleReview(user, 'rider', 'rejected')} className="flex items-center justify-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-[11px] font-bold text-rose-700 disabled:opacity-40"><XCircle className="h-4 w-4" />Reject</button>
                  </div>
                </section>
              )}

              {isDriverPending && user.riderVerificationStatus === 'verified' && (
                <section className="space-y-2 border-t border-neutral-100 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <strong>Driver access</strong><span className="capitalize text-neutral-500">{user.driverVerificationStatus}</span>
                  </div>
                  {!driverReady && <p className="text-[10px] text-amber-700">Waiting for the RC-with-face image.</p>}
                  <div className="flex gap-2">
                    <button type="button" disabled={!driverReady || busyKey === `${user.id}:driver`} onClick={() => void handleReview(user, 'driver', 'verified')} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />Approve driver</button>
                    <button type="button" disabled={!driverReady || busyKey === `${user.id}:driver`} onClick={() => void handleReview(user, 'driver', 'rejected')} className="flex items-center justify-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-[11px] font-bold text-rose-700 disabled:opacity-40"><XCircle className="h-4 w-4" />Reject</button>
                  </div>
                </section>
              )}
              {user.riderVerificationStatus === 'verified' && user.driverVerificationStatus === 'verified' && (
                <p className="border-t border-neutral-100 pt-3 text-xs font-semibold text-emerald-700"><CheckCircle2 className="mr-1 inline h-4 w-4" />Rider and driver approved</p>
              )}
            </article>
          );
            })}
            {hasMore && (
          <button type="button" disabled={isLoading} onClick={() => void loadUsers(cursor, true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white p-3 text-xs font-bold disabled:opacity-50">
            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}Load more accounts
          </button>
            )}
            {activeTab === 'verification' && <div className="flex items-center gap-2 text-[10px] text-neutral-500"><AlertTriangle className="h-3.5 w-3.5" />Only approve when the submitted images match the account holder and are legible.</div>}
          </>
        )}
      </main>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={preview.label}>
          <div className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-bold">{preview.label}</h2>
              <button type="button" onClick={() => setPreview(null)} className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-bold">Close</button>
            </div>
            <img src={preview.url} alt={preview.label} className="max-h-[75vh] w-full rounded-lg object-contain" />
            <p className="text-[10px] text-neutral-500">Temporary private link; expires in five minutes.</p>
          </div>
        </div>
      )}
    </div>
  );
};
