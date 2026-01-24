import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CalendarPlus,
  Clock,
  MapPin,
  RefreshCw,
  Repeat,
  Share2,
  Ticket,
  Users,
  User2,
} from 'lucide-react';
import {
  getMyBookings,
  getMyPublishedRides,
  type BookingAdminItem,
  type RideAdminItem,
  type RideAdminSummary,
  type RideReservation,
} from '../api';
import { useApp } from '../store';
import { getBookingStatusInfo, getPaymentStatusInfo, getRideStatusInfo } from '../constants/status';

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

const STATUS_OPTIONS = [
  { id: 'upcoming', label: 'À venir' },
  { id: 'past', label: 'Passés' },
  { id: 'all', label: 'Tous' },
];

const formatReservationStatus = (status?: string) => getBookingStatusInfo(status).label;
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

const toCalendarDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

const addHours = (value?: string | null, hours = 2) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

const buildIcs = (payload: {
  title: string;
  description?: string;
  location?: string;
  start?: string;
  end?: string;
}) => {
  const start = toCalendarDate(payload.start);
  const end = toCalendarDate(payload.end);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KariGo//Trips//FR',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@karigo`,
    `DTSTAMP:${toCalendarDate(new Date().toISOString())}`,
    start ? `DTSTART:${start}` : '',
    end ? `DTEND:${end}` : '',
    `SUMMARY:${payload.title}`,
    payload.description ? `DESCRIPTION:${payload.description}` : '',
    payload.location ? `LOCATION:${payload.location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\n');
};

const downloadIcs = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
};

const copyText = async (value: string) => {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

const getTimelineSteps = (createdAt?: string | null, departureAt?: string | null) => {
  const arrivalAt = addHours(departureAt);
  const steps = [
    { id: 'created', label: 'Créé', time: createdAt },
    { id: 'departure', label: 'Départ', time: departureAt },
    { id: 'arrival', label: 'Arrivée estimée', time: arrivalAt },
  ];
  const now = Date.now();
  return steps.map((step) => {
    const ts = step.time ? Date.parse(step.time) : Number.NaN;
    const isDone = Number.isFinite(ts) ? ts < now : false;
    return { ...step, isDone };
  });
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

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const buildRideUrl = (rideId?: string | null) => (rideId ? `${baseUrl}/ride/${rideId}` : '');

  const handleShare = async (url: string, title: string) => {
    if (!url) return;
    try {
      if (navigator?.share) {
        await navigator.share({ title, url });
        return;
      }
      await copyText(url);
    } catch {
      // ignore share errors
    }
  };

  const handleCalendar = (payload: {
    title: string;
    description?: string;
    location?: string;
    start?: string | null;
  }) => {
    if (!payload.start) return;
    const ics = buildIcs({
      title: payload.title,
      description: payload.description,
      location: payload.location,
      start: payload.start,
      end: addHours(payload.start, 2),
    });
    downloadIcs('trajet-karigo.ics', ics);
  };

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
                const statusInfo = getBookingStatusInfo(booking.status);
                const paymentStatusInfo = getPaymentStatusInfo(booking.paymentStatus);
                const departureLabel = booking.departureAt
                  ? formatDate(booking.departureAt)
                  : formatDate(booking.createdAt);
                const bookingRideId =
                  booking.ride?.id || booking.ride?.rideId || booking.rideId || undefined;
                const bookingSteps = getTimelineSteps(booking.createdAt, booking.departureAt);
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
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.tone}`}>
                          {statusInfo.label}
                        </span>
                        {booking.paymentStatus ? (
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentStatusInfo.tone}`}>
                            {paymentStatusInfo.label}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Réservation</p>
                        <p className="font-semibold text-slate-900">
                          {booking.referenceCode || booking.id}
                        </p>
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
                    <div className="mt-4 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Timeline</p>
                      <div className="flex flex-wrap gap-2">
                        {bookingSteps.map((step) => (
                          <div
                            key={step.id}
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                              step.isDone ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'
                            }`}
                          >
                            {step.label}
                            {step.time ? ` · ${formatDate(step.time, false)}` : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleShare(
                            buildRideUrl(bookingRideId),
                            'Trajet KariGo',
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-sky-200 hover:text-sky-600"
                      >
                        <Share2 size={14} /> Partager
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleCalendar({
                            title: `Trajet KariGo ${booking.originCity ?? ''} → ${booking.destinationCity ?? ''}`,
                            description: `Reservation ${booking.referenceCode || booking.id}`,
                            location: `${booking.originCity ?? ''} → ${booking.destinationCity ?? ''}`,
                            start: booking.departureAt ?? booking.createdAt,
                          })
                        }
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-sky-200 hover:text-sky-600"
                      >
                        <CalendarPlus size={14} /> Ajouter au calendrier
                      </button>
                      {bookingRideId ? (
                        <Link
                          to={`/ride/${bookingRideId}`}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-sky-200 hover:text-sky-600"
                        >
                          <ArrowRight size={14} /> Voir le trajet
                        </Link>
                      ) : null}
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
                    {(() => {
                      const statusInfo = getRideStatusInfo(ride.status);
                      return (
                        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.tone}`}>
                          {statusInfo.label}
                        </div>
                      );
                    })()}
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
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timeline</div>
                  <div className="flex flex-wrap gap-2">
                    {getTimelineSteps(ride.createdAt ?? ride.updatedAt, ride.departureAt).map((step) => (
                      <div
                        key={step.id}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                          step.isDone ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'
                        }`}
                      >
                        {step.label}
                        {step.time ? ` · ${formatDate(step.time, false)}` : ''}
                      </div>
                    ))}
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/create"
                      state={{
                        prefill: {
                          originCity: ride.originCity,
                          destinationCity: ride.destinationCity,
                          date: ride.departureAt
                            ? new Date(ride.departureAt).toLocaleDateString('fr-CA')
                            : '',
                          time: ride.departureAt
                            ? new Date(ride.departureAt).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '',
                          pricePerSeat: ride.pricePerSeat ?? 0,
                          seatsTotal: ride.seatsTotal ?? 1,
                          liveTrackingEnabled: Boolean(ride.liveTrackingEnabled),
                        },
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
                    >
                      <Repeat size={14} /> Reprogrammer
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleShare(buildRideUrl(ride.id), 'Trajet KariGo')}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-sky-200 hover:text-sky-600"
                    >
                      <Share2 size={14} /> Partager
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleCalendar({
                          title: `Trajet KariGo ${ride.originCity} → ${ride.destinationCity}`,
                          description: `Trajet ${ride.id}`,
                          location: `${ride.originCity} → ${ride.destinationCity}`,
                          start: ride.departureAt,
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                    >
                      <CalendarPlus size={14} /> Ajouter au calendrier
                    </button>
                    <Link
                      to={`/ride/${ride.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-sky-200 hover:text-sky-600"
                    >
                      <ArrowRight size={14} /> Voir le détail
                    </Link>
                  </div>
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
