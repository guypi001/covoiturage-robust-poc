import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin } from "lucide-react";
import { CITIES_CI } from "../data/cities-ci";

type Props = {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
  maxSuggestions?: number;
  className?: string;
};

function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export default function CityCombobox({
  id,
  value,
  onChange,
  placeholder = "Ville",
  label,
  maxSuggestions = 8,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // sync externe -> interne
  useEffect(() => setInput(value), [value]);

  const list = useMemo(() => {
    const q = normalize(input.trim());
    if (!q) return CITIES_CI.slice(0, maxSuggestions);
    // 1) commence par… puis 2) contient…
    const starts = CITIES_CI.filter(c => normalize(c.name).startsWith(q));
    const contains = CITIES_CI.filter(
      c => !normalize(c.name).startsWith(q) && normalize(c.name).includes(q)
    );
    return [...starts, ...contains].slice(0, maxSuggestions);
  }, [input, maxSuggestions]);

  // Fermeture au clic extérieur
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(name: string) {
    onChange(name);
    setInput(name);
    setOpen(false);
    // remet le focus
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(a => Math.min(a + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (list[active]) choose(list[active].name);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // dropdown rendu dans un portal pour éviter tout overflow hidden/clip
  const dropdown = open && list.length > 0 && wrapRef.current
    ? createPortal(
        <ul
          role="listbox"
          aria-labelledby={id}
          className="z-[60] w-[var(--cb-w)] max-h-72 overflow-auto rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-2xl p-1"
          style={{
            position: "absolute",
            top: "calc(var(--cb-top) + var(--cb-h) + 6px)",
            left: "var(--cb-left)",
          }}
        >
          {list.map((c, i) => (
            <li
              key={c.name}
              role="option"
              aria-selected={i === active}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
                ${i === active ? "bg-indigo-600/20 text-slate-100" : "text-slate-200 hover:bg-white/5"}`}
              onMouseDown={(ev) => {
                ev.preventDefault(); // pour ne pas déclencher blur avant le click
                choose(c.name);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <MapPin size={16} className="text-indigo-400" />
              <div className="leading-tight">
                <div className="font-medium">{c.name}</div>
                {c.region && (
                  <div className="text-xs text-slate-400">{c.region}, Côte d’Ivoire</div>
                )}
              </div>
            </li>
          ))}
        </ul>,
        document.body
      )
    : null;

  // position/largeur du dropdown (via CSS vars)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--cb-left", `${r.left}px`);
      el.style.setProperty("--cb-top", `${r.top}px`);
      el.style.setProperty("--cb-w", `${r.width}px`);
      el.style.setProperty("--cb-h", `${r.height}px`);
    });
    io.observe(el);
    window.addEventListener("scroll", () => io.callback?.([] as any), true);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", () => io.callback?.([] as any), true);
    };
  }, []);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      )}
      <div className="relative">
        <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          ref={inputRef}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          value={input}
          onChange={(e) => {
            setInput(e.currentTarget.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full h-11 rounded-xl bg-slate-900/60 border border-white/10 text-slate-100
                     placeholder:text-slate-400 pl-10 pr-3 outline-none focus:ring-2 ring-indigo-500"
        />
      </div>
      {dropdown}
    </div>
  );
}
