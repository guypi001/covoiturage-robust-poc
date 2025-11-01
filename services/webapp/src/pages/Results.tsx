import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchRides } from '../api';
import { useApp } from '../store';
import RideCard from '../components/RideCard';
import { HOME_THEME_STYLE } from '../constants/homePreferences';

export function Results() {
  const nav = useNavigate();
  const { lastSearch, results, setResults, setLoading, loading, error, setError } = useApp();
  const account = useApp((state) => state.account);
  const theme = account?.homePreferences?.theme ?? 'default';
  const themeStyle = HOME_THEME_STYLE[theme] ?? HOME_THEME_STYLE.default;
  const chipsStyle = themeStyle.chips;
  const baseTextClass = theme === 'night' ? 'text-slate-300' : 'text-slate-600';

  useEffect(() => {
    (async () => {
      if (!lastSearch) return;
      try {
        setLoading(true); setError(undefined);
        const data = await searchRides(lastSearch);
        setResults(data);
      } catch (e:any) {
        setError(e?.message || 'Erreur de recherche');
      } finally { setLoading(false); }
    })();
  }, [lastSearch]);

  if (!lastSearch) return <div className="glass p-6 rounded-2xl">Lance d’abord une recherche 🙂</div>;
  if (loading) return <div className="glass p-6 rounded-2xl animate-pulse">Chargement…</div>;
  if (error) return <div className="glass p-6 rounded-2xl text-red-300">{error}</div>;
  if (results.length === 0) return <div className="glass p-6 rounded-2xl">Aucun trajet trouvé.</div>;

  const chips: string[] = [];
  if (lastSearch.priceMax) chips.push(`≤ ${lastSearch.priceMax.toLocaleString()} XOF`);
  if (lastSearch.departureAfter || lastSearch.departureBefore) {
    const after = lastSearch.departureAfter ? `après ${lastSearch.departureAfter}` : '';
    const before = lastSearch.departureBefore ? `avant ${lastSearch.departureBefore}` : '';
    chips.push(`Départ ${[after, before].filter(Boolean).join(' ')}`.trim());
  }
  const sortLabel =
    lastSearch.sort === 'cheapest'
      ? 'Tri : moins cher'
      : lastSearch.sort === 'seats'
        ? 'Tri : plus de places'
        : 'Tri : plus tôt';

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap gap-2 text-xs ${baseTextClass}`}>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${chipsStyle.neutral}`}>
          {lastSearch.from} → {lastSearch.to}
        </span>
        {chips.map((chip) => (
          <span
            key={chip}
            className={`inline-flex items-center rounded-full px-3 py-1 ${chipsStyle.accent}`}
          >
            {chip}
          </span>
        ))}
        <span className={`inline-flex items-center rounded-full px-3 py-1 ${chipsStyle.neutral}`}>
          {sortLabel}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {results.map((r) => (
          <RideCard
            key={r.rideId}
            {...r}
            onBook={() => nav(`/booking/${r.rideId}`)}
            onDetails={() => nav(`/ride/${r.rideId}`)}
          />
        ))}
      </div>
    </div>
  );
}
