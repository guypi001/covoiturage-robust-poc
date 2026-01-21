import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  CalendarPlus,
  Clock,
  Flag,
  Mail,
  Phone,
  Share2,
  Shield,
  Star,
} from 'lucide-react';
import { useApp } from '../store';
import {
  createReport,
  getRide,
  getPublicProfile,
  resolveIdentityAssetUrl,
  sendChatMessage,
  type Ride,
  type Account,
} from '../api';
import { getRideStatusInfo } from '../constants/status';
import { upsertPendingAcquisition } from '../utils/pendingAcquisitions';
import { RouteMap } from '../components/RouteMap';
import type { LocationMeta } from '../types/location';
import { CityBadge, CityIcon } from '../utils/cityIcons';

const extractFirstName = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0];
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

const REPORT_REASONS = [
  'Comportement inapproprié',
  'Informations trompeuses',
  'Tarif abusif',
  'Autre',
];

export function RideDetail() {
  const { rideId } = useParams<{ rideId: string }>();
  const nav = useNavigate();
  const storeRide = useApp((state) => state.results.find((x) => x.rideId === rideId));
  const token = useApp((state) => state.token);
  const currentAccount = useApp((state) => state.account);
  const refreshBadge = useApp((state) => state.refreshMessageBadge);
  const lastSearch = useApp((state) => state.lastSearch);

  const [ride, setRide] = useState<Ride | undefined>(storeRide);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [driver, setDriver] = useState<Account | null>(null);
  const [driverLoading, setDriverLoading] = useState(false);
  const [driverError, setDriverError] = useState<string>();
  const [messageDraft, setMessageDraft] = useState('');
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState<string>();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportMessage, setReportMessage] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<string>();

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
          liveTrackingEnabled: data.liveTrackingEnabled,
          liveTrackingMode: data.liveTrackingMode,
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

  const isLikelyAccountId = (value?: string) => {
    if (!value) return false;
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
  };

  useEffect(() => {
    if (!ride?.driverId || !token) return;
    if (!isLikelyAccountId(ride.driverId)) {
      setDriver(null);
      setDriverError("Profil chauffeur indisponible pour ce trajet.");
      setDriverLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setDriverLoading(true);
        setDriverError(undefined);
        const data = await getPublicProfile(ride.driverId, token);
        if (!cancelled) setDriver(data);
      } catch (e: any) {
        if (!cancelled) setDriverError(e?.message || 'Impossible de charger le chauffeur.');
      } finally {
        if (!cancelled) setDriverLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ride?.driverId, token]);

  const departure = useMemo(() => {
    if (!ride) return '';
    return new Date(ride.departureAt).toLocaleString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [ride?.departureAt]);

  const ridePrefill = useMemo(() => {
    if (!ride) return undefined;
    return {
      rideId: ride.rideId,
      originCity: ride.originCity,
      destinationCity: ride.destinationCity,
      departureAt: ride.departureAt,
    };
  }, [ride]);

  const canMessage = Boolean(driver && currentAccount?.id && driver?.id !== currentAccount?.id && token);
  const canViewProfile = Boolean(driver?.id && token);

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

  const goToMessages = () => {
    if (!driver || !canMessage) return;
    nav('/messages', {
      state: {
        contact: {
          id: driver.id,
          type: driver.type,
          label: driver.fullName ?? driver.companyName ?? driver.email ?? 'Chauffeur',
          email: driver.email,
        },
        rideContext: ridePrefill ?? undefined,
      },
    });
  };

  const handleSendMessage = async () => {
    if (!driver || !canMessage || !currentAccount) return;
    const body = messageDraft.trim();
    if (!body) {
      setMessageError('Écris un petit message pour le chauffeur.');
      return;
    }
    setMessageError(undefined);
    setMessageSending(true);
    try {
      const clientMessageId = `${currentAccount.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await sendChatMessage({
        senderId: currentAccount.id,
        senderType: currentAccount.type,
        senderLabel: currentAccount.fullName ?? currentAccount.companyName ?? currentAccount.email,
        recipientId: driver.id,
        recipientType: driver.type,
        recipientLabel: driver.fullName ?? driver.companyName ?? driver.email,
        body,
        clientMessageId,
      });
      upsertPendingAcquisition(currentAccount.id ?? 'guest', {
        rideId: ride.rideId,
        driverId: driver.id,
        driverType: driver.type,
        driverLabel: driver.fullName ?? driver.companyName ?? driver.email ?? 'Chauffeur KariGo',
        originCity: ride.originCity,
        destinationCity: ride.destinationCity,
        departureAt: ride.departureAt,
        pricePerSeat: ride.pricePerSeat,
        lastMessagePreview: body.slice(0, 140),
      });
      setMessageDraft('');
      await refreshBadge();
      nav('/messages', {
        state: {
          contact: {
            id: driver.id,
            type: driver.type,
            label: driver.fullName ?? driver.companyName ?? driver.email ?? 'Chauffeur',
            email: driver.email,
          },
          rideContext: ridePrefill ?? undefined,
        },
      });
    } catch (e: any) {
      setMessageError(e?.response?.data?.message || e?.message || 'Impossible d’envoyer le message.');
    } finally {
      setMessageSending(false);
    }
  };

  const profilePicture = resolveIdentityAssetUrl(driver?.profilePhotoUrl) || undefined;
  const driverName =
    extractFirstName(driver?.fullName ?? driver?.companyName ?? driver?.email) || 'Chauffeur KariGo';
  const driverEmailVerified = Boolean(driver?.emailVerifiedAt);
  const driverPhoneVerified = Boolean(driver?.phoneVerifiedAt);
  const rideShareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/ride/${ride?.rideId ?? ride?.id ?? ''}`
      : '';

  const handleShareRide = async () => {
    if (!rideShareUrl) return;
    try {
      if (navigator?.share) {
        await navigator.share({ title: 'Trajet KariGo', url: rideShareUrl });
        return;
      }
      await copyText(rideShareUrl);
    } catch {
      // ignore share errors
    }
  };

  const handleCalendar = () => {
    if (!ride?.departureAt) return;
    const ics = buildIcs({
      title: `Trajet KariGo ${ride.originCity} → ${ride.destinationCity}`,
      description: `Trajet partagé avec ${driverName}`,
      location: `${ride.originCity} → ${ride.destinationCity}`,
      start: ride.departureAt,
      end: addHours(ride.departureAt, 2),
    });
    downloadIcs('trajet-karigo.ics', ics);
  };

  const handleReport = async () => {
    if (!token || !driver?.id) {
      setReportFeedback('Connecte-toi pour signaler ce trajet.');
      return;
    }
    const rideIdentifier = ride?.rideId ?? ride?.id;
    if (!rideIdentifier) {
      setReportFeedback('Trajet indisponible pour le signalement.');
      return;
    }
    setReportBusy(true);
    setReportFeedback(undefined);
    try {
      await createReport(token, {
        targetAccountId: driver.id,
        targetRideId: rideIdentifier,
        category: 'RIDE',
        reason: reportReason,
        message: reportMessage || undefined,
        context: {
          originCity: ride.originCity,
          destinationCity: ride.destinationCity,
        },
      });
      setReportFeedback('Signalement envoyé. Merci pour ton aide.');
      setReportOpen(false);
      setReportMessage('');
    } catch (err: any) {
      setReportFeedback(err?.response?.data?.message || err?.message || 'Signalement impossible.');
    } finally {
      setReportBusy(false);
    }
  };

  const goToProfile = () => {
    if (!canViewProfile || !driver?.id) return;
    nav(`/profile/${driver.id}`);
  };

  const normalizeCity = (value?: string) => value?.trim().toLowerCase();
  const originMeta: LocationMeta | undefined =
    ride &&
    lastSearch &&
    normalizeCity(lastSearch.fromMeta?.city) === normalizeCity(ride.originCity)
      ? lastSearch.fromMeta ?? undefined
      : undefined;
  const destinationMeta: LocationMeta | undefined =
    ride &&
    lastSearch &&
    normalizeCity(lastSearch.toMeta?.city) === normalizeCity(ride.destinationCity)
      ? lastSearch.toMeta ?? undefined
      : undefined;

  const trackingEnabled = Boolean(ride.liveTrackingEnabled);
  const trackingMode = ride.liveTrackingMode ?? 'FULL';
  const departureTimestamp = Date.parse(ride.departureAt);
  const trackingStartLabel = Number.isFinite(departureTimestamp)
    ? new Date(departureTimestamp - 15 * 60 * 1000).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : undefined;
  const trackingDetails =
    !trackingEnabled
      ? 'Le chauffeur doit activer le suivi pour que la position exacte soit visible.'
      : trackingMode === 'CITY_ALERTS'
        ? 'Mode entreprise : suivi 15 min avant départ puis notifications des grandes villes.'
        : 'Suivi en direct disponible 15 min avant le départ et jusqu’à l’arrivée.';

  return (
    <div className="glass p-6 rounded-2xl space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-900/60">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs uppercase tracking-wide">
            Trajet partagé
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-slate-900/60">
            <Calendar size={14} /> {departure}
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-slate-900/60">
            <Clock size={14} /> {ride.seatsAvailable}/{ride.seatsTotal} sièges
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-slate-900/60">
            <Shield size={14} /> {getRideStatusInfo(ride.status).label}
          </span>
          {trackingEnabled && (
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Suivi en direct
            </span>
          )}
        </div>
        <h1 className="flex flex-wrap items-center gap-2 text-3xl font-semibold text-slate-900">
          <CityBadge name={ride.originCity} className="text-lg" />
          <ArrowRight size={22} className="text-slate-900/50" />
          <CityBadge name={ride.destinationCity} className="text-lg" />
        </h1>
      </header>

      <RouteMap
        origin={{ label: ride.originCity, meta: originMeta }}
        destination={{ label: ride.destinationCity, meta: destinationMeta }}
        departureAt={ride.departureAt}
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white/5 p-5 text-slate-900/80 space-y-4">
          <div className="flex flex-wrap items-start gap-4">
            <button
              type="button"
              onClick={canViewProfile ? goToProfile : undefined}
              className={`relative h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${
                canViewProfile ? 'cursor-pointer hover:opacity-90 transition' : 'cursor-default'
              }`}
            >
              {profilePicture ? (
                <img src={profilePicture} alt={`Photo de ${driverName}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-900/70">
                  Photo
                </div>
              )}
            </button>
            <div className="flex-1 space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-900/60">
                {driver?.type === 'COMPANY' ? 'Trajet pro' : 'Conducteur particulier'}
              </p>
              <div className="text-xl font-semibold text-slate-900">
                {driverName}
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase">
                <span
                  className={`rounded-full px-2.5 py-1 ${
                    driverEmailVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {driverEmailVerified ? 'Email vérifié' : 'Email non vérifié'}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 ${
                    driverPhoneVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {driverPhoneVerified ? 'Téléphone vérifié' : 'Téléphone non vérifié'}
                </span>
              </div>
              {driver?.tagline && <p className="text-sm text-slate-900/70">{driver.tagline}</p>}
              {driver && (
                <div className="flex flex-wrap gap-3 text-xs text-slate-900/70">
                  {driver.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail size={12} />
                      {driver.email}
                    </span>
                  )}
                  {driver.contactPhone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} />
                      {driver.contactPhone}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {canMessage && (
                <button
                  onClick={goToMessages}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-900/90 hover:bg-slate-100"
                >
                  Ouvrir la messagerie
                  <ArrowRight size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={handleShareRide}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-900/90 hover:bg-slate-100"
              >
                Partager
                <Share2 size={14} />
              </button>
              <button
                type="button"
                onClick={handleCalendar}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-900/90 hover:bg-slate-100"
              >
                Ajouter au calendrier
                <CalendarPlus size={14} />
              </button>
              <button
                type="button"
                onClick={() => setReportOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                Signaler
                <Flag size={14} />
              </button>
              {canViewProfile && (
                <button
                  type="button"
                  onClick={goToProfile}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900"
                >
                  Voir le profil du chauffeur
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>

          {driver?.comfortPreferences && driver.comfortPreferences.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-slate-900/80">
              {driver.comfortPreferences.map((pref) => (
                <span key={pref} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1">
                  <Star size={11} /> {pref}
                </span>
              ))}
            </div>
          )}

          {reportOpen && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 space-y-3 text-sm text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Signaler ce trajet</p>
              <div className="flex flex-wrap gap-2">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setReportReason(reason)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      reportReason === reason
                        ? 'bg-rose-600 text-white'
                        : 'border border-rose-200 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <textarea
                value={reportMessage}
                onChange={(event) => setReportMessage(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-rose-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                placeholder="Ajoute des détails si nécessaire."
              />
              <button
                type="button"
                onClick={handleReport}
                disabled={reportBusy}
                className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                Envoyer le signalement
              </button>
            </div>
          )}
          {reportFeedback && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
              {reportFeedback}
            </div>
          )}

          {canMessage && (
            <div className="mt-3 space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-900/60">Envoyer un message</p>
              <textarea
                className="input w-full min-h-[90px] bg-slate-100 text-sm text-slate-900 placeholder:text-slate-900/60"
                placeholder={`Bonjour ${driverName}, je suis intéressé par ce trajet...`}
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.currentTarget.value)}
              />
              {messageError && <div className="text-xs text-rose-200">{messageError}</div>}
              <button
                onClick={handleSendMessage}
                disabled={messageSending}
                className="btn-primary h-10 px-4 text-sm font-semibold disabled:opacity-60"
              >
                {messageSending ? 'Envoi en cours…' : 'Envoyer'}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/5 p-5 text-slate-900/80 space-y-4">
          <p className="text-xs uppercase tracking-wide text-slate-900/60">Détails du trajet</p>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div>
                <p className="text-xs uppercase text-slate-900/50">Départ</p>
                <p className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <CityIcon city={ride.originCity} />
                  <span>{ride.originCity}</span>
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div>
                <p className="text-xs uppercase text-slate-900/50">Arrivée</p>
                <p className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <CityIcon city={ride.destinationCity} />
                  <span>{ride.destinationCity}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-900/70">
              <Clock size={16} className="text-emerald-300" />
              <span>{departure}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-900/70">
              <Shield size={16} className="text-emerald-300" />
              <span>{ride.seatsAvailable}/{ride.seatsTotal} sièges disponibles</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-slate-900/70">
              <Shield size={16} className={trackingEnabled ? 'text-emerald-300' : 'text-slate-300'} />
              <div>
                <p className="font-semibold">
                  Suivi en direct {trackingEnabled ? 'activé' : 'non activé'}
                  {trackingStartLabel ? ` à partir de ${trackingStartLabel}` : ''}
                </p>
                <p className="text-xs text-slate-900/60">{trackingDetails}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-emerald-300 text-2xl font-bold">
              {ride.pricePerSeat.toLocaleString()} XOF
              <span className="text-base text-slate-900/60">/ siège</span>
            </div>
          </div>

          <button
            onClick={() => nav(`/booking/${ride.rideId}`)}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-slate-900 transition hover:bg-emerald-400"
          >
            Réserver ce trajet
          </button>
          {canMessage && (
            <button
              onClick={goToMessages}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Écrire au conducteur
            </button>
          )}
        </div>
      </section>

      {driverLoading && (
        <div className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900/80">
          Chargement des informations du conducteur…
        </div>
      )}

      {driverError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {driverError}
        </div>
      )}

      <button
        onClick={() => nav(-1)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-900/80 hover:bg-slate-100"
      >
        Retour
      </button>
    </div>
  );
}
