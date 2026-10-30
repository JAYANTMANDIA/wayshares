import React, { useState } from 'react';
import { cities } from 'indian-cities-json';

export interface IndianCity {
  id: string;
  name: string;
  state: string;
}

export const INDIAN_CITIES = cities as IndianCity[];

interface IndianCityAutocompleteProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'lg';
}

export const IndianCityAutocomplete: React.FC<IndianCityAutocompleteProps> = ({ id, label, value, onChange, size = 'sm' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const query = value.trim().toLocaleLowerCase('en-IN');
  const suggestions = query
    ? INDIAN_CITIES
      .filter((city) => city.name.toLocaleLowerCase('en-IN').includes(query))
      .sort((a, b) => Number(b.name.toLocaleLowerCase('en-IN').startsWith(query)) - Number(a.name.toLocaleLowerCase('en-IN').startsWith(query)))
    : [];

  const isLarge = size === 'lg';

  return (
    <div className="relative flex-1">
      <label htmlFor={id} className={`${isLarge ? 'text-xs' : 'text-[10px]'} font-bold text-neutral-500 uppercase tracking-wide block`}>{label}</label>
      <input
        type="text"
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen && Boolean(query)}
        aria-controls={`${id}-suggestions`}
        autoComplete="off"
        value={value}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 100)}
        onChange={(event) => { onChange(event.target.value); setIsOpen(true); }}
        className={`w-full font-semibold text-neutral-900 bg-transparent outline-hidden placeholder:text-neutral-400 ${isLarge ? 'mt-1 text-base leading-7 min-h-8' : 'text-xs'}`}
        placeholder="Type an Indian city"
      />
      {isOpen && query && (
        <div
          id={`${id}-suggestions`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg"
        >
          {suggestions.length ? suggestions.map((city) => (
            <button
              key={city.id}
              type="button"
              role="option"
              aria-selected={city.name === value}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => { onChange(city.name); setIsOpen(false); }}
              className={`block w-full border-b border-neutral-100 text-left last:border-0 hover:bg-orange-50 ${isLarge ? 'px-3.5 py-2.5' : 'px-3 py-2'}`}
            >
              <span className={`block font-semibold text-neutral-900 ${isLarge ? 'text-sm' : 'text-xs'}`}>{city.name}</span>
              <span className={`block text-neutral-500 ${isLarge ? 'text-xs' : 'text-[10px]'}`}>{city.state}</span>
            </button>
          )) : (
            <p className={`px-3 py-2 text-neutral-500 ${isLarge ? 'text-sm' : 'text-xs'}`}>No matching cities</p>
          )}
        </div>
      )}
    </div>
  );
};