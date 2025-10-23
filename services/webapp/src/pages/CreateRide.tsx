import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  driverId: string;
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
  const setSearch = useApp((state) => state.setSearch);
  const setResults = useApp((state) => state.setResults);
  const setLoading = useApp((state) => state.setLoading);
  const setError = useApp((state) => state.setError);

  const [form, setForm] = useState<FormState>({
    originCity: 'Abidjan',
    destinationCity: 'Yamoussoukro',
    date: '',
    time: '',
    pricePerSeat: 2000,
    seatsTotal: 3,
    driverId: 'drv-seed',
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const updateForm = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

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
    if (!state.driverId.trim()) {
      return 'Indique un identifiant chauffeur.';
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

    const departureAt = toIsoUtc(form.date, form.time);
    const payload = {
      originCity: form.originCity.trim(),
      destinationCity: form.destinationCity.trim(),
      departureAt,
      pricePerSeat: Math.round(form.pricePerSeat),
      seatsTotal: Math.round(form.seatsTotal),
      driverId: form.driverId.trim(),
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

  return (
    <div className="container-wide py-8 md:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
            Publier un trajet
          </h1>
          <p className="text-sm text-slate-600">
            Renseigne les informations principales du trajet pour le rendre visible dans la
            recherche.
          </p>
        </div>

        {feedback && (
          <div className={`px-4 py-3 rounded-xl text-sm ${feedbackStyles}`}>{feedback.message}</div>
        )}

        <form className="card p-6 md:p-8 space-y-6" onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-2 gap-4">
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

          <div className="grid md:grid-cols-2 gap-4">
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

          <div className="grid md:grid-cols-3 gap-4">
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
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Chauffeur (ID PoC)
              </label>
              <input
                className="input w-full"
                value={form.driverId}
                onChange={(e) => updateForm({ driverId: e.currentTarget.value })}
                required
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
        </form>
      </div>
    </div>
  );
}
