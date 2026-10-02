import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  X,
  MapPin,
  Share2,
  Copy,
  CheckCircle,
  Navigation,
  AlertCircle,
  Loader2,
  ExternalLink,
  Users,
  StopCircle,
  Signal
} from 'lucide-react';
import { store } from '../services/store';
import { auth } from '../lib/firebase';

interface ShareLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Phase = 'idle' | 'gps' | 'starting' | 'sharing' | 'error';

interface SessionInfo {
  sessionToken: string;
  locationUrl: string;
  contactsCount: number;
  warning?: string;
}

export const ShareLocationModal: React.FC<ShareLocationModalProps> = ({ isOpen, onClose }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const [contacts, setContacts] = useState(store.safetyContacts);

  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<SessionInfo | null>(null);

  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => {
    const unsub = store.subscribe(() => setContacts([...store.safetyContacts]));
    return unsub;
  }, []);

  useEffect(() => {
    return () => { stopUpdates(); };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      setCoords(null);
      setErrorMsg('');
      setCopied(false);
      setUpdateCount(0);
    }
  }, [isOpen]);

  const getAuthHeader = async (): Promise<Record<string, string>> => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('You must be signed in to share your location.');
    const token = await firebaseUser.getIdToken();
    return { Authorization: `Bearer ${token}` };
  };

  const stopUpdates = () => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  };

  const startLocationUpdates = (token: string) => {
    stopUpdates();
    updateIntervalRef.current = setInterval(async () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setCoords({ lat: latitude, lng: longitude, accuracy: Math.round(pos.coords.accuracy) });
          try {
            const headers = await getAuthHeader();
            await fetch(`/api/location-sharing/${token}/update`, {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ latitude, longitude })
            });
            setUpdateCount((n) => n + 1);
          } catch { /* silent */ }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }, 10_000);
  };

  const handleStart = () => {
    setPhase('gps');
    setErrorMsg('');
    if (!navigator.geolocation) {
      setPhase('error');
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy) });
        setPhase('starting');
        try {
          const headers = await getAuthHeader();
          const res = await fetch('/api/location-sharing/start', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude, longitude })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to start sharing');
          const info: SessionInfo = {
            sessionToken: data.sessionToken,
            locationUrl: data.locationUrl,
            contactsCount: data.contactsCount || 0,
            warning: data.warning
          };
          setSession(info);
          setPhase('sharing');
          store.addNotification({
            title: 'Live Location Sharing Started',
            message: info.warning || 'Your live link is ready. Open WhatsApp for each trusted contact and tap Send.',
            type: 'safety'
          });
          startLocationUpdates(data.sessionToken);
        } catch (err) {
          setPhase('error');
          setErrorMsg(err instanceof Error ? err.message : 'Failed to start location sharing.');
        }
      },
      (geoError) => {
        setPhase('error');
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            setErrorMsg('Location permission denied. Please allow location access in your browser settings and try again.'); break;
          case geoError.POSITION_UNAVAILABLE:
            setErrorMsg('Location information is unavailable. Please check your GPS / network connection.'); break;
          case geoError.TIMEOUT:
            setErrorMsg('Location request timed out. Please try again.'); break;
          default:
            setErrorMsg('An unknown error occurred while fetching your location.');
        }
      },
      { timeout: 15000, enableHighAccuracy: true }
    );
  };

  const handleStop = async () => {
    if (!session) return;
    setStopping(true);
    stopUpdates();
    try {
      const headers = await getAuthHeader();
      await fetch(`/api/location-sharing/${session.sessionToken}/stop`, { method: 'POST', headers });
      store.addNotification({ title: 'Live Location Stopped', message: 'Your trusted contacts can no longer track your location.', type: 'safety' });
    } catch { /* clear locally anyway */ } finally {
      setStopping(false);
      setSession(null);
      setPhase('idle');
      setCoords(null);
      setUpdateCount(0);
    }
  };

  const handleCopyLink = async () => {
    if (!session) return;
    try { await navigator.clipboard.writeText(session.locationUrl); } catch {
      const el = document.createElement('textarea');
      el.value = session.locationUrl;
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const getWhatsAppLink = (contact: SafetyContact) => {
    if (!session) return '#';
    const phone = contact.phoneNumber.replace(/\D/g, '');
    const message = `I'm sharing my live location with you: ${session.locationUrl}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center select-none">
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="w-full max-w-sm bg-white rounded-t-3xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${phase === 'sharing' ? 'bg-emerald-500' : 'bg-neutral-800'}`}>
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-black leading-tight">Share Live Location</h3>
              <p className="text-[11px] text-neutral-500">
                {phase === 'sharing' ? 'Live tracking active · updates every 10s' : 'GPS tracking to trusted contacts via WhatsApp'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-black transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {phase === 'idle' && (
            <div className="text-center py-4 space-y-3">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                <MapPin className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-black">Ready to share your location?</p>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  This will start live GPS tracking and prepare a WhatsApp message for your {contacts.length} trusted contact{contacts.length !== 1 ? 's' : ''}. You review and send each message.
                </p>
              </div>
              {contacts.length === 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs text-amber-700 font-medium">No trusted contacts saved. Add contacts in Profile → Trusted Contacts first.</p>
                </div>
              )}
            </div>
          )}

          {phase === 'gps' && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
              <Loader2 className="w-5 h-5 text-neutral-500 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-bold text-neutral-800">Fetching GPS Location…</p>
                <p className="text-xs text-neutral-500 mt-0.5">Please allow location access if prompted.</p>
              </div>
            </div>
          )}

          {phase === 'starting' && coords && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-200">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-bold text-blue-800">Starting Live Session…</p>
                <p className="text-xs text-blue-600 mt-0.5 font-mono">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
                <p className="text-xs text-blue-500 mt-0.5">Preparing your live location link…</p>
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200">
              <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-rose-700">Error</p>
                <p className="text-xs text-rose-500 mt-0.5 leading-relaxed">{errorMsg}</p>
                <button onClick={handleStart} className="mt-2 text-xs font-bold text-rose-600 underline">Try Again</button>
              </div>
            </div>
          )}

          {phase === 'sharing' && session && coords && (
            <>
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="relative shrink-0">
                  <Signal className="w-5 h-5 text-emerald-600" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-emerald-800">Live Sharing Active</p>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">±{coords.accuracy}m</span>
                  </div>
                  <p className="text-[10px] text-emerald-600 mt-0.5 font-mono">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">{updateCount > 0 ? `${updateCount} update${updateCount !== 1 ? 's' : ''} sent` : 'Tracking started'}</p>
                </div>
              </div>

              {session.warning && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs text-amber-700 font-medium">⚠ {session.warning}</p>
                </div>
              )}

              {session.locationUrl && <div className="space-y-2">
                <p className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Live Map Link</p>
                <div className="flex gap-2">
                  <a href={session.locationUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold py-2.5 rounded-xl transition-all">
                    <ExternalLink className="w-3.5 h-3.5" /> Open Map
                  </a>
                  <button onClick={handleCopyLink}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl border transition-all ${copied ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-700'}`}>
                    {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>}

              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Users className="w-4 h-4 text-neutral-500" />
                  <p className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Trusted Contacts ({contacts.length})</p>
                </div>
                {contacts.length === 0 ? (
                  <div className="text-center py-3 bg-neutral-50 rounded-2xl border border-neutral-200">
                    <p className="text-xs text-neutral-500">Add trusted contacts to share this link with them.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {contacts.map((contact) => (
                        <div key={contact.id} className="flex items-center gap-2.5 p-3 rounded-xl border border-neutral-200 bg-white">
                          <div className="w-8 h-8 rounded-full bg-rose-50 text-[#EF4444] border border-rose-100 flex items-center justify-center font-bold text-xs">
                            {contact.contactName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-black leading-tight">{contact.contactName}</p>
                            <p className="text-[11px] text-neutral-500">{contact.phoneNumber}</p>
                          </div>
                          <a href={getWhatsAppLink(contact)} target="_blank" rel="noopener noreferrer"
                            className="ml-auto flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-2 text-xs font-semibold">
                            <ExternalLink className="w-3.5 h-3.5" /> WhatsApp
                          </a>
                        </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-neutral-500 mt-2">WhatsApp opens using the account signed in on this device. Review the message and tap Send.</p>
              </div>
            </>
          )}
        </div>

        <div className="px-5 pb-6 pt-3 border-t border-neutral-100 space-y-2.5">
          {phase === 'idle' && (
            <button onClick={handleStart}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2">
              <Share2 className="w-4 h-4" />
              {contacts.length > 0 ? 'Start Live Location Sharing' : 'Start Sharing (No Contacts)'}
            </button>
          )}
          {phase === 'error' && (
            <button onClick={handleStart}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
              <Navigation className="w-4 h-4" /> Retry
            </button>
          )}
          {phase === 'sharing' && (
            <button onClick={() => void handleStop()} disabled={stopping}
              className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
              {stopping ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
              {stopping ? 'Stopping…' : 'Stop Sharing'}
            </button>
          )}
          <button onClick={onClose}
            className="w-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50 font-semibold py-3 rounded-xl text-sm transition-all">
            {phase === 'sharing' ? 'Close (Keep Sharing)' : 'Close'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
