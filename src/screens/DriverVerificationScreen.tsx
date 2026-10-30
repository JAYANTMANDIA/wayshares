import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen } from '../types';

interface DriverVerificationScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const DriverVerificationScreen: React.FC<DriverVerificationScreenProps> = ({ onNavigate }) => (
  <div className="min-h-[720px] w-full bg-white pb-12">
    <TopBar title="Driver Verification" onBack={() => onNavigate('driver_dashboard')} showMore={false} />
    <div className="space-y-4 px-5 py-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
        <ShieldCheck className="mr-2 inline h-5 w-5" />
        Driver access is granted only after an admin approves your rider identity and your vehicle RC photo with your face visible.
      </div>
      <button type="button" onClick={() => onNavigate('profile')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-xs font-bold text-white">
        Open secure document center <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  </div>
);
