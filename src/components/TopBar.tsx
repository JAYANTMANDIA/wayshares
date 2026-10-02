import React from 'react';
import { ChevronLeft, MoreHorizontal } from 'lucide-react';

interface TopBarProps {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  showMore?: boolean;
  onMore?: () => void;
  rightAction?: React.ReactNode;
  dark?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  onBack,
  showBack = true,
  showMore = true,
  onMore,
  rightAction,
  dark = false
}) => {
  return (
    <div
      className={`w-full px-5 py-3.5 flex items-center justify-between sticky top-0 z-30 transition-colors ${
        dark ? 'bg-black text-white' : 'bg-white text-black'
      }`}
    >
      <div className="w-8 flex items-center justify-start">
        {showBack && onBack && (
          <button
            onClick={onBack}
            className={`p-1.5 -ml-1 rounded-full transition-transform active:scale-90 ${
              dark ? 'hover:bg-neutral-800 text-white' : 'hover:bg-neutral-100 text-black'
            }`}
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.4]" />
          </button>
        )}
      </div>

      {title && (
        <h1
          className={`text-[17px] font-bold tracking-tight text-center truncate px-2 ${
            dark ? 'text-white' : 'text-neutral-900'
          }`}
        >
          {title}
        </h1>
      )}

      <div className="w-8 flex items-center justify-end">
        {rightAction ? (
          rightAction
        ) : showMore ? (
          <button
            onClick={onMore}
            className={`p-1.5 -mr-1 rounded-full transition-transform active:scale-90 ${
              dark ? 'hover:bg-neutral-800 text-white' : 'hover:bg-neutral-100 text-black'
            }`}
            aria-label="More options"
          >
            <MoreHorizontal className="w-6 h-6" />
          </button>
        ) : null}
      </div>
    </div>
  );
};
