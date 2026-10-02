import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, X, Check, ThumbsUp, Sparkles, ShieldCheck } from 'lucide-react';
import { store } from '../services/store';

interface RateDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  driverId: string;
  driverName: string;
  driverPhoto: string;
  vehicleInfo?: string;
  route?: string;
  bookingId?: string;
  onSuccess?: () => void;
}

const COMPLIMENT_TAGS = [
  'Smooth & Safe Driving',
  'On-Time Departure',
  'Clean & Sanitized Car',
  'Polite & Courteous',
  'Expressway Lane Discipline',
  'Comfortable AC'
];

const RATING_DESCRIPTIONS: Record<number, string> = {
  1: 'Disappointing',
  2: 'Could be better',
  3: 'Average trip',
  4: 'Very Good & Reliable',
  5: 'Exceptional & Highly Recommended'
};

export const RateDriverModal: React.FC<RateDriverModalProps> = ({
  isOpen,
  onClose,
  rideId,
  driverId,
  driverName,
  driverPhoto,
  vehicleInfo = 'Vehicle verified',
  route = 'Intercity Highway Trip',
  bookingId,
  onSuccess
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Smooth & Safe Driving', 'Clean & Sanitized Car']);
  const [comment, setComment] = useState<string>('');
  const [wouldRideAgain, setWouldRideAgain] = useState<boolean>(true);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;

    store.addReview({
      rideId,
      driverId,
      rating,
      comment: comment.trim() || (rating >= 4 ? 'Great highway driving and safe journey. Reached comfortably on time.' : 'Ride completed.'),
      tags: selectedTags,
      bookingId
    });

    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      onClose();
      if (onSuccess) onSuccess();
    }, 1500);
  };

  const activeScore = hoverRating || rating;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-neutral-150 relative"
        >
          {/* Header decorative accent */}
          <div className="h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {isSubmitted ? (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner"
              >
                <Check className="w-8 h-8 stroke-[3]" />
              </motion.div>
              <h3 className="text-xl font-extrabold text-neutral-900">Rating Submitted!</h3>
              <p className="text-xs text-neutral-600 max-w-xs leading-relaxed">
                Thank you for rating <span className="font-semibold text-black">{driverName}</span>. Your feedback strengthens driver reliability and highway safety for all passengers.
              </p>
              <div className="flex items-center gap-1 text-amber-500 pt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-5 h-5 fill-current" />
                ))}
              </div>
            </div>
          ) : (
            <div className="p-5 max-h-[85vh] overflow-y-auto">
              {/* Driver info card */}
              <div className="flex items-center gap-3.5 pb-4 border-b border-neutral-100">
                <div className="relative">
                  <img
                    src={driverPhoto}
                    alt={driverName}
                    className="w-14 h-14 rounded-full object-cover border-2 border-orange-500/30 shadow-xs"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] ring-2 ring-white">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="flex-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    Post-Ride Rating
                  </span>
                  <h3 className="text-base font-extrabold text-neutral-900 mt-0.5 leading-tight">
                    {driverName}
                  </h3>
                  <p className="text-xs text-neutral-500 line-clamp-1">{vehicleInfo}</p>
                  <p className="text-[11px] text-neutral-400 font-medium">{route}</p>
                </div>
              </div>

              {/* Star Selection Area */}
              <div className="text-center py-4 space-y-1.5">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
                  How was your highway trip?
                </span>

                <div className="flex items-center justify-center gap-2 pt-1 pb-1">
                  {[1, 2, 3, 4, 5].map((starIndex) => {
                    const isFilled = starIndex <= activeScore;
                    return (
                      <motion.button
                        key={starIndex}
                        type="button"
                        whileHover={{ scale: 1.25 }}
                        whileTap={{ scale: 0.9 }}
                        onMouseEnter={() => setHoverRating(starIndex)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(starIndex)}
                        className="p-1 focus:outline-hidden transition-transform"
                      >
                        <Star
                          className={`w-8 h-8 transition-colors duration-150 ${
                            isFilled
                              ? 'text-amber-400 fill-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)]'
                              : 'text-neutral-300 hover:text-amber-200'
                          }`}
                        />
                      </motion.button>
                    );
                  })}
                </div>

                <p className="text-xs font-bold text-orange-600 h-4">
                  {RATING_DESCRIPTIONS[activeScore] || 'Tap a star to rate'}
                </p>
              </div>

              {/* Compliments / Positive Tags */}
              <div className="space-y-2 pt-1 pb-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>What went well? (Select badges)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COMPLIMENT_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                          isSelected
                            ? 'bg-orange-500 text-white shadow-xs font-semibold'
                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                      >
                        {isSelected && '✓ '}
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Text Review Box */}
              <div className="space-y-1.5 pb-3">
                <label className="text-xs font-bold text-neutral-700 block">
                  Write a review for co-passengers
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g. Great highway driving, car was super clean and we reached right on time!"
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-neutral-200 focus:outline-hidden focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-neutral-800 placeholder:text-neutral-400 resize-none"
                />
              </div>

              {/* Would Ride Again Recommendation */}
              <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl border border-neutral-150 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-neutral-800">
                    Ride with {driverName.split(' ')[0]} again?
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWouldRideAgain(true)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                      wouldRideAgain
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-neutral-200 text-neutral-600'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setWouldRideAgain(false)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                      !wouldRideAgain
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-neutral-200 text-neutral-600'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Star className="w-4 h-4 fill-white" />
                <span>Submit Rating & Review</span>
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
