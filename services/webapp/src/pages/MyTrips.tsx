import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin, RefreshCw, Ticket, ArrowRight } from 'lucide-react';
import { getMyBookings, type BookingAdminItem } from '../api';
import { useApp } from '../store';

type BookingWithMeta = BookingAdminItem & {
  departureAt?: string | null;
  originCity?: string | null;
  destinationCity?: string | null;
  isPast: boolean;
};

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'En attente', tone: 'text-amber-700 bg-amber-100' },
  CONFIRMED: { label: 'Confirmée', tone: 'text-sky-700 bg-sky-100' },
  PAID: { label: 'Payée', tone: 'text-emerald-700 bg-emerald-100' },
  CANCELLED: { label: 'Annulée', tone: 'text-rose-700 bg-rose-100' },
};

const STATUS_OPTIONS = [
  { id: 'upcoming', label: 'À venir' },
  { id: 'past', label: 'Passés' },
  { id: 'all', label: 'Tous' },
];

const formatDate = (value?: string | null, withTime = true) => {
  if (!value) return 'Date inconnue';
  try {
    const date = new Date(value);
    return withTime
      ? date.toLocaleString('fr-FR', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : date.toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
  } catch {
    return value;
  }
};

export default function MyTrips() {
  const token = useApp((state) => state.token);
  const account = useApp((state) => state.account);
  const [bookings, setBookings] = useState<BookingAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [tab, setTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  const refresh = async () => {
    if (!token) return;
    setLoading(true);
    setError(undefined);
    try {
      const payload = await getMyBookings(token, { limit: 100 });
      setBookings(Array.isArray(payload.data) ? payload.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Impossible de récupérer tes trajets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [token]);

  const enriched = useMemo<BookingWithMeta[]>(() => {
    const now = Date.now();
    return bookings.map((booking) => {
      const ride = booking.ride;
      const departureAt = ride?.departureAt ?? null;
      const originCity = ride?.originCity ?? null;
      const destinationCity = ride?.destinationCity ?? null;
      const eventTs = departureAt ? Date.parse(departureAt) : Date.parse(booking.createdAt);
      const isPast = Number.isFinite(eventTs) ? eventTs < now : false;
      return {
        ...booking,
        departureAt,
        originCity,
        destinationCity,
        isPast,
      };
    });
  }, [bookings]);

  const filtered = useMemo(() => {
    if (tab === 'all') return enriched;
    if (tab === 'upcoming') return enriched.filter((item) => !item.isPast);
    return enriched.filter((item) => item.isPast);
  }, [tab, enriched]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900/5 via-white to-white">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        <section className="rounded-3xl border border-slate-200 bg-white/95 shadow-xl shadow-sky-100/60 backdrop-blur p-6 lg:p-10 space-y-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold text-sky-700">
                Mon historique de trajets
              </div>
              <h1 className="text-3xl font-semibold text-slate-900">
                {account?.fullName ? `${account.fullName},` : 'Salut,'} retrouve tes réservations en un clin d’œil.
              </h1>
              <p className="text-sm text-slate-600">
                Visualise les trajets à venir, revois tes trajets passés et accède rapidement aux détails pour préparer tes voyages.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-600 disabled:opacity-50"
            >
              <RefreshCw size={14} /> Actualiser
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setTab(option.id as typeof tab)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  tab === option.id
                    ? 'bg-sky-600 text-white shadow shadow-sky-200/60'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-sky-200 hover:text-sky-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, idx) => (
                <div
                  key={idx}
                  className="animate-pulse rounded-3xl border border-slate-100 bg-white px-5 py-6 shadow-sm"
                >
                  <div className="h-4 w-1/3 rounded bg-slate-100" />
                  <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
                  <div className="mt-4 h-10 rounded bg-slate-50" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-500">
              <Ticket className="mx-auto mb-3 h-6 w-6 text-slate-400" />
              <p className="text-sm">
                Aucun trajet {tab === 'past' ? 'passé' : tab === 'upcoming' ? 'à venir' : ''} pour l’instant. Réserve un trajet et il apparaîtra ici.
              </p>
              <Link
                to="/"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Explorer des trajets <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {filtered.map((booking) => {
                const statusInfo = STATUS_LABEL[booking.status] ?? {
                  label: booking.status,
                  tone: 'text-slate-600 bg-slate-100',
                };
                const departureLabel = booking.departureAt
                  ? formatDate(booking.departureAt)
                  : formatDate(booking.createdAt);
                return (
                  <article
                    key={booking.id}
                    className="rounded-3xl border border-slate-100 bg-white px-5 py-6 shadow-sm transition hover:border-sky-100 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-slate-900 flex items-center gap-2">
                          <MapPin size={16} className="text-sky-500" />
                          {booking.originCity ?? 'Origine inconnue'} → {booking.destinationCity ?? 'Destination inconnue'}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-2">
                          <Clock size={14} />
                          {departureLabel}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${statusInfo.tone}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-4">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase font-semibold text-slate-500">Réservation</p>
                        <p className="font-semibold text-slate-900 truncate">#{booking.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase font-semibold text-slate-500">Sièges</p>
                        <p className="font-semibold text-slate-900">{booking.seats}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase font-semibold text-slate-500">Montant</p>
                        <p className="font-semibold text-slate-900">{booking.amount.toLocaleString('fr-FR')} XOF</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase font-semibold text-slate-500">Créé le</p>
                        <p className="font-semibold text-slate-900">{formatDate(booking.createdAt, false)}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
                      <Link
                        to={`/ride/${booking.rideId}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:border-sky-200 hover:text-sky-600"
                      >
                        Voir le trajet <ArrowRight size={14} />
                      </Link>
                      <Link
                        to={`/booking/${booking.rideId}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:border-sky-200 hover:text-sky-600"
                      >
                        Détails de la réservation
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
