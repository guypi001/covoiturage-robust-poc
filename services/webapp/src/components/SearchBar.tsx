import { Calendar, Search } from "lucide-react";
import React from "react";
import CityCombobox from "./CityInput";

export type SearchPatch = Partial<{ from: string; to: string; date: string }>;

type Props = {
  from: string;
  to: string;
  date?: string;
  loading?: boolean;
  onChange: (patch: SearchPatch) => void;
  onSubmit: () => void;
};

export default function SearchBar({
  from,
  to,
  date,
  loading,
  onChange,
  onSubmit,
}: Props) {
  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="w-full"
      aria-label="Recherche de trajets"
    >
      <div className="rounded-xl bg-slate-900/70 backdrop-blur border border-white/10 shadow-[0_8px_24px_-12px_rgba(0,0,0,.6)] text-slate-100 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,200px,140px] divide-y md:divide-y-0 md:divide-x divide-white/10">
          {/* Départ */}
          <CityCombobox
            id="search-from"
            label="Départ"
            placeholder="Départ"
            value={from}
            onChange={(v) => onChange({ from: v })}
            className="px-3"
          />

          {/* Arrivée */}
          <CityCombobox
            id="search-to"
            label="Arrivée"
            placeholder="Arrivée"
            value={to}
            onChange={(v) => onChange({ to: v })}
            className="px-3"
          />

          {/* Date */}
          <label className="flex items-center gap-3 px-3 h-12">
            <Calendar size={18} className="text-slate-400 shrink-0" aria-hidden />
            <input
              type="date"
              min={minDate}
              value={date ?? ""}
              onChange={(e) => onChange({ date: e.currentTarget.value })}
              aria-label="Date de départ"
              className="w-full bg-transparent text-[15.5px] leading-none focus:outline-none [color-scheme:dark]"
            />
          </label>

          {/* Bouton */}
          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full bg-sky-600 hover:bg-sky-700 disabled:bg-sky-500 text-white font-semibold flex items-center justify-center gap-2 md:rounded-r-xl transition-colors"
          >
            <Search size={18} />
            {loading ? "Recherche…" : "Rechercher"}
          </button>
        </div>
      </div>
    </form>
  );
}
