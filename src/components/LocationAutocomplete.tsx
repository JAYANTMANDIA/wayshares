import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, MapPin } from 'lucide-react';

export interface LocationSuggestion {
  id: string;
  /** Clean city name, no postal suffixes — e.g. "Chennai", "Tambaram", "Puducherry" */
  cityName: string;
  /** Raw post-office name from dataset (used internally) */
  displayName: string;
  district: string;
  state: string;
  pincode: string;
  lat: number | null;
  lon: number | null;
  type: string;
  matchType: 'prefix' | 'contains' | 'word';
}

interface LocationAutocompleteProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelectLocation?: (location: LocationSuggestion) => void;
  size?: 'sm' | 'lg';
  placeholder?: string;
  filterState?: string;
}

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  id,
  label,
  value,
  onChange,
  onSelectLocation,
  size = 'sm',
  placeholder = 'Type a city, town or village',
  filterState,
}) => {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedValue = useDebounce(value, 280);

  useEffect(() => {
    const query = debouncedValue.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setFetchError('');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setFetchError('');

    const params = new URLSearchParams({ q: query, limit: '20' });
    if (filterState) params.set('state', filterState);

    fetch(`/api/locations/search?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = await res.json() as { success: boolean; results: LocationSuggestion[]; error?: string };
        if (!data.success) throw new Error(data.error || 'Search error');
        setSuggestions(data.results);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setFetchError('Location search unavailable');
        setSuggestions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedValue, filterState]);

  const handleSelect = useCallback((loc: LocationSuggestion) => {
    // Always put the clean city name in the input, never the post-office name
    onChange(loc.cityName);
    onSelectLocation?.(loc);
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.blur();
  }, [onChange, onSelectLocation]);

  const showDropdown = isOpen && value.trim().length >= 2 && (isLoading || suggestions.length > 0 || fetchError.length > 0);
  const isLarge = size === 'lg';

  return (
    <div className="relative flex-1">
      <label
        htmlFor={id}
        className={`${isLarge ? 'text-xs' : 'text-[10px]'} font-bold text-neutral-500 uppercase tracking-wide block`}
      >
        {label}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={`${id}-suggestions`}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
          onChange={(e) => { onChange(e.target.value); setIsOpen(true); }}
          className={`w-full font-semibold text-neutral-900 bg-transparent outline-hidden placeholder:text-neutral-400 ${isLarge ? 'mt-1 text-base leading-7 min-h-8' : 'text-xs'}`}
          placeholder={placeholder}
        />
        {isLoading && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none">
            <LoaderCircle className={`animate-spin text-neutral-400 ${isLarge ? 'w-4 h-4' : 'w-3 h-3'}`} />
          </span>
        )}
      </div>

      {showDropdown && (
        <div
          id={`${id}-suggestions`}
          role="listbox"
          aria-label={`Suggestions for ${label}`}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg"
        >
          {fetchError && (
            <p className="px-3 py-2 text-xs text-rose-600">{fetchError}</p>
          )}

          {!fetchError && isLoading && !suggestions.length && (
            <p className={`px-3 py-2 text-neutral-400 ${isLarge ? 'text-sm' : 'text-xs'}`}>Searching…</p>
          )}

          {!fetchError && suggestions.length === 0 && !isLoading && (
            <p className={`px-3 py-2 text-neutral-500 ${isLarge ? 'text-sm' : 'text-xs'}`}>
              No locations found for "{value.trim()}"
            </p>
          )}

          {suggestions.map((loc) => (
            <button
              key={loc.id}
              type="button"
              role="option"
              aria-selected={loc.cityName === value}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(loc)}
              className={`flex w-full items-start gap-2 border-b border-neutral-100 text-left last:border-0 hover:bg-orange-50 focus:bg-orange-50 focus:outline-none ${isLarge ? 'px-3.5 py-2.5' : 'px-3 py-2'}`}
            >
              <MapPin className={`shrink-0 mt-0.5 text-neutral-400 ${isLarge ? 'w-4 h-4' : 'w-3 h-3'}`} />
              <span className="min-w-0">
                {/* Show the clean city name — no "Ho", "Bo", "G.p.o." etc. */}
                <span className={`block font-semibold text-neutral-900 truncate ${isLarge ? 'text-sm' : 'text-xs'}`}>
                  {loc.cityName}
                </span>
                <span className={`block text-neutral-500 truncate ${isLarge ? 'text-xs' : 'text-[10px]'}`}>
                  {loc.district}, {loc.state}
                </span>
              </span>
            </button>
          ))}

          <div className="border-t border-neutral-100 px-3 py-1.5">
            <p className="text-[9px] text-neutral-400">
              India Post open data · Govt. of India
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
