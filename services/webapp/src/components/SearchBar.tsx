import React, { useId, useMemo, useRef, useState } from 'react';
import { Calendar, Search, Users, RefreshCcw, Settings2 } from 'lucide-react';
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
  liveTracking: boolean | undefined;
}>;

export type SearchErrors = Partial<{
  from: string;
  to: string;
  seats: string;
  timeWindow: string;
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
  liveTracking?: boolean;
  loading?: boolean;
  errors?: SearchErrors;
  showErrors?: boolean;
  submitDisabled?: boolean;
  onChange: (patch: SearchPatch) => void;
  onSubmit: () => void;
  theme?: HomeThemeId;
  searchTheme?: HomeSearchTheme;
};

export default function SearchBar({
  from,
  fromLabel,
  fromMeta,
  to,
  toLabel,
  toMeta,
  date,
  seats,
  priceMax,
  departureAfter,
  departureBefore,
  sort,
  liveTracking,
  loading,
  errors,
  showErrors = false,
  submitDisabled = false,
  onChange,
  onSubmit,
  theme = 'default',
  searchTheme,
}: Props) {
  const MAX_SEATS = 10;
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
  const errorFieldClass = 'border-red-300 focus:border-red-400 focus:ring-red-200';
  const minDate = new Date().toISOString().slice(0, 10);
  const dateRef = useRef<HTMLInputElement>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fieldBaseId = useId();
  const fromId = `${fieldBaseId}-from`;
  const toId = `${fieldBaseId}-to`;
  const dateId = `${fieldBaseId}-date`;
  const seatsId = `${fieldBaseId}-seats`;
  const priceId = `${fieldBaseId}-price`;
  const sortId = `${fieldBaseId}-sort`;
  const departureAfterId = `${fieldBaseId}-after`;
  const departureBeforeId = `${fieldBaseId}-before`;
  const fromErrorId = `${fromId}-error`;
  const toErrorId = `${toId}-error`;
  const seatsErrorId = `${seatsId}-error`;
  const timeErrorId = `${fieldBaseId}-time-error`;
  const fromError = showErrors ? errors?.from : undefined;
  const toError = showErrors ? errors?.to : undefined;
  const seatsError = showErrors ? errors?.seats : undefined;
  const timeError = showErrors ? errors?.timeWindow : undefined;

  const openNativePicker = () => {
    const el = dateRef.current;
    if (!el) return;
    (el as any).showPicker?.();
    el.focus();
  };

  const swapLocations = () => {
    if (!from && !to) return;
    onChange({
      from: to,
      fromLabel: toLabel,
      fromMeta: toMeta,
      to: from,
      toLabel: fromLabel,
      toMeta: fromMeta,
    });
  };

  const quickSamples = [
    ['Abidjan', 'Yamoussoukro'],
    ['Abidjan', 'Bouaké'],
    ['Bouaké', 'Abidjan'],
  ];

  const applySample = (sampleFrom: string, sampleTo: string) => {
    onChange({
      from: sampleFrom,
      fromLabel: sampleFrom,
      fromMeta: null,
      to: sampleTo,
      toLabel: sampleTo,
      toMeta: null,
    });
  };

  return (
    <form
      className={`search-sticky relative w-full overflow-hidden rounded-[32px] px-8 md:px-16 py-10 space-y-7 transition ${tokens.panel}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      noValidate
      aria-label="Formulaire de recherche de trajets"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="font-semibold uppercase tracking-wide">Planifier un trajet</span>
          <button
            type="button"
            onClick={swapLocations}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
          >
            <RefreshCcw size={12} /> Inverser
          </button>
        </div>

        {quickSamples.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Suggestions instantanées
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {quickSamples.map(([sampleFrom, sampleTo]) => (
                <button
                  key={`${sampleFrom}-${sampleTo}`}
                  type="button"
                  onClick={() => applySample(sampleFrom, sampleTo)}
                  className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
                >
                  {sampleFrom} → {sampleTo}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label
              className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              htmlFor={fromId}
            >
              Départ
            </label>
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
              className="mt-2 w-full text-base"
              inputId={fromId}
              ariaInvalid={Boolean(fromError)}
              ariaDescribedBy={fromError ? fromErrorId : undefined}
            />
            {fromError && (
              <p id={fromErrorId} className="mt-2 text-xs text-red-600">
                {fromError}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label
              className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              htmlFor={toId}
            >
              Arrivée
            </label>
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
              className="mt-2 w-full text-base"
              inputId={toId}
              ariaInvalid={Boolean(toError)}
              ariaDescribedBy={toError ? toErrorId : undefined}
            />
            {toError && (
              <p id={toErrorId} className="mt-2 text-xs text-red-600">
                {toError}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className={`text-xs font-semibold ${labelClass}`} htmlFor={dateId}>
                Date de départ
              </label>
              <div className="relative">
                <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 ${tokens.icon}`} size={18} />
                <input
                  ref={dateRef}
                  id={dateId}
                  type="date"
                  className={`input input-with-icon h-14 w-full pr-12 text-base ${tokens.fieldLg}`}
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
              <p className="text-xs text-slate-400">Choisis une date ou laisse vide pour les prochains départs.</p>
            </div>
            <div className="space-y-1">
              <label className={`text-xs font-semibold ${labelClass}`} htmlFor={seatsId}>
                Nombre de sièges
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-14 w-14 rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-700 transition hover:bg-slate-100"
                  onClick={() => onChange({ seats: Math.max(1, seats - 1) })}
                  aria-label="Diminuer le nombre de sièges"
                >
                  −
                </button>
                <div className="relative flex-1">
                  <Users className={`absolute left-3 top-1/2 -translate-y-1/2 ${tokens.icon}`} size={16} />
                  <input
                    id={seatsId}
                    type="number"
                    min={1}
                    max={MAX_SEATS}
                    step={1}
                    className={`input input-with-icon h-14 w-full text-base ${tokens.fieldLg} ${
                      seatsError ? errorFieldClass : ''
                    }`}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-invalid={Boolean(seatsError)}
                    aria-describedby={seatsError ? seatsErrorId : undefined}
                    value={seats}
                    onChange={(e) => {
                      const raw = Number(e.currentTarget.value);
                      const safe = Number.isFinite(raw) ? Math.max(1, Math.min(MAX_SEATS, raw)) : seats;
                      onChange({ seats: safe });
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="h-14 w-14 rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-700 transition hover:bg-slate-100"
                  onClick={() => onChange({ seats: Math.min(MAX_SEATS, seats + 1) })}
                  aria-label="Augmenter le nombre de sièges"
                >
                  +
                </button>
              </div>
              {seatsError ? (
                <p id={seatsErrorId} className="text-xs text-red-600">
                  {seatsError}
                </p>
              ) : (
                <p className="text-xs text-slate-400">Entre 1 et {MAX_SEATS} sièges par réservation.</p>
              )}
            </div>
            <div className="space-y-1">
              <label className={`text-xs font-semibold ${labelClass}`} htmlFor={priceId}>
                Budget maximum (F CFA)
              </label>
              <input
                id={priceId}
                type="number"
                min={0}
                step={500}
                className={`input h-14 w-full text-base ${tokens.fieldLg}`}
                placeholder="Plafond souhaité"
                value={typeof priceMax === 'number' ? priceMax : ''}
                onChange={(e) => {
                  const raw = e.currentTarget.value;
                  const parsed = Number(raw);
                  if (!raw) {
                    onChange({ priceMax: undefined });
                    return;
                  }
                  onChange({ priceMax: Number.isFinite(parsed) ? Math.max(0, parsed) : undefined });
                }}
              />
              <p className="text-xs text-slate-400">Affiche uniquement les trajets sous ce montant.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="flex w-full items-center justify-between text-sm font-semibold text-slate-700"
          >
            <span className="inline-flex items-center gap-2">
              <Settings2 size={14} /> Filtres avancés
            </span>
            <span className="text-xs text-slate-500">{showAdvanced ? 'Masquer' : 'Afficher'}</span>
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),minmax(0,0.6fr)]">
                <div>
                  <label className={`text-xs font-semibold ${labelClass}`} htmlFor={sortId}>
                    Trier par
                  </label>
                  <select
                    id={sortId}
                    className={`input mt-1 h-12 w-full text-sm ${tokens.fieldSm}`}
                    value={sort}
                    onChange={(e) => onChange({ sort: e.currentTarget.value as typeof sort })}
                  >
                    <option value="soonest">Départ le plus proche</option>
                    <option value="cheapest">Moins cher</option>
                    <option value="seats">Plus de places</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className={`flex items-center gap-2 text-xs font-semibold ${labelClass}`}>
                    <input
                      type="checkbox"
                      checked={Boolean(liveTracking)}
                      onChange={(e) => onChange({ liveTracking: e.currentTarget.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-200"
                    />
                    Suivi en direct activé
                  </label>
                </div>
              </div>
              <div>
                <label className={`text-xs font-semibold ${labelClass}`} htmlFor={departureAfterId}>
                  Départ entre
                </label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    id={departureAfterId}
                    className={`input h-12 w-full text-sm ${tokens.fieldLg} ${
                      timeError ? errorFieldClass : ''
                    }`}
                    value={departureAfter ?? ''}
                    onChange={(e) => onChange({ departureAfter: e.currentTarget.value || undefined })}
                    placeholder="08:00"
                    aria-invalid={Boolean(timeError)}
                    aria-describedby={timeError ? timeErrorId : undefined}
                  />
                  <input
                    type="time"
                    id={departureBeforeId}
                    className={`input h-12 w-full text-sm ${tokens.fieldLg} ${
                      timeError ? errorFieldClass : ''
                    }`}
                    value={departureBefore ?? ''}
                    onChange={(e) => onChange({ departureBefore: e.currentTarget.value || undefined })}
                    placeholder="18:00"
                    aria-invalid={Boolean(timeError)}
                    aria-describedby={timeError ? timeErrorId : undefined}
                  />
                </div>
                {timeError ? (
                  <p id={timeErrorId} className="mt-1 text-xs text-red-600">
                    {timeError}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">
                    Ex. 08h à 12h pour afficher uniquement les départs du matin.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading || submitDisabled}
          className="inline-flex w-full items-center justify-center gap-3 rounded-[24px] bg-sky-600 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-sky-200/80 transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-200 disabled:opacity-60"
        >
          <Search size={22} />
          {loading ? 'Recherche en cours…' : 'Trouver des trajets'}
        </button>
      </div>
    </form>
  );
}
