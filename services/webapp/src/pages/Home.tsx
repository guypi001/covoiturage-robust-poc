// src/pages/Home.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar, { SearchPatch } from '../components/SearchBar';
import RideCard from '../components/RideCard';
import { useApp } from '../store';
import { searchRides } from '../api';

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

  // État local du formulaire (prérempli depuis la dernière recherche)
  const [form, setForm] = useState({
    from: lastSearch?.from ?? '',
    to: lastSearch?.to ?? '',
    date: lastSearch?.date ?? '',
    seats: lastSearch?.seats ?? 1,
  });

  // Patch partiel (vient de SearchBar)
  function onChange(patch: SearchPatch) {
    setForm(prev => ({ ...prev, ...patch }));
  }

  // Lance la recherche et affiche les résultats sur la même page
  async function onSubmit() {
    if (!form.from || !form.to) {
      setError('Renseigne départ et arrivée');
      return;
    }
    if (!form.seats || form.seats <= 0) {
      setError('Nombre de sièges invalide');
      return;
    }
    setSearch(form);
    setLoading(true);
    setError(undefined);
    try {
      const data = await searchRides(form);
      setResults(data);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)]">
      {/* Barre de recherche en haut, sticky et claire */}
      <section className="container-wide pt-6 md:pt-8">
        <SearchBar
          from={form.from}
          to={form.to}
          date={form.date}
          seats={form.seats}
          loading={loading}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      </section>

      {/* Corps : résumé + liste de résultats */}
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
            &nbsp;pour <span className="font-medium">{lastSearch.from}</span> →{' '}
            <span className="font-medium">{lastSearch.to}</span>
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
