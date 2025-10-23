// src/pages/CreateRide.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRide } from '../api';
import { motion } from 'framer-motion';
import CityAutocomplete from '../components/CityAutocomplete';

export default function CreateRide() {
  const [originCity, setOriginCity] = useState('Abidjan');
  const [destinationCity, setDestinationCity] = useState('Yamoussoukro');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [pricePerSeat, setPricePerSeat] = useState(2000);
  const [seatsTotal, setSeatsTotal] = useState(3);
  const [driverId, setDriverId] = useState('drv-seed');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  const toISO = (d: string, t: string) => {
    if (!d || !t) return '';
    const [Y, M, D] = d.split('-').map(Number);
    const [h, m] = t.split(':').map(Number);
    return new Date(Date.UTC(Y, M - 1, D, h, m, 0)).toISOString();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const departureAt = toISO(date, time);
    if (!departureAt) return setErr('Date/heure invalides');

    try {
      setLoading(true);
      await createRide({
        originCity,
        destinationCity,
        departureAt,
        pricePerSeat: Number(pricePerSeat),
        seatsTotal: Number(seatsTotal),
        driverId,
      });
      navigate(`/results?from=${encodeURIComponent(originCity)}&to=${encodeURIComponent(destinationCity)}`);
    } catch (e: any) {
      setErr(e?.message || 'Échec de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-zinc-900 to-black text-zinc-100">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6">
          Proposer un trajet ✨
        </motion.h1>

        <motion.form onSubmit={submit} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/60 backdrop-blur rounded-2xl p-5 md:p-7 shadow-xl shadow-black/30 border border-zinc-800 space-y-5">

          <div className="grid md:grid-cols-2 gap-4">
            <CityAutocomplete
              label="Départ"
              placeholder="Ville de départ"
              value={originCity}
              onChange={setOriginCity}
              onSelect={setOriginCity}
            />
            <CityAutocomplete
              label="Arrivée"
              placeholder="Ville d’arrivée"
              value={destinationCity}
              onChange={setDestinationCity}
              onSelect={setDestinationCity}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl bg-zinc-800/80 border border-zinc-700 px-4 py-3 outline-none focus:ring-2 ring-indigo-500" required />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Heure</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl bg-zinc-800/80 border border-zinc-700 px-4 py-3 outline-none focus:ring-2 ring-indigo-500" required />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Prix / siège (XOF)</label>
              <input type="number" min={0} step={100} value={pricePerSeat}
                onChange={(e) => setPricePerSeat(Number(e.target.value))}
                className="w-full rounded-xl bg-zinc-800/80 border border-zinc-700 px-4 py-3 outline-none focus:ring-2 ring-indigo-500" required />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Sièges</label>
              <input type="number" min={1} max={7} value={seatsTotal}
                onChange={(e) => setSeatsTotal(Number(e.target.value))}
                className="w-full rounded-xl bg-zinc-800/80 border border-zinc-700 px-4 py-3 outline-none focus:ring-2 ring-indigo-500" required />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Driver ID (PoC)</label>
              <input value={driverId} onChange={(e) => setDriverId(e.target.value)}
                className="w-full rounded-xl bg-zinc-800/80 border border-zinc-700 px-4 py-3 outline-none focus:ring-2 ring-indigo-500" required />
            </div>
          </div>

          {err && <div className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-xl px-4 py-3">{err}</div>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={loading}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-3 font-semibold shadow-lg shadow-indigo-900/40 transition">
              {loading ? 'Publication…' : 'Publier le trajet'}
            </button>
            <span className="text-xs text-zinc-500">
              * Au clic, on crée le trajet côté <code>ride</code> puis on revient sur la recherche.
            </span>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
