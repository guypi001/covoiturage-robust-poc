import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Filter, RefreshCw, MapPin, Clock, SlidersHorizontal, AlertCircle, RotateCcw } from 'lucide-react';
import { useApp } from '../store';
import RideCard from '../components/RideCard';
import { HOME_THEME_STYLE } from '../constants/homePreferences';
import { useRideContact } from '../hooks/useRideContact';
import { useRideSearch } from '../hooks/useRideSearch';

export function Results() {
  const nav = useNavigate();
  const { lastSearch, results, setResults, setLoading, loading, error, setError, setSearch } = useApp();
  const account = useApp((state) => state.account);
  const theme = account?.homePreferences?.theme ?? 'default';
  const themeStyle = HOME_THEME_STYLE[theme] ?? HOME_THEME_STYLE.default;
  const chipsStyle = themeStyle.chips;
  const baseTextClass = theme === 'night' ? 'text-slate-300' : 'text-slate-600';
  const { contactDriver, contactingRideId, contactError, clearContactError } = useRideContact();
  const { execute: runRideSearch, isPending: ridePending } = useRideSearch();
  const deferredResults = useDeferredValue(results);

  const draftFromSearch = useCallback(
    () => ({
      priceMax: lastSearch?.priceMax ? String(lastSearch.priceMax) : '',
      departureAfter: lastSearch?.departureAfter ?? '',
      departureBefore: lastSearch?.departureBefore ?? '',
      seats: lastSearch?.seats ?? 1,
      sort: lastSearch?.sort ?? 'soonest',
    }),
    [lastSearch],
  );

  const [filterDraft, setFilterDraft] = useState(() => draftFromSearch());

  useEffect(() => {
    setFilterDraft(draftFromSearch());
  }, [draftFromSearch]);

  const performSearch = useCallback(
    async (nextSearch: typeof lastSearch) => {
      if (!nextSearch) return;
      setSearch(nextSearch);
      setLoading(true);
      setError(undefined);
      const result = await runRideSearch(nextSearch, {
        onSuccess: (rides) => setResults(rides),
        onError: (message) => setError(message),
      });
      if (!result.aborted) {
        setLoading(false);
      }
    },
    [runRideSearch, setSearch, setLoading, setError, setResults],
  );

  const refresh = useCallback(async () => {
    if (!lastSearch) return;
    await performSearch(lastSearch);
  }, [lastSearch, performSearch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!lastSearch) {
    return (
      <section className="py-14">
        <div className="container-wide">
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
            <MapPin className="mx-auto mb-4 h-10 w-10 text-slate-400" />
            <p className="text-lg font-semibold text-slate-900">Commence par définir ton trajet</p>
            <p className="mt-2 text-sm text-slate-500">
              Choisis un point de départ, une destination et une date depuis la page d’accueil pour voir
              les résultats détaillés ici.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
            >
              Ouvrir la recherche
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const sortLabel =
    lastSearch.sort === 'cheapest'
      ? 'Tri : moins cher'
      : lastSearch.sort === 'seats'
        ? 'Tri : plus de places'
        : 'Tri : plus tôt';

  const timeWindowChip = lastSearch.departureAfter || lastSearch.departureBefore;
  const totalResults = deferredResults.length;
  const hasResults = totalResults > 0;
  const isSearching = loading || ridePending;

  const normalizedDraft = useMemo(() => {
    const price = Number(filterDraft.priceMax);
    return {
      priceMax: filterDraft.priceMax && Number.isFinite(price) && price > 0 ? Math.floor(price) : undefined,
      departureAfter: filterDraft.departureAfter || undefined,
      departureBefore: filterDraft.departureBefore || undefined,
      seats: Math.max(1, filterDraft.seats || 1),
      sort: filterDraft.sort,
    };
  }, [filterDraft]);

  const filtersChanged = useMemo(() => {
    if (!lastSearch) return false;
    return (
      normalizedDraft.priceMax !== (lastSearch.priceMax ?? undefined) ||
      (normalizedDraft.departureAfter || undefined) !== (lastSearch.departureAfter ?? undefined) ||
      (normalizedDraft.departureBefore || undefined) !== (lastSearch.departureBefore ?? undefined) ||
      normalizedDraft.seats !== (lastSearch.seats ?? 1) ||
      normalizedDraft.sort !== (lastSearch.sort ?? 'soonest')
    );
  }, [lastSearch, normalizedDraft]);

  const applyFilters = async () => {
    if (!lastSearch) return;
    const nextSearch = {
      ...lastSearch,
      priceMax: normalizedDraft.priceMax,
      departureAfter: normalizedDraft.departureAfter,
      departureBefore: normalizedDraft.departureBefore,
      seats: normalizedDraft.seats,
      sort: normalizedDraft.sort,
    };
    await performSearch(nextSearch);
  };

  const resetFilters = () => {
    if (!lastSearch) return;
    setFilterDraft(draftFromSearch());
  };

  const sortOptions: Array<{ value: 'soonest' | 'cheapest' | 'seats'; label: string }> = [
    { value: 'soonest', label: 'Départ' },
    { value: 'cheapest', label: 'Moins cher' },
    { value: 'seats', label: 'Places' },
  ];

  return (
    <section className="py-8">
      <div className="container-wide space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[220px]">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trajet demandé</p>
              <p className="text-lg font-semibold text-slate-900">
                {lastSearch.from} → {lastSearch.to}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isSearching}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-600 disabled:opacity-50"
            >
              <RefreshCw size={14} />
              Actualiser
            </button>
          </div>

          <div className={`mt-4 flex flex-wrap gap-2 text-xs ${baseTextClass}`}>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${chipsStyle.neutral}`}>
              <MapPin size={12} />
              {lastSearch.from} → {lastSearch.to}
            </span>
            {lastSearch.date && (
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${chipsStyle.neutral}`}>
                <Clock size={12} /> {new Date(lastSearch.date).toLocaleDateString('fr-FR')}
              </span>
            )}
            {lastSearch.seats && (
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${chipsStyle.accent}`}>
                {lastSearch.seats} siège(s)
              </span>
            )}
            {lastSearch.priceMax && (
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${chipsStyle.accent}`}>
                Budget ≤ {lastSearch.priceMax.toLocaleString('fr-FR')} XOF
              </span>
            )}
            {timeWindowChip && (
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${chipsStyle.neutral}`}>
                <Filter size={12} />
                {lastSearch.departureAfter ? `Après ${lastSearch.departureAfter}` : ''}
                {lastSearch.departureBefore ? ` avant ${lastSearch.departureBefore}` : ''}
              </span>
            )}
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${chipsStyle.neutral}`}>
              {sortLabel}
            </span>
          </div>
        </div>

        {lastSearch && (
          <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ajuster en direct
                </p>
                <p className="text-sm text-slate-500">Modifie tri, budget ou horaires sans quitter la page.</p>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                disabled={!filtersChanged}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 disabled:opacity-40"
              >
                <RotateCcw size={14} /> Réinitialiser
              </button>
            </div>

            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void applyFilters();
              }}
            >
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priorité</p>
                <div className="flex flex-wrap gap-2">
                  {sortOptions.map((option) => {
                    const active = filterDraft.sort === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setFilterDraft((prev) => ({
                            ...prev,
                            sort: option.value,
                          }))
                        }
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? 'border-sky-200 bg-sky-50 text-sky-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <SlidersHorizontal size={12} /> {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))]">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500">Sièges</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={filterDraft.seats}
                    onChange={(e) =>
                      setFilterDraft((prev) => ({
                        ...prev,
                        seats: Math.max(1, Number(e.currentTarget.value) || 1),
                      }))
                    }
                    className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500">Budget max (XOF)</label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={filterDraft.priceMax}
                    onChange={(e) =>
                      setFilterDraft((prev) => ({
                        ...prev,
                        priceMax: e.currentTarget.value,
                      }))
                    }
                    className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                    placeholder="15 000"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500">Plage horaire</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="time"
                      value={filterDraft.departureAfter}
                      onChange={(e) =>
                        setFilterDraft((prev) => ({
                          ...prev,
                          departureAfter: e.currentTarget.value,
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                    />
                    <input
                      type="time"
                      value={filterDraft.departureBefore}
                      onChange={(e) =>
                        setFilterDraft((prev) => ({
                          ...prev,
                          departureBefore: e.currentTarget.value,
                        }))
                      }
                      className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={!filtersChanged || isSearching}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
                >
                  <SlidersHorizontal size={14} /> Appliquer
                </button>
                <p className="text-xs text-slate-500">
                  {filtersChanged ? 'Rafraîchit les résultats instantanément.' : 'Filtres appliqués.'}
                </p>
              </div>
            </form>
          </div>
        )}

        {contactError && (
          <ErrorBanner message={contactError} tone="warning" onDismiss={clearContactError} />
        )}

        {isSearching && (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="h-40 rounded-2xl border border-slate-100 bg-slate-50 animate-pulse" />
            ))}
          </div>
        )}

        {error && !isSearching && (
          <ErrorBanner message={error} tone="error" onDismiss={() => setError(undefined)} />
        )}

        {!isSearching && !error && hasResults && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {deferredResults.map((ride) => (
              <RideCard
                key={ride.rideId}
                {...ride}
                onBook={() => nav(`/booking/${ride.rideId}`)}
                onDetails={() => nav(`/ride/${ride.rideId}`)}
                onContact={account?.id && ride.driverId ? () => contactDriver(ride) : undefined}
                contactBusy={contactingRideId === ride.rideId}
                variant="dark"
                showPublisher={Boolean(account)}
              />
            ))}
          </div>
        )}

        {!isSearching && !error && !hasResults && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-600">
            <p className="font-semibold text-slate-900">Aucun trajet trouvé</p>
            <p className="mt-2 text-sm">
              Ajuste tes filtres ou propose un trajet pour informer les passagers intéressés.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm">
              <Link
                to="/"
                className="rounded-full border border-slate-200 px-4 py-2 text-slate-600 hover:border-sky-200 hover:text-sky-600"
              >
                Affiner la recherche
              </Link>
              <Link
                to="/create"
                className="rounded-full bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
              >
                Publier un trajet
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

type BannerTone = 'error' | 'warning';

function ErrorBanner({
  message,
  tone = 'error',
  onDismiss,
}: {
  message: string;
  tone?: BannerTone;
  onDismiss?: () => void;
}) {
  const toneMap: Record<BannerTone, string> = {
    error: 'border-rose-200 bg-rose-50 text-rose-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
  };
  return (
    <div className={`rounded-3xl border px-4 py-3 text-sm ${toneMap[tone]} flex items-start gap-3`}>
      <AlertCircle size={16} className="mt-0.5" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-semibold underline-offset-4 hover:underline"
        >
          OK
        </button>
      )}
    </div>
  );
}
