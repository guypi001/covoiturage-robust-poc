import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { getRide, getPublicProfile, sendChatMessage, type Ride, type Account } from '../api';

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
      setDriverError('Profil chauffeur indisponible pour ce trajet (identifiant technique).');
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
  const canMessage = Boolean(driver && currentAccount?.id && driver.id !== currentAccount.id && token);

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
        },
      });
    } catch (e: any) {
      setMessageError(e?.response?.data?.message || e?.message || 'Impossible d’envoyer le message.');
    } finally {
      setMessageSending(false);
    }
  };

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

      <div className="space-y-3">
        <div className="space-y-1 text-white/70">
          <div>
            Chauffeur&nbsp;:{' '}
            <span className="text-white font-medium">
              {driver?.fullName ?? driver?.companyName ?? ride.driverId ?? 'N/A'}
            </span>
          </div>
          <div>
            Statut&nbsp;: <span className="text-white font-medium">{ride.status}</span>
          </div>
        </div>

        {driverLoading && (
          <div className="rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm text-white/80">
            Chargement des informations du conducteur…
          </div>
        )}

        {driverError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {driverError}
          </div>
        )}

        {driver && driver.type === 'INDIVIDUAL' && (
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80 space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">Chauffeur particulier</p>
              <p className="text-lg font-semibold text-white">{driver.fullName}</p>
              {driver.tagline && <p className="text-white/70 text-sm">{driver.tagline}</p>}
            </div>
            <div className="text-xs text-white/60">
              Contact&nbsp;: <span className="text-white">{driver.email}</span>
            </div>
            {driver.comfortPreferences && driver.comfortPreferences.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {driver.comfortPreferences.map((pref) => (
                  <span
                    key={pref}
                    className="rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs text-white"
                  >
                    {pref}
                  </span>
                ))}
              </div>
            )}
            {canMessage && (
              <button
                onClick={goToMessages}
                className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/30 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Envoyer un message
              </button>
            )}
            {canMessage && (
              <div className="mt-3 space-y-2">
                <p className="text-xs uppercase tracking-wide text-white/60">Écrire depuis cette page</p>
                <textarea
                  className="input w-full text-sm min-h-[80px] bg-white/10 text-white placeholder:text-white/50"
                  placeholder="Pose une question sur le trajet…"
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.currentTarget.value)}
                />
                {messageError && (
                  <div className="text-xs text-red-200">
                    {messageError}
                  </div>
                )}
                <button
                  onClick={handleSendMessage}
                  disabled={messageSending}
                  className="btn-primary h-10 px-4 text-sm font-semibold disabled:opacity-60"
                >
                  {messageSending ? 'Envoi…' : 'Envoyer et ouvrir la conversation'}
                </button>
              </div>
            )}
          </div>
        )}
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
