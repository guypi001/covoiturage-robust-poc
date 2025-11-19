import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Inbox, MessageSquare, ShoppingBag, Trash2 } from 'lucide-react';
import { getMyBookings, type BookingAdminItem } from '../api';
import { useApp } from '../store';
import { usePendingAcquisitions } from '../hooks/usePendingAcquisitions';
import {
  clearPendingByRideIds,
  removePendingAcquisition,
  type PendingAcquisition,
} from '../utils/pendingAcquisitions';

const formatDate = (value?: string | null, withTime = true) => {
  if (!value) return 'Date inconnue';
  try {
    const date = new Date(value);
    return withTime
      ? date.toLocaleString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : date.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
  } catch {
    return value;
  }
};

export default function Cart() {
  const account = useApp((state) => state.account);
  const token = useApp((state) => state.token);
  const ownerId = account?.id ?? 'guest';
  const navigate = useNavigate();
  const { items: pending, refresh: refreshPending } = usePendingAcquisitions(ownerId);
  const [bookings, setBookings] = useState<BookingAdminItem[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState<'reserved' | 'pending' | 'saved'>('reserved');
  const savedMap = useApp((state) => state.savedRides);
  const removeSavedRide = useApp((state) => state.removeSavedRide);

  useEffect(() => {
    if (!token) {
      setBookings([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingBookings(true);
        setError(undefined);
        const payload = await getMyBookings(token, { limit: 100 });
        if (!cancelled) {
          setBookings(Array.isArray(payload.data) ? payload.data : []);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.message || err?.message || 'Impossible de charger tes réservations.');
      } finally {
        if (!cancelled) setLoadingBookings(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!pending.length || !bookings.length) return;
    const rideIds = bookings.map((booking) => booking.rideId);
    const intersects = pending.some((item) => rideIds.includes(item.rideId));
    if (intersects) {
      clearPendingByRideIds(ownerId, rideIds);
      refreshPending();
    }
  }, [pending, bookings, ownerId, refreshPending]);

  const reservedList = useMemo(() => bookings, [bookings]);
  const pendingList = useMemo(() => pending, [pending]);
  const savedList = useMemo(() => Object.values(savedMap), [savedMap]);

  const renderReserved = () => {
    if (!token) {
      return (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-600">
          Connecte-toi pour retrouver tes réservations confirmées.
          <div className="mt-4">
            <Link to="/login" className="btn-primary px-4 py-2">
              Se connecter
            </Link>
          </div>
        </div>
      );
    }

    if (loadingBookings) {
      return (
        <div className="space-y-3">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="animate-pulse rounded-3xl border border-slate-100 bg-white px-5 py-6 shadow-sm">
              <div className="h-4 w-1/3 rounded bg-slate-100" />
              <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
              <div className="mt-4 h-10 rounded bg-slate-50" />
            </div>
          ))}
        </div>
      );
    }

    if (reservedList.length === 0) {
      return (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-500">
          <Inbox className="mx-auto mb-3 h-6 w-6 text-slate-400" />
          Aucun trajet réservé pour l’instant.
          <Link to="/" className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
            Explorer les trajets <ArrowRight size={14} />
          </Link>
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        {reservedList.map((booking) => {
          const departureLabel = booking.ride?.departureAt
            ? formatDate(booking.ride?.departureAt)
            : formatDate(booking.createdAt);
          return (
            <article key={booking.id} className="rounded-3xl border border-slate-100 bg-white px-5 py-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {booking.ride?.originCity ?? 'Origine'} → {booking.ride?.destinationCity ?? 'Destination'}
                  </p>
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <Clock size={14} /> {departureLabel}
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-600">{booking.amount.toLocaleString('fr-FR')} XOF</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
                <Link to={`/ride/${booking.rideId}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:border-sky-200 hover:text-sky-600">
                  Voir le trajet <ArrowRight size={14} />
                </Link>
                <Link to={`/booking/${booking.rideId}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:border-sky-200 hover:text-sky-600">
                  Détails réservation
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  const handleRemovePending = (item: PendingAcquisition) => {
    removePendingAcquisition(ownerId, item.id);
    refreshPending();
  };

  const renderPending = () => {
    if (pendingList.length === 0) {
      return (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-500">
          <MessageSquare className="mx-auto mb-3 h-6 w-6 text-slate-400" />
          Tu n’as pas encore de trajets en cours d’acquisition. Envoie un message à un conducteur depuis un détail de trajet pour les retrouver ici.
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        {pendingList.map((item) => (
          <article key={item.id} className="rounded-3xl border border-slate-100 bg-white px-5 py-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {item.originCity} → {item.destinationCity}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <Clock size={14} /> {formatDate(item.departureAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemovePending(item)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-rose-200 hover:text-rose-500"
              >
                <Trash2 size={14} /> Retirer
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">Contacté : {item.driverLabel}</p>
            {item.lastMessagePreview && (
              <p className="mt-2 rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-500">“{item.lastMessagePreview}”</p>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => navigate('/messages', { state: { contact: { id: item.driverId, type: item.driverType, label: item.driverLabel } } })}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:border-sky-200 hover:text-sky-600"
              >
                Continuer la discussion <ArrowRight size={14} />
              </button>
              <Link
                to={`/ride/${item.rideId}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:border-emerald-200 hover:text-emerald-600"
              >
                Voir le trajet
              </Link>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const renderSaved = () => {
    if (savedList.length === 0) {
      return (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-500">
          <ShoppingBag className="mx-auto mb-3 h-6 w-6 text-slate-400" />
          Tu n’as pas encore sauvegardé de trajet. Ajoute des trajets à ta liste depuis la recherche pour les retrouver ici.
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        {savedList.map((item) => (
          <article key={item.rideId} className="rounded-3xl border border-slate-100 bg-white px-5 py-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {item.originCity} → {item.destinationCity}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <Clock size={14} /> {formatDate(item.departureAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeSavedRide(item.rideId)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-rose-200 hover:text-rose-500"
              >
                <Trash2 size={14} /> Retirer
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{item.pricePerSeat.toLocaleString('fr-FR')} XOF / siège</span>
              <span>{item.seatsAvailable} place(s) dispo</span>
              {item.driverLabel && <span>Conducteur : {item.driverLabel}</span>}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => nav(`/booking/${item.rideId}`)}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
              >
                Continuer l’achat <ArrowRight size={14} />
              </button>
              <Link
                to={`/ride/${item.rideId}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-slate-600 hover:border-sky-200 hover:text-sky-600"
              >
                Voir le détail
              </Link>
            </div>
          </article>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="container-wide py-10 space-y-8">
        <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-xs font-semibold text-slate-600">
                <ShoppingBag size={14} /> Mon panier KariGo
              </p>
              <h1 className="text-3xl font-semibold text-slate-900">Centralise tes réservations et tes discussions.</h1>
              <p className="text-sm text-slate-500">
                Accède en un clic aux trajets déjà réservés et à ceux pour lesquels tu es en discussion avec un conducteur.
              </p>
            </div>
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
              {pendingList.length} en cours · {reservedList.length} réservé(s) · {savedList.length} sauvegardé(s)
            </div>
          </div>
          {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">{error}</div>}
          <div className="mt-6 inline-flex gap-3 rounded-full bg-slate-100 p-1 text-sm font-semibold text-slate-500">
            <button
              type="button"
              onClick={() => setMode('reserved')}
              className={`rounded-full px-4 py-1.5 ${mode === 'reserved' ? 'bg-white text-slate-900 shadow' : ''}`}
            >
              Réservés
            </button>
            <button
              type="button"
              onClick={() => setMode('pending')}
              className={`rounded-full px-4 py-1.5 ${mode === 'pending' ? 'bg-white text-slate-900 shadow' : ''}`}
            >
              En cours d’acquisition
            </button>
            <button
              type="button"
              onClick={() => setMode('saved')}
              className={`rounded-full px-4 py-1.5 ${mode === 'saved' ? 'bg-white text-slate-900 shadow' : ''}`}
            >
              Sauvegardés
            </button>
          </div>
        </section>

        <section>
          {mode === 'reserved' ? renderReserved() : mode === 'pending' ? renderPending() : renderSaved()}
        </section>
      </div>
    </div>
  );
}
