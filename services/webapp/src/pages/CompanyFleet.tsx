import {
  Calendar,
  Car,
  Clock,
  Fuel,
  MapPin,
  Plus,
  RefreshCw,
  Route,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  archiveFleetVehicle,
  cancelFleetSchedule,
  createFleetSchedule,
  createFleetVehicle,
  fetchMyFleet,
  listFleetSchedules,
  updateFleetSchedule,
  updateFleetVehicle,
  type FleetSchedule,
  type FleetScheduleStatus,
  type FleetScheduleRecurrence,
  type FleetVehicle,
  type FleetVehicleStatus,
} from '../api';
import { useApp } from '../store';
import {
  HOME_THEME_STYLE,
  type HomeThemeStyle,
} from '../constants/homePreferences';

type VehicleFormState = {
  label: string;
  plateNumber: string;
  category: string;
  seats: string;
  brand: string;
  model: string;
  year: string;
  amenities: string;
};

type ScheduleDraft = {
  originCity: string;
  destinationCity: string;
  departureAt: string;
  arrivalEstimate: string;
  plannedSeats: string;
  pricePerSeat: string;
  recurrence: FleetScheduleRecurrence;
  notes: string;
};

type ScheduleCache = {
  loading: boolean;
  error?: string;
  window: 'upcoming' | 'past' | 'all';
  items: FleetSchedule[];
};

const INITIAL_VEHICLE_FORM: VehicleFormState = {
  label: '',
  plateNumber: '',
  category: 'MINIBUS',
  seats: '15',
  brand: '',
  model: '',
  year: '',
  amenities: '',
};

const INITIAL_SCHEDULE_DRAFT: ScheduleDraft = {
  originCity: '',
  destinationCity: '',
  departureAt: '',
  arrivalEstimate: '',
  plannedSeats: '',
  pricePerSeat: '',
  recurrence: 'NONE',
  notes: '',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function joinAmenities(list?: string[] | null) {
  if (!list || list.length === 0) return '—';
  return list.join(', ');
}

export default function CompanyFleet() {
  const account = useApp((state) => state.account);
  const isCompany = account?.type === 'COMPANY';
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [summary, setSummary] = useState({
    active: 0,
    inactive: 0,
    fleetSeats: 0,
    upcomingTrips: 0,
  });
  const [error, setError] = useState<string>();
  const [vehicleForm, setVehicleForm] = useState<VehicleFormState>(INITIAL_VEHICLE_FORM);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [expandedVehicle, setExpandedVehicle] = useState<string>();
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, ScheduleDraft>>({});
  const [scheduleCache, setScheduleCache] = useState<Record<string, ScheduleCache>>({});
  const [scheduleSaving, setScheduleSaving] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ALL');

  const theme = account?.homePreferences?.theme ?? 'default';
  const themeStyle: HomeThemeStyle = HOME_THEME_STYLE[theme] ?? HOME_THEME_STYLE.default;
  const heroTokens = themeStyle.hero;
  const surfLight = themeStyle.surface;
  const chipAccent = themeStyle.chips.accent;
  const chipNeutral = themeStyle.chips.neutral;
  const quickAccent = themeStyle.quickActions.active;
  const quickMuted = themeStyle.quickActions.inactive;
  const panelMuted =
    theme === 'night'
      ? 'border border-slate-800 bg-slate-900/70 backdrop-blur-xl text-slate-200'
      : 'border border-slate-200 bg-white shadow-sm';

  const loadFleet = async () => {
    if (!isCompany) return;
    setLoading(true);
    setError(undefined);
    try {
      const data = await fetchMyFleet({
        status: statusFilter,
        limit: 200,
      });
      setVehicles(data.data);
      setSummary(data.summary);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Impossible de charger la flotte');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isCompany) {
      loadFleet();
    }
  }, [isCompany, statusFilter]);

  const handleVehicleFormChange = (field: keyof VehicleFormState, value: string) => {
    setVehicleForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateVehicle = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!vehicleForm.label.trim() || !vehicleForm.plateNumber.trim()) {
      setError('Renseigne au minimum un nom interne et une immatriculation.');
      return;
    }
    const seats = Number(vehicleForm.seats);
    if (!Number.isFinite(seats) || seats <= 0) {
      setError('Nombre de places invalide.');
      return;
    }
    const year = vehicleForm.year.trim() ? Number(vehicleForm.year) : undefined;
    if (year && (!Number.isFinite(year) || year < 1950)) {
      setError('Année de mise en circulation invalide.');
      return;
    }
    const amenities = vehicleForm.amenities
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    setSavingVehicle(true);
    setError(undefined);
    try {
      await createFleetVehicle({
        label: vehicleForm.label.trim(),
        plateNumber: vehicleForm.plateNumber.trim().toUpperCase(),
        category: vehicleForm.category.trim().toUpperCase() || 'MINIBUS',
        seats,
        brand: vehicleForm.brand.trim() || undefined,
        model: vehicleForm.model.trim() || undefined,
        year,
        amenities: amenities.length ? amenities : undefined,
      });
      setVehicleForm(INITIAL_VEHICLE_FORM);
      await loadFleet();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Création impossible');
    } finally {
      setSavingVehicle(false);
    }
  };

  const toggleVehicleStatus = async (vehicle: FleetVehicle) => {
    try {
      await updateFleetVehicle(vehicle.id, {
        status: vehicle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      await loadFleet();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Impossible de modifier le statut');
    }
  };

  const handleArchiveVehicle = async (vehicleId: string) => {
    try {
      await archiveFleetVehicle(vehicleId);
      await loadFleet();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Impossible de désactiver le véhicule');
    }
  };

  const getScheduleDraft = (vehicleId: string): ScheduleDraft =>
    scheduleDrafts[vehicleId] ?? INITIAL_SCHEDULE_DRAFT;

  const updateScheduleDraft = (vehicleId: string, patch: Partial<ScheduleDraft>) => {
    setScheduleDrafts((prev) => ({
      ...prev,
      [vehicleId]: { ...getScheduleDraft(vehicleId), ...patch },
    }));
  };

  const loadSchedules = async (
    vehicleId: string,
    window: 'upcoming' | 'past' | 'all' = 'upcoming',
  ) => {
    setScheduleCache((prev) => ({
      ...prev,
      [vehicleId]: { loading: true, window, items: prev[vehicleId]?.items ?? [] },
    }));
    try {
      const data = await listFleetSchedules(vehicleId, { window });
      setScheduleCache((prev) => ({
        ...prev,
        [vehicleId]: { loading: false, window, items: data.data },
      }));
    } catch (err: any) {
      setScheduleCache((prev) => ({
        ...prev,
        [vehicleId]: {
          loading: false,
          window,
          items: prev[vehicleId]?.items ?? [],
          error: err?.response?.data?.message ?? err?.message ?? 'Erreur de chargement',
        },
      }));
    }
  };

  const handleCreateSchedule = async (vehicle: FleetVehicle) => {
    const draft = getScheduleDraft(vehicle.id);
    if (!draft.originCity.trim() || !draft.destinationCity.trim() || !draft.departureAt.trim()) {
      setError('Complète la ville de départ, d’arrivée et la date/heure de départ.');
      return;
    }

    const plannedSeats = draft.plannedSeats.trim()
      ? Number(draft.plannedSeats.trim())
      : undefined;
    if (plannedSeats !== undefined) {
      if (!Number.isFinite(plannedSeats) || plannedSeats <= 0) {
        setError('Nombre de sièges planifiés invalide.');
        return;
      }
      if (plannedSeats > vehicle.seats) {
        setError('Les sièges planifiés dépassent la capacité du véhicule.');
        return;
      }
    }

    const pricePerSeat = draft.pricePerSeat.trim()
      ? Number(draft.pricePerSeat.trim())
      : undefined;
    if (pricePerSeat !== undefined && (!Number.isFinite(pricePerSeat) || pricePerSeat < 0)) {
      setError('Prix par siège invalide.');
      return;
    }

    setScheduleSaving((prev) => ({ ...prev, [vehicle.id]: true }));
    setError(undefined);
    try {
      await createFleetSchedule(vehicle.id, {
        originCity: draft.originCity.trim(),
        destinationCity: draft.destinationCity.trim(),
        departureAt: new Date(draft.departureAt).toISOString(),
        arrivalEstimate: draft.arrivalEstimate
          ? new Date(draft.arrivalEstimate).toISOString()
          : undefined,
        plannedSeats,
        pricePerSeat,
        recurrence: draft.recurrence,
        notes: draft.notes.trim() || undefined,
      });
      updateScheduleDraft(vehicle.id, INITIAL_SCHEDULE_DRAFT);
      await Promise.all([loadFleet(), loadSchedules(vehicle.id, 'upcoming')]);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Impossible de planifier ce trajet');
    } finally {
      setScheduleSaving((prev) => ({ ...prev, [vehicle.id]: false }));
    }
  };

  const handleScheduleStatus = async (
    vehicleId: string,
    scheduleId: string,
    status: FleetScheduleStatus,
  ) => {
    setError(undefined);
    try {
      if (status === 'CANCELLED') {
        await cancelFleetSchedule(vehicleId, scheduleId);
      } else {
        await updateFleetSchedule(vehicleId, scheduleId, { status });
      }
      await Promise.all([loadFleet(), loadSchedules(vehicleId, 'upcoming')]);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Action impossible sur ce planning');
    }
  };

  const expandedSchedules = expandedVehicle ? scheduleCache[expandedVehicle] : undefined;

  const renderScheduleList = (vehicle: FleetVehicle) => {
    const cache = scheduleCache[vehicle.id];
    const items = cache?.items ?? vehicle.upcomingSchedules ?? [];
    return (
      <div className="mt-4 space-y-3">
        {items.length === 0 && (
          <div className={`rounded-xl px-4 py-4 text-sm ${chipNeutral}`}>
            Aucun trajet planifié. Ajoute un créneau pour ce véhicule.
          </div>
        )}
        {items.map((schedule) => {
          const statusTone =
            schedule.status === 'PLANNED'
              ? chipAccent
              : schedule.status === 'COMPLETED'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-600';
          return (
            <div
              key={schedule.id}
              className={`rounded-xl border px-4 py-3 text-sm ${statusTone}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Route size={16} />
                  <span className="font-semibold">
                    {schedule.originCity} → {schedule.destinationCity}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 text-xs">
                  <Calendar size={14} />
                  {formatDate(schedule.departureAt)}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-2">
                  <Clock size={12} />
                  Départ dans{' '}
                  {(() => {
                    const diff =
                      new Date(schedule.departureAt).getTime() - Date.now();
                    if (!Number.isFinite(diff) || diff <= 0) return 'moins de 24h';
                    const hours = Math.round(diff / 3_600_000);
                    if (hours < 24) return `${hours}h`;
                    const days = Math.round(hours / 24);
                    return `${days} jour(s)`;
                  })()}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Car size={12} />
                  {schedule.plannedSeats} sièges planifiés
                </span>
                {schedule.pricePerSeat > 0 && (
                  <span className="inline-flex items-center gap-2">
                    <Fuel size={12} />
                    {schedule.pricePerSeat.toLocaleString()} XOF / siège
                  </span>
                )}
                {schedule.recurrence !== 'NONE' && (
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw size={12} />
                    {schedule.recurrence === 'DAILY' ? 'Quotidien' : 'Hebdomadaire'}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {schedule.status === 'PLANNED' && (
                  <>
                    <button
                      onClick={() => handleScheduleStatus(vehicle.id, schedule.id, 'COMPLETED')}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                    >
                      Marquer réalisé
                    </button>
                    <button
                      onClick={() => handleScheduleStatus(vehicle.id, schedule.id, 'CANCELLED')}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50"
                    >
                      Annuler
                    </button>
                  </>
                )}
                {schedule.status === 'CANCELLED' && (
                  <button
                    onClick={() => handleScheduleStatus(vehicle.id, schedule.id, 'PLANNED')}
                    className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-medium text-sky-600 hover:bg-sky-50"
                  >
                    Réouvrir
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {cache?.error && (
          <div className="text-xs text-amber-600">{cache.error}</div>
        )}
      </div>
    );
  };

  const vehiclesVisible = useMemo(() => {
    if (statusFilter === 'ALL') return vehicles;
    return vehicles.filter((vehicle) => vehicle.status === statusFilter);
  }, [vehicles, statusFilter]);

  if (!isCompany) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-800">Accès réservé</h1>
          <p className="mt-3 text-sm text-slate-600">
            La gestion de flotte est disponible pour les comptes entreprise. Passe sur un compte
            « COMPANY » ou contacte un administrateur pour être promu.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)]">
      <section className="relative overflow-hidden pb-10">
        <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${themeStyle.gradient}`} />
        {themeStyle.pattern && (
          <div className={`absolute inset-0 -z-10 opacity-80 ${themeStyle.pattern}`} />
        )}
        <div className="container-wide py-10 space-y-8">
          <header className="space-y-4">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide ${heroTokens.badge}`}
            >
              Flotte entreprise
            </span>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2">
                <h1 className={`text-3xl font-bold leading-tight ${heroTokens.title}`}>
                  Planifie tes véhicules et tes voyages récurrents
                </h1>
                <p className={`max-w-2xl text-sm ${heroTokens.text}`}>
                  Renseigne les caractéristiques de ta flotte, harmonise les départs à venir et
                  surveille d’un coup d’œil la capacité disponible pour tes passagers.
                </p>
              </div>
              <div className="flex gap-3 text-xs">
                <span className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 ${chipAccent}`}>
                  <Car size={14} />
                  {summary.active} actifs
                </span>
                <span className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 ${chipNeutral}`}>
                  <Clock size={14} />
                  {summary.upcomingTrips} trajets planifiés
                </span>
              </div>
            </div>
          </header>

          <div className={`grid gap-4 sm:grid-cols-4 ${panelMuted}`}>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`rounded-xl px-4 py-4 text-left transition ${
                statusFilter === 'ALL' ? quickAccent : quickMuted
              }`}
            >
              <p className="text-xs font-semibold uppercase">Flotte complète</p>
              <p className="mt-2 text-lg font-semibold">{vehicles.length}</p>
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`rounded-xl px-4 py-4 text-left transition ${
                statusFilter === 'ACTIVE' ? quickAccent : quickMuted
              }`}
            >
              <p className="text-xs font-semibold uppercase">Actifs</p>
              <p className="mt-2 text-lg font-semibold">{summary.active}</p>
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`rounded-xl px-4 py-4 text-left transition ${
                statusFilter === 'INACTIVE' ? quickAccent : quickMuted
              }`}
            >
              <p className="text-xs font-semibold uppercase">En pause</p>
              <p className="mt-2 text-lg font-semibold">{summary.inactive}</p>
            </button>
            <div className="rounded-xl px-4 py-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Capacité totale
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-800">
                {summary.fleetSeats.toLocaleString()} sièges
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Répartis sur {vehicles.length} véhicule(s)
              </p>
            </div>
          </div>

          <form
            onSubmit={handleCreateVehicle}
            className={`rounded-3xl px-6 py-6 space-y-4 ${surfLight}`}
          >
            <div className="flex items-center gap-3">
              <Plus size={18} />
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                Ajouter un véhicule
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Nom interne</label>
                <input
                  className="input input-sm w-full"
                  placeholder="Sprinter Abidjan 01"
                  value={vehicleForm.label}
                  onChange={(e) => handleVehicleFormChange('label', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Immatriculation</label>
                <input
                  className="input input-sm w-full uppercase"
                  placeholder="XX-123-XX"
                  value={vehicleForm.plateNumber}
                  onChange={(e) => handleVehicleFormChange('plateNumber', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Catégorie</label>
                <select
                  className="input input-sm w-full"
                  value={vehicleForm.category}
                  onChange={(e) => handleVehicleFormChange('category', e.target.value)}
                >
                  <option value="MINIBUS">Minibus</option>
                  <option value="BUS">Bus</option>
                  <option value="SUV">SUV</option>
                  <option value="SEDAN">Berline</option>
                  <option value="VAN">Van</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Sièges</label>
                <input
                  type="number"
                  min={1}
                  className="input input-sm w-full"
                  value={vehicleForm.seats}
                  onChange={(e) => handleVehicleFormChange('seats', e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Marque</label>
                <input
                  className="input input-sm w-full"
                  value={vehicleForm.brand}
                  onChange={(e) => handleVehicleFormChange('brand', e.target.value)}
                  placeholder="Toyota"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Modèle</label>
                <input
                  className="input input-sm w-full"
                  value={vehicleForm.model}
                  onChange={(e) => handleVehicleFormChange('model', e.target.value)}
                  placeholder="Coaster"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Année</label>
                <input
                  className="input input-sm w-full"
                  value={vehicleForm.year}
                  onChange={(e) => handleVehicleFormChange('year', e.target.value)}
                  placeholder="2022"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">
                  Equipements (séparés par une virgule)
                </label>
                <input
                  className="input input-sm w-full"
                  value={vehicleForm.amenities}
                  onChange={(e) => handleVehicleFormChange('amenities', e.target.value)}
                  placeholder="Climatisation, Wi-Fi, Sièges inclinables"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingVehicle}
                className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={16} />
                {savingVehicle ? 'Ajout…' : 'Ajouter'}
              </button>
            </div>
          </form>

          {error && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
              Chargement de ta flotte…
            </div>
          ) : vehiclesVisible.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-8 text-center text-sm text-slate-500">
              Aucun véhicule pour le moment. Ajoute ton premier minibus ou bus depuis le formulaire
              ci-dessus.
            </div>
          ) : (
            <div className="space-y-6">
              {vehiclesVisible.map((vehicle) => {
                const draft = getScheduleDraft(vehicle.id);
                const scheduleBusy = scheduleSaving[vehicle.id];
                return (
                  <div key={vehicle.id} className={`rounded-3xl px-6 py-6 ${surfLight}`}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                            <Car size={20} />
                          </span>
                          <div>
                            <h3 className="text-lg font-semibold text-slate-800">
                              {vehicle.label}{' '}
                              <span className="text-sm text-slate-500">
                                ({vehicle.plateNumber})
                              </span>
                            </h3>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={12} />
                                {vehicle.category}
                              </span>
                              <span>{vehicle.seats} sièges</span>
                              {vehicle.brand && (
                                <span>
                                  {vehicle.brand} {vehicle.model ?? ''}
                                </span>
                              )}
                              {vehicle.year && <span>Année {vehicle.year}</span>}
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  vehicle.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {vehicle.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
                              </span>
                              {vehicle.metrics && (
                                <span className="inline-flex items-center gap-1">
                                  <Calendar size={12} />
                                  {vehicle.metrics.upcomingTrips} départ(s) à venir
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500">
                          {joinAmenities(vehicle.amenities)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleVehicleStatus(vehicle)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          {vehicle.status === 'ACTIVE' ? 'Mettre en pause' : 'Réactiver'}
                        </button>
                        <button
                          onClick={() => handleArchiveVehicle(vehicle.id)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Archiver
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,360px),1fr]">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                        <h4 className="text-xs font-semibold uppercase text-slate-500">
                          Planifier un trajet
                        </h4>
                        <div className="mt-3 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="text-xs font-semibold text-slate-500">
                                Départ
                              </label>
                              <input
                                className="input input-sm w-full"
                                value={draft.originCity}
                                onChange={(e) =>
                                  updateScheduleDraft(vehicle.id, { originCity: e.target.value })
                                }
                                placeholder="Abidjan"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-500">
                                Arrivée
                              </label>
                              <input
                                className="input input-sm w-full"
                                value={draft.destinationCity}
                                onChange={(e) =>
                                  updateScheduleDraft(vehicle.id, { destinationCity: e.target.value })
                                }
                                placeholder="Yamoussoukro"
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="text-xs font-semibold text-slate-500">
                                Départ (date & heure)
                              </label>
                              <input
                                type="datetime-local"
                                className="input input-sm w-full"
                                value={draft.departureAt}
                                onChange={(e) =>
                                  updateScheduleDraft(vehicle.id, { departureAt: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-500">
                                Estimation d’arrivée
                              </label>
                              <input
                                type="datetime-local"
                                className="input input-sm w-full"
                                value={draft.arrivalEstimate}
                                onChange={(e) =>
                                  updateScheduleDraft(vehicle.id, { arrivalEstimate: e.target.value })
                                }
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <label className="text-xs font-semibold text-slate-500">
                                Sièges à publier
                              </label>
                              <input
                                className="input input-sm w-full"
                                placeholder={`${vehicle.seats}`}
                                value={draft.plannedSeats}
                                onChange={(e) =>
                                  updateScheduleDraft(vehicle.id, { plannedSeats: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-500">
                                Prix / siège (XOF)
                              </label>
                              <input
                                className="input input-sm w-full"
                                value={draft.pricePerSeat}
                                onChange={(e) =>
                                  updateScheduleDraft(vehicle.id, { pricePerSeat: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-500">
                                Récurrence
                              </label>
                              <select
                                className="input input-sm w-full"
                                value={draft.recurrence}
                                onChange={(e) =>
                                  updateScheduleDraft(vehicle.id, {
                                    recurrence: e.target.value as FleetScheduleRecurrence,
                                  })
                                }
                              >
                                <option value="NONE">Aucune</option>
                                <option value="DAILY">Quotidienne</option>
                                <option value="WEEKLY">Hebdomadaire</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-500">Notes</label>
                            <textarea
                              className="input input-sm w-full"
                              rows={2}
                              value={draft.notes}
                              onChange={(e) =>
                                updateScheduleDraft(vehicle.id, { notes: e.target.value })
                              }
                              placeholder="Instructions pour le conducteur, point de rendez-vous…"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={scheduleBusy}
                            onClick={() => handleCreateSchedule(vehicle)}
                            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Calendar size={14} />
                            {scheduleBusy ? 'Planification…' : 'Planifier'}
                          </button>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold uppercase text-slate-500">
                            Prochains départs
                          </h4>
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              className="rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-100"
                              onClick={() => loadSchedules(vehicle.id, 'upcoming')}
                            >
                              Rafraîchir
                            </button>
                            <button
                              className="rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-100"
                              onClick={() => {
                                setExpandedVehicle((prev) =>
                                  prev === vehicle.id ? undefined : vehicle.id,
                                );
                                if (expandedVehicle !== vehicle.id) {
                                  loadSchedules(vehicle.id, 'upcoming');
                                }
                              }}
                            >
                              Historique
                            </button>
                          </div>
                        </div>
                        {renderScheduleList(vehicle)}
                        {expandedVehicle === vehicle.id && (
                          <div className="mt-3 flex gap-2 text-xs text-slate-500">
                            <button
                              className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-100"
                              onClick={() => loadSchedules(vehicle.id, 'all')}
                            >
                              Tout afficher
                            </button>
                            <button
                              className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-100"
                              onClick={() => loadSchedules(vehicle.id, 'past')}
                            >
                              Trajets passés
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
