import React, { useMemo, useRef } from 'react';
import { Calendar, MapPin, Search, Users } from 'lucide-react';
import CityAutocomplete from './CityAutocomplete';
import type { LocationMeta } from '../types/location';
import type { HomeSearchTheme, HomeThemeId } from '../constants/homePreferences';

export type SearchPatch = Partial<{
  from: string;
  fromLabel: string;
  fromMeta: LocationMeta | null;
  to: string;
  toLabel: string;
  toMeta: LocationMeta | null;
  date: string;
  seats: number;
  priceMax: number | undefined;
  departureAfter: string | undefined;
  departureBefore: string | undefined;
  sort: 'soonest' | 'cheapest' | 'seats';
}>;

type Props = {
  from: string;
  fromLabel: string;
  fromMeta: LocationMeta | null;
  to: string;
  toLabel: string;
  toMeta: LocationMeta | null;
  date?: string;
  seats: number;
  priceMax?: number;
  departureAfter?: string;
  departureBefore?: string;
  sort: 'soonest' | 'cheapest' | 'seats';
  loading?: boolean;
  onChange: (patch: SearchPatch) => void;
  onSubmit: () => void;
  theme?: HomeThemeId;
  searchTheme?: HomeSearchTheme;
};

export default function SearchBar({
  from,
  fromLabel,
  to,
  toLabel,
  date,
  seats,
  priceMax,
  departureAfter,
  departureBefore,
  sort,
  loading,
  onChange,
  onSubmit,
  theme = 'default',
  searchTheme,
}: Props) {
  const tokens = useMemo<HomeSearchTheme>(() => {
    const fallback: HomeSearchTheme = {
      panel: 'border border-white/80 bg-white/98 shadow-xl shadow-sky-100/60 backdrop-blur-xl',
      icon: 'text-sky-500/80',
      fieldLg: 'border-slate-200 focus:border-sky-200 focus:ring-sky-100',
      fieldSm: 'border-slate-200 focus:border-sky-200 focus:ring-sky-100',
      button: 'bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-200/60',
      hint: 'text-slate-500',
    };
    if (!searchTheme) return fallback;
    return {
      ...fallback,
      ...searchTheme,
      panel: `${fallback.panel} ${searchTheme.panel ?? ''}`.trim(),
    };
  }, [searchTheme]);

  const labelClass = theme === 'night' ? 'text-indigo-100' : 'text-slate-600';
  const minDate = new Date().toISOString().slice(0, 10);
  const dateRef = useRef<HTMLInputElement>(null);

  const openNativePicker = () => {
    const el = dateRef.current;
    if (!el) return;
    (el as any).showPicker?.();
    el.focus();
  };

  return (
    <form
      className={`search-sticky relative w-full overflow-hidden rounded-[32px] px-8 md:px-16 py-10 space-y-7 transition ${tokens.panel}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      aria-label="Formulaire de recherche de trajets"
    >
      <div className="grid gap-5 lg:grid-cols-[2fr,1.1fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <MapPin className={tokens.icon} size={14} /> Départ
            </p>
            <div className="mt-3 text-base">
              <CityAutocomplete
                label={undefined}
                placeholder="Abidjan, Bouaké, San-Pédro…"
                value={fromLabel}
                onChange={(v) => onChange({ from: v })}
                onSelect={(v) => onChange({ from: v })}
                onDisplayChange={(v) => onChange({ fromLabel: v })}
                onMetaChange={(meta) => onChange({ fromMeta: meta })}
                allowCurrentLocation
                enablePlacesLookup
                className="w-full"
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <MapPin className={tokens.icon} size={14} /> Arrivée
            </p>
            <div className="mt-3 text-base">
              <CityAutocomplete
                label={undefined}
                placeholder="Yamoussoukro, Korhogo…"
                value={toLabel}
                onChange={(v) => onChange({ to: v })}
                onSelect={(v) => onChange({ to: v })}
                onDisplayChange={(v) => onChange({ toLabel: v })}
                onMetaChange={(meta) => onChange({ toMeta: meta })}
                allowCurrentLocation
                enablePlacesLookup
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr),minmax(0,0.8fr)]">
          <div className="space-y-2">
            <label className={`text-xs font-semibold ${labelClass}`}>Date de départ</label>
            <div className="relative">
              <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 ${tokens.icon}`} size={18} />
              <input
                ref={dateRef}
                type="date"
                className={`input h-16 w-full pl-14 pr-14 text-lg ${tokens.fieldLg}`}
                min={minDate}
                value={date ?? ''}
                onChange={(e) => onChange({ date: e.currentTarget.value })}
              />
              <button
                type="button"
                onClick={openNativePicker}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Choisir une date"
              >
                <Calendar size={16} />
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className={`text-xs font-semibold ${labelClass}`}>Nombre de sièges</label>
            <div className="relative">
              <Users className={`absolute left-3 top-1/2 -translate-y-1/2 ${tokens.icon}`} size={16} />
              <input
                type="number"
                min={1}
                max={10}
                className={`input h-16 w-full pl-14 text-lg ${tokens.fieldLg}`}
                value={seats}
                onChange={(e) => onChange({ seats: Math.max(1, Number(e.currentTarget.value) || 1) })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr),minmax(0,0.8fr)] md:items-end">
        <div className="space-y-2">
          <label className={`text-xs font-semibold ${labelClass}`}>Budget & horaires</label>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr),minmax(0,0.7fr),minmax(0,0.7fr)]">
            <input
              type="number"
              min={0}
              step={500}
              className={`input h-16 text-lg ${tokens.fieldLg}`}
              placeholder="Prix max"
              value={typeof priceMax === 'number' ? priceMax : ''}
              onChange={(e) => {
                const raw = e.currentTarget.value;
                const parsed = Number(raw);
                if (!raw) {
                  onChange({ priceMax: undefined });
                  return;
                }
                onChange({ priceMax: Number.isFinite(parsed) ? parsed : undefined });
              }}
            />
            <input
              type="time"
              className={`input h-16 text-lg ${tokens.fieldLg}`}
              value={departureAfter ?? ''}
              onChange={(e) => onChange({ departureAfter: e.currentTarget.value || undefined })}
              placeholder="08:00"
            />
            <input
              type="time"
              className={`input h-16 text-lg ${tokens.fieldLg}`}
              value={departureBefore ?? ''}
              onChange={(e) => onChange({ departureBefore: e.currentTarget.value || undefined })}
              placeholder="20:00"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className={`text-xs font-semibold ${labelClass}`}>Trier par</label>
          <select
            className={`input h-16 text-lg ${tokens.fieldSm}`}
            value={sort}
            onChange={(e) => onChange({ sort: e.currentTarget.value as typeof sort })}
          >
            <option value="soonest">Départ le plus proche</option>
            <option value="cheapest">Moins cher</option>
            <option value="seats">Plus de places</option>
          </select>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-3 rounded-[24px] bg-sky-600 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-sky-200/80 transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-200 disabled:opacity-60"
        >
          <Search size={22} />
          {loading ? 'Recherche en cours…' : 'Trouver des trajets'}
        </button>
      </div>
    </form>
  );
}
