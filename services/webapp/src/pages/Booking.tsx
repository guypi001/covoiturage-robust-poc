import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  captureBookingPayment,
  createBooking,
  getBookingReceipt,
  getRide,
  getMyPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  updatePaymentPreferences,
  type Ride,
  type PaymentMethod,
} from '../api';
import {
  startPaymentSimulation,
  type PaymentSimulationHandle,
  type PaymentSimulationStep,
} from '../utils/paymentSimulation';
import { CheckCircle2, Copy, CreditCard, ShieldCheck, Smartphone, Wallet as WalletIcon, Trash2 } from 'lucide-react';

export function Booking() {
  const { rideId } = useParams<{ rideId: string }>();
  const nav = useNavigate();
  const { results, passengerId, token, account, setRideAvailability } = useApp((state) => ({
    results: state.results,
    passengerId: state.passengerId,
    token: state.token,
    account: state.account,
    setRideAvailability: state.setRideAvailability,
  }));
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
          liveTrackingEnabled: data.liveTrackingEnabled,
          liveTrackingMode: data.liveTrackingMode,
        };
        if (!cancelled) {
          setRide(normalized);
          setRideAvailability(normalized.rideId, normalized.seatsAvailable, normalized.seatsTotal);
        }
      } catch (e: any) {
        if (!cancelled) setFetchError(e?.message || 'Trajet introuvable');
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memoRide, rideId, setRideAvailability]);

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
  const [paymentSteps, setPaymentSteps] = useState<PaymentSimulationStep[]>([]);
  const paymentSimulationRef = useRef<PaymentSimulationHandle | null>(null);
  const copyRefTimerRef = useRef<number | null>(null);
  const [receiptIssuedAt, setReceiptIssuedAt] = useState<string>();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [methodsError, setMethodsError] = useState<string>();
  const [selectedMethodId, setSelectedMethodId] = useState<string>('cash');
  const [defaultMethodId, setDefaultMethodId] = useState<string | undefined>(
    account?.paymentPreferences?.defaultPaymentMethodId,
  );
  const [showMethodForm, setShowMethodForm] = useState(false);
  const [savingMethod, setSavingMethod] = useState(false);
  const [newMethodType, setNewMethodType] = useState<'CARD' | 'MOBILE_MONEY'>('CARD');
  const [newCardForm, setNewCardForm] = useState({ holder: '', number: '', expiry: '' });
  const [newMobileForm, setNewMobileForm] = useState({ provider: 'MTN Money', phone: '' });
  const [instantMobileForm, setInstantMobileForm] = useState({ provider: 'MTN Money', phone: '' });
  const [instantPhoneTouched, setInstantPhoneTouched] = useState(false);
  const [copyRefFeedback, setCopyRefFeedback] = useState<'idle' | 'copied'>('idle');
  const [cashCommitmentOpen, setCashCommitmentOpen] = useState(false);
  const selectedMethod =
    selectedMethodId === 'cash'
      ? { type: 'CASH' as const, label: 'Paiement en espèces' }
      : selectedMethodId === 'mobile-instant'
      ? {
          type: 'MOBILE_MONEY' as const,
          label:
            `${instantMobileForm.provider} ${instantMobileForm.phone || ''}`.trim() || 'Mobile money instantané',
          provider: instantMobileForm.provider,
          phoneNumber: instantMobileForm.phone,
        }
      : paymentMethods.find((m) => m.id === selectedMethodId);

  useEffect(() => {
    return () => {
      paymentSimulationRef.current?.cancel();
      paymentSimulationRef.current = null;
      if (copyRefTimerRef.current) {
        window.clearTimeout(copyRefTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setDefaultMethodId(account?.paymentPreferences?.defaultPaymentMethodId);
  }, [account?.paymentPreferences?.defaultPaymentMethodId]);

  const syncRideAvailability = useCallback(async () => {
    if (!rideId) return;
    try {
      const latest = await getRide(rideId);
      if (!latest || (latest as any)?.error) return;
      const normalized: Ride = {
        rideId: latest.id,
        originCity: latest.originCity,
        destinationCity: latest.destinationCity,
        departureAt: latest.departureAt,
        pricePerSeat: latest.pricePerSeat,
        seatsTotal: latest.seatsTotal,
        seatsAvailable: latest.seatsAvailable,
        driverId: latest.driverId,
        status: latest.status,
        liveTrackingEnabled: latest.liveTrackingEnabled,
        liveTrackingMode: latest.liveTrackingMode,
      };
      setRide(normalized);
      setRideAvailability(normalized.rideId, normalized.seatsAvailable, normalized.seatsTotal);
      useApp.setState((state) => ({
        results: state.results.map((item) =>
          item.rideId === normalized.rideId ? { ...item, seatsAvailable: normalized.seatsAvailable } : item,
        ),
      }));
    } catch {
      // ignore refresh failure
    }
  }, [rideId, setRideAvailability]);

  const refreshPaymentMethods = useCallback(async () => {
    if (!token) {
      setPaymentMethods([]);
      setSelectedMethodId('cash');
      return;
    }
    try {
      setMethodsLoading(true);
      setMethodsError(undefined);
      const data = await getMyPaymentMethods(token);
      const normalized = Array.isArray(data) ? data : [];
      setPaymentMethods(normalized);
      const storedDefault = account?.paymentPreferences?.defaultPaymentMethodId;
      const isDefaultAvailable =
        storedDefault === 'cash' ||
        storedDefault === 'mobile-instant' ||
        normalized.some((item) => item.id === storedDefault);
      if (storedDefault && isDefaultAvailable) {
        setSelectedMethodId(storedDefault);
      } else if (normalized.length > 0) {
        setSelectedMethodId((prev) => (prev === 'cash' ? normalized[0].id : prev));
      }
    } catch (err: any) {
      setMethodsError(err?.response?.data?.message || err?.message || 'Impossible de charger tes moyens de paiement.');
    } finally {
      setMethodsLoading(false);
    }
  }, [account?.paymentPreferences?.defaultPaymentMethodId, token]);

  useEffect(() => {
    void refreshPaymentMethods();
  }, [refreshPaymentMethods]);

  if (fetching && !ride) {
    return <div className="glass p-6 rounded-2xl">Chargement du trajet…</div>;
  }
  if (!ride) {
    return <div className="glass p-6 rounded-2xl text-red-200">{fetchError || 'Trajet introuvable.'}</div>;
  }

  const seatsUnavailable = ride.seatsAvailable <= 0;
  const amount = seatsUnavailable ? 0 : seats * ride.pricePerSeat;
  const departureLabel = new Date(ride.departureAt).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const reservationStepStatus = bookingResult ? 'done' : loading ? 'active' : 'pending';
  const paymentStepStatus = paymentMessage ? 'done' : paying ? 'active' : bookingResult ? 'ready' : 'pending';
  const confirmationStepStatus = paymentMessage ? 'done' : 'pending';
  const instantPhoneDigits = instantMobileForm.phone.replace(/\D/g, '');
  const mobileInstantValid = selectedMethodId !== 'mobile-instant' || instantPhoneDigits.length >= 8;
  const paymentBlockedReason =
    selectedMethodId === 'mobile-instant' && !mobileInstantValid
      ? 'Renseigne un numéro mobile money valide.'
      : undefined;
  const defaultMethodLabel = useMemo(() => {
    if (!defaultMethodId) return 'Aucun';
    if (defaultMethodId === 'cash') return 'Espèces à bord';
    if (defaultMethodId === 'mobile-instant') {
      return instantMobileForm.provider || 'Mobile money instantané';
    }
    const method = paymentMethods.find((item) => item.id === defaultMethodId);
    return method?.label || method?.provider || method?.type || 'Moyen enregistré';
  }, [defaultMethodId, instantMobileForm.provider, paymentMethods]);
  const timelineSteps = [
    {
      id: 'reservation',
      title: 'Réservation',
      status: reservationStepStatus,
      description: bookingResult ? `Réf ${bookingResult.id}` : 'Choisis tes sièges et confirme.',
    },
    {
      id: 'payment',
      title: 'Paiement',
      status: paymentStepStatus,
      description: selectedMethod?.label || 'Sélectionne ton moyen favori.',
    },
    {
      id: 'confirmation',
      title: 'Confirmation',
      status: confirmationStepStatus,
      description: paymentMessage || 'Recevras ton reçu automatiquement.',
    },
  ];

  const buildPaymentSteps = (methodType?: string) => {
    if (methodType === 'MOBILE_MONEY') {
      return [
        { id: 'init', label: 'Connexion à l’opérateur mobile money…', duration: 700 },
        { id: 'otp', label: 'Validation sur ton téléphone (OTP)…', duration: 1200 },
        { id: 'confirm', label: 'Confirmation du paiement…', duration: 900 },
      ];
    }
    if (methodType === 'CARD') {
      return [
        { id: 'init', label: 'Connexion au réseau bancaire…', duration: 700 },
        { id: '3ds', label: 'Validation 3D Secure…', duration: 1200 },
        { id: 'confirm', label: 'Confirmation du paiement…', duration: 900 },
      ];
    }
    return [
      { id: 'init', label: 'Traitement du paiement…', duration: 700 },
      { id: 'confirm', label: 'Confirmation…', duration: 900 },
    ];
  };

  const receiptData = useMemo(() => {
    if (!paymentMessage || !bookingResult) return null;
    return {
      bookingId: bookingResult.id,
      passengerName: account?.fullName || account?.companyName || account?.email || 'Client KariGo',
      passengerEmail: account?.email || '',
      originCity: ride.originCity,
      destinationCity: ride.destinationCity,
      departureAt: ride.departureAt,
      seats,
      amount: bookingResult.amount ?? amount,
      paymentMethod: selectedMethod?.label || selectedMethod?.type || 'Paiement',
      issuedAt: receiptIssuedAt || new Date().toISOString(),
    };
  }, [
    account?.companyName,
    account?.email,
    account?.fullName,
    amount,
    bookingResult,
    paymentMessage,
    receiptIssuedAt,
    ride.departureAt,
    ride.destinationCity,
    ride.originCity,
    seats,
    selectedMethod?.label,
    selectedMethod?.type,
  ]);

  async function submit() {
    setBookingError(undefined);
    setBookingMessage(undefined);
    setPaymentMessage(undefined);
    setPaymentError(undefined);
    setBookingResult(undefined);
    setPaymentSteps([]);
    paymentSimulationRef.current?.cancel();
    paymentSimulationRef.current = null;
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
      setRideAvailability(ride.rideId, remaining, ride.seatsTotal);
      useApp.setState((state) => ({
        results: state.results.map((item) =>
          item.rideId === ride.rideId ? { ...item, seatsAvailable: remaining } : item,
        ),
      }));
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail || e?.response?.data?.error;
      const detailLower = typeof detail === 'string' ? detail.toLowerCase() : '';
      if (status === 409 && e?.response?.data?.error === 'not_enough_seats') {
        setBookingError(detail || 'Plus assez de sièges disponibles.');
        await syncRideAvailability();
      } else if (detailLower.includes('seat lock')) {
        setBookingError('Plus assez de sièges disponibles. Nous venons de synchroniser le trajet.');
        await syncRideAvailability();
      } else {
        setBookingError(detail || e?.message || 'Erreur pendant la réservation');
      }
    } finally {
      setLoading(false);
    }
  }

  async function pay() {
    if (!bookingResult) return;
    if (!mobileInstantValid) {
      setInstantPhoneTouched(true);
      setPaymentError('Renseigne un numéro mobile money valide.');
      return;
    }
    const method =
      selectedMethodId === 'cash'
        ? { type: 'CASH' as const, label: 'Paiement en espèces' }
        : selectedMethodId === 'mobile-instant'
        ? {
            type: 'MOBILE_MONEY' as const,
            label: `${instantMobileForm.provider} ${instantMobileForm.phone || ''}`.trim(),
            provider: instantMobileForm.provider,
            phoneNumber: instantMobileForm.phone,
          }
        : paymentMethods.find((m) => m.id === selectedMethodId);
    if (!method) {
      setPaymentError('Choisis un moyen de paiement.');
      return;
    }
    setPaymentError(undefined);
    setPaymentMessage(undefined);
    paymentSimulationRef.current?.cancel();
    const simulation = startPaymentSimulation({
      steps: buildPaymentSteps(method?.type),
      onUpdate: ({ steps }) => setPaymentSteps(steps),
    });
    paymentSimulationRef.current = simulation;
    try {
      setPaying(true);
      await captureBookingPayment({
        bookingId: bookingResult.id,
        amount: bookingResult.amount,
        holdId: bookingResult.holdId ?? undefined,
        paymentMethodId: method?.id,
        paymentMethodType: method?.type ?? 'CASH',
        paymentProvider:
          method?.type === 'CASH' ? 'CASH' : method?.provider,
      });
      await simulation.promise;
      setPaymentMessage(
        method.type === 'CASH'
          ? 'Paiement en espèces confirmé 🥳'
          : `Paiement confirmé via ${method.label || method.provider || method.type} 🥳`,
      );
      setReceiptIssuedAt(new Date().toISOString());
    } catch (e: any) {
      simulation.cancel();
      await simulation.promise.catch(() => undefined);
      const failedIndex = simulation.getCurrentIndex();
      setPaymentSteps((prev) =>
        prev.map((step, idx) => {
          if (failedIndex < 0) {
            if (idx === 0 && prev.length) return { ...step, status: 'error' };
            return step;
          }
          if (idx === failedIndex) return { ...step, status: 'error' };
          if (idx > failedIndex) return { ...step, status: 'pending' };
          return step;
        }),
      );
      setPaymentError(e?.message || 'Échec du paiement');
    } finally {
      paymentSimulationRef.current = null;
      setPaying(false);
    }
  }

  const handleAddPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setMethodsError('Connecte-toi pour enregistrer un moyen de paiement.');
      return;
    }
    try {
      setSavingMethod(true);
      setMethodsError(undefined);
      if (newMethodType === 'CARD') {
        const digits = newCardForm.number.replace(/\D/g, '');
        if (digits.length < 12) throw new Error('Numéro de carte invalide');
        const last4 = digits.slice(-4);
        const brand = digits.startsWith('4')
          ? 'VISA'
          : digits.startsWith('5')
            ? 'MASTERCARD'
            : 'CARTE';
        const label = newCardForm.holder
          ? `${newCardForm.holder} •••• ${last4}`
          : `Carte •••• ${last4}`;
        await addPaymentMethod(token, {
          type: 'CARD',
          label,
          provider: brand,
          last4,
          expiresAt: newCardForm.expiry,
        });
      } else {
        if (!newMobileForm.phone.trim()) throw new Error('Numéro requis');
        await addPaymentMethod(token, {
          type: 'MOBILE_MONEY',
          label: `${newMobileForm.provider} ${newMobileForm.phone}`,
          provider: newMobileForm.provider,
          phoneNumber: newMobileForm.phone,
        });
      }
      setShowMethodForm(false);
      setNewCardForm({ holder: '', number: '', expiry: '' });
      setNewMobileForm({ provider: 'MTN Money', phone: '' });
      await refreshPaymentMethods();
    } catch (err: any) {
      setMethodsError(err?.response?.data?.message || err?.message || 'Impossible d’enregistrer le moyen de paiement.');
    } finally {
      setSavingMethod(false);
    }
  };

  const handleDeleteMethod = async (methodId: string) => {
    if (!token) return;
    try {
      await deletePaymentMethod(token, methodId);
      if (selectedMethodId === methodId) {
        setSelectedMethodId('cash');
      }
      if (account?.id && defaultMethodId === methodId) {
        const updated = await updatePaymentPreferences(token, account.type, {
          defaultPaymentMethodId: 'cash',
        });
        useApp.setState({ account: updated });
        setDefaultMethodId(updated.paymentPreferences?.defaultPaymentMethodId);
      }
      await refreshPaymentMethods();
    } catch (err: any) {
      setMethodsError(err?.response?.data?.message || err?.message || 'Suppression impossible.');
    }
  };

  const handleSetDefaultMethod = async () => {
    if (!token || !account) {
      setMethodsError('Connecte-toi pour memoriser ton moyen par defaut.');
      return;
    }
    try {
      setMethodsError(undefined);
      const updated = await updatePaymentPreferences(token, account.type, {
        defaultPaymentMethodId: selectedMethodId,
      });
      useApp.setState({ account: updated });
      setDefaultMethodId(updated.paymentPreferences?.defaultPaymentMethodId);
    } catch (err: any) {
      setMethodsError(err?.response?.data?.message || err?.message || 'Impossible de definir le moyen par defaut.');
    }
  };

  const handleDownloadReceipt = () => {
    if (!receiptData || !token) return;
    getBookingReceipt(token, receiptData.bookingId)
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `recu-${receiptData.bookingId}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => {
        setPaymentError("Impossible de telecharger le recu pour l'instant.");
      });
  };

  const handlePrintReceipt = () => {
    if (!receiptData || !token) return;
    getBookingReceipt(token, receiptData.bookingId)
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (!win) return;
        win.focus();
        win.print();
      })
      .catch(() => {
        setPaymentError("Impossible d'imprimer le recu pour l'instant.");
      });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 rounded-3xl bg-white px-4 py-6 text-slate-900 shadow-xl sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trajet</p>
          <p className="text-2xl font-semibold text-slate-900">
            {ride.originCity} → {ride.destinationCity}
          </p>
          <p className="text-sm text-slate-600">
            {departureLabel} • {ride.seatsAvailable} siège(s) restants
          </p>
        </div>
        <button
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
          onClick={() => nav(`/ride/${ride.rideId}`)}
        >
          Voir la fiche trajet
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr,1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paiement sécurisé</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  Validation instantanée et reçu automatique
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <ShieldCheck size={14} />
                Sécurisé
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Confirmation rapide
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Reçu dans ton espace
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Support 7j/7
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-600">Nombre de sièges</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, ride.seatsAvailable)}
                  value={seats}
                  onChange={(e) => {
                    const next = Number(e.target.value || 1);
                    setSeats(Math.min(Math.max(1, next), Math.max(1, ride.seatsAvailable)));
                  }}
                  className="mt-2 h-12 w-24 rounded-2xl border border-slate-300 bg-white text-center text-2xl font-semibold text-slate-900"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-600">Disponibles</span>
                <span className="mt-2 text-2xl font-semibold text-emerald-600">{ride.seatsAvailable}</span>
                <span className="text-xs text-slate-500">Encore {ride.seatsAvailable} place(s)</span>
              </div>
              <div className="flex-1 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm text-slate-600">
                Ajuste le nombre de sièges puis valide pour verrouiller ta réservation avant les autres passagers.
              </div>
            </div>
            {seatsUnavailable && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Plus aucune place disponible pour ce trajet.
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Montant estimé</p>
                <p className="text-3xl font-semibold text-slate-900">{amount.toLocaleString()} XOF</p>
              </div>
              <div className="text-sm text-slate-500">
                Prix par siège&nbsp;
                <span className="font-semibold text-slate-900">{ride.pricePerSeat.toLocaleString()} XOF</span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">Parcours de réservation</p>
                <p className="text-xs text-slate-500">
                  Réserve, paie, puis reçois automatiquement ton reçu dans ton espace KariGo.
                </p>
              </div>
              {bookingMessage && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {bookingMessage}
                </span>
              )}
            </div>
            <div className="mt-5 space-y-5">
              {timelineSteps.map((step) => {
                const dotClass =
                  step.status === 'done'
                    ? 'bg-emerald-500'
                    : step.status === 'active'
                    ? 'bg-amber-500 animate-pulse'
                    : step.status === 'ready'
                    ? 'bg-sky-500'
                    : 'bg-slate-300';
                const titleClass =
                  step.status === 'done'
                    ? 'text-emerald-700'
                    : step.status === 'active'
                    ? 'text-slate-900'
                    : step.status === 'ready'
                    ? 'text-sky-700'
                    : 'text-slate-500';
                return (
                  <div key={step.id} className="flex gap-4">
                    <div className={`mt-1 h-3 w-3 rounded-full ${dotClass}`} />
                    <div>
                      <p className={`text-sm font-semibold ${titleClass}`}>{step.title}</p>
                      <p className="text-sm text-slate-500">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {bookingResult && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Réservation confirmée</p>
                  <p className="text-xs text-slate-500">Réf {bookingResult.id}</p>
                </div>
                <button
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  onClick={() => {
                    if (selectedMethodId === 'cash') {
                      setCashCommitmentOpen(true);
                    } else {
                      void pay();
                    }
                  }}
                  disabled={paying || !!paymentMessage || !mobileInstantValid}
                >
                  {paying ? 'Paiement…' : 'Payer maintenant'}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={async () => {
                    if (!bookingResult?.id) return;
                    await navigator.clipboard?.writeText?.(bookingResult.id);
                    setCopyRefFeedback('copied');
                    if (copyRefTimerRef.current) {
                      window.clearTimeout(copyRefTimerRef.current);
                    }
                    copyRefTimerRef.current = window.setTimeout(
                      () => setCopyRefFeedback('idle'),
                      2000,
                    );
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
                >
                  <Copy size={12} />
                  {copyRefFeedback === 'copied' ? 'Réf copiée' : 'Copier la référence'}
                </button>
                {paymentBlockedReason && (
                  <span className="text-amber-600">{paymentBlockedReason}</span>
                )}
              </div>
              <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  Montant&nbsp;
                  <span className="font-semibold text-slate-900">
                    {bookingResult.amount?.toLocaleString?.() ?? bookingResult.amount} XOF
                  </span>
                </div>
                <div>
                  Moyen sélectionné&nbsp;
                  <span className="font-semibold text-slate-900">
                    {selectedMethod?.label || (selectedMethod?.type === 'CASH' ? 'Espèces' : selectedMethod?.type)}
                  </span>
                </div>
                {bookingResult.holdId && (
                  <div>
                    Wallet hold&nbsp;
                    <span className="font-semibold text-slate-900">{bookingResult.holdId}</span>
                  </div>
                )}
                <div>
                  Sièges réservés&nbsp;
                  <span className="font-semibold text-slate-900">{seats}</span>
                </div>
              </div>
              {paymentMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                  {paymentMessage}
                </div>
              )}
              {paymentError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">
                  {paymentError}
                </div>
              )}
              {receiptData && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Recu disponible
                      </p>
                      <p className="text-sm text-slate-600">
                        Un recu PDF est envoye par email {receiptData.passengerEmail ? `a ${receiptData.passengerEmail}` : ''}.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadReceipt}
                        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        Telecharger PDF
                      </button>
                      <button
                        type="button"
                        onClick={handlePrintReceipt}
                        className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-500"
                      >
                        Imprimer
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {paymentSteps.length > 0 && (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Simulation du paiement
                  </p>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all"
                      style={{
                        width: `${Math.round(
                          (paymentSteps.filter((step) => step.status === 'done').length /
                            Math.max(paymentSteps.length, 1)) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    {paymentSteps.map((step) => (
                      <div key={step.id} className="flex items-center gap-3 text-sm">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            step.status === 'done'
                              ? 'bg-emerald-500'
                              : step.status === 'active'
                              ? 'bg-amber-500 animate-pulse'
                              : step.status === 'error'
                              ? 'bg-rose-500'
                              : 'bg-slate-300'
                          }`}
                        />
                        <span
                          className={
                            step.status === 'error'
                              ? 'text-rose-600'
                              : step.status === 'done'
                              ? 'text-emerald-700'
                              : step.status === 'active'
                              ? 'text-slate-900'
                              : 'text-slate-500'
                          }
                        >
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">Choisis un moyen de paiement</p>
                <p className="text-xs text-slate-500">
                  Cartes bancaires/Visa, mobile money, payer en cash le jour J ou enregistre ton wallet.
                </p>
              </div>
              {token ? (
                <button
                  type="button"
                  onClick={() => setShowMethodForm((prev) => !prev)}
                  className="text-xs font-semibold text-slate-900 underline"
                >
                  {showMethodForm ? 'Fermer' : 'Enregistrer un moyen'}
                </button>
              ) : (
                <span className="text-xs font-semibold text-slate-400">
                  Connecte-toi pour mémoriser tes moyens favoris
                </span>
              )}
            </div>
            {methodsError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                {methodsError}
              </div>
            )}
            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => setSelectedMethodId('cash')}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  selectedMethodId === 'cash'
                    ? 'border-slate-900 bg-slate-900/5 shadow-sm'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <WalletIcon size={18} className="text-slate-900" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Espèces à bord</p>
                    <p className="text-xs text-slate-500">Paiement au départ, confirmation avec le conducteur.</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethodId('mobile-instant')}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  selectedMethodId === 'mobile-instant'
                    ? 'border-slate-900 bg-slate-900/5 shadow-sm'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <Smartphone size={18} className="text-slate-900" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Mobile money instantané</p>
                      <p className="text-xs text-slate-500">
                        Saisis ton numéro (MTN, Orange, Moov) et confirme depuis ton téléphone.
                      </p>
                    </div>
                    <span className="ml-auto rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">
                      Instantané
                    </span>
                  </div>
                  {selectedMethodId === 'mobile-instant' && (
                    <div className="space-y-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {['MTN Money', 'Orange Money', 'Moov Money'].map((provider) => (
                          <button
                            key={provider}
                            type="button"
                            onClick={() => setInstantMobileForm((prev) => ({ ...prev, provider }))}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              instantMobileForm.provider === provider
                                ? 'bg-slate-900 text-white'
                                : 'bg-white text-slate-600 ring-1 ring-slate-200'
                            }`}
                          >
                            {provider}
                          </button>
                        ))}
                      </div>
                      <input
                        type="tel"
                        value={instantMobileForm.phone}
                        onChange={(e) => {
                          setInstantPhoneTouched(true);
                          setInstantMobileForm((prev) => ({ ...prev, phone: e.target.value }));
                        }}
                        onBlur={() => setInstantPhoneTouched(true)}
                        placeholder="+225 07 07 07 07"
                        className={`h-11 w-full rounded-xl border bg-white px-3 text-slate-900 placeholder:text-slate-400 ${
                          instantPhoneTouched && !mobileInstantValid
                            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200'
                            : 'border-slate-300'
                        }`}
                      />
                      {instantPhoneTouched && !mobileInstantValid && (
                        <p className="text-xs text-rose-600">Numéro mobile money invalide.</p>
                      )}
                    </div>
                  )}
                </div>
              </button>
              {methodsLoading && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Chargement…</div>
              )}
              {!methodsLoading &&
                paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setSelectedMethodId(method.id)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      selectedMethodId === method.id
                        ? 'border-slate-900 bg-slate-900/5 shadow-sm'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {method.type === 'CARD' ? (
                        <CreditCard size={18} className="text-slate-900" />
                      ) : (
                        <Smartphone size={18} className="text-slate-900" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{method.label || method.provider || method.type}</p>
                        <p className="text-xs text-slate-500">
                          {method.type === 'CARD'
                            ? `•••• ${method.last4 ?? '****'} · Exp ${method.expiresAt ?? '--/--'}`
                            : method.phoneNumber || 'Numéro inconnu'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteMethod(method.id);
                        }}
                        className="ml-auto text-slate-400 transition hover:text-rose-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </button>
                ))}
            </div>
            {account?.id && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span>
                  Moyen par défaut: <span className="font-semibold text-slate-900">{defaultMethodLabel}</span>
                </span>
                <button
                  type="button"
                  onClick={handleSetDefaultMethod}
                  disabled={selectedMethodId === defaultMethodId}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
                >
                  {selectedMethodId === defaultMethodId ? 'Déjà par défaut' : 'Définir par défaut'}
                </button>
              </div>
            )}
            {showMethodForm && token && (
              <form className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleAddPaymentMethod}>
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Nouveau moyen</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewMethodType('CARD')}
                      className={`rounded-full px-3 py-1 ${
                        newMethodType === 'CARD' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                      }`}
                    >
                      Carte
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMethodType('MOBILE_MONEY')}
                      className={`rounded-full px-3 py-1 ${
                        newMethodType === 'MOBILE_MONEY'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600 ring-1 ring-slate-200'
                      }`}
                    >
                      Mobile money
                    </button>
                  </div>
                </div>
                {newMethodType === 'CARD' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Nom sur la carte</label>
                      <input
                        type="text"
                        value={newCardForm.holder}
                        onChange={(e) => setNewCardForm((prev) => ({ ...prev, holder: e.target.value }))}
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900"
                        placeholder="Koman Traoré"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Numéro</label>
                      <input
                        type="text"
                        value={newCardForm.number}
                        onChange={(e) => setNewCardForm((prev) => ({ ...prev, number: e.target.value }))}
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900"
                        placeholder="4111 1111 1111 1111"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Expiration</label>
                      <input
                        type="text"
                        value={newCardForm.expiry}
                        onChange={(e) => setNewCardForm((prev) => ({ ...prev, expiry: e.target.value }))}
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900"
                        placeholder="08/28"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Opérateur</label>
                      <select
                        value={newMobileForm.provider}
                        onChange={(e) => setNewMobileForm((prev) => ({ ...prev, provider: e.target.value }))}
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900"
                      >
                        <option>MTN Money</option>
                        <option>Orange Money</option>
                        <option>Moov Money</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Numéro</label>
                      <input
                        type="tel"
                        value={newMobileForm.phone}
                        onChange={(e) => setNewMobileForm((prev) => ({ ...prev, phone: e.target.value }))}
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900"
                        placeholder="+225 07 07 07 07"
                        required
                      />
                    </div>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={savingMethod}
                  className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingMethod ? 'Enregistrement…' : 'Enregistrer ce moyen'}
                </button>
              </form>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">Récapitulatif</p>
              <p className="text-xs text-slate-500">Valide ton panier puis passe au paiement moderne.</p>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Prix par place</span>
                <span className="font-semibold text-slate-900">{ride.pricePerSeat.toLocaleString()} XOF</span>
              </div>
              <div className="flex justify-between">
                <span>Places sélectionnées</span>
                <span className="font-semibold text-slate-900">{seats}</span>
              </div>
              <div className="flex justify-between">
                <span>Méthode</span>
                <span className="font-semibold text-slate-900">
                  {selectedMethod?.label || (selectedMethod?.type === 'CASH' ? 'Espèces' : 'À choisir')}
                </span>
              </div>
              {paymentBlockedReason && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {paymentBlockedReason}
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
                <span>Total</span>
                <span>{amount.toLocaleString()} XOF</span>
              </div>
            </div>
            {bookingError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{bookingError}</div>
            )}
            {bookingMessage && !bookingResult && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                {bookingMessage}
              </div>
            )}
            <div className="grid gap-2">
              <button
                disabled={loading || seatsUnavailable}
                onClick={submit}
                className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {loading ? 'Réservation…' : 'Confirmer la réservation'}
              </button>
              <button
                className="rounded-full border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-500"
                onClick={() => nav(-1)}
              >
                Retour
              </button>
            </div>
          </section>
        </div>
      </div>
      {cashCommitmentOpen && bookingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paiement en espèces</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">Je m’engage à payer le jour du départ</p>
            </div>
            <p className="text-sm text-slate-600">
              En choisissant l’espèce, tu confirmes que tu verseras{' '}
              <span className="font-semibold text-slate-900">
                {bookingResult.amount?.toLocaleString?.() ?? bookingResult.amount} XOF
              </span>{' '}
              directement au conducteur avant le départ. Merci d’arriver avec le montant exact.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => setCashCommitmentOpen(false)}
                disabled={paying}
              >
                Annuler
              </button>
              <button
                type="button"
                className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  setCashCommitmentOpen(false);
                  void pay();
                }}
                disabled={paying}
              >
                Je m’engage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
