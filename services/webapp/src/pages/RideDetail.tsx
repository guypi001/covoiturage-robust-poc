import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, Clock, MapPin, Shield, Phone, Mail, Star } from 'lucide-react';
import { useApp } from '../store';
import { getRide, getPublicProfile, sendChatMessage, type Ride, type Account } from '../api';

const extractFirstName = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0];
};

export function RideDetail() {
  const { rideId } = useParams<{ rideId: string }>();
  const nav = useNavigate();
  const storeRide = useApp((state) => state.results.find((x) => x.rideId === rideId));
  const token = useApp((state) => state.token);
  const currentAccount = useApp((state) => state.account);
  const refreshBadge = useApp((state) => state.refreshMessageBadge);

  const [ride, setRide] = useState<Ride | undefined>(storeRide);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [driver, setDriver] = useState<Account | null>(null);
  const [driverLoading, setDriverLoading] = useState(false);
  const [driverError, setDriverError] = useState<string>();
  const [messageDraft, setMessageDraft] = useState('');
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState<string>();

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
      await sendChatMessage({
        senderId: currentAccount.id,
        senderType: currentAccount.type,
        senderLabel: currentAccount.fullName ?? currentAccount.companyName ?? currentAccount.email,
        recipientId: driver.id,
        recipientType: driver.type,
        recipientLabel: driver.fullName ?? driver.companyName ?? driver.email,
        body,
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

  const profilePicture = driver?.profilePhotoUrl || undefined;
  const driverName =
    extractFirstName(driver?.fullName ?? driver?.companyName ?? driver?.email) || 'Chauffeur KariGo';

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
          <span className="inline-flex items-center gap-2 text-xs text-slate-900/60 capitalize">
            <Shield size={14} /> {ride.status.toLowerCase()}
          </span>
        </div>
        <h1 className="flex flex-wrap items-center gap-2 text-3xl font-semibold text-slate-900">
          <MapPin size={24} className="text-emerald-300" />
          <span>{ride.originCity}</span>
          <ArrowRight size={22} className="text-slate-900/50" />
          <span>{ride.destinationCity}</span>
        </h1>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white/5 p-5 text-slate-900/80 space-y-4">
          <div className="flex flex-wrap items-start gap-4">
            <button
              type="button"
              onClick={profilePicture ? () => nav(`/profile/${driver?.id}`) : undefined}
              className={`relative h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${
                profilePicture ? 'cursor-pointer hover:opacity-90 transition' : 'cursor-default'
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
            {canMessage && (
              <button
                onClick={goToMessages}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-900/90 hover:bg-slate-100"
              >
                Ouvrir la messagerie
                <ArrowRight size={14} />
              </button>
            )}
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
              <MapPin size={16} className="text-emerald-300" />
              <div>
                <p className="text-xs uppercase text-slate-900/50">Départ</p>
                <p className="text-lg font-semibold text-slate-900">{ride.originCity}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-emerald-300" />
              <div>
                <p className="text-xs uppercase text-slate-900/50">Arrivée</p>
                <p className="text-lg font-semibold text-slate-900">{ride.destinationCity}</p>
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
