import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../store';

export function RideDetail() {
  const { rideId } = useParams();
  const nav = useNavigate();
  const r = useApp.getState().results.find(x => x.rideId === rideId);

  if (!r) return <div className="glass p-6 rounded-2xl">Trajet introuvable (reviens via la recherche).</div>;

  const dt = new Date(r.departureAt).toLocaleString();

  return (
    <div className="glass p-6 rounded-2xl space-y-4">
      <div className="text-2xl font-semibold">{r.originCity} → {r.destinationCity}</div>
      <div className="text-white/70">Départ: {dt}</div>
      <div className="text-white/70">{r.seatsAvailable} / {r.seatsTotal} sièges dispo</div>
      <div className="text-emerald-300 text-2xl font-bold">{r.pricePerSeat} XOF <span className="text-base text-white/60">/ siège</span></div>
      <div className="pt-2">
        <button onClick={()=>nav(`/booking/${r.rideId}`)} className="px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 transition">
          Réserver
        </button>
      </div>
    </div>
  );
}
