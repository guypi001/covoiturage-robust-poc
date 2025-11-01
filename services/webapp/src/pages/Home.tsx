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
import {
  HOME_THEME_STYLE,
  QUICK_ACTION_OPTIONS,
  type HomeThemeStyle,
} from '../constants/homePreferences';

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
  const themeStyle: HomeThemeStyle =
    HOME_THEME_STYLE[theme] ?? HOME_THEME_STYLE.default;
  const heroTokens = themeStyle.hero;
  const chipsStyle = themeStyle.chips;
  const quickTokens = themeStyle.quickActions;
  const surfaceClass = themeStyle.surface;
  const baseTextClass = theme === 'night' ? 'text-slate-300' : 'text-slate-600';
  const primaryTextClass = theme === 'night' ? 'text-white' : 'text-slate-900';
  const panelBaseClass =
    theme === 'night'
      ? 'rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur px-4 py-4 text-slate-200'
      : 'rounded-xl border border-slate-200 bg-white px-4 py-4 text-slate-600 shadow-sm';
  const panelMutedClass =
    theme === 'night'
      ? 'rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur px-4 py-4 text-slate-300'
      : 'rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-600';
  const errorAlertClass =
    theme === 'night'
      ? 'rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-red-200 shadow-lg shadow-red-900/30'
      : 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700';
  const heroMessage = homePreferences?.heroMessage?.trim() ||
    'Voyage sereinement entre les villes de Côte d’Ivoire';
  const showTips = homePreferences?.showTips ?? true;
  const quickActions = homePreferences?.quickActions ?? [];
  const favoriteRoutes = homePreferences?.favoriteRoutes ?? [];
  const quickActionItems = QUICK_ACTION_OPTIONS.filter(
    (option) =>
      quickActions.includes(option.id) &&
      (option.id !== 'manage_fleet' || account?.type === 'COMPANY'),
  );

  const heroHighlights = [
    {
      title: 'Sécurité renforcée',
      text: 'Mots de passe, OTP Gmail et contrôle des sessions pour des comptes sereins.',
      renderIcon: (className: string) => <ShieldCheck size={20} className={className} />,
    },
    {
      title: 'Recherche intelligente',
      text: 'Filtre tes trajets par prix, créneaux horaires ou nombre de places en un clic.',
      renderIcon: (className: string) => <Clock size={20} className={className} />,
    },
    {
      title: 'Profil connecté',
      text: 'Avatar, préférences et page d’accueil synchronisés et éditables par les admins.',
      renderIcon: (_className: string) => <GmailLogo className="h-6 w-6" />,
    },
  ];

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
        <div className={`absolute inset-0 -z-20 bg-gradient-to-br ${themeStyle.gradient}`} />
        {themeStyle.pattern && (
          <div className={`absolute inset-0 -z-10 opacity-80 ${themeStyle.pattern}`} />
        )}
        <div className="absolute inset-y-0 right-0 -z-10 hidden lg:block">
          <div className={`h-full w-72 translate-x-24 rounded-full blur-3xl ${themeStyle.glow}`} />
        </div>
        <div className="container-wide py-12 md:py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr),minmax(0,1fr)] items-start">
            <div className="space-y-6">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide ${heroTokens.badge}`}
              >
                <Sparkles size={14} className={heroTokens.badgeIcon} />
                Covoiturage harmonisé
              </span>
              <h1 className={`text-3xl md:text-4xl font-bold leading-tight ${heroTokens.title}`}>
                {heroMessage}
              </h1>
              <p className={`text-base max-w-xl ${heroTokens.text}`}>
                Coordonne tes trajets, retrouve ton historique et partage tes préférences de confort
                avec une interface cohérente entre web et mobile.
              </p>
              {showTips && (
                <ul className="grid gap-3 sm:grid-cols-3 text-sm">
                  {heroHighlights.map((feature) => (
                    <li
                      key={feature.title}
                      className={`flex flex-col gap-3 rounded-2xl px-4 py-4 ${heroTokens.card}`}
                    >
                      <span
                        className={`grid h-11 w-11 place-items-center rounded-xl ${heroTokens.iconWrap}`}
                      >
                        {feature.renderIcon(heroTokens.iconColor)}
                      </span>
                      <div className="space-y-1">
                        <p className={`text-sm font-semibold ${heroTokens.sectionTitle}`}>
                          {feature.title}
                        </p>
                        <p className={`text-sm leading-snug ${heroTokens.cardText}`}>
                          {feature.text}
                        </p>
                      </div>
                    </li>
                  ))}
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
                theme={theme}
                searchTheme={themeStyle.search}
              />
              {quickActionItems.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  {quickActionItems.map((action) => (
                    <Link
                      key={action.id}
                      to={action.to}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 transition ${quickTokens.active}`}
                    >
                      <Wand2 size={14} className={heroTokens.iconColor} />
                      {action.label}
                    </Link>
                  ))}
                </div>
              )}
              <div className={`mt-4 flex flex-wrap items-center gap-3 text-xs ${baseTextClass}`}>
                <span
                  className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 shadow-sm ${chipsStyle.accent}`}
                >
                  <ShieldCheck size={14} className={heroTokens.iconColor} />
                  Historique et préférences sauvegardés
                </span>
                <span
                  className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 shadow-sm ${chipsStyle.neutral}`}
                >
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
          <div className={`rounded-2xl px-4 py-5 ${surfaceClass}`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Star size={18} className={heroTokens.iconColor} />
                <h2 className={`text-sm font-semibold uppercase tracking-wide ${heroTokens.sectionTitle}`}>
                  Trajets favoris
                </h2>
              </div>
              <p className={`text-xs ${heroTokens.cardText}`}>
                Préremplis instantanément ta recherche avec les itinéraires que tu utilises souvent.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {favoriteRoutes.map((route, index) => (
                <button
                  key={`${route.from}-${route.to}-${index}`}
                  type="button"
                  onClick={() => prefillFavoriteRoute(route)}
                  className={`rounded-xl px-4 py-2 text-sm transition ${quickTokens.inactive}`}
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
          <div className={errorAlertClass}>{error}</div>
        )}

        {/* Résumé de recherche */}
        {lastSearch && !loading && (
          <div className={`text-sm ${baseTextClass}`}>
            <span className={`font-semibold ${primaryTextClass}`}>{results.length}</span> résultat(s)
            &nbsp;pour <span className={`font-semibold ${primaryTextClass}`}>{displayLastFrom}</span> →{' '}
            <span className={`font-semibold ${primaryTextClass}`}>{displayLastTo}</span>
            {lastSearch.date ? ` • ${new Date(lastSearch.date).toLocaleDateString()}` : ''}
            {lastSearch.seats ? ` • ${lastSearch.seats} siège(s)` : ''}
          </div>
        )}

        {/* Chargement */}
        {loading && (
          <div className={`${panelMutedClass} animate-pulse`}>Recherche en cours…</div>
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
          <div className={`${panelBaseClass} transition`}>
            Aucun trajet trouvé. Essaie d’ajuster la date ou la ville.
          </div>
        )}

        {/* État initial (pas encore de recherche) */}
        {!lastSearch && !loading && results.length === 0 && !error && (
          <div className={`${panelBaseClass} transition`}>
            Renseigne un <span className={`font-medium ${primaryTextClass}`}>départ</span>, une{' '}
            <span className={`font-medium ${primaryTextClass}`}>arrivée</span> et une{' '}
            <span className={`font-medium ${primaryTextClass}`}>date</span> pour voir les trajets disponibles.
          </div>
        )}
      </section>
    </div>
  );
}
