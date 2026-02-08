import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  MapPinned,
  Navigation,
  Route,
  Sparkles,
  Users,
} from 'lucide-react';
import CityAutocomplete from '../components/CityAutocomplete';
import { createRide } from '../api';
import { useApp } from '../store';

type FormState = {
  originCity: string;
  destinationCity: string;
  date: string;
  time: string;
  pricePerSeat: number;
  seatsTotal: number;
  liveTrackingEnabled: boolean;
};

type Feedback = { type: 'error' | 'success'; message: string } | null;
type FieldErrors = Partial<Record<keyof FormState | 'route' | 'departureAt', string>>;

type RouteTemplate = {
  id: string;
  originCity: string;
  destinationCity: string;
  pricePerSeat: number;
  seatsTotal: number;
};

const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toIsoUtc = (date: string, time: string) => {
  if (!date || !time) return '';
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return '';
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0)).toISOString();
};

const toInputDate = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toInputTime = (value: Date) => {
  const hour = `${value.getHours()}`.padStart(2, '0');
  const minute = `${value.getMinutes()}`.padStart(2, '0');
  return `${hour}:${minute}`;
};

const roundToNextQuarter = (value: Date) => {
  const copy = new Date(value);
  copy.setSeconds(0, 0);
  const minutes = copy.getMinutes();
  const rounded = Math.ceil(minutes / 15) * 15;
  copy.setMinutes(rounded);
  return copy;
};

const getDefaultDeparture = () => {
  const now = new Date();
  now.setHours(now.getHours() + 1);
  const date = roundToNextQuarter(now);
  return {
    date: toInputDate(date),
    time: toInputTime(date),
  };
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

const ROUTE_TEMPLATES: RouteTemplate[] = [
  { id: 'abj-yam', originCity: 'Abidjan', destinationCity: 'Yamoussoukro', pricePerSeat: 2000, seatsTotal: 3 },
  { id: 'abj-bke', originCity: 'Abidjan', destinationCity: 'Bouake', pricePerSeat: 2500, seatsTotal: 3 },
  { id: 'bke-kgo', originCity: 'Bouake', destinationCity: 'Korhogo', pricePerSeat: 3500, seatsTotal: 3 },
];

const PRICE_PRESETS = [1500, 2000, 2500, 3000, 4000, 5000];

export default function CreateRide() {
  const navigate = useNavigate();
  const location = useLocation();
  const account = useApp((state) => state.account);

  const defaultDeparture = useMemo(() => getDefaultDeparture(), []);
  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [form, setForm] = useState<FormState>({
    originCity: 'Abidjan',
    destinationCity: 'Yamoussoukro',
    date: defaultDeparture.date,
    time: defaultDeparture.time,
    pricePerSeat: 2000,
    seatsTotal: 3,
    liveTrackingEnabled: false,
  });
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [advancedMode, setAdvancedMode] = useState(false);

  const isCompany = account?.type === 'COMPANY';

  const updateForm = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const applyTemplate = (template: RouteTemplate) => {
    setForm((prev) => ({
      ...prev,
      originCity: template.originCity,
      destinationCity: template.destinationCity,
      pricePerSeat: template.pricePerSeat,
      seatsTotal: template.seatsTotal,
    }));
    setErrors((prev) => ({ ...prev, originCity: undefined, destinationCity: undefined, route: undefined }));
  };

  const swapRoute = () => {
    setForm((prev) => ({
      ...prev,
      originCity: prev.destinationCity,
      destinationCity: prev.originCity,
    }));
    setErrors((prev) => ({ ...prev, originCity: undefined, destinationCity: undefined, route: undefined }));
  };

  const applyDeparturePreset = (departureDate: Date) => {
    updateForm({
      date: toInputDate(departureDate),
      time: toInputTime(departureDate),
    });
    setErrors((prev) => ({ ...prev, date: undefined, time: undefined, departureAt: undefined }));
  };

  useEffect(() => {
    if (isCompany) {
      setForm((prev) => ({ ...prev, liveTrackingEnabled: true }));
    }
  }, [isCompany]);

  useEffect(() => {
    const statePrefill = (location.state as { prefill?: Partial<FormState> } | null)?.prefill;
    if (statePrefill) {
      setForm((prev) => ({
        ...prev,
        ...statePrefill,
        seatsTotal: statePrefill.seatsTotal
          ? clampNumber(Number(statePrefill.seatsTotal), 1, 8)
          : prev.seatsTotal,
        pricePerSeat: statePrefill.pricePerSeat
          ? clampNumber(Number(statePrefill.pricePerSeat), 500, 100000)
          : prev.pricePerSeat,
      }));
    }

    if (!location.search) return;
    const params = new URLSearchParams(location.search);
    if (![...params.keys()].length) return;

    const seatsParam = Number(params.get('seats'));
    const priceParam = Number(params.get('price'));

    setForm((prev) => ({
      ...prev,
      originCity: params.get('from') || prev.originCity,
      destinationCity: params.get('to') || prev.destinationCity,
      date: params.get('date') || prev.date,
      time: params.get('time') || prev.time,
      seatsTotal: Number.isFinite(seatsParam) && seatsParam > 0 ? clampNumber(seatsParam, 1, 8) : prev.seatsTotal,
      pricePerSeat:
        Number.isFinite(priceParam) && priceParam > 0
          ? clampNumber(priceParam, 500, 100000)
          : prev.pricePerSeat,
      liveTrackingEnabled: params.get('tracking')
        ? params.get('tracking') === 'true'
        : prev.liveTrackingEnabled,
    }));
  }, [location.search, location.state]);

  const validateStepOne = (state: FormState): FieldErrors => {
    const nextErrors: FieldErrors = {};

    if (!state.originCity.trim()) nextErrors.originCity = 'Choisis une ville de depart.';
    if (!state.destinationCity.trim()) nextErrors.destinationCity = "Choisis une ville d'arrivee.";

    if (
      state.originCity.trim() &&
      state.destinationCity.trim() &&
      normalizeText(state.originCity) === normalizeText(state.destinationCity)
    ) {
      nextErrors.route = "Le depart et l'arrivee doivent etre differents.";
    }

    if (!state.date) nextErrors.date = 'Choisis une date.';
    if (!state.time) nextErrors.time = 'Choisis une heure.';

    const departureIso = toIsoUtc(state.date, state.time);
    if (!departureIso) {
      nextErrors.departureAt = 'Date ou heure invalide.';
    } else if (Date.parse(departureIso) < Date.now() + 5 * 60 * 1000) {
      nextErrors.departureAt = 'Le depart doit etre dans le futur.';
    }

    return nextErrors;
  };

  const validateStepTwo = (state: FormState): FieldErrors => {
    const nextErrors: FieldErrors = {};
    if (!Number.isFinite(state.pricePerSeat) || state.pricePerSeat < 500) {
      nextErrors.pricePerSeat = 'Definis un prix d au moins 500 XOF.';
    }
    if (!Number.isFinite(state.seatsTotal) || state.seatsTotal < 1 || state.seatsTotal > 8) {
      nextErrors.seatsTotal = 'Le nombre de sieges doit etre entre 1 et 8.';
    }
    return nextErrors;
  };

  const validateForm = (state: FormState) => ({
    ...validateStepOne(state),
    ...validateStepTwo(state),
  });

  const moveToStepTwo = () => {
    const stepErrors = validateStepOne(form);
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      setFeedback({ type: 'error', message: 'Complete d abord les informations de trajet.' });
      return;
    }
    setErrors({});
    setFeedback(null);
    setCurrentStep(2);
  };

  const extractFirstName = (value?: string | null) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.split(/\s+/)[0];
  };

  const previewDriver =
    extractFirstName(account?.fullName || account?.companyName || account?.email) || 'Profil KariGo';

  const previewDeparture = form.date && form.time ? `${form.date}T${form.time}` : undefined;
  const previewDepartureLabel = previewDeparture
    ? new Date(previewDeparture).toLocaleString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Date et heure a confirmer';

  const previewRouteLabel = `${form.originCity || 'Depart'} -> ${form.destinationCity || 'Arrivee'}`;
  const previewPriceLabel = `${Number(form.pricePerSeat || 0).toLocaleString('fr-FR')} XOF`;
  const previewSeatsLabel = `${form.seatsTotal} place${form.seatsTotal > 1 ? 's' : ''}`;
  const previewEstimatedRevenue = form.pricePerSeat * form.seatsTotal;

  const feedbackStyles =
    feedback?.type === 'success'
      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
      : 'bg-red-50 border border-red-200 text-red-700';

  const now = new Date();
  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(now.getDate() + 1);
  tomorrowMorning.setHours(8, 0, 0, 0);

  const tomorrowEvening = new Date(now);
  tomorrowEvening.setDate(now.getDate() + 1);
  tomorrowEvening.setHours(18, 0, 0, 0);

  const tonight = new Date(now);
  tonight.setHours(now.getHours() >= 18 ? 20 : 18, 0, 0, 0);
  if (tonight.getTime() < now.getTime()) {
    tonight.setDate(tonight.getDate() + 1);
  }

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();

    if (currentStep === 1) {
      moveToStepTwo();
      return;
    }

    setFeedback(null);
    const nextErrors = validateForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setFeedback({ type: 'error', message: 'Corrige les champs obligatoires avant publication.' });
      return;
    }

    if (!account?.id) {
      setFeedback({ type: 'error', message: 'Connecte-toi pour publier un trajet.' });
      return;
    }

    const departureAt = toIsoUtc(form.date, form.time);
    const seatsTotal = clampNumber(Math.round(form.seatsTotal), 1, 8);
    const liveTrackingEnabled = isCompany ? true : Boolean(form.liveTrackingEnabled);
    const payload = {
      originCity: form.originCity.trim(),
      destinationCity: form.destinationCity.trim(),
      departureAt,
      pricePerSeat: Math.round(form.pricePerSeat),
      seatsTotal,
      seatsAvailable: seatsTotal,
      driverId: account.id,
      driverLabel: previewDriver,
      driverPhotoUrl: account.profilePhotoUrl ?? undefined,
      liveTrackingEnabled,
      liveTrackingMode: liveTrackingEnabled ? (isCompany ? 'CITY_ALERTS' : 'FULL') : undefined,
    };

    try {
      setSubmitting(true);
      await createRide(payload);
      navigate('/my-trips?published=1');
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Echec de la creation du trajet.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-950/5 py-8">
      <div className="container-wide space-y-8">
        <div className="space-y-3 text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            <Sparkles size={12} />
            Publication simplifiee
          </div>
          <h1 className="text-3xl font-semibold text-slate-900">Publier un trajet devient tres simple</h1>
          <p className="text-sm text-slate-600 max-w-3xl">
            2 etapes: choisis l'itineraire, puis confirme prix et places. Le trajet apparait ensuite directement dans
            "Mes trajets".
          </p>
        </div>

        {feedback && <div className={`px-4 py-3 rounded-xl text-sm ${feedbackStyles}`}>{feedback.message}</div>}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr),320px]">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <section className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    currentStep === 1
                      ? 'bg-sky-600 text-white shadow shadow-sky-200/60'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-700'
                  }`}
                >
                  1. Itineraire
                </button>
                <button
                  type="button"
                  onClick={moveToStepTwo}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    currentStep === 2
                      ? 'bg-sky-600 text-white shadow shadow-sky-200/60'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-700'
                  }`}
                >
                  2. Prix et publication
                </button>
              </div>
            </section>

            {currentStep === 1 ? (
              <>
                <section className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Etape 1: itineraire</h2>
                    <span className="text-xs text-slate-500">Utilise un modele en 1 clic</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ROUTE_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
                      >
                          {template.originCity}
                          {' -> '}
                          {template.destinationCity}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),auto,minmax(0,1fr)] md:items-end">
                    <CityAutocomplete
                      label="Depart"
                      placeholder="Ville de depart"
                      value={form.originCity}
                      onChange={(value) => updateForm({ originCity: value })}
                      onSelect={(value) => updateForm({ originCity: value })}
                    />
                    <button
                      type="button"
                      onClick={swapRoute}
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
                    >
                      Inverser
                    </button>
                    <CityAutocomplete
                      label="Arrivee"
                      placeholder="Ville d'arrivee"
                      value={form.destinationCity}
                      onChange={(value) => updateForm({ destinationCity: value })}
                      onSelect={(value) => updateForm({ destinationCity: value })}
                    />
                  </div>
                  {errors.originCity ? <p className="text-xs text-red-600">{errors.originCity}</p> : null}
                  {errors.destinationCity ? <p className="text-xs text-red-600">{errors.destinationCity}</p> : null}
                  {errors.route ? <p className="text-xs text-red-600">{errors.route}</p> : null}
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Date et heure</h2>
                    <span className="text-xs text-slate-500">Date min: {minDate}</span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                      <input
                        type="date"
                        className="input w-full"
                        min={minDate}
                        value={form.date}
                        onChange={(e) => updateForm({ date: e.currentTarget.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Heure</label>
                      <input
                        type="time"
                        className="input w-full"
                        value={form.time}
                        onChange={(e) => updateForm({ time: e.currentTarget.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applyDeparturePreset(tonight)}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-sky-200 hover:text-sky-700"
                    >
                      Ce soir
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDeparturePreset(tomorrowMorning)}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-sky-200 hover:text-sky-700"
                    >
                      Demain matin
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDeparturePreset(tomorrowEvening)}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-sky-200 hover:text-sky-700"
                    >
                      Demain soir
                    </button>
                  </div>
                  {errors.date ? <p className="text-xs text-red-600">{errors.date}</p> : null}
                  {errors.time ? <p className="text-xs text-red-600">{errors.time}</p> : null}
                  {errors.departureAt ? <p className="text-xs text-red-600">{errors.departureAt}</p> : null}
                </section>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={moveToStepTwo}
                    className="btn-primary px-5 py-3 inline-flex items-center gap-2"
                  >
                    Continuer <ArrowRight size={16} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <section className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Etape 2: prix et places</h2>
                    <button
                      type="button"
                      onClick={() => setAdvancedMode((prev) => !prev)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      {advancedMode ? 'Mode simple' : 'Mode avance'}
                    </button>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-600">Nombre de places</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateForm({ seatsTotal: clampNumber(form.seatsTotal - 1, 1, 8) })}
                          className="h-11 w-11 rounded-xl border border-slate-200 text-lg font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          -
                        </button>
                        <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-center text-lg font-semibold text-slate-900">
                          {form.seatsTotal}
                        </div>
                        <button
                          type="button"
                          onClick={() => updateForm({ seatsTotal: clampNumber(form.seatsTotal + 1, 1, 8) })}
                          className="h-11 w-11 rounded-xl border border-slate-200 text-lg font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          +
                        </button>
                      </div>
                      {errors.seatsTotal ? <p className="text-xs text-red-600">{errors.seatsTotal}</p> : null}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-600">Prix par place (XOF)</label>
                      <input
                        type="range"
                        min={500}
                        max={15000}
                        step={100}
                        value={clampNumber(form.pricePerSeat, 500, 15000)}
                        onChange={(e) => updateForm({ pricePerSeat: Number(e.currentTarget.value) })}
                        className="w-full"
                      />
                      <input
                        type="number"
                        min={500}
                        max={100000}
                        step={100}
                        className="input w-full"
                        value={form.pricePerSeat}
                        onChange={(e) =>
                          updateForm({
                            pricePerSeat: clampNumber(Number(e.currentTarget.value || 500), 500, 100000),
                          })
                        }
                        required
                      />
                      <div className="flex flex-wrap gap-2">
                        {PRICE_PRESETS.map((price) => (
                          <button
                            key={price}
                            type="button"
                            onClick={() => updateForm({ pricePerSeat: price })}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-sky-200 hover:text-sky-700"
                          >
                            {price.toLocaleString('fr-FR')} XOF
                          </button>
                        ))}
                      </div>
                      {errors.pricePerSeat ? <p className="text-xs text-red-600">{errors.pricePerSeat}</p> : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {isCompany
                      ? 'Mode entreprise: le suivi en direct est active automatiquement.'
                      : 'Tu peux activer le suivi en direct pour rassurer les passagers.'}
                  </div>

                  {!isCompany ? (
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.liveTrackingEnabled}
                        onChange={(e) => updateForm({ liveTrackingEnabled: e.currentTarget.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
                      />
                      Activer le suivi en direct
                    </label>
                  ) : null}

                  {advancedMode ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500 space-y-1">
                      <p>Le trajet sera indexe dans la recherche juste apres creation.</p>
                      <p>Tu pourras le retrouver et le partager depuis "Mes trajets".</p>
                    </div>
                  ) : null}
                </section>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-4 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100"
                  >
                    Retour
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary px-5 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Publication...' : 'Publier le trajet'}
                  </button>
                </div>
              </>
            )}
          </form>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resume instantane</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Itineraire</p>
                  <p className="font-semibold text-slate-900 flex items-center gap-2">
                    <MapPinned size={14} className="text-sky-500" />
                    {previewRouteLabel}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Depart prevu</p>
                  <p className="font-semibold text-slate-900 flex items-center gap-2">
                    <CalendarClock size={14} className="text-slate-500" />
                    {previewDepartureLabel}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">Places</p>
                    <p className="font-semibold text-slate-900 flex items-center gap-2">
                      <Users size={14} />
                      {previewSeatsLabel}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">Prix</p>
                    <p className="font-semibold text-slate-900 flex items-center gap-2">
                      <CircleDollarSign size={14} />
                      {previewPriceLabel}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500">
                  Chauffeur associe: <span className="font-semibold text-slate-900">{previewDriver}</span>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  Revenu theorique maximal:{' '}
                  <span className="font-semibold text-slate-900">{previewEstimatedRevenue.toLocaleString('fr-FR')} XOF</span>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
                  <Route size={14} className="text-slate-400" />
                  {isCompany || form.liveTrackingEnabled ? 'Suivi en direct active' : 'Suivi en direct desactive'}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 px-5 py-6 text-white shadow-lg">
              <p className="text-sm font-semibold">Flux optimise production</p>
              <p className="mt-2 text-xs text-white/80">
                Ce parcours est adapte a un usage sur adresse publique: formulaire court, validation immediate et
                redirection directe vers "Mes trajets".
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold">
                <Navigation size={14} />
                Pret a publier
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
