import {
  BadgeCheck,
  BarChart3,
  Calendar,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  FileText,
  Fuel,
  MapPin,
  Plus,
  RefreshCw,
  Route,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  archiveFleetVehicle,
  approveCompanySchedule,
  cancelFleetSchedule,
  createFleetSchedule,
  createFleetVehicle,
  downloadCompanyInvoiceCsv,
  fetchMyFleet,
  getCompanyDashboard,
  getCompanyInvoice,
  getCompanyPolicy,
  listFleetSchedules,
  rejectCompanySchedule,
  updateCompanyPolicy,
  updateFleetSchedule,
  updateFleetVehicle,
  type CompanyPolicy,
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

type ApprovalItem = FleetSchedule & {
  vehicleLabel: string;
  vehiclePlate: string;
};

type PolicyDraftWindow = {
  days: string;
  start: string;
  end: string;
};

type PolicyDraft = {
  maxPricePerSeat: string;
  allowedOrigins: string;
  allowedDestinations: string;
  requireApproval: boolean;
  blackoutWindows: PolicyDraftWindow[];
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

const INITIAL_POLICY_DRAFT: PolicyDraft = {
  maxPricePerSeat: '',
  allowedOrigins: '',
  allowedDestinations: '',
  requireApproval: false,
  blackoutWindows: [{ days: '', start: '', end: '' }],
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

function parseDayList(value: string) {
  const days = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((num) => Number.isFinite(num) && num >= 0 && num <= 7);
  return days.length ? days : undefined;
}

function normalizePolicyDraft(policy?: CompanyPolicy | null): PolicyDraft {
  if (!policy) return INITIAL_POLICY_DRAFT;
  const windows = (policy.blackoutWindows ?? []).map((window) => ({
    days: window.days?.join(', ') ?? '',
    start: window.start ?? '',
    end: window.end ?? '',
  }));
  return {
    maxPricePerSeat: policy.maxPricePerSeat != null ? String(policy.maxPricePerSeat) : '',
    allowedOrigins: (policy.allowedOrigins ?? []).join(', '),
    allowedDestinations: (policy.allowedDestinations ?? []).join(', '),
    requireApproval: Boolean(policy.requireApproval),
    blackoutWindows: windows.length ? windows : [{ days: '', start: '', end: '' }],
  };
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
  const [activeTab, setActiveTab] = useState<
    'fleet' | 'policies' | 'approvals' | 'dashboard' | 'invoices'
  >('fleet');
  const [policy, setPolicy] = useState<CompanyPolicy | null>(null);
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft>(INITIAL_POLICY_DRAFT);
  const [policyError, setPolicyError] = useState<string>();
  const [policySaving, setPolicySaving] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvalsError, setApprovalsError] = useState<string>();
  const [dashboard, setDashboard] = useState<{
    total: number;
    planned: number;
    completed: number;
    cancelled: number;
    seatsPlanned: number;
    seatsReserved: number;
    fillRate: number;
  } | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string>();
  const [invoiceMonth, setInvoiceMonth] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string>();
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);

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

  const loadPolicy = async () => {
    if (!account?.id) return;
    setPolicyError(undefined);
    try {
      const data = await getCompanyPolicy(account.id);
      setPolicy(data);
      setPolicyDraft(normalizePolicyDraft(data));
    } catch (err: any) {
      setPolicyError(err?.response?.data?.message ?? err?.message ?? 'Impossible de charger la politique.');
    }
  };

  const loadApprovals = async () => {
    if (!account?.id) return;
    setApprovalsLoading(true);
    setApprovalsError(undefined);
    try {
      const fleet = await fetchMyFleet({ status: 'ALL', limit: 200 });
      const schedulesByVehicle = await Promise.all(
        fleet.data.map(async (vehicle) => {
          try {
            const res = await listFleetSchedules(vehicle.id, { status: 'PENDING', window: 'all' });
            return res.data.map((schedule) => ({
              ...schedule,
              vehicleLabel: vehicle.label,
              vehiclePlate: vehicle.plateNumber,
            }));
          } catch {
            return [];
          }
        }),
      );
      setApprovals(schedulesByVehicle.flat());
    } catch (err: any) {
      setApprovalsError(
        err?.response?.data?.message ?? err?.message ?? 'Impossible de charger les demandes.',
      );
    } finally {
      setApprovalsLoading(false);
    }
  };

  const loadDashboard = async () => {
    if (!account?.id) return;
    setDashboardLoading(true);
    setDashboardError(undefined);
    try {
      const data = await getCompanyDashboard(account.id);
      setDashboard(data);
    } catch (err: any) {
      setDashboardError(err?.response?.data?.message ?? err?.message ?? 'Impossible de charger le tableau de bord.');
    } finally {
      setDashboardLoading(false);
    }
  };

  const loadInvoice = async (month: string) => {
    if (!account?.id) return;
    setInvoiceLoading(true);
    setInvoiceError(undefined);
    try {
      const data = await getCompanyInvoice(account.id, month || undefined);
      setInvoiceData(data);
    } catch (err: any) {
      setInvoiceError(err?.response?.data?.message ?? err?.message ?? 'Impossible de charger les factures.');
    } finally {
      setInvoiceLoading(false);
    }
  };

  useEffect(() => {
    if (!isCompany) return;
    if (activeTab === 'policies') {
      void loadPolicy();
    }
    if (activeTab === 'approvals') {
      void loadApprovals();
    }
    if (activeTab === 'dashboard') {
      void loadDashboard();
    }
    if (activeTab === 'invoices') {
      void loadInvoice(invoiceMonth);
    }
  }, [activeTab, isCompany]);

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

  const updatePolicyDraftField = (field: keyof PolicyDraft, value: any) => {
    setPolicyDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updatePolicyWindow = (index: number, patch: Partial<PolicyDraftWindow>) => {
    setPolicyDraft((prev) => {
      const next = [...prev.blackoutWindows];
      next[index] = { ...next[index], ...patch };
      return { ...prev, blackoutWindows: next };
    });
  };

  const addPolicyWindow = () => {
    setPolicyDraft((prev) => ({
      ...prev,
      blackoutWindows: [...prev.blackoutWindows, { days: '', start: '', end: '' }],
    }));
  };

  const removePolicyWindow = (index: number) => {
    setPolicyDraft((prev) => ({
      ...prev,
      blackoutWindows: prev.blackoutWindows.filter((_, idx) => idx !== index),
    }));
  };

  const handleSavePolicy = async () => {
    if (!account?.id) return;
    setPolicySaving(true);
    setPolicyError(undefined);
    try {
      const maxPrice = policyDraft.maxPricePerSeat.trim()
        ? Number(policyDraft.maxPricePerSeat.trim())
        : null;
      if (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
        setPolicyError('Le plafond de prix est invalide.');
        setPolicySaving(false);
        return;
      }

      const allowedOrigins = policyDraft.allowedOrigins
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const allowedDestinations = policyDraft.allowedDestinations
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const blackoutWindows = policyDraft.blackoutWindows
        .map((window) => ({
          days: parseDayList(window.days),
          start: window.start.trim(),
          end: window.end.trim(),
        }))
        .filter((window) => window.start && window.end);

      const updated = await updateCompanyPolicy(account.id, {
        maxPricePerSeat: maxPrice,
        allowedOrigins: allowedOrigins.length ? allowedOrigins : null,
        allowedDestinations: allowedDestinations.length ? allowedDestinations : null,
        requireApproval: policyDraft.requireApproval,
        blackoutWindows: blackoutWindows.length ? blackoutWindows : null,
      });
      setPolicy(updated);
      setPolicyDraft(normalizePolicyDraft(updated));
    } catch (err: any) {
      setPolicyError(err?.response?.data?.message ?? err?.message ?? 'Impossible de sauvegarder la politique.');
    } finally {
      setPolicySaving(false);
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

  const handleApprovalDecision = async (scheduleId: string, action: 'approve' | 'reject') => {
    if (!account?.id) return;
    setApprovalsError(undefined);
    try {
      if (action === 'approve') {
        await approveCompanySchedule(account.id, scheduleId, { actorId: account.id });
      } else {
        await rejectCompanySchedule(account.id, scheduleId, { actorId: account.id });
      }
      await loadApprovals();
      await loadFleet();
    } catch (err: any) {
      setApprovalsError(
        err?.response?.data?.message ??
          err?.message ??
          'Impossible de traiter la demande.',
      );
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
            schedule.status === 'PENDING'
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : schedule.status === 'PLANNED'
                ? chipAccent
                : schedule.status === 'COMPLETED'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600';
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
                <span className="inline-flex items-center gap-2">
                  {schedule.status === 'PENDING' ? (
                    <>
                      <ShieldAlert size={12} />
                      Validation requise
                    </>
                  ) : schedule.status === 'PLANNED' ? (
                    <>
                      <ShieldCheck size={12} />
                      Validé
                    </>
                  ) : schedule.status === 'COMPLETED' ? (
                    <>
                      <BadgeCheck size={12} />
                      Terminé
                    </>
                  ) : (
                    <>
                      <XCircle size={12} />
                      Annulé
                    </>
                  )}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {schedule.status === 'PENDING' && (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-700">
                    En attente d’approbation
                  </span>
                )}
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

  const tabs = [
    { id: 'fleet', label: 'Flotte', icon: Car },
    { id: 'policies', label: 'Politiques', icon: ShieldCheck },
    { id: 'approvals', label: 'Approbations', icon: ClipboardCheck },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'invoices', label: 'Factures', icon: FileText },
  ] as const;

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

          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                    active
                      ? 'border-sky-200 bg-white text-sky-700 shadow-sm'
                      : 'border-transparent bg-white/40 text-slate-600 hover:bg-white'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'fleet' && (
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
          )}

          {activeTab === 'fleet' && (
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
          )}

          {activeTab === 'fleet' && (
            <>
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
            </>
          )}

          {activeTab === 'policies' && (
            <div className={`rounded-3xl px-6 py-6 space-y-6 ${surfLight}`}>
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Politiques internes</h2>
                  <p className="text-xs text-slate-500">
                    Définis les règles de prix, zones autorisées et validation obligatoire.
                  </p>
                </div>
                <button
                  onClick={handleSavePolicy}
                  disabled={policySaving}
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ShieldCheck size={14} />
                  {policySaving ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
              </header>
              {policyError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {policyError}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Plafond prix / siège (XOF)</label>
                  <input
                    type="number"
                    min={0}
                    className="input input-sm w-full"
                    value={policyDraft.maxPricePerSeat}
                    onChange={(e) => updatePolicyDraftField('maxPricePerSeat', e.target.value)}
                    placeholder="Ex: 3500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Villes autorisees (depart)</label>
                  <input
                    className="input input-sm w-full"
                    value={policyDraft.allowedOrigins}
                    onChange={(e) => updatePolicyDraftField('allowedOrigins', e.target.value)}
                    placeholder="Abidjan, Bouake"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Villes autorisees (arrivee)</label>
                  <input
                    className="input input-sm w-full"
                    value={policyDraft.allowedDestinations}
                    onChange={(e) => updatePolicyDraftField('allowedDestinations', e.target.value)}
                    placeholder="Yamoussoukro, Korhogo"
                  />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={policyDraft.requireApproval}
                  onChange={(e) => updatePolicyDraftField('requireApproval', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-200"
                />
                Demander une validation manager avant publication
              </label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-slate-500">Fenetre d'interdiction</p>
                  <button
                    type="button"
                    onClick={addPolicyWindow}
                    className="text-xs font-medium text-sky-600 hover:text-sky-700"
                  >
                    Ajouter une fenetre
                  </button>
                </div>
                {policyDraft.blackoutWindows.map((window, index) => (
                  <div
                    key={`window-${index}`}
                    className="grid gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 sm:grid-cols-[1fr,1fr,1fr,auto]"
                  >
                    <input
                      className="input input-sm w-full"
                      placeholder="Jours (1-7) ex: 1,2,3"
                      value={window.days}
                      onChange={(e) => updatePolicyWindow(index, { days: e.target.value })}
                    />
                    <input
                      className="input input-sm w-full"
                      placeholder="Debut (ex: 08:00)"
                      value={window.start}
                      onChange={(e) => updatePolicyWindow(index, { start: e.target.value })}
                    />
                    <input
                      className="input input-sm w-full"
                      placeholder="Fin (ex: 18:00)"
                      value={window.end}
                      onChange={(e) => updatePolicyWindow(index, { end: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removePolicyWindow(index)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 hover:bg-slate-100"
                    >
                      Retirer
                    </button>
                  </div>
                ))}
                <p className="text-xs text-slate-500">
                  Renseigne les jours avec 1 (lundi) a 7 (dimanche). Laisse vide pour une regle globale.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'approvals' && (
            <div className={`rounded-3xl px-6 py-6 space-y-4 ${surfLight}`}>
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Approbations en attente</h2>
                  <p className="text-xs text-slate-500">
                    Valide ou rejette les trajets demandes par les gestionnaires.
                  </p>
                </div>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
                  onClick={loadApprovals}
                >
                  Rafraichir
                </button>
              </header>
              {approvalsError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {approvalsError}
                </div>
              )}
              {approvalsLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                  Chargement des demandes...
                </div>
              ) : approvals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-sm text-slate-500">
                  Aucun trajet en attente pour le moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {approvals.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <Route size={16} />
                            {schedule.originCity} → {schedule.destinationCity}
                          </div>
                          <div className="text-xs text-slate-500">
                            {schedule.vehicleLabel} ({schedule.vehiclePlate}) · {formatDate(schedule.departureAt)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {schedule.plannedSeats} sieges · {schedule.pricePerSeat?.toLocaleString() || 0} XOF/ siege
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleApprovalDecision(schedule.id, 'approve')}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            <CheckCircle2 size={14} />
                            Approuver
                          </button>
                          <button
                            onClick={() => handleApprovalDecision(schedule.id, 'reject')}
                            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                          >
                            <XCircle size={14} />
                            Rejeter
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className={`rounded-3xl px-6 py-6 space-y-6 ${surfLight}`}>
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Tableau de bord</h2>
                  <p className="text-xs text-slate-500">
                    Analyse rapide du volume et du taux de remplissage.
                  </p>
                </div>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
                  onClick={loadDashboard}
                >
                  Rafraichir
                </button>
              </header>
              {dashboardError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {dashboardError}
                </div>
              )}
              {dashboardLoading || !dashboard ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                  Chargement du dashboard...
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Trajets total</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">{dashboard.total}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {dashboard.planned} planifies · {dashboard.completed} termines
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Taux de remplissage</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">{dashboard.fillRate}%</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {dashboard.seatsReserved} / {dashboard.seatsPlanned} sieges reserves
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">Annulations</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">{dashboard.cancelled}</p>
                    <p className="mt-1 text-xs text-slate-500">Sur la periode selectionnee</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className={`rounded-3xl px-6 py-6 space-y-6 ${surfLight}`}>
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Factures entreprise</h2>
                  <p className="text-xs text-slate-500">
                    Telecharge les factures mensuelles consolidees.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="month"
                    className="input input-sm"
                    value={invoiceMonth}
                    onChange={(e) => {
                      setInvoiceMonth(e.target.value);
                      loadInvoice(e.target.value);
                    }}
                  />
                  <button
                    onClick={async () => {
                      if (!account?.id) return;
                      setInvoiceDownloading(true);
                      try {
                        const blob = await downloadCompanyInvoiceCsv(account.id, invoiceMonth || undefined);
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `invoice-${invoiceMonth || 'current'}.csv`;
                        link.click();
                        URL.revokeObjectURL(url);
                      } finally {
                        setInvoiceDownloading(false);
                      }
                    }}
                    disabled={invoiceDownloading}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                  >
                    <Download size={14} />
                    {invoiceDownloading ? 'Telechargement...' : 'Exporter CSV'}
                  </button>
                </div>
              </header>
              {invoiceError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {invoiceError}
                </div>
              )}
              {invoiceLoading || !invoiceData ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                  Chargement des factures...
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs font-semibold uppercase text-slate-500">Montant total</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-800">
                        {invoiceData.totalAmount?.toLocaleString() || 0} XOF
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs font-semibold uppercase text-slate-500">Remboursements</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-800">
                        {invoiceData.totalRefunded?.toLocaleString() || 0} XOF
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs font-semibold uppercase text-slate-500">Statuts</p>
                      <div className="mt-2 space-y-1 text-xs text-slate-500">
                        {Object.entries(invoiceData.byStatus || {}).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between">
                            <span>{status}</span>
                            <span className="font-semibold text-slate-800">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                      <FileText size={14} />
                      Derniers paiements
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      {(invoiceData.items || []).slice(0, 10).map((item: any) => (
                        <div key={item.id || item.bookingId} className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800">{item.bookingId}</span>
                          <span>{item.amount?.toLocaleString() || 0} {item.currency || 'XOF'}</span>
                          <span className="text-slate-500">{item.status}</span>
                          <span className="text-slate-400">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('fr-FR') : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
