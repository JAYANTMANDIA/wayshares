import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { AppScreen } from '../types';
import { store } from '../services/store';
import { auth } from '../lib/firebase';
import {
  firebaseErrorMessage,
  saveFirebaseUserProfile,
} from '../lib/firebaseAuth';

interface LoginScreenProps {
  onNavigate: (screen: AppScreen) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onNavigate }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [canResendVerification, setCanResendVerification] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (mode === 'register' && fullName.trim().length < 2) {
      setError('Enter your name to create an account');
      return;
    }
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (mode === 'register' && cleanPhone.length !== 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }

    setError('');
    setNotice('');
    setCanResendVerification(false);
    setIsBusy(true);
    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setError('Enter a valid email address');
        return;
      }
      if (!password) {
        setError('Enter your password to continue');
        return;
      }
      if (mode === 'register' && password.length < 8) {
        setError('Choose a password with at least 8 characters');
        return;
      }
      if (!auth) {
        setError('Firebase is not configured. Add the Firebase settings to .env.local.');
        return;
      }

      if (mode === 'register') {
        let firebaseUser;
        try {
          firebaseUser = (await createUserWithEmailAndPassword(auth, normalizedEmail, password)).user;
        } catch (createError) {
          const code = createError && typeof createError === 'object' && 'code' in createError
            ? String(createError.code)
            : '';
          if (code !== 'auth/email-already-in-use') throw createError;
          firebaseUser = (await signInWithEmailAndPassword(auth, normalizedEmail, password)).user;
        }

        await updateProfile(firebaseUser, { displayName: fullName.trim() });
        const fullPhone = `+91${cleanPhone}`;
        try {
          await saveFirebaseUserProfile(firebaseUser, fullName.trim(), fullPhone, true);
          if (!firebaseUser.emailVerified) await sendEmailVerification(firebaseUser);
        } finally {
          await signOut(auth);
        }
        setNotice(firebaseUser.emailVerified
          ? 'Account details saved. You can now log in.'
          : `Verification email sent to ${normalizedEmail}. Verify your email, then log in.`);
        setCanResendVerification(!firebaseUser.emailVerified);
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      if (!credential.user.emailVerified) {
        try {
          await sendEmailVerification(credential.user);
        } finally {
          await signOut(auth);
        }
        setNotice(`Verify your email using the link sent to ${normalizedEmail}, then log in.`);
        setCanResendVerification(true);
        return;
      }

      const profile = await saveFirebaseUserProfile(credential.user);
      store.setAuthenticatedUser(profile);
      onNavigate('home');
    } catch (authError) {
      setError(firebaseErrorMessage(authError));
    } finally {
      setIsBusy(false);
    }
  };

  const handleResendVerification = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!auth || !normalizedEmail || !password) {
      setError('Enter your email and password to resend verification.');
      return;
    }
    setIsBusy(true);
    setError('');
    setNotice('');
    try {
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      try {
        if (credential.user.emailVerified) {
          setNotice('Your email is already verified. You can log in.');
          setCanResendVerification(false);
        } else {
          await sendEmailVerification(credential.user);
          setNotice(`A new verification email was sent to ${normalizedEmail}.`);
          setCanResendVerification(true);
        }
      } finally {
        await signOut(auth);
      }
    } catch (authError) {
      setError(firebaseErrorMessage(authError));
    } finally {
      setIsBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter your email address first');
      return;
    }
    if (!auth) {
      setError('Firebase is not configured. Add the Firebase settings to .env.local.');
      return;
    }
    setIsBusy(true);
    setError('');
    setNotice('');
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setNotice(`Password reset email sent to ${normalizedEmail}.`);
    } catch (authError) {
      setError(firebaseErrorMessage(authError));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="w-full min-h-[776px] bg-white px-6 pt-8 pb-6 flex flex-col select-none">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-2 text-[25px] font-extrabold tracking-tight">
          <span className="text-black">Uber<span className="text-[#EF4444]">X</span></span>
        </div>
        <span className="h-1 w-10 rounded-full bg-[#EF4444]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-7"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#EF4444] mb-2">
          Your ride starts here
        </p>
        <h2 className="text-[30px] font-bold text-black tracking-tight leading-[1.08]">
          {mode === 'login' ? 'Welcome back.' : 'Join UberX.'}
        </h2>
        <p className="text-neutral-500 text-sm mt-2 leading-5">
          {mode === 'login' ? 'Sign in to pick up where you left off.' : 'Create an account to ride and travel together.'}
        </p>
      </motion.div>

      <div className="grid grid-cols-2 p-1 rounded-xl bg-neutral-100 mb-6" aria-label="Account access mode">
        <button
          type="button"
          onClick={() => { setMode('login'); setError(''); setCanResendVerification(false); }}
          aria-pressed={mode === 'login'}
          className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${mode === 'login' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => { setMode('register'); setError(''); setCanResendVerification(false); }}
          aria-pressed={mode === 'register'}
          className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${mode === 'register' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleContinue} className="space-y-4">
        {mode === 'register' && (
          <label className="block">
            <span className="block text-xs font-semibold text-neutral-600 mb-2">Full name</span>
            <span className="flex items-center gap-3 rounded-xl border border-neutral-300 px-4 py-3.5 focus-within:border-black transition-colors">
              <UserRound className="w-4 h-4 text-neutral-400 shrink-0" />
              <input
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => { setFullName(event.target.value); setError(''); }}
                placeholder="Your name"
                className="w-full bg-transparent text-sm text-neutral-900 outline-hidden placeholder:text-neutral-400"
              />
            </span>
          </label>
        )}

        {mode === 'register' && (
          <label className="block">
            <span className="block text-xs font-semibold text-neutral-600 mb-2">Mobile number</span>
            <span className="flex items-center gap-3 rounded-xl border border-neutral-300 px-4 py-3.5 focus-within:border-black transition-colors">
              <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
              <span className="text-sm font-semibold text-neutral-700">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={phoneNumber}
                onChange={(event) => { setPhoneNumber(event.target.value); setError(''); }}
                placeholder="10-digit mobile number"
                maxLength={15}
                className="w-full bg-transparent text-sm font-medium text-neutral-900 outline-hidden placeholder:text-neutral-400"
              />
            </span>
          </label>
        )}

        <label className="block">
          <span className="block text-xs font-semibold text-neutral-600 mb-2">Email address</span>
          <span className="flex items-center gap-3 rounded-xl border border-neutral-300 px-4 py-3.5 focus-within:border-black transition-colors">
            <Mail className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              type="email"
              id="email-address-input"
              autoComplete="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); setError(''); }}
              placeholder="you@example.com"
              className="w-full bg-transparent text-sm font-medium text-neutral-900 outline-hidden placeholder:text-neutral-400"
            />
          </span>
        </label>

        <label className="block">
            <span className="block text-xs font-semibold text-neutral-600 mb-2">Password</span>
            <span className="flex items-center gap-3 rounded-xl border border-neutral-300 px-4 py-3.5 focus-within:border-black transition-colors">
              <LockKeyhole className="w-4 h-4 text-neutral-400 shrink-0" />
              <input
                type="password"
                id="email-password-input"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={mode === 'register' ? 8 : undefined}
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(''); }}
                placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
                className="w-full bg-transparent text-sm font-medium text-neutral-900 outline-hidden placeholder:text-neutral-400"
              />
            </span>
        </label>

        {error && <p role="alert" className="text-xs text-rose-600 font-medium px-1">{error}</p>}

          <button
          type="submit"
          id="login-continue-button"
          disabled={isBusy}
          className="w-full mt-2 bg-black hover:bg-neutral-800 disabled:bg-neutral-500 active:scale-[0.99] text-white font-semibold py-4 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
        >
          <span>{isBusy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Log in with email'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
        {mode === 'login' && (
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={isBusy}
            className="w-full text-xs font-semibold text-neutral-600 hover:text-black disabled:opacity-50"
          >
            Forgot password?
          </button>
        )}
        {notice && <p role="status" className="text-xs text-emerald-700 font-medium text-center">{notice}</p>}
        {canResendVerification && (
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={isBusy}
            className="w-full text-xs font-semibold text-neutral-600 hover:text-black disabled:opacity-50"
          >
            Resend verification email
          </button>
        )}
      </form>

      <div className="mt-auto pt-8">
        <p className="text-center text-[11px] leading-5 text-neutral-400">
          {mode === 'register'
            ? 'We’ll send a verification link to your email. Your mobile number is saved to your profile.'
            : 'Sign in with your verified email and password.'}
        </p>
        <p className="text-center text-[11px] leading-5 text-neutral-400 mt-3">
          By continuing, you agree to UberX's <span className="text-neutral-700 underline underline-offset-2">Terms</span> and <span className="text-neutral-700 underline underline-offset-2">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
};
