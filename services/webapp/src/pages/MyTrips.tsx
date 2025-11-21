import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Clock, MapPin, RefreshCw, Ticket, Users, User2 } from 'lucide-react';
import {
  getMyBookings,
  getMyPublishedRides,
  type BookingAdminItem,
  type RideAdminItem,
  type RideAdminSummary,
  type RideReservation,
} from '../api';
import { useApp } from '../store';

type BookingWithMeta = BookingAdminItem & {
  departureAt?: string | null;
  originCity?: string | null;
  destinationCity?: string | null;
  isPast: boolean;
};

type RideWithDerived = RideAdminItem & {
  seatsReserved: number;
  occupancy: number;
  isPast: boolean;
  reservations: RideReservation[];
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

const RESERVATION_STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};

const formatReservationStatus = (status?: string) => RESERVATION_STATUS_LABEL[status ?? ''] ?? status ?? 'Inconnu';
const extractFirstName = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0];
};

const PASSENGER_NAME_PREF_KEY = 'kari_show_passenger_names';

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
  const [bookingError, setBookingError] = useState<string>();
  const [bookingLoading, setBookingLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  const [rides, setRides] = useState<RideAdminItem[]>([]);
  const [ridesSummary, setRidesSummary] = useState<RideAdminSummary | undefined>();
  const [ridesError, setRidesError] = useState<string>();
  const [ridesLoading, setRidesLoading] = useState(true);
  const [showPassengerNames, setShowPassengerNames] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem(PASSENGER_NAME_PREF_KEY);
    if (stored === null) return true;
    return stored === 'true';
  });

  const refreshBookings = async () => {
    if (!token) return;
    setBookingLoading(true);
    setBookingError(undefined);
    try {
      const payload = await getMyBookings(token, { limit: 100 });
      setBookings(Array.isArray(payload.data) ? payload.data : []);
    } catch (err: any) {
      setBookingError(err?.response?.data?.message || err?.message || 'Impossible de récupérer tes trajets.');
    } finally {
      setBookingLoading(false);
    }
  };

  const refreshRides = async () => {
    if (!token) return;
    setRidesLoading(true);
    setRidesError(undefined);
    try {
      const payload = await getMyPublishedRides(token, { limit: 100, sort: 'departure_desc' });
      setRides(Array.isArray(payload.data) ? payload.data : []);
      setRidesSummary(payload.summary);
    } catch (err: any) {
      setRidesError(err?.response?.data?.message || err?.message || 'Impossible de récupérer tes trajets publiés.');
    } finally {
      setRidesLoading(false);
    }
  };

  useEffect(() => {
    void refreshBookings();
    void refreshRides();
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PASSENGER_NAME_PREF_KEY, String(showPassengerNames));
  }, [showPassengerNames]);

  const enrichedBookings = useMemo<BookingWithMeta[]>(() => {
    const now = Date.now();
    return bookings.map((booking) => {
      const ride = booking.ride;
      const departureAt = ride?.departureAt ?? null;
      const originCity = ride?.originCity ?? null;
      const destinationCity = ride?.destinationCity ?? null;
      const eventTs = departureAt ? Date.parse(departureAt) : Date.parse(booking.createdAt);
      return {
        ...booking,
        departureAt,
        originCity,
        destinationCity,
        isPast: Number.isFinite(eventTs) ? eventTs < now : false,
      };
    });
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (tab === 'all') return enrichedBookings;
    if (tab === 'upcoming') return enrichedBookings.filter((item) => !item.isPast);
    return enrichedBookings.filter((item) => item.isPast);
  }, [tab, enrichedBookings]);

  const derivedRides = useMemo<RideWithDerived[]>(() => {
    const now = Date.now();
    return rides.map((ride) => {
      const reservations = Array.isArray(ride.reservations) ? ride.reservations : [];
      const seatsReserved = Math.max(0, (ride.seatsTotal ?? 0) - (ride.seatsAvailable ?? 0));
      const occupancy =
        ride.seatsTotal && ride.seatsTotal > 0
          ? Math.round((seatsReserved / Math.max(ride.seatsTotal, 1)) * 100)
          : 0;
      const isPast = Number.isFinite(Date.parse(ride.departureAt))
        ? Date.parse(ride.departureAt) < now
        : false;
      return {
        ...ride,
        seatsReserved,
        occupancy,
        isPast,
        reservations,
      };
    });
  }, [rides]);

  const rideStats = useMemo(() => {
    const summary = ridesSummary;
    if (summary) {
      return {
        upcoming: summary.upcoming ?? 0,
        published: summary.published ?? 0,
        seatsBooked: summary.seatsBooked ?? 0,
        seatsTotal: summary.seatsTotal ?? 0,
      };
    }
    return {
      upcoming: derivedRides.filter((ride) => !ride.isPast).length,
      published: derivedRides.filter((ride) => ride.status === 'PUBLISHED').length,
      seatsBooked: derivedRides.reduce((acc, ride) => acc + ride.seatsReserved, 0),
      seatsTotal: derivedRides.reduce((acc, ride) => acc + (ride.seatsTotal ?? 0), 0),
    };
  }, [derivedRides, ridesSummary]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900/5 via-white to-white">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        <section className="rounded-3xl border border-slate-200 bg-white/95 shadow-xl shadow-sky-100/60 backdrop-blur p-6 lg:p-10 space-y-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold text-sky-700">
                  Mes réservations
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold text-indigo-700">
                  Mes trajets publiés
                </span>
              </div>
              <h1 className="text-3xl font-semibold text-slate-900">
                {account?.fullName ? `${account.fullName},` : 'Salut,'} gère toute ton activité KariGo.
              </h1>
              <p className="text-sm text-slate-600">
                Visualise tes réservations à venir, revois celles passées et surveille l’occupation des trajets que tu as publiés.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void refreshBookings()}
                disabled={bookingLoading}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-600 disabled:opacity-50"
              >
                <RefreshCw size={14} /> Réservations
              </button>
              <button
                type="button"
                onClick={() => void refreshRides()}
                disabled={ridesLoading}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50"
              >
                <RefreshCw size={14} /> Trajets publiés
              </button>
            </div>
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

        {bookingError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {bookingError}
          </div>
        )}

        <section className="space-y-4">
          {bookingLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={idx}
                  className="animate-pulse rounded-3xl border border-slate-100 bg-white px-5 py-6 shadow-sm"
                >
                  <div className="h-4 w-1/3 rounded bg-slate-100" />
                  <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
                  <div className="mt-4 h-10 rounded bg-slate-50" />
                </div>
              ))}
            </div>
          ) : filteredBookings.length === 0 ? (
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
              {filteredBookings.map((booking) => {
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
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.tone}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Réservation</p>
                        <p className="font-semibold text-slate-900">{booking.id}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Sièges</p>
                        <p className="font-semibold text-slate-900">{booking.seats}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Montant</p>
                        <p className="font-semibold text-slate-900">
                          {booking.amount?.toLocaleString?.() ?? booking.amount} XOF
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/95 shadow-xl shadow-indigo-100/70 backdrop-blur p-6 lg:p-10 space-y-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold text-indigo-700">
                Mes trajets publiés
              </div>
              <h2 className="text-2xl font-semibold text-slate-900">Surveille l’occupation de tes trajets.</h2>
              <p className="text-sm text-slate-600">
                Suis les places restantes, le tarif et l’état de publication de chaque trajet créé.
              </p>
            </div>
            <div className="flex flex-col gap-2 lg:items-end">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void refreshRides()}
                  disabled={ridesLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50"
                >
                  <RefreshCw size={14} /> Actualiser
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    showPassengerNames
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-600 hover:border-emerald-200 hover:text-emerald-700'
                  }`}
                  onClick={() => setShowPassengerNames((prev) => !prev)}
                  aria-pressed={showPassengerNames}
                >
                  {showPassengerNames ? 'Masquer les prénoms' : 'Afficher les prénoms'}
                </button>
              </div>
              <p className={`text-xs ${showPassengerNames ? 'text-emerald-600' : 'text-slate-500'}`}>
                {showPassengerNames
                  ? 'Les prénoms sont affichés (visible uniquement pour vous).'
                  : 'Clique sur le bouton pour révéler les prénoms des passagers.'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Trajets à venir" value={rideStats.upcoming} icon={<Clock size={14} />} />
            <StatCard label="Trajets publiés" value={rideStats.published} icon={<BarChart3 size={14} />} />
            <StatCard label="Places offertes" value={rideStats.seatsTotal} icon={<Users size={14} />} />
            <StatCard label="Places réservées" value={rideStats.seatsBooked} icon={<Ticket size={14} />} />
          </div>

          {ridesError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {ridesError}
            </div>
          )}

          {ridesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={idx}
                  className="h-28 rounded-2xl bg-slate-100 animate-pulse"
                ></div>
              ))}
            </div>
          ) : derivedRides.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-8 text-center text-slate-600">
              <p>Tu n’as pas encore publié de trajet.</p>
              <Link
                to="/create"
                className="mt-3 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Publier un trajet
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {derivedRides.map((ride) => (
                <article
                  key={ride.id}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100 space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm uppercase tracking-wide text-slate-500">Trajet #{ride.id.slice(0, 8)}</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {ride.originCity} → {ride.destinationCity}
                      </div>
                      <div className="text-sm text-slate-500">{formatDate(ride.departureAt)}</div>
                    </div>
                    <div
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        ride.status === 'PUBLISHED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : ride.status === 'CLOSED'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {ride.status === 'PUBLISHED' ? 'En ligne' : ride.status === 'CLOSED' ? 'Clôturé' : ride.status}
                    </div>
                  </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Places réservées</span>
                    <span className="font-semibold text-slate-900">
                      {ride.seatsReserved}/{ride.seatsTotal} ({ride.occupancy}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500"
                      style={{ width: `${Math.min(ride.occupancy, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Places restantes</span>
                    <span className="font-semibold text-slate-900">{ride.seatsAvailable}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Tarif</span>
                    <span className="font-semibold text-slate-900">{ride.pricePerSeat?.toLocaleString()} XOF</span>
                  </div>
                </div>
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Passagers
                  </div>
                  {ride.reservations.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {ride.reservations.map((reservation) => {
                        const derivedFirstName =
                          extractFirstName(reservation.passengerName) ||
                          extractFirstName(reservation.passengerEmail?.split('@')[0]) ||
                          'Passager KariGo';
                        const displayName = showPassengerNames ? derivedFirstName : 'Prénom masqué';
                        const contactLine = showPassengerNames
                          ? reservation.passengerEmail || 'Contact non renseigné'
                          : 'Contact masqué';
                        return (
                          <div
                            key={reservation.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 border border-slate-200">
                                <User2 size={14} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {displayName}
                                </p>
                                <p className="text-xs text-slate-500 truncate">{contactLine}</p>
                              </div>
                            </div>
                            <div className="text-right text-xs text-slate-500">
                              <p className="font-semibold text-slate-800">
                                {reservation.seats} siège(s)
                              </p>
                              <p>{formatReservationStatus(reservation.status)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Aucune réservation pour ce trajet.</p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Link
                    to={`/ride/${ride.id}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 hover:text-sky-700"
                  >
                      Voir le détail
                      <ArrowRight size={16} />
                    </Link>
                    <div className="text-xs text-slate-400">
                      Mise à jour {ride.updatedAt ? formatDate(ride.updatedAt, false) : 'récente'}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type StatCardProps = {
  label: string;
  value: number;
  icon?: ReactNode;
};

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm shadow-slate-100">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value.toLocaleString()}</div>
    </div>
  );
}
