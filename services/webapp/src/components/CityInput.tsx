import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { CI_CITIES } from "../data/cities-ci";
import { normalize, rankCity } from "../utils/strings";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  id?: string;
  className?: string;
};

export default function CityCombobox({
  value,
  onChange,
  placeholder = "Ville",
  label = "Ville",
  id,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const query = value;

  const options = useMemo(() => {
    const ranked = CI_CITIES
      .map((c) => ({ c, r: rankCity(query, c) }))
      .filter((x) => x.r < 999)
      .sort((a, b) => a.r - b.r)
      .slice(0, 8)
      .map((x) => x.c);

    return query ? ranked : CI_CITIES.slice(0, 8);
  }, [query]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => { setActive(0); }, [options.length, query]);

  const select = (city: string) => { onChange(city); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) setOpen(true);
    if (!options.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, options.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); select(options[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  const Highlight = ({ text }: { text: string }) => {
    const q = normalize(query);
    const t = normalize(text);
    if (!q) return <>{text}</>;
    const idx = t.indexOf(q);
    if (idx === -1) return <>{text}</>;
    const end = idx + q.length;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-transparent text-sky-400 font-semibold">{text.slice(idx, end)}</mark>
        {text.slice(end)}
      </>
    );
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <label className="sr-only" htmlFor={id}>{label}</label>
      <div
        className="flex items-center gap-3 px-3 h-12 rounded-lg bg-slate-900/70 border border-white/10 focus-within:ring-2 ring-sky-500/60"
        role="combobox"
        aria-expanded={open}
        aria-controls={id ? `${id}-listbox` : undefined}
      >
        <MapPin size={18} className="text-slate-400 shrink-0" aria-hidden />
        <input
          id={id}
          className="w-full bg-transparent placeholder:text-slate-400 text-[15.5px] leading-none focus:outline-none"
          placeholder={placeholder}
          autoComplete="off"
          value={value}
          onChange={(e) => { onChange(e.currentTarget.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>

      {open && (
        <ul
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-lg bg-slate-900/95 backdrop-blur border border-white/10 shadow-xl"
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400 select-none">Aucun résultat</li>
          )}
          {options.map((city, i) => (
            <li
              key={city}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(city)}
              className={`px-3 py-2 cursor-pointer text-[15px] ${
                i === active ? "bg-sky-600/20 text-sky-200" : "text-slate-200 hover:bg-white/5"
              }`}
            >
              <Highlight text={city} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
