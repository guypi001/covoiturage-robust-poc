import { useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Filter, RefreshCw, MapPin, Clock } from 'lucide-react';
import { searchRides } from '../api';
import { useApp } from '../store';
import RideCard from '../components/RideCard';
import { HOME_THEME_STYLE } from '../constants/homePreferences';
import { useRideContact } from '../hooks/useRideContact';

export function Results() {
  const nav = useNavigate();
  const { lastSearch, results, setResults, setLoading, loading, error, setError } = useApp();
  const account = useApp((state) => state.account);
  const theme = account?.homePreferences?.theme ?? 'default';
  const themeStyle = HOME_THEME_STYLE[theme] ?? HOME_THEME_STYLE.default;
  const chipsStyle = themeStyle.chips;
  const baseTextClass = theme === 'night' ? 'text-slate-300' : 'text-slate-600';
  const hasResults = results.length > 0;
  const { contactDriver, contactingRideId, contactError, clearContactError } = useRideContact();

  const refresh = useCallback(async () => {
    if (!lastSearch) return;
    try {
      setLoading(true);
      setError(undefined);
      const data = await searchRides(lastSearch);
      setResults(data);
    } catch (e: any) {
      setError(e?.message || 'Erreur de recherche');
    } finally {
      setLoading(false);
    }
  }, [lastSearch, setError, setLoading, setResults]);

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
              disabled={loading}
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

        {contactError && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start justify-between gap-4">
            <span>{contactError}</span>
            <button type="button" onClick={clearContactError} className="text-xs font-semibold">
              OK
            </button>
          </div>
        )}

        {loading && (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="h-40 rounded-2xl border border-slate-100 bg-slate-50 animate-pulse" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && !error && hasResults && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.map((ride) => (
              <RideCard
                key={ride.rideId}
                {...ride}
                onBook={() => nav(`/booking/${ride.rideId}`)}
                onDetails={() => nav(`/ride/${ride.rideId}`)}
                onContact={account?.id && ride.driverId ? () => contactDriver(ride) : undefined}
                contactBusy={contactingRideId === ride.rideId}
                variant="dark"
              />
            ))}
          </div>
        )}

        {!loading && !error && !hasResults && (
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
