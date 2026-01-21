import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin, Clock, Users, Sparkles } from 'lucide-react';
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

const toIsoUtc = (date: string, time: string) => {
  if (!date || !time) return '';
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0)).toISOString();
};

export default function CreateRide() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSearch = useApp((state) => state.setSearch);
  const setResults = useApp((state) => state.setResults);
  const setLoading = useApp((state) => state.setLoading);
  const setError = useApp((state) => state.setError);
  const account = useApp((state) => state.account);

  const [form, setForm] = useState<FormState>({
    originCity: 'Abidjan',
    destinationCity: 'Yamoussoukro',
    date: '',
    time: '',
    pricePerSeat: 2000,
    seatsTotal: 3,
    liveTrackingEnabled: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const updateForm = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const isCompany = account?.type === 'COMPANY';

  useEffect(() => {
    if (isCompany) {
      setForm((prev) => ({ ...prev, liveTrackingEnabled: true }));
    }
  }, [isCompany]);

  useEffect(() => {
    const statePrefill = (location.state as { prefill?: Partial<FormState> } | null)?.prefill;
    if (statePrefill) {
      setForm((prev) => ({ ...prev, ...statePrefill }));
    }

    if (!location.search) return;
    const params = new URLSearchParams(location.search);
    if (![...params.keys()].length) return;
    setForm((prev) => ({
      ...prev,
      originCity: params.get('from') || prev.originCity,
      destinationCity: params.get('to') || prev.destinationCity,
      date: params.get('date') || prev.date,
      time: params.get('time') || prev.time,
      pricePerSeat: params.get('price') ? Number(params.get('price')) : prev.pricePerSeat,
      seatsTotal: params.get('seats') ? Number(params.get('seats')) : prev.seatsTotal,
      liveTrackingEnabled: params.get('tracking')
        ? params.get('tracking') === 'true'
        : prev.liveTrackingEnabled,
    }));
  }, [location.search, location.state]);

  const validate = (state: FormState): string | null => {
    if (!state.originCity.trim() || !state.destinationCity.trim()) {
      return 'Précise la ville de départ et d’arrivée.';
    }
    if (!state.date || !state.time) {
      return 'Choisis une date et une heure de départ.';
    }
    if (!Number.isFinite(state.pricePerSeat) || state.pricePerSeat <= 0) {
      return 'Le prix par siège doit être supérieur à 0.';
    }
    if (!Number.isFinite(state.seatsTotal) || state.seatsTotal <= 0) {
      return 'Le nombre de sièges doit être positif.';
    }
    if (!toIsoUtc(state.date, state.time)) {
      return 'Date ou heure invalide.';
    }
    return null;
  };

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setFeedback(null);

    const error = validate(form);
    if (error) {
      setFeedback({ type: 'error', message: error });
      return;
    }

    if (!account?.id) {
      setFeedback({ type: 'error', message: 'Connecte-toi pour publier un trajet.' });
      return;
    }

    const departureAt = toIsoUtc(form.date, form.time);
    const seatsTotal = Math.round(form.seatsTotal);
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
      setFeedback({ type: 'success', message: 'Trajet publié avec succès !' });

      setSearch({
        from: payload.originCity,
        to: payload.destinationCity,
        date: form.date || undefined,
      });
      setResults([]);
      setError(undefined);
      setLoading(true);

      navigate('/results');
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Échec de la création du trajet.' });
    } finally {
      setSubmitting(false);
    }
  };

  const feedbackStyles =
    feedback?.type === 'success'
      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
      : 'bg-red-50 border border-red-200 text-red-700';

  const previewDeparture = form.date && form.time ? `${form.date}T${form.time}` : undefined;
  const previewDepartureLabel = previewDeparture
    ? new Date(previewDeparture).toLocaleString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Date et heure à confirmer';
  const previewRouteLabel = `${form.originCity || 'Départ ?'} → ${form.destinationCity || 'Arrivée ?'}`;
  const previewSeatsLabel = `${form.seatsTotal} siège(s)`;
  const previewPriceLabel = `${Number(form.pricePerSeat || 0).toLocaleString('fr-FR')} XOF`; 
  const extractFirstName = (value?: string | null) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.split(/\s+/)[0];
  };

  const previewDriver =
    extractFirstName(account?.fullName || account?.companyName || account?.email) || 'Profil KariGo';

  const steps = [
    { id: 1, label: 'Itinéraire' },
    { id: 2, label: 'Logistique' },
    { id: 3, label: 'Publication' },
  ];

  return (
    <div className="bg-slate-950/5 py-8">
      <div className="container-wide space-y-8">
        <div className="space-y-3 text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            <Sparkles size={12} />
            Publication express
          </div>
          <h1 className="text-3xl font-semibold text-slate-900">Publier un trajet en quelques étapes</h1>
          <p className="text-sm text-slate-600 max-w-3xl">
            Définis l’itinéraire, précise les détails logistiques puis confirme la publication. La fiche
            est instantanément disponible dans la recherche et partageable par les administrateurs.
          </p>
        </div>

        {feedback && (
          <div className={`px-4 py-3 rounded-xl text-sm ${feedbackStyles}`}>{feedback.message}</div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr),320px]">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <div className="flex items-center gap-3">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-600">
                      {step.id}
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {step.label}
                    </span>
                    {index < steps.length - 1 && <span className="hidden sm:block h-px w-8 bg-slate-200" />}
                  </div>
                ))}
              </div>
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">1. Définir l’itinéraire</h2>
                <span className="text-xs text-slate-500">Choisis des villes connues</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <CityAutocomplete
                  label="Départ"
                  placeholder="Ville de départ"
                  value={form.originCity}
                  onChange={(value) => updateForm({ originCity: value })}
                  onSelect={(value) => updateForm({ originCity: value })}
                />
                <CityAutocomplete
                  label="Arrivée"
                  placeholder="Ville d’arrivée"
                  value={form.destinationCity}
                  onChange={(value) => updateForm({ destinationCity: value })}
                  onSelect={(value) => updateForm({ destinationCity: value })}
                />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">2. Planifier le départ</h2>
                <span className="text-xs text-slate-500">Date limite {minDate}</span>
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
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Prix par siège (XOF)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    className="input w-full"
                    value={form.pricePerSeat}
                    onChange={(e) => updateForm({ pricePerSeat: Number(e.currentTarget.value || 0) })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nombre de sièges
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    className="input w-full"
                    value={form.seatsTotal}
                    onChange={(e) => {
                      const value = Number(e.currentTarget.value || 1);
                      updateForm({ seatsTotal: Math.max(1, Math.min(7, value)) });
                    }}
                    required
                  />
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">Suivi en direct</h2>
                <span className="text-xs text-slate-500">Disponible 15 min avant le départ</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {isCompany
                  ? 'Mode entreprise : le suivi s’active automatiquement 15 min avant le départ, puis bascule en notifications de passage des grandes villes.'
                  : 'Active le suivi pour permettre au passager de voir ta position exacte jusqu’à l’arrivée.'}
              </div>
              {!isCompany && (
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.liveTrackingEnabled}
                    onChange={(e) => updateForm({ liveTrackingEnabled: e.currentTarget.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
                  />
                  Activer le suivi en direct pour ce trajet
                </label>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">3. Publier et partager</h2>
                <span className="text-xs text-slate-500">Résumé automatique envoyé aux admins</span>
              </div>
              <ul className="text-sm text-slate-600 space-y-2">
                <li>• Le trajet sera indexé dans la recherche et visible en admin.</li>
                <li>• Tu peux dupliquer ce formulaire pour planifier une tournée complète.</li>
                <li>
                  • Le trajet sera automatiquement associé à ton profil {account?.fullName ?? account?.companyName ?? ''} pour
                  assurer la traçabilité et les échanges.
                </li>
              </ul>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary px-5 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Publication…' : 'Publier le trajet'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-4 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  Annuler
                </button>
              </div>
            </section>
          </form>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Aperçu du trajet
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Itinéraire</p>
                  <p className="font-semibold text-slate-900 flex items-center gap-2">
                    <MapPin size={14} className="text-sky-500" />
                    {previewRouteLabel}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Départ prévu</p>
                  <p className="font-semibold text-slate-900 flex items-center gap-2">
                    <Clock size={14} className="text-slate-500" />
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
                    <p className="font-semibold text-slate-900">{previewPriceLabel}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500">
                  Chauffeur associé : <span className="font-semibold text-slate-900">{previewDriver}</span>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  Suivi en direct :{' '}
                  <span className="font-semibold text-slate-900">
                    {isCompany || form.liveTrackingEnabled ? 'Activé' : 'Désactivé'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 px-5 py-6 text-white shadow-lg">
              <p className="text-sm font-semibold">Besoin de suivre les réservations ?</p>
              <p className="mt-2 text-xs text-white/80">
                Les admins peuvent, depuis la page dédiée, envoyer la liste complète des trajets par email
                ou les fermer en un clic.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold">
                Accessible après publication
                <ArrowRight size={14} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
