// src/pages/Home.tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, ShieldCheck, Clock, Star, Wand2 } from 'lucide-react';
import SearchBar, { SearchPatch } from '../components/SearchBar';
import RideCard from '../components/RideCard';
import { useApp } from '../store';
import { searchRides, type FavoriteRoute } from '../api';
import { GmailLogo } from '../components/icons/GmailLogo';
import { findCityByName, isKnownCiCity } from '../data/cities-ci';
import type { LocationMeta } from '../types/location';
import { HOME_THEME_STYLE, QUICK_ACTION_OPTIONS } from '../constants/homePreferences';

type SearchFormState = {
  from: string;
  fromLabel: string;
  fromMeta: LocationMeta | null;
  to: string;
  toLabel: string;
  toMeta: LocationMeta | null;
  date: string;
  seats: number;
  priceMax?: number;
  departureAfter?: string;
  departureBefore?: string;
  sort: 'soonest' | 'cheapest' | 'seats';
};

export default function Home() {
  const nav = useNavigate();

  const {
    lastSearch,
    setSearch,
    setResults,
    setLoading,
    setError,
    loading,
    results,
    error,
  } = useApp();
  const account = useApp((state) => state.account);

  const homePreferences = account?.homePreferences;
  const theme = homePreferences?.theme ?? 'default';
  const themeStyle = HOME_THEME_STYLE[theme] ?? HOME_THEME_STYLE.default;
  const isDarkTheme = theme === 'night';
  const heroMessage = homePreferences?.heroMessage?.trim() ||
    'Voyage sereinement entre les villes de Côte d’Ivoire';
  const showTips = homePreferences?.showTips ?? true;
  const quickActions = homePreferences?.quickActions ?? [];
  const favoriteRoutes = homePreferences?.favoriteRoutes ?? [];
  const quickActionItems = QUICK_ACTION_OPTIONS.filter((option) => quickActions.includes(option.id));
  const heroTitleColor = isDarkTheme ? 'text-white' : 'text-slate-900';
  const heroTextColor = isDarkTheme ? 'text-slate-200' : 'text-slate-600';
  const heroBadgeClass = isDarkTheme
    ? 'bg-white/10 text-white'
    : 'bg-white/80 text-sky-600 shadow-sm shadow-sky-100';
  const heroCardClass = isDarkTheme
    ? 'border-white/15 bg-white/10 text-slate-200'
    : 'border-white/60 bg-white/80 text-slate-600 shadow-sm';

  // État local du formulaire (prérempli depuis la dernière recherche)
  const [form, setForm] = useState<SearchFormState>({
    from: lastSearch?.from ?? '',
    fromLabel: lastSearch?.fromMeta?.label ?? lastSearch?.from ?? '',
    fromMeta: lastSearch?.fromMeta ?? null,
    to: lastSearch?.to ?? '',
    toLabel: lastSearch?.toMeta?.label ?? lastSearch?.to ?? '',
    toMeta: lastSearch?.toMeta ?? null,
    date: lastSearch?.date ?? '',
    seats: lastSearch?.seats ?? 1,
    priceMax: lastSearch?.priceMax,
    departureAfter: lastSearch?.departureAfter,
    departureBefore: lastSearch?.departureBefore,
    sort: lastSearch?.sort ?? 'soonest',
  });

  // Patch partiel (vient de SearchBar)
  function onChange(patch: SearchPatch) {
    setForm(prev => ({ ...prev, ...patch } as SearchFormState));
  }

  const ensureMeta = (meta: LocationMeta | null, city: string): LocationMeta => {
    const cityNorm = city.trim();
    if (meta && meta.city.toLowerCase() === cityNorm.toLowerCase()) {
      return meta;
    }
    const found = findCityByName(cityNorm);
    if (found) {
      return {
        city: found.name,
        label: meta?.label?.trim() || found.name,
        lat: found.lat,
        lng: found.lng,
        mode: 'city',
      };
    }
    return {
      city: cityNorm,
      label: meta?.label?.trim() || cityNorm,
      lat: meta?.lat,
      lng: meta?.lng,
      distanceKm: meta?.distanceKm,
      accuracyMeters: meta?.accuracyMeters,
      note: meta?.note,
      mode: meta?.mode ?? 'manual',
    };
  };

  // Lance la recherche et affiche les résultats sur la même page
  async function onSubmit() {
    const fromCity = form.from.trim();
    const toCity = form.to.trim();
    if (!fromCity || !toCity) {
      setError('Renseigne départ et arrivée');
      return;
    }
    if (!isKnownCiCity(fromCity)) {
      setError('Sélectionne un point de départ valide.');
      return;
    }
    if (!isKnownCiCity(toCity)) {
      setError('Sélectionne une arrivée valide.');
      return;
    }
    if (!form.seats || form.seats <= 0) {
      setError('Nombre de sièges invalide');
      return;
    }
    if (form.departureAfter && form.departureBefore && form.departureAfter > form.departureBefore) {
      setError('Plage horaire incohérente. “Après” doit précéder “avant”.');
      return;
    }
    const nextSearch = {
      from: fromCity,
      to: toCity,
      date: form.date || undefined,
      seats: form.seats,
      priceMax: typeof form.priceMax === 'number' && form.priceMax > 0 ? form.priceMax : undefined,
      departureAfter: form.departureAfter || undefined,
      departureBefore: form.departureBefore || undefined,
      sort: form.sort || 'soonest',
      fromMeta: ensureMeta(form.fromMeta, fromCity),
      toMeta: ensureMeta(form.toMeta, toCity),
    };
    setSearch(nextSearch);
    setLoading(true);
    setError(undefined);
    try {
      const data = await searchRides({
        from: nextSearch.from,
        to: nextSearch.to,
        date: nextSearch.date,
        seats: nextSearch.seats,
        priceMax: nextSearch.priceMax,
        departureAfter: nextSearch.departureAfter,
        departureBefore: nextSearch.departureBefore,
        sort: nextSearch.sort,
      });
      setResults(data);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  }

  const displayLastFrom = lastSearch?.fromMeta?.label ?? lastSearch?.from ?? '';
  const displayLastTo = lastSearch?.toMeta?.label ?? lastSearch?.to ?? '';

  const prefillFavoriteRoute = (route: FavoriteRoute) => {
    setForm((prev) => ({
      ...prev,
      from: route.from,
      fromLabel: route.from,
      fromMeta: ensureMeta(prev.fromMeta, route.from),
      to: route.to,
      toLabel: route.to,
      toMeta: ensureMeta(prev.toMeta, route.to),
    }));
    setError(undefined);
  };

  return (
    <div className="min-h-[calc(100vh-56px)]">
      <section className="relative overflow-hidden">
        <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${themeStyle.gradient}`} />
        <div className="absolute inset-y-0 right-0 -z-10 hidden lg:block">
          <div
            className={`h-full w-72 translate-x-24 rounded-full blur-3xl ${
              isDarkTheme ? 'bg-indigo-500/20' : 'bg-sky-100/50'
            }`}
          />
        </div>
        <div className="container-wide py-12 md:py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr),minmax(0,1fr)] items-start">
            <div className="space-y-6">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide ${heroBadgeClass}`}
              >
                <Sparkles size={14} className={isDarkTheme ? 'text-amber-300' : 'text-sky-500'} />
                Covoiturage harmonisé
              </span>
              <h1 className={`text-3xl md:text-4xl font-bold leading-tight ${heroTitleColor}`}>
                {heroMessage}
              </h1>
              <p className={`text-base max-w-xl ${heroTextColor}`}>
                Coordonne tes trajets, retrouve ton historique et partage tes préférences de confort
                avec une interface cohérente entre web et mobile.
              </p>
              {showTips && (
                <ul className={`grid gap-3 sm:grid-cols-2 text-sm ${heroTextColor}`}>
                  <li className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${heroCardClass}`}>
                    <span
                      className={`mt-1 grid h-10 w-10 place-items-center rounded-xl ${
                        isDarkTheme ? 'bg-white/15 text-amber-200' : 'bg-sky-500/15 text-sky-600'
                      }`}
                    >
                      <ShieldCheck size={18} />
                    </span>
                    <div>
                      <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                        Comptes sécurisés
                      </p>
                      <p>Mot de passe ou code Gmail : choisis la méthode qui te convient.</p>
                    </div>
                  </li>
                  <li className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${heroCardClass}`}>
                    <span
                      className={`mt-1 grid h-10 w-10 place-items-center rounded-xl ${
                        isDarkTheme ? 'bg-white/15 text-amber-200' : 'bg-sky-500/15 text-sky-600'
                      }`}
                    >
                      <Clock size={18} />
                    </span>
                    <div>
                      <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                        OTP instantané
                      </p>
                      <p>Reçois un code Gmail en quelques secondes pour valider ton accès.</p>
                    </div>
                  </li>
                  <li className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${heroCardClass} sm:col-span-2`}>
                    <span
                      className={`mt-1 grid h-10 w-10 place-items-center rounded-xl ${
                        isDarkTheme ? 'bg-white/15 text-amber-200' : 'bg-sky-500/15'
                      }`}
                    >
                      <GmailLogo className={`h-6 w-6 ${isDarkTheme ? 'text-amber-300' : ''}`} />
                    </span>
                    <div>
                      <p className={`font-semibold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                        Synchronisation Gmail
                      </p>
                      <p>Un design cohérent de la boîte mail à l’application pour éviter toute surprise.</p>
                    </div>
                  </li>
                </ul>
              )}
            </div>
            <div className="relative lg:pl-6">
              <SearchBar
                from={form.from}
                fromLabel={form.fromLabel}
                fromMeta={form.fromMeta}
                to={form.to}
                toLabel={form.toLabel}
                toMeta={form.toMeta}
                date={form.date}
                seats={form.seats}
                priceMax={form.priceMax}
                departureAfter={form.departureAfter}
                departureBefore={form.departureBefore}
                sort={form.sort}
                loading={loading}
                onChange={onChange}
                onSubmit={onSubmit}
              />
              {quickActionItems.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  {quickActionItems.map((action) => (
                    <Link
                      key={action.id}
                      to={action.to}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-600 hover:bg-slate-100"
                    >
                      <Wand2 size={14} className="text-sky-500" />
                      {action.label}
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm">
                  <ShieldCheck size={14} className="text-sky-500" />
                  Historique et préférences sauvegardés
                </span>
                <span className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 shadow-sm">
                  <GmailLogo className="h-4 w-4" />
                  Connexion Gmail supportée
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
      {favoriteRoutes.length > 0 && (
        <section className="container-wide mt-4">
          <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur px-4 py-5 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Star size={18} className="text-amber-500" />
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  Trajets favoris
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Préremplis instantanément ta recherche avec les itinéraires que tu utilises souvent.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {favoriteRoutes.map((route, index) => (
                <button
                  key={`${route.from}-${route.to}-${index}`}
                  type="button"
                  onClick={() => prefillFavoriteRoute(route)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                >
                  {route.from} → {route.to}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container-wide pb-14 space-y-6">
        {/* Erreur */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3">
            {error}
          </div>
        )}

        {/* Résumé de recherche */}
        {lastSearch && !loading && (
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{results.length}</span> résultat(s)
            &nbsp;pour <span className="font-medium">{displayLastFrom}</span> →{' '}
            <span className="font-medium">{displayLastTo}</span>
            {lastSearch.date ? ` • ${new Date(lastSearch.date).toLocaleDateString()}` : ''}
            {lastSearch.seats ? ` • ${lastSearch.seats} siège(s)` : ''}
          </div>
        )}

        {/* Chargement */}
        {loading && (
          <div className="card p-4 animate-pulse">Recherche en cours…</div>
        )}

        {/* Résultats */}
        {!loading && results.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {results.map(r => (
              <RideCard
                key={r.rideId}
                {...r}
                onBook={() => nav(`/booking/${r.rideId}`)}
                onDetails={() => nav(`/ride/${r.rideId}`)}
              />
            ))}
          </div>
        )}

        {/* Aucun résultat */}
        {!loading && !error && results.length === 0 && lastSearch && (
          <div className="card p-5">
            Aucun trajet trouvé. Essaie d’ajuster la date ou la ville.
          </div>
        )}

        {/* État initial (pas encore de recherche) */}
        {!lastSearch && !loading && results.length === 0 && !error && (
          <div className="card p-5 text-slate-600">
            Renseigne un <span className="font-medium text-slate-900">départ</span>, une{' '}
            <span className="font-medium text-slate-900">arrivée</span> et une{' '}
            <span className="font-medium text-slate-900">date</span> pour voir les trajets disponibles.
          </div>
        )}
      </section>
    </div>
  );
}
