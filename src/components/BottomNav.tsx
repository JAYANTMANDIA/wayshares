import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Home, Compass, MessageSquare, Shield, User, Car, ShieldAlert, PlusCircle } from 'lucide-react';
import { AppScreen } from '../types';
import { store } from '../services/store';

interface BottomNavProps {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentScreen, onNavigate }) => {
  const [activeRole, setActiveRole] = useState(store.activeRole);
  const [unreadChatCount, setUnreadChatCount] = useState(() =>
    store.conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setActiveRole(store.activeRole);
      setUnreadChatCount(store.conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0));
    });
    return unsubscribe;
  }, []);

  // Only show bottom nav on primary top-level tabs
  const allowedScreens: AppScreen[] = [
    'home',
    'my_trips',
    'chat',
    'safety',
    'profile',
    'driver_dashboard',
    'admin_dashboard'
  ];

  if (!allowedScreens.includes(currentScreen)) {
    return null;
  }

  if (activeRole === 'driver') {
    const driverTabs = [
      { id: 'driver_dashboard', label: 'Dashboard', icon: Car },
      { id: 'create_ride', label: 'Post Ride', icon: PlusCircle },
      { id: 'driver_verification', label: 'Documents', icon: Shield },
      { id: 'profile', label: 'Profile', icon: User }
    ] as const;

    return (
      <div className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-neutral-150 px-4 py-2 flex items-center justify-around z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        {driverTabs.map((tab) => {
          const isActive = currentScreen === tab.id;
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.88 }}
              onClick={() => onNavigate(tab.id as AppScreen)}
              className="relative flex flex-col items-center py-1 px-3 transition-colors"
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 stroke-[2.2] ${
                    isActive ? 'text-orange-600 scale-110' : 'text-neutral-500 hover:text-black'
                  }`}
                />
                {isActive && (
                  <motion.div
                    layoutId="driverNavActiveGlow"
                    className="absolute -inset-1.5 bg-orange-500/15 rounded-full -z-10"
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  />
                )}
              </div>
              <span
                className={`text-[10px] mt-1 transition-colors ${
                  isActive ? 'text-orange-600 font-bold' : 'text-neutral-500 font-medium'
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="driverNavActiveIndicator"
                  className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-0.5"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    );
  }

  if (activeRole === 'admin') {
    return (
      <div className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-neutral-150 px-6 py-2.5 flex items-center justify-around z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onNavigate('admin_dashboard')}
          className={`flex flex-col items-center gap-1 transition-colors ${
            currentScreen === 'admin_dashboard' ? 'text-neutral-900 font-bold' : 'text-neutral-500 hover:text-black'
          }`}
        >
          <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[11px]">Admin Console</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onNavigate('home')}
          className="flex flex-col items-center gap-1 text-neutral-500 hover:text-black transition-colors"
        >
          <Home className="w-5 h-5 stroke-[2.2]" />
          <span className="text-[11px]">App View</span>
        </motion.button>
      </div>
    );
  }

  // Standard Passenger Navigation with animated indicator & orange accents
  const passengerTabs = [
    { id: 'home', label: 'Home', icon: Home, match: ['home', 'plan_trip'] },
    { id: 'my_trips', label: 'My Trips', icon: Compass, match: ['my_trips', 'trip_details'] },
    { id: 'chat', label: 'Chat', icon: MessageSquare, match: ['chat'] },
    { id: 'safety', label: 'Safety', icon: Shield, match: ['safety', 'trusted_contacts'] },
    { id: 'profile', label: 'Profile', icon: User, match: ['profile'] }
  ] as const;

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-neutral-150 px-3 py-1.5 flex items-center justify-around z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
      {passengerTabs.map((tab) => {
        const isActive = (tab.match as readonly string[]).includes(currentScreen);
        const Icon = tab.icon;
        return (
          <motion.button
            key={tab.id}
            whileTap={{ scale: 0.88 }}
            onClick={() => onNavigate(tab.id as AppScreen)}
            className="relative flex flex-col items-center py-1 px-3.5 transition-colors group"
          >
            <div className="relative">
              <Icon
                className={`w-5 h-5 transition-transform duration-200 stroke-[2.2] ${
                  isActive ? 'text-orange-600 scale-110' : 'text-neutral-500 group-hover:text-neutral-800'
                }`}
              />
              {tab.id === 'chat' && unreadChatCount > 0 && !isActive && (
                <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-orange-500 text-white rounded-full text-[9px] font-black flex items-center justify-center ring-2 ring-white">
                  {unreadChatCount}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="passengerNavActiveGlow"
                  className="absolute -inset-1.5 bg-orange-500/15 rounded-full -z-10"
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                />
              )}
            </div>
            <span
              className={`text-[10.5px] mt-0.5 tracking-tight transition-colors ${
                isActive ? 'text-orange-600 font-bold' : 'text-neutral-500 font-medium'
              }`}
            >
              {tab.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="passengerNavActiveIndicator"
                className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-0.5"
                transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
};

