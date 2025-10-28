// src/components/SearchBar.tsx
import React, { useRef } from "react";
import { Calendar, Search } from "lucide-react";
import CityAutocomplete from "./CityAutocomplete";
import type { LocationMeta } from "../types/location";

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
};

export default function SearchBar({
  from,
  fromLabel,
  fromMeta: _fromMeta,
  to,
  toLabel,
  toMeta: _toMeta,
  date,
  seats,
  priceMax,
  departureAfter,
  departureBefore,
  sort,
  loading,
  onChange,
  onSubmit,
}: Props) {
  const minDate = new Date().toISOString().slice(0, 10);
  const dateRef = useRef<HTMLInputElement>(null);

  const openNativePicker = () => {
    const el = dateRef.current;
    if (!el) return;
    // Ouvre le sélecteur natif quand l’API est dispo (Chrome/Edge/Android)
    // sinon fallback: focus (Firefox/macOS anciens)
    (el as any).showPicker?.();
    el.focus();
  };

  return (
    <form
      className="search-sticky rounded-3xl border border-white/70 bg-white/95 shadow-xl shadow-sky-100/40 backdrop-blur p-4 md:p-6 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      aria-label="Formulaire de recherche de trajets"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <CityAutocomplete
          label="Départ"
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

        <CityAutocomplete
          label="Arrivée"
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

      <div className="grid gap-4 md:grid-cols-[minmax(0,220px),minmax(0,140px),minmax(0,1fr)] md:items-end">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600">Date</label>
          <div className="relative">
            <Calendar
              aria-hidden
              className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-500/80"
              size={18}
            />
            <input
              ref={dateRef}
              type="date"
              className="input input-lg w-full pl-12 pr-12"
              aria-label="Date de départ"
              min={minDate}
              value={date ?? ''}
              onChange={(e) => onChange({ date: e.currentTarget.value })}
            />
            <button
              type="button"
              onClick={openNativePicker}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
              aria-label="Ouvrir le sélecteur de date"
              title="Choisir une date"
            >
              <Calendar size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600">Sièges</label>
          <input
            type="number"
            min={1}
            max={10}
            className="input input-lg w-full"
            aria-label="Nombre de sièges souhaités"
            value={seats}
            onChange={(e) =>
              onChange({ seats: Math.max(1, Number(e.currentTarget.value) || 1) })
            }
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary h-12 md:h-14 flex items-center justify-center gap-2 text-base font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Lancer la recherche"
        >
          <Search size={20} />
          {loading ? 'Recherche…' : 'Rechercher'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))]">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600">Prix max (XOF)</label>
          <input
            type="number"
            min={0}
            step={500}
            className="input input-sm w-full"
            placeholder="Aucun"
            value={typeof priceMax === 'number' ? priceMax : ''}
            onChange={(e) => {
              const raw = e.currentTarget.value;
              const parsed = Number(raw);
              if (!raw) {
                onChange({ priceMax: undefined });
                return;
              }
              if (!Number.isFinite(parsed) || parsed <= 0) {
                onChange({ priceMax: undefined });
                return;
              }
              onChange({ priceMax: parsed });
            }}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600">Départ après</label>
          <input
            type="time"
            className="input input-sm w-full"
            value={departureAfter ?? ''}
            onChange={(e) => onChange({ departureAfter: e.currentTarget.value || undefined })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600">Départ avant</label>
          <input
            type="time"
            className="input input-sm w-full"
            value={departureBefore ?? ''}
            onChange={(e) => onChange({ departureBefore: e.currentTarget.value || undefined })}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,220px),minmax(0,1fr)] md:items-end">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600">Tri</label>
          <select
            className="input input-sm w-full"
            value={sort}
            onChange={(e) => onChange({ sort: e.currentTarget.value as 'soonest' | 'cheapest' | 'seats' })}
          >
            <option value="soonest">Le plus tôt</option>
            <option value="cheapest">Le moins cher</option>
            <option value="seats">Plus de places</option>
          </select>
        </div>
        <p className="text-xs text-slate-500">
          Astuce : combine un prix maximal et une fenêtre horaire pour trouver des trajets proches de tes préférences.
        </p>
      </div>
    </form>
  );
}
