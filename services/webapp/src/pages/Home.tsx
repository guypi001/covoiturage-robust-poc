// src/pages/Home.tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, ShieldCheck, Clock, Star, Wand2, ArrowRight } from 'lucide-react';
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
  const nightMode = theme === 'night';
  const surfaceClass = themeStyle.surface;
  const baseTextClass = nightMode ? 'text-slate-300' : 'text-slate-600';
  const primaryTextClass = nightMode ? 'text-white' : 'text-slate-900';
  const panelBaseClass =
    nightMode
      ? 'rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur px-4 py-4 text-slate-200'
      : 'rounded-xl border border-slate-200 bg-white px-4 py-4 text-slate-600 shadow-sm';
  const panelMutedClass =
    nightMode
      ? 'rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur px-4 py-4 text-slate-300'
      : 'rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-600';
  const errorAlertClass =
    nightMode
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

  const insightCardBase = nightMode
    ? 'border-slate-800 bg-slate-900/60 text-slate-100 shadow-black/20'
    : 'border-white/60 bg-white/80 text-slate-900 shadow-sky-100/50 backdrop-blur';
  const insightLabelClass = nightMode ? 'text-slate-400' : 'text-slate-500';
  const insightValueClass = nightMode ? 'text-white' : 'text-slate-900';
  const insightHintClass = nightMode ? 'text-slate-400' : 'text-slate-500';

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
  const totalResults = results.length;
  const lastSearchDateLabel = lastSearch?.date
    ? new Date(lastSearch.date).toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : 'Flexible';

  const usageInsights = [
    {
      label: 'Dernière recherche',
      value: lastSearch ? `${displayLastFrom || '—'} → ${displayLastTo || '—'}` : 'Pas encore lancée',
      hint: lastSearch ? `Le ${lastSearchDateLabel}` : 'Renseigne ton trajet pour suivre les disponibilités',
    },
    {
      label: 'Trajets trouvés',
      value: totalResults.toString().padStart(2, '0'),
      hint: totalResults > 0 ? 'Résultats mis à jour en temps réel' : 'Publie un trajet ou ajuste les filtres',
    },
    {
      label: 'Places souhaitées',
      value: lastSearch?.seats ? `${lastSearch.seats} siège(s)` : 'Non précisé',
      hint: lastSearch?.seats ? 'Tu peux augmenter pour un groupe' : 'Choisis le nombre de passagers',
    },
    {
      label: 'Budget par siège',
      value: lastSearch?.priceMax ? `${lastSearch.priceMax.toLocaleString('fr-FR')} XOF` : 'Illimité',
      hint: lastSearch?.priceMax ? 'Filtré sur un plafond personnalisé' : 'Aucun plafond défini',
    },
  ];

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
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-950/5 via-white to-white">
      <section className="relative isolate overflow-hidden section-block pb-6">
        <div className={`absolute inset-0 -z-20 bg-gradient-to-br ${themeStyle.gradient}`} />
        {themeStyle.pattern && (
          <div className={`absolute inset-0 -z-10 opacity-80 ${themeStyle.pattern}`} />
        )}
        <div className="absolute inset-y-0 right-0 -z-10 hidden lg:block">
          <div className={`h-full w-72 translate-x-24 rounded-full blur-3xl ${themeStyle.glow}`} />
        </div>
        <div className="container-wide">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr),minmax(0,1fr)] items-start">
            <div className="space-y-6 md:space-y-8">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide ${heroTokens.badge}`}
              >
                <Sparkles size={14} className={heroTokens.badgeIcon} />
                Covoiturage harmonisé
              </span>
              <h1 className={`text-3xl md:text-4xl font-bold leading-tight ${heroTokens.title}`}>
                {heroMessage}
              </h1>
              <p className={`text-base max-w-2xl ${heroTokens.text}`}>
                Coordonne tes trajets, retrouve ton historique, visualise tes réservations et publie en
                deux minutes sur une interface pensée pour les trajets longue distance en Côte d’Ivoire.
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

              <div className="grid gap-4 sm:grid-cols-2">
                {usageInsights.map((insight) => (
                  <div
                    key={insight.label}
                    className={`rounded-2xl px-4 py-3 ${insightCardBase}`}
                  >
                    <p className={`text-[11px] uppercase tracking-wide ${insightLabelClass}`}>
                      {insight.label}
                    </p>
                    <p className={`text-lg font-semibold ${insightValueClass}`}>{insight.value}</p>
                    <p className={`text-xs ${insightHintClass}`}>{insight.hint}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative lg:pl-6">
              <div className="rounded-3xl border border-white/30 bg-white/90 shadow-2xl shadow-sky-200/40 backdrop-blur-lg p-4 sm:p-6">
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
                  <div className="mt-5 flex flex-wrap gap-2 text-xs">
                    {quickActionItems.map((action) => (
                      <Link
                        key={action.id}
                        to={action.to}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 transition ${quickTokens.active}`}
                      >
                        <Wand2 size={14} className={heroTokens.iconColor} />
                        {action.label}
                      </Link>
                    ))}
                  </div>
                )}

                <div className={`mt-4 flex flex-wrap gap-2 text-xs ${baseTextClass}`}>
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
                  <Link
                    to="/my-trips"
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-slate-600 hover:text-sky-600"
                  >
                    Accéder à mes réservations
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block--compact pt-0 pb-12">
        <div className="container-wide grid gap-8 lg:grid-cols-[minmax(0,1fr),320px]">
          <div className="space-y-5">
            {error && <div className={errorAlertClass}>{error}</div>}

            {lastSearch && !loading && (
              <div className={`flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm ${baseTextClass}`}>
                <span className={`font-semibold ${primaryTextClass}`}>
                  {totalResults} trajet(s)
                </span>
                <span>
                  {displayLastFrom} → {displayLastTo}
                </span>
                {lastSearch.date && <span>• {new Date(lastSearch.date).toLocaleDateString()}</span>}
                {lastSearch.seats && <span>• {lastSearch.seats} siège(s)</span>}
              </div>
            )}

            {loading && (
              <div className={`${panelMutedClass} animate-pulse`}>Recherche en cours…</div>
            )}

            {!loading && totalResults > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {results.map((ride) => (
                  <RideCard
                    key={ride.rideId}
                    {...ride}
                    onBook={() => nav(`/booking/${ride.rideId}`)}
                    onDetails={() => nav(`/ride/${ride.rideId}`)}
                  />
                ))}
              </div>
            )}

            {!loading && !error && totalResults === 0 && lastSearch && (
              <div className={`${panelBaseClass} transition`}>
                Aucun trajet ne correspond encore à cette recherche. Essaie d’ajuster l’horaire ou
                publie ton propre trajet pour informer la communauté.
              </div>
            )}

            {!lastSearch && !loading && totalResults === 0 && !error && (
              <div className={`${panelBaseClass} transition`}>
                Renseigne un <span className={`font-medium ${primaryTextClass}`}>départ</span>, une{' '}
                <span className={`font-medium ${primaryTextClass}`}>arrivée</span> et une{' '}
                <span className={`font-medium ${primaryTextClass}`}>date</span> pour voir les trajets disponibles.
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className={`rounded-2xl px-4 py-5 ${surfaceClass}`}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Star size={18} className={heroTokens.iconColor} />
                  <h2 className={`text-sm font-semibold uppercase tracking-wide ${heroTokens.sectionTitle}`}>
                    Trajets favoris
                  </h2>
                </div>
                <p className={`text-xs ${heroTokens.cardText}`}>
                  Préremplis la recherche avec tes itinéraires fréquents.
                </p>
              </div>
              <div className="mt-3 scroll-chips text-sm sm:flex sm:flex-wrap sm:gap-2">
                {favoriteRoutes.length > 0 ? (
                  favoriteRoutes.map((route, index) => (
                    <button
                      key={`${route.from}-${route.to}-${index}`}
                      type="button"
                      onClick={() => prefillFavoriteRoute(route)}
                      className={`shrink-0 rounded-xl px-4 py-2 transition ${quickTokens.inactive}`}
                    >
                      {route.from} → {route.to}
                    </button>
                  ))
                ) : (
                  <p className={`text-xs ${heroTokens.cardText}`}>
                    Ajoute des favoris depuis tes préférences pour les retrouver ici.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Besoin de publier ?
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Utilise la page dédiée pour créer un trajet en masse, ajuster tes places et
                prévenir les passagers.
              </p>
              <Link to="/create" className="mt-4 inline-flex items-center gap-2 text-sm text-sky-600">
                Publier un trajet
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-5 text-white shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
                Nouveauté
              </p>
              <p className="mt-2 text-sm text-white/90">
                Consulter tes réservations confirmées, passées et à venir depuis un espace dédié.
              </p>
              <Link
                to="/my-trips"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
              >
                Ouvrir "Mes trajets"
                <ArrowRight size={14} />
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
