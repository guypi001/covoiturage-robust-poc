// src/components/CityAutocomplete.tsx
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  City,
  POPULAR_CITIES,
  nearestCiCity,
  searchCiCities,
} from '../data/cities-ci';
import { ExternalLink, Loader2, MapPin, Navigation } from 'lucide-react';
import type { LocationMeta } from '../types/location';
import {
  getPlaceDetails,
  isGooglePlacesConfigured,
  searchPlaces,
} from '../utils/places';

type Props = {
  value: string;
  placeholder?: string;
  label?: string;
  onChange: (value: string) => void; // valeur canonique (ville) ou saisie en cours
  onSelect?: (value: string) => void; // quand l’utilisateur choisit
  onDisplayChange?: (value: string) => void; // libellé affiché
  onMetaChange?: (meta: LocationMeta | null) => void;
  className?: string;
  inputId?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  autoFocus?: boolean;
  allowCurrentLocation?: boolean;
  enablePlacesLookup?: boolean;
};

const formatCoords = (lat: number, lng: number, digits = 4) =>
  `${lat.toFixed(digits)}, ${lng.toFixed(digits)}`;

export default function CityAutocomplete({
  value,
  placeholder = 'Ville',
  label,
  onChange,
  onSelect,
  onDisplayChange,
  onMetaChange,
  className,
  inputId,
  ariaInvalid,
  ariaDescribedBy,
  autoFocus,
  allowCurrentLocation = false,
  enablePlacesLookup = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value ?? '');
  const [active, setActive] = useState(0);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [placeSuggestions, setPlaceSuggestions] = useState<
    Array<{ placeId: string; description: string; mainText?: string; secondaryText?: string }>
  >([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxSeed = useId();
  const listboxId = inputId ? `${inputId}-listbox` : `city-listbox-${listboxSeed}`;
  const inputErrorClass = ariaInvalid ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : '';

  useEffect(() => setQuery(value ?? ''), [value]);

  const items = useMemo<City[]>(() => {
    const q = query?.trim() ?? '';
    return q ? searchCiCities(q, 8) : POPULAR_CITIES;
  }, [query]);

  useEffect(() => {
    if (!enablePlacesLookup || !isGooglePlacesConfigured) {
      setPlaceSuggestions([]);
      setPlacesError(null);
      setPlacesLoading(false);
      return;
    }
    const q = query.trim();
    if (q.length < 3) {
      setPlaceSuggestions([]);
      setPlacesError(null);
      setPlacesLoading(false);
      return;
    }
    let cancelled = false;
    setPlacesLoading(true);
    setPlacesError(null);
    const handle = window.setTimeout(async () => {
      try {
        const results = await searchPlaces(q);
        if (!cancelled) setPlaceSuggestions(results);
      } catch (err: any) {
        if (!cancelled) setPlacesError(err?.message || 'Impossible de contacter Google Places.');
      } finally {
        if (!cancelled) setPlacesLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, enablePlacesLookup]);

  const emitMeta = (meta: LocationMeta | null) => onMetaChange?.(meta);

  // Fermer quand on clique en dehors
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const applySelection = (meta: LocationMeta) => {
    setQuery(meta.label);
    onDisplayChange?.(meta.label);
    onChange(meta.city);
    onSelect?.(meta.city);
    emitMeta(meta);
    setOpen(false);
    setGeoError(null);
    setGeoLoading(false);
    setActive(0);
    inputRef.current?.focus();
  };

  const choose = (city: City) => {
    applySelection({
      city: city.name,
      label: city.name,
      lat: city.lat,
      lng: city.lng,
      mode: 'city',
    });
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
      choose(items[Math.max(0, active)]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleUseCurrentLocation = () => {
    setGeoError(null);
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoError('La géolocalisation n’est pas supportée sur ce navigateur.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const { city, distanceKm } = nearestCiCity(latitude, longitude);
        const distanceInfo =
          typeof distanceKm === 'number' ? ` • ~${distanceKm.toFixed(1)} km` : '';
        const label = `Ma position actuelle · ${city.name}${distanceInfo} (${formatCoords(
          latitude,
          longitude,
        )})`;
        applySelection({
          city: city.name,
          label,
          lat: latitude,
          lng: longitude,
          accuracyMeters: accuracy ?? undefined,
          distanceKm,
          mode: 'current',
        });
      },
      (err) => {
        setGeoLoading(false);
        setGeoError(err?.message || 'Impossible de récupérer la position.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  const choosePlace = async (placeId: string, fallbackLabel: string) => {
    try {
      setPlacesError(null);
      setPlacesLoading(true);
      const details = await getPlaceDetails(placeId);
      if (!details) {
        setPlacesError('Lieu indisponible.');
        return;
      }
      const { city, distanceKm } = nearestCiCity(details.location.lat, details.location.lng);
      const label = details.name || fallbackLabel;
      applySelection({
        city: city.name,
        label: `${label} · ${city.name}`,
        lat: details.location.lat,
        lng: details.location.lng,
        distanceKm,
        note: details.formattedAddress,
        mode: 'place',
        placeId: details.placeId,
        provider: 'google',
      });
    } catch (err: any) {
      setPlacesError(err?.message || 'Impossible de charger ce lieu.');
    } finally {
      setPlacesLoading(false);
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
          id={inputId}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            const next = e.currentTarget.value;
            setQuery(next);
            onChange(next);
            onDisplayChange?.(next);
            emitMeta(null);
            setGeoError(null);
            if (!open) setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={`input input-lg input-with-icon w-full pr-4 ${inputErrorClass}`.trim()}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-invalid={ariaInvalid || undefined}
          aria-describedby={ariaDescribedBy}
        />
      </div>

      {open && (
        <div
          className="absolute left-0 right-0 mt-2 rounded-2xl border border-slate-200 bg-white shadow-2xl z-[100]"
          role="listbox"
          id={listboxId}
        >
          <div className="max-h-80 overflow-auto">
            {allowCurrentLocation && (
              <div className="border-b border-slate-100 bg-white/80">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-sky-50 transition disabled:cursor-not-allowed disabled:opacity-70"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleUseCurrentLocation}
                  disabled={geoLoading}
                >
                  {geoLoading ? (
                    <Loader2 size={16} className="animate-spin text-sky-600" />
                  ) : (
                    <Navigation size={16} className="text-sky-600" />
                  )}
                  {geoLoading ? 'Localisation en cours…' : 'Utiliser ma position actuelle'}
                </button>
                {geoError && (
                  <div className="px-4 pb-2 text-xs text-red-600">{geoError}</div>
                )}
              </div>
            )}

            {enablePlacesLookup && (
              <div className="border-b border-slate-100 bg-slate-50/60">
                {!isGooglePlacesConfigured ? (
                  <div className="px-4 py-3 text-xs text-slate-600 flex items-start gap-2">
                    <ExternalLink size={14} className="mt-0.5 text-slate-500" />
                    <span>
                      Ajoute <code>VITE_GOOGLE_PLACES_KEY</code> pour activer la recherche de lieux
                      (Google Places).
                    </span>
                  </div>
                ) : placeSuggestions.length === 0 && query.trim().length < 3 ? (
                  <div className="px-4 py-3 text-xs text-slate-500">
                    Tape au moins 3 caractères pour chercher un lieu précis.
                  </div>
                ) : (
                  <div className="py-2">
                    <div className="px-4 pb-2 text-xs font-semibold uppercase text-slate-500">
                      Lieux proposés
                    </div>
                    {placesError && (
                      <div className="px-4 pb-2 text-xs text-red-600">{placesError}</div>
                    )}
                    {placesLoading && (
                      <div className="px-4 py-2 text-sm text-slate-500 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-slate-500" />
                        Recherche…
                      </div>
                    )}
                    {placeSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.placeId}
                        type="button"
                        className="w-full px-4 py-2 text-left hover:bg-sky-50 transition"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choosePlace(suggestion.placeId, suggestion.description)}
                      >
                        <div className="text-sm font-semibold text-slate-800">
                          {suggestion.mainText ?? suggestion.description}
                        </div>
                        {suggestion.secondaryText && (
                          <div className="text-xs text-slate-500">
                            {suggestion.secondaryText}
                          </div>
                        )}
                      </button>
                    ))}
                    {!placesLoading && placeSuggestions.length === 0 && query.trim().length >= 3 && (
                      <div className="px-4 py-2 text-xs text-slate-500">
                        Aucun lieu correspondant dans Google Places.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {items.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">Aucune ville trouvée</div>
            ) : (
              items.map((c, i) => (
                <button
                  key={c.name}
                  type="button"
                  className={`w-full text-left px-4 py-2 transition ${
                    i === active ? 'bg-sky-50 text-sky-700' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(c)}
                  role="option"
                  aria-selected={i === active}
                >
                  <div className="text-sm font-semibold text-slate-800">{c.name}</div>
                  {c.region && <div className="text-xs text-slate-500">{c.region}</div>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
