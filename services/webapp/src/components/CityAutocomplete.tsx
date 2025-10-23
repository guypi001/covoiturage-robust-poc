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
        <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">
          {label}
        </label>
      )}

      <div className="relative">
        <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
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
          className="input w-full pl-10"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="city-listbox"
        />
      </div>

      {open && (
        <div
          className="absolute left-0 right-0 mt-2 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-2xl max-h-64 overflow-auto z-[100]"
          role="listbox"
          id="city-listbox"
        >
          {items.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">Aucune ville trouvée</div>
          ) : (
            items.map((c, i) => (
              <button
                key={c.name}
                type="button"
                className={`w-full text-left px-3 py-2 hover:bg-slate-800 ${
                  i === active ? 'bg-slate-800' : ''
                }`}
                onMouseDown={(e) => e.preventDefault()} // empêche la perte de focus avant onClick
                onClick={() => choose(c.name)}
                role="option"
                aria-selected={i === active}
              >
                <div className="text-slate-100">{c.name}</div>
                {c.region && <div className="text-xs text-slate-400">{c.region}</div>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
