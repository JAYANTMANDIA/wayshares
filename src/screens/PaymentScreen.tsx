import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, QrCode, Wallet, Building2, ShieldCheck, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen, Ride, Booking } from '../types';
import { store } from '../services/store';
import { payForRide } from '../services/payment';

interface PaymentScreenProps {
  ride: Ride;
  selectedSeats: number[];
  onNavigate: (screen: AppScreen) => void;
  onBookingSuccess: (booking: Booking) => void;
}

export const PaymentScreen: React.FC<PaymentScreenProps> = ({
  ride,
  selectedSeats,
  onNavigate,
  onBookingSuccess
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'upi' | 'wallet' | 'netbanking'>('card');
  const [showFareBreakdown, setShowFareBreakdown] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const seatCount = selectedSeats.length || 1;
  const baseFare = seatCount * (ride.pricePerSeat - 40);
  const tollAndPlatformFee = seatCount * 25;
  const gst = seatCount * 15;
  const totalAmount = seatCount * ride.pricePerSeat;

  const handleProceedPayment = async () => {
    setProcessing(true);
    setError('');
    try {
      const booking = await payForRide(ride.id, selectedSeats, selectedMethod);
      store.recordConfirmedBooking(booking);
      onBookingSuccess(booking);
      onNavigate('booking_confirmation');
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Failed to complete payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-24 relative">
      <div>
        {/* TopBar matching Screenshot 9 */}
        <TopBar
          title="Payment"
          onBack={() => onNavigate('select_seat')}
          showMore={true}
        />

        <div className="px-6 pt-2 space-y-4">
          {/* Trip Fare Card matching Screenshot 9 */}
          <div className="p-5 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
                  Trip Fare
                </span>
                <span className="text-3xl font-black text-black tracking-tight mt-0.5 block">
                  ₹{totalAmount}
                </span>
              </div>

              {/* View Details dropdown toggle */}
              <button
                type="button"
                onClick={() => setShowFareBreakdown(!showFareBreakdown)}
                className="text-xs font-bold text-neutral-800 hover:text-black flex items-center gap-1 border border-neutral-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <span>View Details</span>
                {showFareBreakdown ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Expandable Fare Breakdown */}
            <AnimatePresence>
              {showFareBreakdown && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden pt-4 mt-3 border-t border-neutral-100 text-xs space-y-2 text-neutral-600"
                >
                  <div className="flex justify-between">
                    <span>Base Fare ({seatCount} seat × ₹{ride.pricePerSeat - 40})</span>
                    <span className="font-semibold text-black">₹{baseFare}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Highway Tolls & Platform Service</span>
                    <span className="font-semibold text-black">₹{tollAndPlatformFee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxes & GST (5%)</span>
                    <span className="font-semibold text-black">₹{gst}</span>
                  </div>
                  <div className="flex justify-between font-bold text-black pt-1 border-t border-neutral-100">
                    <span>Total Payable</span>
                    <span>₹{totalAmount}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Payment Methods Section matching Screenshot 9 */}
          <div>
            <h3 className="text-sm font-bold text-black tracking-tight mb-3">
              Choose Payment Method
            </h3>

            <div className="space-y-2.5">
              {/* 1. Credit / Debit Card */}
              <div
                onClick={() => setSelectedMethod('card')}
                className={`p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between cursor-pointer active:scale-[0.98] ${
                  selectedMethod === 'card'
                    ? 'border-2 border-orange-500 bg-orange-50/25 ring-4 ring-orange-500/20 shadow-xs scale-[1.01]'
                    : 'border-neutral-200 bg-white hover:border-orange-300'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-2xs ${
                    selectedMethod === 'card' ? 'bg-orange-500 text-white' : 'bg-neutral-100 text-neutral-800'
                  }`}>
                    <CreditCard className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-black">Credit / Debit Card</h4>
                    <p className="text-[11px] text-neutral-500">Visa, Mastercard, RuPay, Amex</p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedMethod === 'card' ? 'border-orange-500 bg-orange-500' : 'border-neutral-300'
                  }`}
                >
                  {selectedMethod === 'card' && (
                    <div className="w-2 h-2 rounded-full bg-white shadow-2xs" />
                  )}
                </div>
              </div>

              {/* 2. UPI */}
              <div
                onClick={() => setSelectedMethod('upi')}
                className={`p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between cursor-pointer active:scale-[0.98] ${
                  selectedMethod === 'upi'
                    ? 'border-2 border-orange-500 bg-orange-50/25 ring-4 ring-orange-500/20 shadow-xs scale-[1.01]'
                    : 'border-neutral-200 bg-white hover:border-orange-300'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-2xs ${
                    selectedMethod === 'upi' ? 'bg-orange-500 text-white' : 'bg-neutral-100 text-neutral-800'
                  }`}>
                    <QrCode className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-black">UPI</h4>
                    <p className="text-[11px] text-neutral-500">Google Pay, PhonePe, Paytm, BHIM</p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedMethod === 'upi' ? 'border-orange-500 bg-orange-500' : 'border-neutral-300'
                  }`}
                >
                  {selectedMethod === 'upi' && (
                    <div className="w-2 h-2 rounded-full bg-white shadow-2xs" />
                  )}
                </div>
              </div>

              {/* 3. Wallet */}
              <div
                onClick={() => setSelectedMethod('wallet')}
                className={`p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between cursor-pointer active:scale-[0.98] ${
                  selectedMethod === 'wallet'
                    ? 'border-2 border-orange-500 bg-orange-50/25 ring-4 ring-orange-500/20 shadow-xs scale-[1.01]'
                    : 'border-neutral-200 bg-white hover:border-orange-300'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-2xs ${
                    selectedMethod === 'wallet' ? 'bg-orange-500 text-white' : 'bg-neutral-100 text-neutral-800'
                  }`}>
                    <Wallet className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-black">Wallet</h4>
                    <p className="text-[11px] text-neutral-500">UberX Cash, Amazon Pay (₹500 bal)</p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedMethod === 'wallet' ? 'border-orange-500 bg-orange-500' : 'border-neutral-300'
                  }`}
                >
                  {selectedMethod === 'wallet' && (
                    <div className="w-2 h-2 rounded-full bg-white shadow-2xs" />
                  )}
                </div>
              </div>

              {/* 4. Net Banking */}
              <div
                onClick={() => setSelectedMethod('netbanking')}
                className={`p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between cursor-pointer active:scale-[0.98] ${
                  selectedMethod === 'netbanking'
                    ? 'border-2 border-orange-500 bg-orange-50/25 ring-4 ring-orange-500/20 shadow-xs scale-[1.01]'
                    : 'border-neutral-200 bg-white hover:border-orange-300'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-2xs ${
                    selectedMethod === 'netbanking' ? 'bg-orange-500 text-white' : 'bg-neutral-100 text-neutral-800'
                  }`}>
                    <Building2 className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-black">Net Banking</h4>
                    <p className="text-[11px] text-neutral-500">HDFC, ICICI, SBI, Axis & 40+ banks</p>
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedMethod === 'netbanking' ? 'border-orange-500 bg-orange-500' : 'border-neutral-300'
                  }`}
                >
                  {selectedMethod === 'netbanking' && (
                    <div className="w-2 h-2 rounded-full bg-white shadow-2xs" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Security Assurance Badge matching Screenshot 9 */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-emerald-900">
            <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="text-[11px] leading-tight">
              <span className="font-bold block">100% Secure Payments</span>
              <span className="text-emerald-700/80">Processed via 256-bit encrypted gateway</span>
            </div>
          </div>

          {error && <p className="text-xs text-rose-500 font-semibold px-1">{error}</p>}
        </div>
      </div>

      {/* Sticky Bottom Action Bar matching Screenshot 9 */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-neutral-200 px-6 py-3.5 flex items-center justify-between z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div>
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
            TOTAL PAYABLE
          </span>
          <span className="text-2xl font-black text-black">
            ₹{totalAmount}
          </span>
        </div>

        <button
          onClick={handleProceedPayment}
          disabled={processing}
          id="proceed-to-pay-button"
          className="bg-black hover:bg-neutral-800 active:scale-[0.98] disabled:opacity-70 text-white font-semibold py-3 px-7 rounded-xl text-sm transition-all shadow-md flex items-center gap-2"
        >
          {processing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <span>Proceed to Pay</span>
          )}
        </button>
      </div>
    </div>
  );
};
