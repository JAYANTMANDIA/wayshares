import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';
import { AppScreen } from '../types';
import { store } from '../services/store';
import { auth } from '../lib/firebase';
import { saveFirebaseUserProfile } from '../lib/firebaseAuth';

interface SplashScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onNavigate }) => {
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) onNavigate('login');
    }, 2400);

    const unsubscribe = auth ? onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timer);
      if (!active) return;
      if (!firebaseUser) {
        store.logout();
        onNavigate('login');
        return;
      }
      try {
        const profile = await saveFirebaseUserProfile(firebaseUser);
        if (active) {
          store.setAuthenticatedUser(profile);
          onNavigate('home');
        }
      } catch (error) {
        console.error('Unable to restore authenticated profile', error);
        if (active) onNavigate('login');
      }
    }) : undefined;

    return () => {
      active = false;
      clearTimeout(timer);
      unsubscribe?.();
    };
  }, [onNavigate]);

  const handleManualSkip = () => {
    if (auth?.currentUser && store.isAuthenticated) {
      onNavigate('home');
    } else {
      onNavigate('login');
    }
  };

  return (
    <div
      onClick={handleManualSkip}
      className="w-full h-full min-h-[780px] bg-black text-white flex flex-col items-center justify-center relative cursor-pointer select-none px-6"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="flex flex-col items-center justify-center text-center"
      >
        {/* UberX Logo matching Screenshot 1 */}
        <div className="flex items-center text-5xl sm:text-6xl font-extrabold tracking-tight mb-2">
          <span>Uber</span>
          <span className="text-[#EF4444]">X</span>
        </div>

        {/* Red accent line under logo */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 84 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="h-[3px] bg-[#EF4444] rounded-full mb-6"
        />

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-neutral-400 text-sm sm:text-base font-normal tracking-wide"
        >
          Smart Mobility Reimagined
        </motion.p>
      </motion.div>

      {/* Subtle indicator at bottom */}
      <div className="absolute bottom-12 flex flex-col items-center gap-2">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-rose-500 rounded-full animate-spin" />
        <span className="text-[11px] text-neutral-500">Tap anywhere to enter</span>
      </div>
    </div>
  );
};
