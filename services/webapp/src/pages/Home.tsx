import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar, { SearchPatch } from '../components/SearchBar';
import { useApp } from '../store';
import { searchRides } from '../api';
import RideCard from '../components/RideCard';

export default function Home() {
  const nav = useNavigate();
  const {
    lastSearch, setSearch, setResults, setLoading, setError, loading,
    results, error,
  } = useApp();

  const [form, setForm] = useState({
    from: lastSearch?.from ?? '',
    to: lastSearch?.to ?? '',
    date: lastSearch?.date ?? '',
  });

  function onChange(p: SearchPatch) { setForm(prev => ({ ...prev, ...p })); }

  async function onSubmit() {
    if (!form.from || !form.to) {
      setError('Renseigne départ et arrivée');
      return;
    }
    setSearch(form);
    setLoading(true);
    setError(undefined);
    try {
      const data = await searchRides(form);
      setResults(data);
    } catch (e:any) {
      setError(e?.message ?? 'Erreur réseau');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-[calc(100vh-56px)]">
      {/* HERO */}
      <section className="relative">
        <div
          className="h-[320px] md:h-[380px] bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?q=80&w=1800&auto=format&fit=crop')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/10 to-white/80" />
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-6xl mx-auto w-full px-4">
            <h1 className="hero-title text-4xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow">
              Vous avez vos plans, on a vos bons plans.
            </h1>
          </div>
        </div>

        {/* Barre de recherche posée en bas du hero */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 w-full max-w-6xl px-4">
          <SearchBar
            from={form.from}
            to={form.to}
            date={form.date}
            loading={loading}
            onChange={onChange}
            onSubmit={onSubmit}
          />
        </div>
      </section>

      {/* Contenu sous le hero */}
      <div className="max-w-6xl mx-auto px-4 pt-20 pb-10 space-y-6">
        {/* Infos / erreurs */}
        {error && (
          <div className="border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-3">
            {error}
          </div>
        )}
        {lastSearch && !loading && (
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{results.length}</span> résultat(s)
            &nbsp;pour <span className="font-medium">{lastSearch.from}</span> → <span className="font-medium">{lastSearch.to}</span>
            {lastSearch.date ? ` • ${new Date(lastSearch.date).toLocaleDateString()}` : ''}
          </div>
        )}

        {/* Résultats */}
        {loading && (
          <div className="card p-4 animate-pulse">Recherche en cours…</div>
        )}

        {!loading && results.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {results.map(r => (
              <RideCard key={r.rideId} {...r} onBook={() => nav(`/booking/${r.rideId}`)} />
            ))}
          </div>
        )}

        {!loading && !error && results.length === 0 && lastSearch && (
          <div className="card p-5">Aucun trajet trouvé.</div>
        )}
      </div>
    </div>
  );
}
