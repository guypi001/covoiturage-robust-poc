import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { useMemo, useState } from 'react';
import { createBooking } from '../api';

export function Booking() {
  const { rideId } = useParams();
  const nav = useNavigate();
  const { results, passengerId } = useApp();
  const r = useMemo(() => results.find(x => x.rideId === rideId), [rideId, results]);
  const [seats, setSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>();

  if (!r) return <div className="glass p-6 rounded-2xl">Trajet introuvable.</div>;

  const amount = seats * r.pricePerSeat;

  async function submit() {
    try {
      setLoading(true); setMsg(undefined);
      const saved = await createBooking({ rideId: r.rideId, passengerId, seats });
      setMsg(`Réservation ${saved.id} créée. Montant ${saved.amount} XOF. Statut: ${saved.status}.`);
    } catch (e:any) {
      setMsg(e?.message || 'Erreur pendant la réservation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass p-6 rounded-2xl space-y-4">
      <div className="text-xl font-semibold">Réserver — {r.originCity} → {r.destinationCity}</div>
      <div className="flex items-center gap-3">
        <label className="text-white/70">Sièges:</label>
        <input type="number" min={1} max={r.seatsAvailable} value={seats}
          onChange={e=>setSeats(Math.max(1, Math.min(Number(e.target.value||1), r.seatsAvailable)) )}
          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 w-24" />
      </div>
      <div className="text-emerald-300 font-semibold">Total: {amount} XOF</div>
      <div className="flex items-center gap-3">
        <button disabled={loading} onClick={submit}
          className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
          {loading ? 'En cours…' : 'Confirmer'}
        </button>
        <button className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15" onClick={()=>nav(-1)}>Annuler</button>
      </div>
      {msg && <div className="text-white/80">{msg}</div>}
    </div>
  );
}
