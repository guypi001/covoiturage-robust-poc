import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { getRide, type Ride } from '../api';

export function RideDetail() {
  const { rideId } = useParams<{ rideId: string }>();
  const nav = useNavigate();
  const storeRide = useApp((state) => state.results.find((x) => x.rideId === rideId));

  const [ride, setRide] = useState<Ride | undefined>(storeRide);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (storeRide) {
      setRide(storeRide);
    }
  }, [storeRide]);

  useEffect(() => {
    if (storeRide || !rideId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getRide(rideId);
        if (!data || data.error) throw new Error('Trajet introuvable');
        const normalized: Ride = {
          rideId: data.id,
          originCity: data.originCity,
          destinationCity: data.destinationCity,
          departureAt: data.departureAt,
          pricePerSeat: data.pricePerSeat,
          seatsTotal: data.seatsTotal,
          seatsAvailable: data.seatsAvailable,
          driverId: data.driverId,
          status: data.status,
        };
        if (!cancelled) setRide(normalized);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Trajet introuvable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeRide, rideId]);

  if (loading && !ride) {
    return <div className="glass p-6 rounded-2xl">Chargement du trajet…</div>;
  }

  if (!ride) {
    return (
      <div className="glass p-6 rounded-2xl text-red-200">
        {error || 'Trajet introuvable (reviens via la recherche).'}
      </div>
    );
  }

  const departure = useMemo(() => new Date(ride.departureAt).toLocaleString(), [ride.departureAt]);

  return (
    <div className="glass p-6 rounded-2xl space-y-4">
      <div>
        <div className="text-2xl font-semibold text-white">
          {ride.originCity} → {ride.destinationCity}
        </div>
        <div className="text-white/60 text-sm">
          Départ {departure} • {ride.seatsAvailable}/{ride.seatsTotal} sièges disponibles
        </div>
      </div>

      <div className="space-y-1 text-white/70">
        <div>Chauffeur&nbsp;: <span className="text-white font-medium">{ride.driverId ?? 'N/A'}</span></div>
        <div>Statut&nbsp;: <span className="text-white font-medium">{ride.status}</span></div>
      </div>

      <div className="text-emerald-300 text-2xl font-bold">
        {ride.pricePerSeat.toLocaleString()} XOF <span className="text-base text-white/60">/ siège</span>
      </div>

      <div className="pt-2 flex gap-3">
        <button
          onClick={() => nav(`/booking/${ride.rideId}`)}
          className="px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 transition"
        >
          Réserver ce trajet
        </button>
        <button
          onClick={() => nav(-1)}
          className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15"
        >
          Retour
        </button>
      </div>
    </div>
  );
}
