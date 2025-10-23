import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { useEffect, useMemo, useState } from 'react';
import { captureBookingPayment, createBooking, getRide, type Ride } from '../api';

export function Booking() {
  const { rideId } = useParams<{ rideId: string }>();
  const nav = useNavigate();
  const { results, passengerId } = useApp();
  const memoRide = useMemo(() => results.find((x) => x.rideId === rideId), [rideId, results]);

  const [ride, setRide] = useState<Ride | undefined>(memoRide);
  const [fetching, setFetching] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string>();

  useEffect(() => {
    if (memoRide) setRide(memoRide);
  }, [memoRide]);

  useEffect(() => {
    if (memoRide || !rideId) return;
    let cancelled = false;
    (async () => {
      try {
        setFetching(true);
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
        if (!cancelled) setFetchError(e?.message || 'Trajet introuvable');
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memoRide, rideId]);

  const [seats, setSeats] = useState(1);
  useEffect(() => {
    if (!ride) return;
    if (ride.seatsAvailable > 0 && seats > ride.seatsAvailable) {
      setSeats(ride.seatsAvailable);
    }
  }, [ride?.seatsAvailable]);

  const [loading, setLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>();
  const [bookingMessage, setBookingMessage] = useState<string>();
  const [bookingError, setBookingError] = useState<string>();

  const [paying, setPaying] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string>();
  const [paymentError, setPaymentError] = useState<string>();

  if (fetching && !ride) {
    return <div className="glass p-6 rounded-2xl">Chargement du trajet…</div>;
  }
  if (!ride) {
    return <div className="glass p-6 rounded-2xl text-red-200">{fetchError || 'Trajet introuvable.'}</div>;
  }

  const seatsUnavailable = ride.seatsAvailable <= 0;
  const amount = seatsUnavailable ? 0 : seats * ride.pricePerSeat;

  async function submit() {
    setBookingError(undefined);
    setBookingMessage(undefined);
    setPaymentMessage(undefined);
    setPaymentError(undefined);
    setBookingResult(undefined);
    if (ride.seatsAvailable <= 0) {
      setBookingError('Plus aucune place disponible pour ce trajet');
      return;
    }
    try {
      setLoading(true);
      const saved = await createBooking({ rideId: ride.rideId, passengerId, seats });
      setBookingResult(saved);
      setBookingMessage(`Réservation ${saved.id} confirmée (${saved.amount} XOF).`);
      const remaining = Math.max(0, (ride?.seatsAvailable ?? 0) - seats);
      setRide((prev) => (prev ? { ...prev, seatsAvailable: remaining } : prev));
      setSeats((prev) => (remaining > 0 ? Math.min(prev, remaining) : 1));
      useApp.setState((state) => ({
        results: state.results.map((item) =>
          item.rideId === ride.rideId ? { ...item, seatsAvailable: remaining } : item,
        ),
      }));
    } catch (e: any) {
      setBookingError(e?.message || 'Erreur pendant la réservation');
    } finally {
      setLoading(false);
    }
  }

  async function pay() {
    if (!bookingResult) return;
    setPaymentError(undefined);
    setPaymentMessage(undefined);
    try {
      setPaying(true);
      await captureBookingPayment({
        bookingId: bookingResult.id,
        amount: bookingResult.amount,
        holdId: bookingResult.holdId ?? undefined,
      });
      setPaymentMessage('Paiement confirmé 🥳');
    } catch (e: any) {
      setPaymentError(e?.message || 'Échec du paiement');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="glass p-6 rounded-2xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xl font-semibold text-white">
            {ride.originCity} → {ride.destinationCity}
          </div>
          <div className="text-white/60 text-sm">
            Départ {new Date(ride.departureAt).toLocaleString()} • {ride.seatsAvailable} siège(s) dispo
          </div>
        </div>
        <button
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs"
          onClick={() => nav(`/ride/${ride.rideId}`)}
        >
          Voir les détails
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-white/70">Sièges</label>
        <input
          type="number"
          min={1}
          max={Math.max(1, ride.seatsAvailable)}
          value={seats}
          onChange={(e) => {
            const next = Number(e.target.value || 1);
            setSeats(Math.min(Math.max(1, next), Math.max(1, ride.seatsAvailable)));
          }}
          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 w-24"
        />
      </div>
      {seatsUnavailable && (
        <div className="text-sm text-amber-300 bg-amber-900/30 border border-amber-800 rounded-xl px-3 py-2">
          Plus aucune place disponible pour ce trajet.
        </div>
      )}

      <div className="text-emerald-300 font-semibold text-lg">Total: {amount.toLocaleString()} XOF</div>

      <div className="flex items-center gap-3">
        <button
          disabled={loading || seatsUnavailable}
          onClick={submit}
          className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Réservation…' : 'Confirmer la réservation'}
        </button>
        <button
          className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15"
          onClick={() => nav(-1)}
        >
          Retour
        </button>
      </div>

      {bookingError && <div className="text-red-300">{bookingError}</div>}
      {bookingMessage && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-200">
          {bookingMessage}
        </div>
      )}

      {bookingResult && (
        <div className="space-y-3 border border-white/10 rounded-2xl p-4 bg-white/5">
          <div className="text-sm text-white/70">
            Numéro de réservation&nbsp;
            <span className="text-white font-medium">{bookingResult.id}</span>
          </div>
          <div className="text-sm text-white/70">
            Montant confirmé&nbsp;
            <span className="text-white font-medium">{bookingResult.amount?.toLocaleString?.() ?? bookingResult.amount} XOF</span>
          </div>
          {bookingResult.holdId && (
            <div className="text-sm text-white/70">
              Hold portefeuille&nbsp;
              <span className="text-white font-medium">{bookingResult.holdId}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={pay}
              disabled={paying || !!paymentMessage}
            >
              {paying ? 'Paiement…' : 'Payer maintenant'}
            </button>
            {paymentMessage && <span className="text-emerald-300 text-sm">{paymentMessage}</span>}
            {paymentError && <span className="text-red-300 text-sm">{paymentError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
