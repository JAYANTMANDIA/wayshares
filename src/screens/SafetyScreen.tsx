import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ShieldAlert,
  Share2,
  Users,
  ShieldCheck,
  Headphones,
  ChevronRight,
  Shield,
  AlertTriangle,
  HeartHandshake
} from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen } from '../types';
import { store } from '../services/store';
import { ShareLocationModal } from './ShareLocationModal';

interface SafetyScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const SafetyScreen: React.FC<SafetyScreenProps> = ({ onNavigate }) => {
  const [contactsCount, setContactsCount] = useState(store.safetyContacts.length);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    const update = () => setContactsCount(store.safetyContacts.length);
    return store.subscribe(update);
  }, []);

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-12">
      <div>
        {/* TopBar matching Screenshot 11 */}
        <TopBar
          title="Safety"
          onBack={() => onNavigate('home')}
          showMore={true}
        />

        <div className="px-5 pt-1 space-y-3.5">
          {/* Top Banner Card 1: Your Safety Our Priority matching Screenshot 11 */}
          <div className="p-4 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-[#EF4444]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-black tracking-tight leading-tight">
                Your Safety Our Priority
              </h3>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed font-normal">
                Comprehensive safety features designed to protect you on every intercity trip.
              </p>
            </div>
          </div>

          {/* Top Banner Card 2: Ride Safe, Travel Confident matching Screenshot 11 */}
          <div className="p-4 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0 mt-0.5">
              <HeartHandshake className="w-5 h-5 text-neutral-200" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-black tracking-tight leading-tight">
                Ride Safe, Travel Confident
              </h3>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed font-normal">
                Always check driver details and vehicle registration before boarding.
              </p>
            </div>
          </div>

          {/* Safety Action Items List matching Screenshot 11 */}
          <div className="space-y-2.5 pt-1">
            {/* 1. Emergency SOS (High priority red badge) */}
            <a
              href="tel:112"
              aria-label="Call emergency services at 112"
              className="p-4 rounded-2xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50 flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] shadow-2xs"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#EF4444] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-black">
                    Call Emergency Services
                  </h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Call 112 immediately
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-400 shrink-0" />
            </a>

            {/* 2. Share Live Location */}
            <div
              onClick={() => setShowShareModal(true)}
              className="p-4 rounded-2xl border border-neutral-200/90 bg-white hover:border-black/30 flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] shadow-2xs"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-black">
                    Share Live Location
                  </h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Let family & friends track your journey
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-400 shrink-0" />
            </div>

            {/* 3. Trusted Contacts */}
            <div
              onClick={() => onNavigate('trusted_contacts')}
              className="p-4 rounded-2xl border border-neutral-200/90 bg-white hover:border-black/30 flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] shadow-2xs"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-black">
                    Trusted Contacts
                  </h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {contactsCount} contacts added
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-400 shrink-0" />
            </div>

            {/* 4. Verified Drivers */}
            <div
              onClick={() => {
                alert('All UberX drivers undergo government ID validation, Driving License check, and vehicle RC background verification.');
              }}
              className="p-4 rounded-2xl border border-neutral-200/90 bg-white hover:border-black/30 flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] shadow-2xs"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-black">
                    Verified Drivers
                  </h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Background check & DL verified
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-400 shrink-0" />
            </div>

            {/* 5. 24/7 Support */}
            <div
              onClick={() => onNavigate('support')}
              className="p-4 rounded-2xl border border-neutral-200/90 bg-white hover:border-black/30 flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] shadow-2xs"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center shrink-0">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-black">
                    24/7 Support
                  </h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Dedicated safety response team
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-400 shrink-0" />
            </div>
          </div>
        </div>
      </div>
      <ShareLocationModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} />
    </div>
  );
};
