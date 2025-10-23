// src/components/SearchBar.tsx
import React, { useRef } from "react";
import { Calendar, Search } from "lucide-react";
import CityAutocomplete from "./CityAutocomplete";

export type SearchPatch = Partial<{ from: string; to: string; date: string; seats: number }>;

type Props = {
  from: string;
  to: string;
  date?: string;
  seats: number;
  loading?: boolean;
  onChange: (patch: SearchPatch) => void;
  onSubmit: () => void;
};

export default function SearchBar({
  from,
  to,
  date,
  seats,
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
      className="search-sticky card p-3 md:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      aria-label="Formulaire de recherche de trajets"
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,220px,140px,150px] gap-3 md:gap-2 items-stretch">
        <CityAutocomplete
          label="Départ"
          placeholder="Ville de départ"
          value={from}
          onChange={(v) => onChange({ from: v })}
          onSelect={(v) => onChange({ from: v })}
          className="w-full"
        />

        <CityAutocomplete
          label="Arrivée"
          placeholder="Ville d’arrivée"
          value={to}
          onChange={(v) => onChange({ to: v })}
          onSelect={(v) => onChange({ to: v })}
          className="w-full"
        />

        {/* Champ date avec bouton calendrier à droite */}
        <div className="relative">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Date
          </label>
          <div className="relative">
            {/* Icône à gauche (cosmétique) */}
            <Calendar
              aria-hidden
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              ref={dateRef}
              type="date"
              className="input pl-10 pr-11 w-full"
              aria-label="Date de départ"
              min={minDate}
              value={date ?? ""}
              onChange={(e) => onChange({ date: e.currentTarget.value })}
            />
            {/* Bouton à droite qui ouvre le picker natif */}
            <button
              type="button"
              onClick={openNativePicker}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
              aria-label="Ouvrir le sélecteur de date"
              title="Choisir une date"
            >
              <Calendar size={16} className="text-slate-600" />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Sièges
          </label>
          <input
            type="number"
            min={1}
            max={10}
            className="input w-full"
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
          className="btn-primary h-11 md:h-full flex items-center justify-center gap-2"
          aria-label="Lancer la recherche"
        >
          <Search size={18} />
          {loading ? "Recherche…" : "Rechercher"}
        </button>
      </div>
    </form>
  );
}
