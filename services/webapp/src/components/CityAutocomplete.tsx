// src/components/CityAutocomplete.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { City, searchCiCities, POPULAR_CITIES } from '../data/cities-ci';
import { MapPin } from 'lucide-react';

type Props = {
  value: string;
  placeholder?: string;
  label?: string;
  onChange: (value: string) => void;     // à chaque frappe
  onSelect?: (value: string) => void;     // quand l’utilisateur choisit une ville
  className?: string;
  autoFocus?: boolean;
};

export default function CityAutocomplete({
  value,
  placeholder = 'Ville',
  label,
  onChange,
  onSelect,
  className,
  autoFocus,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value ?? '');
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setQuery(value ?? ''), [value]);

  const items = useMemo<City[]>(() => {
    const q = query?.trim() ?? '';
    return q ? searchCiCities(q, 8) : POPULAR_CITIES;
  }, [query]);

  // Fermer quand on clique en dehors
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const choose = (name: string) => {
    onChange(name);
    onSelect?.(name);
    setOpen(false);
    // remet le focus pour enchaîner
    inputRef.current?.focus();
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) setOpen(true);
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(items[Math.max(0, active)].name);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-600 mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        <MapPin
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-500/80 pointer-events-none"
        />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            onChange(e.currentTarget.value);
            if (!open) setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="input input-lg w-full pl-12 pr-4"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="city-listbox"
        />
      </div>

      {open && (
        <div
          className="absolute left-0 right-0 mt-2 rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-64 overflow-auto z-[100]"
          role="listbox"
          id="city-listbox"
        >
          {items.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">Aucune ville trouvée</div>
          ) : (
            items.map((c, i) => (
              <button
                key={c.name}
                type="button"
                className={`w-full text-left px-4 py-2 transition ${
                  i === active ? 'bg-sky-50 text-sky-700' : 'hover:bg-slate-100'
                }`}
                onMouseDown={(e) => e.preventDefault()} // empêche la perte de focus avant onClick
                onClick={() => choose(c.name)}
                role="option"
                aria-selected={i === active}
              >
                <div className="text-sm font-semibold text-slate-800">{c.name}</div>
                {c.region && <div className="text-xs text-slate-500">{c.region}</div>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
