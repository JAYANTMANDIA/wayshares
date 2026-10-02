import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Check } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { AppScreen, Ride } from '../types';

interface SelectSeatScreenProps {
  ride: Ride;
  selectedSeats: number[];
  onSelectSeats: (seats: number[]) => void;
  onNavigate: (screen: AppScreen) => void;
}

export const SelectSeatScreen: React.FC<SelectSeatScreenProps> = ({
  ride,
  selectedSeats,
  onSelectSeats,
  onNavigate
}) => {
  // Default to [3] matching Screenshot 8 if empty
  const [currentSelected, setCurrentSelected] = useState<number[]>(
    selectedSeats.length > 0 ? selectedSeats : [3]
  );
  const [error, setError] = useState('');

  // Seat descriptions
  const seatDescriptions: Record<number, { name: string; desc: string }> = {
    1: {
      name: 'Seat 1 (Front Co-Driver)',
      desc: 'Front passenger seat with generous legroom and direct dashboard air conditioning.'
    },
    2: {
      name: 'Seat 2 (Rear Left Window)',
      desc: 'Occupied by another passenger.'
    },
    3: {
      name: 'Seat 3 (Rear Right Window)',
      desc: 'Window seat on the right side. Great highway view and comfort.'
    },
    4: {
      name: 'Seat 4 (Rear Center)',
      desc: 'Middle back seat. Best for companions or solo travelers with light luggage.'
    }
  };

  const occupiedList = ride.occupiedSeats || [2]; // Seat 2 is occupied as in screenshot 8

  const handleSeatClick = (seatNum: number) => {
    if (occupiedList.includes(seatNum)) {
      setError(`Seat ${seatNum} is already occupied by another passenger.`);
      return;
    }
    setError('');

    if (currentSelected.includes(seatNum)) {
      // Allow deselecting only if > 1 seat or toggling
      if (currentSelected.length === 1) {
        // keep at least 1 or allow 0
        setCurrentSelected([]);
      } else {
        setCurrentSelected(currentSelected.filter((s) => s !== seatNum));
      }
    } else {
      // Add seat
      setCurrentSelected([...currentSelected, seatNum]);
    }
  };

  const handleContinue = () => {
    if (currentSelected.length === 0) {
      setError('Please select at least one seat to continue');
      return;
    }
    onSelectSeats(currentSelected);
    onNavigate('payment');
  };

  const totalFare = currentSelected.length * ride.pricePerSeat;

  return (
    <div className="w-full min-h-[720px] bg-white flex flex-col justify-between select-none pb-24 relative">
      <div>
        {/* TopBar matching Screenshot 8 */}
        <TopBar
          title="Select Your Seat"
          onBack={() => onNavigate('ride_details')}
          showMore={true}
        />

        <div className="px-6 pt-1 text-center">
          <p className="text-xs text-neutral-500 font-normal">
            Choose from the available seats below
          </p>
        </div>

        {/* Car Silhouette Diagram matching Screenshot 8 */}
        <div className="mx-6 my-5 p-6 rounded-3xl bg-neutral-50 border border-neutral-200/80 flex flex-col items-center relative shadow-inner">
          {/* Car Outline Box */}
          <div className="w-56 h-72 border-2 border-dashed border-neutral-300 rounded-[44px] relative p-4 flex flex-col justify-between bg-white shadow-2xs">
            {/* Front Windshield Arc */}
            <div className="w-36 h-3 bg-neutral-200 rounded-full mx-auto -mt-1" />

            {/* Front Row (Driver & Co-Driver) */}
            <div className="flex items-center justify-between px-2 pt-2">
              {/* Co-Driver Seat 1 */}
              <button
                type="button"
                onClick={() => handleSeatClick(1)}
                className={`w-16 h-18 rounded-2xl flex flex-col items-center justify-center font-bold text-sm transition-all duration-200 active:scale-95 ${
                  occupiedList.includes(1)
                    ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed border border-neutral-300'
                    : currentSelected.includes(1)
                    ? 'bg-orange-500 text-white shadow-md border-2 border-orange-600 ring-4 ring-orange-500/20 scale-105'
                    : 'bg-white text-neutral-800 border-2 border-neutral-300 hover:border-orange-400'
                }`}
              >
                <span className="text-xs uppercase text-[10px] tracking-wider opacity-80">Seat</span>
                <span className="text-base font-extrabold">1</span>
                {currentSelected.includes(1) && <Check className="w-3.5 h-3.5 stroke-[3] mt-0.5" />}
              </button>

              {/* Driver Steering Wheel Icon on Right Side (Indian RHD) */}
              <div className="w-16 h-18 rounded-2xl bg-neutral-100 border border-neutral-200 flex flex-col items-center justify-center text-neutral-400 select-none">
                {/* Steering wheel svg */}
                <svg className="w-7 h-7 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
                </svg>
                <span className="text-[9px] font-bold text-neutral-500 mt-1 uppercase tracking-wider">
                  Driver
                </span>
              </div>
            </div>

            {/* Rear Row: Seat 2, 4, 3 */}
            <div className="flex items-center justify-between px-2 pb-2">
              {/* Seat 2 (Occupied in Screenshot 8) */}
              <button
                type="button"
                onClick={() => handleSeatClick(2)}
                className={`w-14 h-16 rounded-2xl flex flex-col items-center justify-center font-bold text-xs transition-all duration-200 ${
                  occupiedList.includes(2)
                    ? 'bg-neutral-300/80 text-neutral-500 cursor-not-allowed border border-neutral-300'
                    : currentSelected.includes(2)
                    ? 'bg-orange-500 text-white shadow-md border-2 border-orange-600 ring-4 ring-orange-500/20 scale-105'
                    : 'bg-white text-neutral-800 border-2 border-neutral-300 hover:border-orange-400'
                }`}
              >
                <span className="text-[9px] opacity-75">Seat</span>
                <span className="text-sm font-extrabold">2</span>
                {occupiedList.includes(2) && (
                  <span className="text-[8px] font-bold text-neutral-500 uppercase mt-0.5">Taken</span>
                )}
              </button>

              {/* Seat 4 (Center) */}
              <button
                type="button"
                onClick={() => handleSeatClick(4)}
                className={`w-14 h-16 rounded-2xl flex flex-col items-center justify-center font-bold text-xs transition-all duration-200 ${
                  occupiedList.includes(4)
                    ? 'bg-neutral-300/80 text-neutral-500 cursor-not-allowed border border-neutral-300'
                    : currentSelected.includes(4)
                    ? 'bg-orange-500 text-white shadow-md border-2 border-orange-600 ring-4 ring-orange-500/20 scale-105'
                    : 'bg-white text-neutral-800 border-2 border-neutral-300 hover:border-orange-400'
                }`}
              >
                <span className="text-[9px] opacity-75">Seat</span>
                <span className="text-sm font-extrabold">4</span>
                {currentSelected.includes(4) && <Check className="w-3 h-3 stroke-[3]" />}
              </button>

              {/* Seat 3 (Selected Red in Screenshot 8) */}
              <button
                type="button"
                onClick={() => handleSeatClick(3)}
                className={`w-14 h-16 rounded-2xl flex flex-col items-center justify-center font-bold text-xs transition-all duration-200 ${
                  occupiedList.includes(3)
                    ? 'bg-neutral-300/80 text-neutral-500 cursor-not-allowed border border-neutral-300'
                    : currentSelected.includes(3)
                    ? 'bg-orange-500 text-white shadow-md border-2 border-orange-600 ring-4 ring-orange-500/20 scale-105'
                    : 'bg-white text-neutral-800 border-2 border-neutral-300 hover:border-orange-400'
                }`}
              >
                <span className="text-[9px] opacity-75">Seat</span>
                <span className="text-sm font-extrabold">3</span>
                {currentSelected.includes(3) && <Check className="w-3 h-3 stroke-[3]" />}
              </button>
            </div>
          </div>

          {/* Seat Status Legend matching Screenshot 8 */}
          <div className="flex items-center justify-center gap-5 mt-4 text-xs font-semibold text-neutral-600">
            {/* Available */}
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md border-2 border-neutral-300 bg-white shadow-2xs" />
              <span>Available</span>
            </div>

            {/* Selected */}
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-gradient-to-tr from-orange-600 to-orange-500 shadow-xs" />
              <span className="text-orange-600 font-bold">Selected</span>
            </div>

            {/* Occupied */}
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-neutral-300" />
              <span>Occupied</span>
            </div>
          </div>
        </div>

        {/* Selected Seat Commentary Card matching Screenshot 8 */}
        <div className="px-6">
          {error && <p className="text-xs text-rose-500 font-semibold mb-2">{error}</p>}

          <div className="p-4 rounded-2xl border border-neutral-200/90 bg-white shadow-2xs">
            <h4 className="text-sm font-bold text-black tracking-tight mb-1">
              {currentSelected.length > 0
                ? `Seat ${currentSelected.join(', ')} Selected`
                : 'No Seat Selected'}
            </h4>
            <p className="text-xs text-neutral-500 leading-relaxed font-normal">
              {currentSelected.length > 0 && currentSelected[0] in seatDescriptions
                ? seatDescriptions[currentSelected[0]].desc
                : 'Tap any white seat in the vehicle silhouette to choose your preferred spot.'}
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar matching Screenshot 8 */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-neutral-200 px-6 py-3.5 flex items-center justify-between z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div>
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
            SEAT PRICE + GST
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-black">
              ₹{totalFare}
            </span>
            <span className="text-xs text-neutral-500 font-medium">
              ({currentSelected.length} {currentSelected.length === 1 ? 'Seat' : 'Seats'})
            </span>
          </div>
        </div>

        <button
          onClick={handleContinue}
          id="select-seat-continue-button"
          className="bg-black hover:bg-orange-600 active:scale-[0.98] text-white font-bold py-3 px-6 rounded-xl text-sm transition-all duration-200 shadow-md flex items-center gap-1.5 group cursor-pointer"
        >
          <span>Get the Ride</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
