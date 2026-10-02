import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Upload, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen } from '../types';

interface DriverVerificationScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const DriverVerificationScreen: React.FC<DriverVerificationScreenProps> = ({ onNavigate }) => {
  const [dlNumber, setDlNumber] = useState('KA 03 2018 0049201');
  const [rcNumber, setRcNumber] = useState('KA 03 MX 4920');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      alert('Documents re-verified by AI verification engine.');
    }, 500);
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-12">
      <div>
        <TopBar
          title="Driver Verification"
          onBack={() => onNavigate('driver_dashboard')}
          showMore={false}
        />

        <div className="px-5 pt-1 space-y-4">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Gold Verified Driver Status
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Your profile is active for highway passenger bookings. You can renew documents or upload updated motor insurance here.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                Driving License Number
              </label>
              <input
                type="text"
                value={dlNumber}
                onChange={(e) => setDlNumber(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-xs font-mono font-bold outline-hidden"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                Vehicle RC (Registration Certificate)
              </label>
              <input
                type="text"
                value={rcNumber}
                onChange={(e) => setRcNumber(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 text-xs font-mono font-bold outline-hidden"
              />
            </div>

            {/* Document preview placeholders */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-neutral-200 rounded-xl p-3 text-center bg-neutral-50">
                <FileText className="w-6 h-6 text-neutral-600 mx-auto mb-1" />
                <span className="text-[11px] font-bold block">DL_Front.jpg</span>
                <span className="text-[9px] text-emerald-600 font-bold">Approved ✓</span>
              </div>

              <div className="border border-neutral-200 rounded-xl p-3 text-center bg-neutral-50">
                <FileText className="w-6 h-6 text-neutral-600 mx-auto mb-1" />
                <span className="text-[11px] font-bold block">Vehicle_RC.jpg</span>
                <span className="text-[9px] text-emerald-600 font-bold">Approved ✓</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-black text-white font-bold py-3 rounded-xl text-xs mt-3"
            >
              Update Documents
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
