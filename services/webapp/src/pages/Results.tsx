import { useEffect } from 'react';
import { searchRides } from '../api';
import { useApp } from '../store';
import RideCard from '../components/RideCard';

export function Results() {
  const { lastSearch, results, setResults, setLoading, loading, error, setError } = useApp();

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

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {results.map(r => <RideCard key={r.rideId} r={r} />)}
    </div>
  );
}
