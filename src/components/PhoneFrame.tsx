import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor, Shield, User, Car, Bell } from 'lucide-react';
import { store } from '../services/store';

interface PhoneFrameProps {
  children: React.ReactNode;
  currentScreen: string;
  onNavigate: (screen: any) => void;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({ children, currentScreen, onNavigate }) => {
  const [isPhoneView, setIsPhoneView] = useState(true);
  const [currentTime, setCurrentTime] = useState('9:41');
  const [activeRole, setActiveRole] = useState(store.activeRole);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    const updateStats = () => {
      setActiveRole(store.activeRole);
      setUnreadNotifs(store.notifications.filter((n) => !n.read).length);
    };
    updateStats();
    return store.subscribe(updateStats);
  }, []);

  useEffect(() => {
    // Keep 9:41 or sync with real time if needed
    const updateTime = () => {
      const d = new Date();
      const h = d.getHours();
      const m = d.getMinutes().toString().padStart(2, '0');
      // Default to 9:41 as seen in the UberX mobile screenshots for pixel parity, or show system time
      setCurrentTime(`${h % 12 || 12}:${m}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const [rcWarningToast, setRcWarningToast] = useState<string | null>(null);

  const handleRoleChange = (role: 'passenger' | 'driver' | 'admin') => {
    if (role === 'driver' && !store.canProvideRide()) {
      setRcWarningToast('Vehicle RC required to provide rides. Upload RC in Profile to unlock Driver Mode.');
      setTimeout(() => setRcWarningToast(null), 4000);
      onNavigate('profile');
      return;
    }
    const success = store.setActiveRole(role);
    if (!success && role === 'driver') {
      setRcWarningToast('Vehicle RC required to provide rides.');
      setTimeout(() => setRcWarningToast(null), 4000);
      return;
    }
    if (role === 'driver') {
      onNavigate('driver_dashboard');
    } else if (role === 'admin') {
      onNavigate('admin_dashboard');
    } else {
      onNavigate('home');
    }
  };

  const showAppHeader = currentScreen !== 'splash' && currentScreen !== 'login';

  return (
    <div className="min-h-screen bg-neutral-100/80 flex flex-col items-center justify-start p-0 sm:py-6 selection:bg-rose-500 selection:text-white">
      {/* RC Missing Toast Alert */}
      {rcWarningToast && (
        <div className="w-full max-w-[420px] mx-auto mb-2 p-2.5 bg-amber-500/95 backdrop-blur-md text-black text-xs font-bold rounded-xl text-center shadow-lg border border-amber-400 animate-fade-in flex items-center justify-center gap-2 z-50">
          <span>⚠️ {rcWarningToast}</span>
        </div>
      )}

      {/* Main Container - Standard Mobile Viewport Width */}
      <main
        className={`w-full transition-all duration-300 ${
          isPhoneView
            ? 'max-w-[420px] min-h-[780px] bg-white sm:rounded-[32px] sm:shadow-2xl sm:border sm:border-neutral-200/90 overflow-hidden flex flex-col relative'
            : 'max-w-3xl min-h-[85vh] rounded-3xl overflow-hidden shadow-2xl relative border border-neutral-200 bg-white flex flex-col'
        }`}
      >
        {/* Subtle Top Accent Brand Line */}
        <div className="w-full h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 shrink-0" />

        {/* On-Screen App Header matching user request: UberX logo, Rider/Driver switch, notifications */}
        {showAppHeader && (
          <header className="w-full px-4 py-2.5 bg-white/95 backdrop-blur-md border-b border-neutral-150 flex items-center justify-between z-40 select-none shrink-0 sticky top-0 shadow-2xs">
            {/* UberX Logo */}
            <button
              onClick={() => onNavigate('home')}
              id="screen-uberx-logo"
              className="flex items-center gap-1.5 active:scale-95 transition-all duration-150 group"
              title="UberX Home"
            >
              <div className="w-6 h-6 bg-black rounded-lg flex items-center justify-center font-bold text-xs tracking-tight text-white border border-neutral-900 shadow-2xs group-hover:scale-105 transition-transform">
                U<span className="text-orange-500 font-black">X</span>
              </div>
              <span className="font-extrabold text-neutral-900 text-sm tracking-tight group-hover:text-orange-600 transition-colors">
                Uber<span className="text-orange-500">X</span>
              </span>
            </button>

            {/* Quick Role Switcher */}
            <div className="flex items-center bg-neutral-100 p-0.5 rounded-full border border-neutral-200/90 text-[11px] shadow-inner">
              <button
                onClick={() => handleRoleChange('passenger')}
                id="role-switch-rider"
                className={`px-2.5 py-1 rounded-full font-medium transition-all duration-200 active:scale-95 ${
                  activeRole === 'passenger'
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-xs font-bold scale-[1.02]'
                    : 'text-neutral-600 hover:text-black hover:bg-neutral-200/60'
                }`}
              >
                Rider
              </button>
              <button
                onClick={() => handleRoleChange('driver')}
                id="role-switch-driver"
                className={`px-2.5 py-1 rounded-full font-medium transition-all duration-200 active:scale-95 ${
                  activeRole === 'driver'
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-xs font-bold scale-[1.02]'
                    : 'text-neutral-600 hover:text-black hover:bg-neutral-200/60'
                }`}
              >
                Driver
              </button>
              <button
                onClick={() => handleRoleChange('admin')}
                id="role-switch-admin"
                className={`px-2.5 py-1 rounded-full font-medium transition-all duration-200 active:scale-95 ${
                  activeRole === 'admin'
                    ? 'bg-gradient-to-r from-neutral-800 to-black text-white shadow-xs font-bold scale-[1.02]'
                    : 'text-neutral-600 hover:text-black hover:bg-neutral-200/60'
                }`}
              >
                Admin
              </button>
            </div>

            {/* Notifications */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onNavigate('notifications')}
                id="screen-notifications-button"
                className="relative p-1.5 rounded-full bg-neutral-100 hover:bg-orange-50 hover:text-orange-600 active:scale-90 text-neutral-700 transition-all duration-150"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-tr from-orange-600 to-orange-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs animate-pulse-subtle">
                    {unreadNotifs}
                  </span>
                )}
              </button>

            </div>
          </header>
        )}

        {/* Screen Content Viewport */}
        <div className="w-full flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
};
