import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, RefreshCw, Send, Pencil, Save, XCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../store';
import {
  Account,
  AccountListResponse,
  AccountRole,
  AccountStatus,
  AccountType,
  AdminAccountActivity,
  FavoriteRoute,
  HomePreferencesPayload,
  BookingAdminItem,
  RideAdminItem,
  RideAdminSummary,
  AdminRideDigestPayload,
  AdminRideDigestResponse,
  AdminRideDigestInsights,
  AdminUpdateRidePayload,
  FleetListResponse,
  FleetVehicle,
  FleetSchedule,
  adminGetAccountActivity,
  adminListAccounts,
  adminUpdateAccountRole,
  adminUpdateAccountStatus,
  adminUpdateAccountProfile,
  adminFetchCompanyFleet,
  adminListCompanySchedules,
  adminListRides,
  adminUpdateRide,
  adminCloseRide,
  adminShareRides,
} from '../api';
import { HOME_THEME_OPTIONS, QUICK_ACTION_OPTIONS } from '../constants/homePreferences';

type FilterState = {
  status: 'ALL' | AccountStatus;
  type: 'ALL' | AccountType;
  search: string;
};

type AdminProfilePayload = {
  comfortPreferences?: string[];
  fullName?: string;
  companyName?: string;
  registrationNumber?: string;
  contactName?: string;
  contactPhone?: string;
  tagline?: string;
  profilePhotoUrl?: string;
  removeProfilePhoto?: boolean;
  homePreferences?: HomePreferencesPayload;
};

type EditableRoute = { from: string; to: string };
type FleetSchedulesState = Record<
  string,
  { loading: boolean; items: FleetSchedule[]; error?: string; window: 'upcoming' | 'past' | 'all' }
>;

type RideListState = {
  loading: boolean;
  data: RideAdminItem[];
  summary?: RideAdminSummary;
  error?: string;
};

const STATUS_LABEL: Record<AccountStatus, string> = {
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
};

const ROLE_LABEL: Record<AccountRole, string> = {
  USER: 'Utilisateur',
  ADMIN: 'Administrateur',
};

const TYPE_LABEL: Record<AccountType, string> = {
  INDIVIDUAL: 'Particulier',
  COMPANY: 'Entreprise',
};

const DATE_TIME = new Intl.DateTimeFormat('fr-FR', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const DATE_ONLY = new Intl.DateTimeFormat('fr-FR', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const PAGE_SIZE = 20;
const MAX_ROUTES = 5;
const DIGEST_ERROR_MESSAGES: Record<string, string> = {
  recipient_scope_requires_account:
    'Sélectionne un compte KariGo existant ou passe la portée sur « Catalogue global ».',
  recipient_required: 'Renseigne une adresse destinataire valide.',
  ride_fetch_failed: 'Impossible de récupérer les trajets à partager pour le moment.',
};

function formatDate(value?: string | null, withTime = true) {
  if (!value) return '—';
  try {
    return withTime ? DATE_TIME.format(new Date(value)) : DATE_ONLY.format(new Date(value));
  } catch {
    return value;
  }
}

function formatAmount(amount: number) {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${safe.toLocaleString('fr-FR')} F CFA`;
}

export default function AdminAccounts() {
  const token = useApp((state) => state.token);
  const account = useApp((state) => state.account);

  const [filters, setFilters] = useState<FilterState>({ status: 'ALL', type: 'ALL', search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [list, setList] = useState<AccountListResponse>();
  const [updatingId, setUpdatingId] = useState<string>();

const [selectedAccountId, setSelectedAccountId] = useState<string>();
const [activity, setActivity] = useState<AdminAccountActivity>();
const [activityLoading, setActivityLoading] = useState(false);
const [activityError, setActivityError] = useState<string>();
const [fleet, setFleet] = useState<FleetListResponse>();
const [fleetLoading, setFleetLoading] = useState(false);
const [fleetError, setFleetError] = useState<string>();
const [fleetSchedulesState, setFleetSchedulesState] = useState<FleetSchedulesState>({});
const [globalUpcoming, setGlobalUpcoming] = useState<RideListState>({ loading: false, data: [] });
const [globalPast, setGlobalPast] = useState<RideListState>({ loading: false, data: [] });

  const digestDefaultRecipient = account?.email ?? '';
  const globalUpcomingCount = Array.isArray(globalUpcoming.data) ? globalUpcoming.data.length : 0;
  const globalPastCount = Array.isArray(globalPast.data) ? globalPast.data.length : 0;
  const globalUpcomingSummary = globalUpcoming.summary;
  const globalPastSummary = globalPast.summary;

  const canAccess = account?.role === 'ADMIN';
  const totalAccounts = list?.total ?? 0;
  const accounts = list?.data ?? [];
  const hasFiltersApplied =
    filters.status !== 'ALL' || filters.type !== 'ALL' || Boolean(filters.search);
  const statusLabel = filters.status === 'ALL' ? 'Tous les statuts' : STATUS_LABEL[filters.status];
  const typeLabel = filters.type === 'ALL' ? 'Tous les types' : TYPE_LABEL[filters.type];
  const isEmptyState = !loading && accounts.length === 0;

  const loadAccounts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(undefined);
    try {
      const res = await adminListAccounts(token, {
        status: filters.status === 'ALL' ? undefined : filters.status,
        type: filters.type === 'ALL' ? undefined : filters.type,
        search: filters.search || undefined,
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setList(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Impossible de charger les comptes.');
    } finally {
      setLoading(false);
    }
  }, [filters, page, token]);

  useEffect(() => {
    setPage(0);
  }, [filters.status, filters.type, filters.search]);

  useEffect(() => {
    if (canAccess) {
      loadAccounts();
    }
  }, [canAccess, loadAccounts]);

  useEffect(() => {
    // Reset activité si les filtres changent (liste potentiellement différente)
    setSelectedAccountId(undefined);
    setActivity(undefined);
    setActivityError(undefined);
    setActivityLoading(false);
  }, [filters.status, filters.type, filters.search]);

  const totalPages = useMemo(() => {
    if (!list) return 1;
    return Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  }, [list]);

  const selectedAccount = useMemo(() => {
    if (!selectedAccountId) return undefined;
    return list?.data.find((item) => item.id === selectedAccountId);
  }, [list, selectedAccountId]);

  const statusOptions = useMemo<FilterSegmentOption<FilterState['status']>[]>(() => {
    const byStatus = list?.stats?.byStatus;
    return [
      { value: 'ALL', label: 'Tous', count: list?.total ?? 0 },
      { value: 'ACTIVE', label: 'Actifs', count: byStatus?.ACTIVE ?? 0 },
      { value: 'SUSPENDED', label: 'Suspendus', count: byStatus?.SUSPENDED ?? 0 },
    ];
  }, [list]);

  const typeCounts = useMemo(() => {
    if (!list?.data) {
      return undefined;
    }
    return list.data.reduce(
      (acc, item) => {
        acc[item.type] = (acc[item.type] ?? 0) + 1;
        return acc;
      },
      { INDIVIDUAL: 0, COMPANY: 0 } as Record<AccountType, number>,
    );
  }, [list?.data]);

  const typeOptions = useMemo<FilterSegmentOption<FilterState['type']>[]>(() => {
    return [
      { value: 'ALL', label: 'Tous', count: list?.total ?? 0 },
      { value: 'INDIVIDUAL', label: 'Particuliers', count: typeCounts?.INDIVIDUAL },
      { value: 'COMPANY', label: 'Entreprises', count: typeCounts?.COMPANY },
    ];
  }, [list?.total, typeCounts]);

  const pageStart = totalAccounts === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = Math.min(totalAccounts, (page + 1) * PAGE_SIZE);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    setSearchInput(trimmed);
    setFilters((prev) => ({ ...prev, search: trimmed }));
  };

  const resetFilters = () => {
    setFilters({ status: 'ALL', type: 'ALL', search: '' });
    setSearchInput('');
  };

  const refreshList = async () => {
    await loadAccounts();
  };

  const fetchActivity = useCallback(
    async (accountId: string, { preserveSelection = false }: { preserveSelection?: boolean } = {}) => {
      if (!token) return;
      if (!preserveSelection) {
        setSelectedAccountId(accountId);
      }
      setActivity(undefined);
      setActivityError(undefined);
      setFleet(undefined);
      setFleetError(undefined);
      setFleetSchedulesState({});
      setActivityLoading(true);
      try {
        const res = await adminGetAccountActivity(token, accountId);
        setActivity(res);
        if (res.account.type === 'COMPANY') {
          setFleetLoading(true);
          try {
            const fleetRes = await adminFetchCompanyFleet(res.account.id, { status: 'ALL' });
            setFleet(fleetRes);
          } catch (err: any) {
            setFleetError(
              err?.response?.data?.message || err?.message || 'Impossible de charger la flotte.',
            );
          } finally {
            setFleetLoading(false);
          }
        } else {
          setFleet(undefined);
        }
      } catch (err: any) {
        setActivityError(err?.response?.data?.message || err?.message || 'Impossible de charger l’activité.');
      } finally {
        setActivityLoading(false);
      }
    },
    [token],
  );

  const saveProfile = useCallback(
    async (accountId: string, payload: AdminProfilePayload) => {
      if (!token) return undefined;
      const updated = await adminUpdateAccountProfile(token, accountId, payload);
      setList((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
        };
      });
      setActivity((prev) => (prev ? { ...prev, account: updated } : prev));
      return updated;
    },
    [token],
  );

  const reloadFleet = useCallback(async () => {
    const company = activity?.account;
    if (!company || company.type !== 'COMPANY') return;
    setFleetLoading(true);
    setFleetError(undefined);
    try {
      const res = await adminFetchCompanyFleet(company.id, { status: 'ALL' });
      setFleet(res);
    } catch (err: any) {
      setFleetError(err?.response?.data?.message || err?.message || 'Impossible de charger la flotte.');
    } finally {
      setFleetLoading(false);
    }
  }, [activity?.account]);

  const loadCompanySchedules = useCallback(
    async (vehicleId: string, window: 'upcoming' | 'past' | 'all' = 'upcoming') => {
      const company = activity?.account;
      if (!company || company.type !== 'COMPANY') return;
      setFleetSchedulesState((prev) => ({
        ...prev,
        [vehicleId]: {
          loading: true,
          items: prev[vehicleId]?.items ?? [],
          window,
        },
      }));
      try {
        const res = await adminListCompanySchedules(company.id, vehicleId, { window });
        setFleetSchedulesState((prev) => ({
          ...prev,
          [vehicleId]: {
            loading: false,
            items: res.data,
            window,
          },
        }));
      } catch (err: any) {
        setFleetSchedulesState((prev) => ({
          ...prev,
          [vehicleId]: {
            loading: false,
            items: prev[vehicleId]?.items ?? [],
            window,
            error:
              err?.response?.data?.message || err?.message || 'Impossible de charger les plannings.',
          },
        }));
      }
    },
    [activity?.account],
  );

  const refreshGlobalRides = useCallback(async () => {
    if (!token || account?.role !== 'ADMIN') return;
    const nowIso = new Date().toISOString();

    setGlobalUpcoming((prev) => ({ ...prev, loading: true, error: undefined }));
    setGlobalPast((prev) => ({ ...prev, loading: true, error: undefined }));

    try {
      const upcoming = await adminListRides(token, {
        departureAfter: nowIso,
        sort: 'departure_asc',
        limit: 200,
      });
      setGlobalUpcoming({
        loading: false,
        data: upcoming.data,
        summary: upcoming.summary,
        error: undefined,
      });
    } catch (err: any) {
      setGlobalUpcoming({
        loading: false,
        data: [],
        summary: undefined,
        error:
          err?.response?.data?.message ||
          err?.message ||
          'Impossible de charger les trajets à venir.',
      });
    }

    try {
      const past = await adminListRides(token, {
        departureBefore: nowIso,
        sort: 'departure_desc',
        limit: 200,
      });
      setGlobalPast({
        loading: false,
        data: past.data,
        summary: past.summary,
        error: undefined,
      });
    } catch (err: any) {
      setGlobalPast({
        loading: false,
        data: [],
        summary: undefined,
        error:
          err?.response?.data?.message ||
          err?.message ||
          'Impossible de charger les trajets passés.',
      });
    }
  }, [token, account?.role]);

  useEffect(() => {
    if (account?.role === 'ADMIN') {
      void refreshGlobalRides();
    }
  }, [account?.role, refreshGlobalRides]);

  const updateRide = useCallback(
    async (rideId: string, payload: AdminUpdateRidePayload) => {
      if (!token || !selectedAccountId) return undefined;
      const updated = await adminUpdateRide(token, rideId, payload);
      await fetchActivity(selectedAccountId, { preserveSelection: true });
      return updated;
    },
    [token, selectedAccountId, fetchActivity],
  );

  const closeRide = useCallback(
    async (rideId: string) => {
      if (!token || !selectedAccountId) return undefined;
      const updated = await adminCloseRide(token, rideId);
      await fetchActivity(selectedAccountId, { preserveSelection: true });
      return updated;
    },
    [token, selectedAccountId, fetchActivity],
  );

  const updateGlobalRide = useCallback(
    async (rideId: string, payload: AdminUpdateRidePayload) => {
      if (!token) return undefined;
      const updated = await adminUpdateRide(token, rideId, payload);
      await refreshGlobalRides();
      if (selectedAccountId) {
        await fetchActivity(selectedAccountId, { preserveSelection: true });
      }
      return updated;
    },
    [token, refreshGlobalRides, selectedAccountId, fetchActivity],
  );

  const closeGlobalRide = useCallback(
    async (rideId: string) => {
      if (!token) return undefined;
      const updated = await adminCloseRide(token, rideId);
      await refreshGlobalRides();
      if (selectedAccountId) {
        await fetchActivity(selectedAccountId, { preserveSelection: true });
      }
      return updated;
    },
    [token, refreshGlobalRides, selectedAccountId, fetchActivity],
  );

  const shareRides = useCallback(
    async (payload: AdminRideDigestPayload) => {
      if (!token) throw new Error('missing_token');
      return adminShareRides(token, payload);
    },
    [token],
  );

  const handleToggleStatus = async (item: Account) => {
    if (!token) return;
    const nextStatus: AccountStatus = item.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setUpdatingId(item.id);
    setError(undefined);
    try {
      await adminUpdateAccountStatus(token, item.id, nextStatus);
      await refreshList();
      if (selectedAccountId === item.id) {
        await fetchActivity(item.id, { preserveSelection: true });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Impossible de modifier le statut.');
    } finally {
      setUpdatingId(undefined);
    }
  };

  const handleToggleRole = async (item: Account) => {
    if (!token) return;
    const nextRole: AccountRole = item.role === 'ADMIN' ? 'USER' : 'ADMIN';
    setUpdatingId(item.id);
    setError(undefined);
    try {
      await adminUpdateAccountRole(token, item.id, nextRole);
      await refreshList();
      if (selectedAccountId === item.id) {
        await fetchActivity(item.id, { preserveSelection: true });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Impossible de modifier le rôle.');
    } finally {
      setUpdatingId(undefined);
    }
  };

  const handleViewActivity = async (item: Account) => {
    await fetchActivity(item.id, { preserveSelection: false });
  };

  const disableStatusAction = (item: Account) => item.id === account?.id;

  const disableRoleAction = (item: Account) => item.id === account?.id;

  return (
    <section className="max-w-7xl mx-auto px-4 py-10 space-y-10">
      <header className="rounded-3xl border border-slate-200 bg-white/90 p-8 lg:p-10 shadow-xl shadow-sky-100/40 backdrop-blur space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold text-sky-700">
              Tableau de bord administrateur
            </div>
            <h1 className="text-3xl lg:text-4xl font-semibold text-slate-900">
              Supervise les comptes et garde le contrôle sur les trajets publiés.
            </h1>
            <p className="text-sm text-slate-500 lg:max-w-2xl">
              Gère les accès, ajuste les profils et actionne les décisions métier sans quitter cette page.
              Le tableau de bord se veut fluide, lisible et orienté actions rapides.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:max-w-xl">
            <StatCard title="Comptes actifs" value={list?.stats.byStatus.ACTIVE ?? 0} tone="green" />
            <StatCard title="Comptes suspendus" value={list?.stats.byStatus.SUSPENDED ?? 0} tone="amber" />
            <StatCard title="Administrateurs" value={list?.stats.byRole.ADMIN ?? 0} tone="sky" />
          </div>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="grid gap-4 lg:grid-cols-[minmax(0,1fr),auto] items-end bg-slate-900/3 rounded-2xl p-4 border border-slate-100"
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Recherche globale</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-sky-200">
                <input
                  type="search"
                  className="flex-1 border-none bg-transparent text-sm text-slate-700 focus:outline-none"
                  placeholder="Email, nom, entreprise…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setFilters((prev) => ({ ...prev, search: '' }));
                    }}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FilterSegment
                label="Statut"
                value={filters.status}
                options={statusOptions}
                onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
              />
              <FilterSegment
                label="Type de compte"
                value={filters.type}
                options={typeOptions}
                onChange={(value) => setFilters((prev) => ({ ...prev, type: value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setFilters({ status: 'ALL', type: 'ALL', search: '' });
                setSearchInput('');
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
            >
              Réinitialiser
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700"
            >
              Appliquer
            </button>
          </div>
        </form>
      </header>

      {account?.role === 'ADMIN' && (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr),minmax(320px,1fr)]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Catalogue global
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {globalUpcomingCount + globalPastCount} trajets suivis
                  </p>
                  <p className="text-sm text-slate-500">
                    {globalUpcomingSummary?.upcoming ?? globalUpcomingCount} à venir • {globalPastCount} archivés
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshGlobalRides()}
                  disabled={globalUpcoming.loading || globalPast.loading}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-600 disabled:opacity-50"
                >
                  <RefreshCw size={14} /> Rafraîchir
                </button>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Places proposées</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {(globalUpcomingSummary?.seatsTotal ?? 0).toLocaleString('fr-FR')}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Réservations</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {(
                      (globalUpcomingSummary?.seatsBooked ?? 0) +
                      (globalPastSummary?.seatsBooked ?? 0)
                    ).toLocaleString('fr-FR')}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Prix moyen</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {(
                      globalUpcomingSummary?.averagePrice ??
                      globalPastSummary?.averagePrice ??
                      0
                    ).toLocaleString('fr-FR')}{' '}
                    F CFA
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <RideManagementPanel
                title="Trajets à venir"
                rides={globalUpcoming.data}
                summary={globalUpcoming.summary}
                loading={globalUpcoming.loading}
                error={globalUpcoming.error}
                enableDigest={false}
                onUpdateRide={updateGlobalRide}
                onCloseRide={closeGlobalRide}
                onRefresh={refreshGlobalRides}
              />
              <RideManagementPanel
                title="Trajets passés"
                rides={globalPast.data}
                summary={globalPast.summary}
                loading={globalPast.loading}
                error={globalPast.error}
                enableDigest={false}
                onUpdateRide={updateGlobalRide}
                onCloseRide={closeGlobalRide}
                onRefresh={refreshGlobalRides}
              />
            </div>
          </div>

          <RideDigestComposer
            defaultRecipient={digestDefaultRecipient}
            disabled={globalUpcoming.loading || globalPast.loading}
            onShare={shareRides}
          />
        </section>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700 px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,520px),minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Résultats</p>
                <p className="text-lg font-semibold text-slate-900">
                  {loading ? 'Recherche en cours…' : `${totalAccounts.toLocaleString('fr-FR')} comptes`}
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5">
                    {statusLabel}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5">
                    {typeLabel}
                  </span>
                  {filters.search && (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-amber-700">
                      « {filters.search} »
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => void refreshList()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 transition hover:border-sky-200 hover:text-sky-600 disabled:opacity-50"
                >
                  <RefreshCw size={14} /> Rafraîchir
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAccountId(undefined)}
                  disabled={!selectedAccountId}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 transition hover:border-slate-300 disabled:opacity-40"
                >
                  Effacer la sélection
                </button>
              </div>
            </div>
            <div className="hidden lg:block overflow-x-auto px-5">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Email</th>
                    <th className="text-left px-4 py-3 font-semibold">Profil</th>
                    <th className="text-left px-4 py-3 font-semibold">Statut</th>
                    <th className="text-left px-4 py-3 font-semibold">Rôle</th>
                    <th className="text-left px-4 py-3 font-semibold">Dernière connexion</th>
                    <th className="text-left px-4 py-3 font-semibold">Connexions</th>
                    <th className="text-left px-4 py-3 font-semibold">Créé le</th>
                    <th className="text-left px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                        Chargement…
                      </td>
                    </tr>
                  )}
                  {!loading && accounts.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                        Aucun compte à afficher.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    accounts.map((item) => (
                      <AccountRowDesktop
                        key={item.id}
                        item={item}
                        selected={selectedAccountId === item.id}
                        disabledStatus={disableStatusAction(item)}
                        disabledRole={disableRoleAction(item)}
                        loadingId={updatingId}
                        onSelect={(account) => void fetchActivity(account.id)}
                        onView={(account) => void handleViewActivity(account)}
                        onToggleStatus={(account) => void handleToggleStatus(account)}
                        onToggleRole={(account) => void handleToggleRole(account)}
                      />
                    ))}
                </tbody>
              </table>
            </div>
            <div className="lg:hidden space-y-3 px-5 py-5">
              {loading && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
                  Chargement…
                </div>
              )}
              {!loading &&
                accounts.map((item) => (
                  <AccountCardMobile
                    key={item.id}
                    item={item}
                    selected={selectedAccountId === item.id}
                    disabledStatus={disableStatusAction(item)}
                    disabledRole={disableRoleAction(item)}
                    loadingId={updatingId}
                    onSelect={(account) => void fetchActivity(account.id)}
                    onView={(account) => void handleViewActivity(account)}
                    onToggleStatus={(account) => void handleToggleStatus(account)}
                    onToggleRole={(account) => void handleToggleRole(account)}
                  />
                ))}
            </div>
            {isEmptyState && (
              <div className="border-t border-slate-100 px-5 py-6 text-center text-sm text-slate-500 space-y-3">
                <p>Aucun compte ne correspond aux filtres sélectionnés.</p>
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
                  {hasFiltersApplied && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-slate-600 transition hover:border-slate-300"
                    >
                      Réinitialiser les filtres
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void refreshList()}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-slate-600 transition hover:border-slate-300"
                  >
                    Recharger
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <div>
              {totalAccounts === 0
                ? 'Aucun résultat'
                : `Affichage ${pageStart.toLocaleString('fr-FR')}–${pageEnd.toLocaleString('fr-FR')} sur ${totalAccounts.toLocaleString('fr-FR')}`}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
              >
                Précédent
              </button>
              <button
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading}
              >
                Suivant
              </button>
            </div>
          </div>

          {selectedAccount && (
            <SelectedAccountSummary
              account={selectedAccount}
              busyId={updatingId}
              disableStatus={disableStatusAction(selectedAccount)}
              disableRole={disableRoleAction(selectedAccount)}
              onView={() => void handleViewActivity(selectedAccount)}
              onToggleStatus={() => void handleToggleStatus(selectedAccount)}
              onToggleRole={() => void handleToggleRole(selectedAccount)}
            />
          )}
        </div>

        <div>
          {selectedAccountId ? (
            <ActivityPanel
              title="Trajets du compte"
              account={activity?.account ?? selectedAccount}
              activity={activity}
              loading={activityLoading}
              error={activityError}
              onRefresh={() => fetchActivity(selectedAccountId, { preserveSelection: true })}
              onSave={async (payload) => saveProfile(selectedAccountId, payload)}
              fleet={fleet}
              fleetLoading={fleetLoading}
              fleetError={fleetError}
              onReloadFleet={reloadFleet}
              fleetSchedules={fleetSchedulesState}
              onLoadSchedules={loadCompanySchedules}
              onUpdateRide={updateRide}
              onCloseRide={closeRide}
              onShareRides={shareRides}
            />
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              <h3 className="text-lg font-semibold text-slate-700">Sélectionne un compte</h3>
              <p className="mt-2 text-sm">
                Choisis un utilisateur dans la liste pour afficher ses informations détaillées, ses trajets et ses statistiques.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const style =
    status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${style}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

type StatTone = 'green' | 'amber' | 'sky';

function StatCard({ title, value, tone }: { title: string; value: number; tone: StatTone }) {
  const toneMap: Record<StatTone, string> = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    sky: 'bg-sky-50 text-sky-700 border-sky-100',
  };
  return (
    <div className={`rounded-xl border px-4 py-5 ${toneMap[tone]} shadow-sm`}>
      <p className="text-xs uppercase font-semibold tracking-wide opacity-80">{title}</p>
      <p className="text-2xl font-semibold mt-2">{value}</p>
    </div>
  );
}

type FilterSegmentOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type FilterSegmentProps<T extends string> = {
  label: string;
  value: T;
  options: FilterSegmentOption<T>[];
  onChange: (value: T) => void;
};

function FilterSegment<T extends string>({ label, value, options, onChange }: FilterSegmentProps<T>) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {option.label}
              {typeof option.count === 'number' && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type AccountRowProps = {
  item: Account;
  selected: boolean;
  disabledStatus: boolean;
  disabledRole: boolean;
  loadingId?: string;
  onSelect: (account: Account) => void;
  onView: (account: Account) => void;
  onToggleStatus: (account: Account) => void;
  onToggleRole: (account: Account) => void;
};

function AccountRowDesktop({
  item,
  selected,
  disabledStatus,
  disabledRole,
  loadingId,
  onSelect,
  onView,
  onToggleStatus,
  onToggleRole,
}: AccountRowProps) {
  return (
    <tr
      onClick={() => onSelect(item)}
      className={`transition cursor-pointer ${
        selected ? 'bg-sky-50/70' : 'hover:bg-slate-50'
      }`}
    >
      <td className="px-4 py-4 align-top">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">{item.email}</p>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
            {TYPE_LABEL[item.type]}
          </span>
        </div>
      </td>
      <td className="px-4 py-4 text-sm text-slate-600 align-top">
        {item.type === 'INDIVIDUAL' ? item.fullName || '—' : item.companyName || item.contactName || '—'}
      </td>
      <td className="px-4 py-4 align-top">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-4 py-4 align-top">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
            item.role === 'ADMIN' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {ROLE_LABEL[item.role]}
        </span>
      </td>
      <td className="px-4 py-4 text-sm text-slate-500 align-top">
        {formatDate(item.lastLoginAt)}
        <div className="text-xs text-slate-400">{item.loginCount ?? 0} connexions</div>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="flex flex-col gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onView(item);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-600"
          >
            Voir
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggleStatus(item);
            }}
            disabled={disabledStatus || loadingId === item.id}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-amber-200 hover:text-amber-600 disabled:opacity-50"
          >
            {item.status === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggleRole(item);
            }}
            disabled={disabledRole || loadingId === item.id}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-600 disabled:opacity-50"
          >
            {item.role === 'ADMIN' ? 'Retirer admin' : 'Promouvoir admin'}
          </button>
        </div>
      </td>
    </tr>
  );
}

function AccountCardMobile({
  item,
  selected,
  disabledStatus,
  disabledRole,
  loadingId,
  onSelect,
  onView,
  onToggleStatus,
  onToggleRole,
}: AccountRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`w-full text-left rounded-2xl border ${
        selected ? 'border-sky-200 bg-sky-50/60' : 'border-slate-200 bg-white'
      } p-4 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/50`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{item.email}</p>
          <p className="text-xs text-slate-500 mt-1">
            {item.type === 'INDIVIDUAL' ? item.fullName || '—' : item.companyName || item.contactName || '—'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5">
              {TYPE_LABEL[item.type]}
            </span>
            <StatusBadge status={item.status} />
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5">
              {ROLE_LABEL[item.role]}
            </span>
          </div>
        </div>
        <div className="text-xs text-slate-400 text-right">
          <p>{formatDate(item.lastLoginAt)}</p>
          <p>{item.loginCount ?? 0} connexions</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-semibold">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onView(item);
          }}
          className="inline-flex items-center justify-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-slate-600 transition hover:border-sky-200 hover:text-sky-600"
        >
          Voir
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleStatus(item);
          }}
          disabled={disabledStatus || loadingId === item.id}
          className="inline-flex items-center justify-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-slate-600 transition hover:border-amber-200 hover:text-amber-600 disabled:opacity-50"
        >
          {item.status === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleRole(item);
          }}
          disabled={disabledRole || loadingId === item.id}
          className="inline-flex items-center justify-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-slate-600 transition hover:border-sky-200 hover:text-sky-600 disabled:opacity-50"
        >
          {item.role === 'ADMIN' ? 'Retirer' : 'Promouvoir'}
        </button>
      </div>
    </button>
  );
}

type SelectedAccountSummaryProps = {
  account: Account;
  busyId?: string;
  disableStatus: boolean;
  disableRole: boolean;
  onView: () => void;
  onToggleStatus: () => void;
  onToggleRole: () => void;
};

function SelectedAccountSummary({
  account,
  busyId,
  disableStatus,
  disableRole,
  onView,
  onToggleStatus,
  onToggleRole,
}: SelectedAccountSummaryProps) {
  const statusActionLabel = account.status === 'ACTIVE' ? 'Suspendre' : 'Réactiver';
  const roleActionLabel = account.role === 'ADMIN' ? 'Retirer admin' : 'Promouvoir admin';
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase text-slate-500">Sélection actuelle</p>
          <p className="text-base font-semibold text-slate-900">{account.email}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5">
              {TYPE_LABEL[account.type]}
            </span>
            <StatusBadge status={account.status} />
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                account.role === 'ADMIN' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {ROLE_LABEL[account.role]}
            </span>
          </div>
        </div>
        {account.profilePhotoUrl && (
          <img
            src={account.profilePhotoUrl}
            alt={account.fullName || account.companyName || account.email}
            className="h-14 w-14 rounded-2xl object-cover border border-slate-200"
          />
        )}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3 text-xs font-semibold">
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-slate-600 transition hover:border-sky-200 hover:text-sky-600"
        >
          Voir la fiche
        </button>
        <button
          type="button"
          onClick={onToggleStatus}
          disabled={disableStatus || busyId === account.id}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-slate-600 transition hover:border-amber-200 hover:text-amber-600 disabled:opacity-50"
        >
          {statusActionLabel}
        </button>
        <button
          type="button"
          onClick={onToggleRole}
          disabled={disableRole || busyId === account.id}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-slate-600 transition hover:border-sky-200 hover:text-sky-600 disabled:opacity-50"
        >
          {roleActionLabel}
        </button>
      </div>
    </div>
  );
}

function ActivityPanel({
  title,
  account,
  activity,
  loading,
  error,
  onRefresh,
  onSave,
  fleet,
  fleetLoading,
  fleetError,
  onReloadFleet,
  fleetSchedules,
  onLoadSchedules,
  onUpdateRide,
  onCloseRide,
  onShareRides,
}: {
  title?: string;
  account?: Account;
  activity?: AdminAccountActivity;
  loading: boolean;
  error?: string;
  onRefresh: () => void;
  onSave: (payload: AdminProfilePayload) => Promise<Account | undefined>;
  fleet?: FleetListResponse;
  fleetLoading?: boolean;
  fleetError?: string;
  onReloadFleet?: () => void;
  fleetSchedules?: FleetSchedulesState;
  onLoadSchedules?: (vehicleId: string, window?: 'upcoming' | 'past' | 'all') => void;
  onUpdateRide?: (id: string, payload: AdminUpdateRidePayload) => Promise<RideAdminItem | undefined>;
  onCloseRide?: (id: string) => Promise<RideAdminItem | undefined>;
  onShareRides?: (payload: AdminRideDigestPayload) => Promise<AdminRideDigestResponse>;
}) {
  const [photoUrl, setPhotoUrl] = useState('');
  const [removePhoto, setRemovePhoto] = useState(false);
  const [tagline, setTagline] = useState('');
  const [comfort, setComfort] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [favoriteRoutesState, setFavoriteRoutesState] = useState<EditableRoute[]>([]);
  const [quickActionsState, setQuickActionsState] = useState<string[]>([]);
  const [theme, setTheme] = useState<'default' | 'sunset' | 'night'>('default');
  const [heroMessage, setHeroMessage] = useState('');
  const [showTips, setShowTips] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [formSuccess, setFormSuccess] = useState<string>();

  useEffect(() => {
    if (!account) return;
    setPhotoUrl(account.profilePhotoUrl ?? '');
    setRemovePhoto(false);
    setTagline(account.tagline ?? '');
    if (account.type === 'INDIVIDUAL') {
      setFullName(account.fullName ?? '');
      setComfort((account.comfortPreferences ?? []).join(', '));
    } else {
      setCompanyName(account.companyName ?? '');
      setRegistrationNumber(account.registrationNumber ?? '');
      setContactName(account.contactName ?? '');
      setContactPhone(account.contactPhone ?? '');
      setComfort('');
      setFullName('');
    }
    const prefs = account.homePreferences;
    setFavoriteRoutesState(
      (prefs?.favoriteRoutes ?? []).map((route) => ({ from: route.from, to: route.to })),
    );
    setQuickActionsState(prefs?.quickActions ?? []);
    setTheme((prefs?.theme as typeof theme | undefined) ?? 'default');
    setHeroMessage(prefs?.heroMessage ?? '');
    setShowTips(prefs?.showTips ?? true);
    setFormError(undefined);
    setFormSuccess(undefined);
  }, [account]);

  const comfortList = useMemo(
    () =>
      comfort
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [comfort],
  );

  const addFavoriteRoute = () => {
    setFavoriteRoutesState((prev) => {
      if (prev.length >= MAX_ROUTES) return prev;
      return [...prev, { from: '', to: '' }];
    });
  };

  const removeFavoriteRoute = (index: number) => {
    setFavoriteRoutesState((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRouteChange = (index: number, field: keyof EditableRoute, value: string) => {
    setFavoriteRoutesState((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const toggleQuickAction = (actionId: string) => {
    setQuickActionsState((prev) =>
      prev.includes(actionId) ? prev.filter((id) => id !== actionId) : [...prev, actionId],
    );
  };

  const buildHomePreferences = (): HomePreferencesPayload | undefined => {
    const routes: FavoriteRoute[] = favoriteRoutesState
      .map((route) => ({ from: route.from.trim(), to: route.to.trim() }))
      .filter((route) => route.from && route.to)
      .slice(0, MAX_ROUTES);

    const payload: HomePreferencesPayload = {};
    if (routes.length) payload.favoriteRoutes = routes;
    if (quickActionsState.length) payload.quickActions = quickActionsState;
    if (theme) payload.theme = theme;
    if (heroMessage.trim()) payload.heroMessage = heroMessage.trim();
    payload.showTips = showTips;

    return Object.keys(payload).length ? payload : undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    setSaving(true);
    setFormError(undefined);
    setFormSuccess(undefined);
    try {
      const trimmedPhoto = photoUrl.trim();
      const trimmedTagline = tagline.trim();
      const shouldRemoveTagline = trimmedTagline.length === 0;
      const payload: AdminProfilePayload = {
        tagline: shouldRemoveTagline ? undefined : trimmedTagline,
        removeTagline: shouldRemoveTagline,
        profilePhotoUrl: removePhoto ? undefined : trimmedPhoto || undefined,
        removeProfilePhoto: removePhoto || (!trimmedPhoto && Boolean(account.profilePhotoUrl)),
        homePreferences: buildHomePreferences(),
      };
      if (account.type === 'INDIVIDUAL') {
        payload.fullName = fullName.trim() || undefined;
        payload.comfortPreferences = comfortList;
      } else {
        payload.companyName = companyName.trim() || undefined;
        const reg = registrationNumber.trim();
        payload.registrationNumber = reg || undefined;
        const contact = contactName.trim();
        payload.contactName = contact || undefined;
        const phone = contactPhone.trim();
        payload.contactPhone = phone || undefined;
      }
      const updated = await onSave(payload);
      if (updated) {
        setFormSuccess('Profil mis à jour.');
        setRemovePhoto(false);
        onRefresh();
      }
    } catch (err: any) {
      setFormError(err?.response?.data?.message || err?.message || 'Erreur lors de la mise à jour.');
    } finally {
      setSaving(false);
    }
  };

  const rides = (activity?.rides.items ?? []) as RideAdminItem[];
  const bookings = (activity?.bookings.items ?? []) as BookingAdminItem[];
  const rideSummary = activity?.rides.summary;
  const bookingSummary = activity?.bookings.summary;
  const metrics = activity?.metrics;

  const panelTitle = title ?? 'Activité du compte';

  return (
    <section className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 lg:p-8 space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold text-sky-700">
            {account?.type === 'COMPANY' ? 'Compte entreprise' : 'Compte particulier'}
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">{panelTitle}</h2>
          <p className="text-sm text-slate-500">
            Ajuste les informations clés, personnalise l’accueil et garde un œil sur les trajets partagés.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
          {loading && <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5"><RefreshCw size={12} className="animate-spin" /> Chargement…</span>}
          <button
            type="button"
            onClick={onRefresh}
            disabled={!account || loading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-slate-600 transition hover:border-sky-200 hover:text-sky-600 disabled:opacity-50"
          >
            <RefreshCw size={14} /> Rafraîchir
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700 px-4 py-3">
          {error}
        </div>
      )}

      {account && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-[auto,1fr]">
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              {removePhoto ? (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                  Photo supprimée
                </div>
              ) : photoUrl || account.profilePhotoUrl ? (
                <img
                  src={removePhoto ? '' : photoUrl || account.profilePhotoUrl || ''}
                  alt="Photo de profil"
                  className="h-full w-full object-cover"
                  onError={() => setPhotoUrl('')}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                  Pas de photo
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="text-sm text-slate-600">
                  <p className="font-medium text-slate-800">Email</p>
                  <p>{account.email}</p>
                </div>
                <div className="text-sm text-slate-600">
                  <p className="font-medium text-slate-800">Type</p>
                  <p>{TYPE_LABEL[account.type]}</p>
                </div>
                <div className="text-sm text-slate-600">
                  <p className="font-medium text-slate-800">Rôle</p>
                  <p>{ROLE_LABEL[account.role]}</p>
                </div>
                <div className="text-sm text-slate-600">
                  <p className="font-medium text-slate-800">Statut</p>
                  <p>{STATUS_LABEL[account.status]}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Photo (URL)</label>
                  <input
                    type="url"
                    value={photoUrl}
                    onChange={(e) => {
                      setPhotoUrl(e.target.value);
                      setRemovePhoto(false);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                    placeholder="https://…"
                  />
                </div>
                <div className="flex items-end gap-3">
                  <button
                    type="button"
                    className="mt-6 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100"
                    onClick={() => {
                      setRemovePhoto(true);
                      setPhotoUrl('');
                    }}
                  >
                    Retirer la photo
                  </button>
                  <span className="mt-6 text-xs text-slate-500">
                    Préconise une image carrée (600×600) accessible publiquement.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {account.type === 'INDIVIDUAL' ? (
              <>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Nom complet</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                    placeholder="Nom Prénom"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Préférences de confort</label>
                  <textarea
                    value={comfort}
                    onChange={(e) => setComfort(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                    placeholder="Musique douce, Pause café…"
                  />
                  <p className="mt-1 text-xs text-slate-500">Sépare chaque préférence par une virgule.</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Entreprise</label>
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                    placeholder="Nom de l’organisation"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">N° d’enregistrement</label>
                  <input
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                    placeholder="RCCM / SIRET…"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Contact principal</label>
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                    placeholder="Nom du référent"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Téléphone</label>
                  <input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                    placeholder="+225…"
                  />
                </div>
              </>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Accroche</label>
            <textarea
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              placeholder="Message court affiché sur le profil"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Thème d’accueil</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as typeof theme)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                {HOME_THEME_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Message d’accueil</label>
              <input
                value={heroMessage}
                onChange={(e) => setHeroMessage(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                placeholder="Texte mis en avant sur la page d’accueil"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-500">Raccourcis rapides</p>
            <div className="flex flex-wrap gap-3">
              {QUICK_ACTION_OPTIONS.map((action) => {
                const active = quickActionsState.includes(action.id);
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => toggleQuickAction(action.id)}
                    className={`rounded-xl border px-4 py-2 text-sm transition ${
                      active
                        ? 'border-sky-400 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-600'
                    }`}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-slate-500">Trajets favoris</p>
              <button
                type="button"
                className="text-xs font-medium text-sky-600 hover:text-sky-700"
                onClick={addFavoriteRoute}
                disabled={favoriteRoutesState.length >= MAX_ROUTES}
              >
                Ajouter un trajet
              </button>
            </div>
            {favoriteRoutesState.length === 0 && (
              <p className="text-sm text-slate-500">
                Ajoute des itinéraires récurrents pour les proposer directement depuis la page d’accueil.
              </p>
            )}
            {favoriteRoutesState.map((route, index) => (
              <div
                key={`${route.from}-${route.to}-${index}`}
                className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:grid-cols-[repeat(2,minmax(0,1fr)),auto]"
              >
                <input
                  value={route.from}
                  onChange={(e) => handleRouteChange(index, 'from', e.target.value)}
                  placeholder="Ville de départ"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
                <input
                  value={route.to}
                  onChange={(e) => handleRouteChange(index, 'to', e.target.value)}
                  placeholder="Ville d’arrivée"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
                <button
                  type="button"
                  onClick={() => removeFavoriteRoute(index)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-500 hover:bg-slate-100"
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showTips}
              onChange={(e) => setShowTips(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-200"
            />
            Afficher les encarts de conseils sur la page d’accueil
          </label>

          {formError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {formSuccess}
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      )}

      {!loading && !error && (
        <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MiniKpi
          label="Trajets publiés"
          value={activity?.rides.total ?? 0}
          hint={`${rideSummary?.published ?? 0} actifs`}
            />
            <MiniKpi
              label="Départs à venir"
              value={metrics?.rides.upcoming ?? 0}
              hint={`${metrics?.rides.past ?? 0} passés`}
            />
            <MiniKpi
              label="Places réservées"
              value={metrics?.rides.seatsReserved ?? 0}
              hint={`/${metrics?.rides.seatsPublished ?? 0} proposées`}
            />
            <MiniKpi
              label="Réservations"
          value={activity?.bookings.total ?? 0}
          hint={`${bookingSummary?.seatsTotal ?? 0} places`}
        />
      </div>

      {account?.type === 'COMPANY' && (
        <CompanyFleetAdmin
          fleet={fleet}
          fleetLoading={fleetLoading}
          fleetError={fleetError}
          onReloadFleet={onReloadFleet}
          scheduleState={fleetSchedules}
          onLoadSchedules={onLoadSchedules}
        />
      )}

          <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6">
            <RideManagementPanel
              title="Trajets du compte"
              account={account}
              rides={rides}
              summary={rideSummary}
              metrics={metrics?.rides}
              loading={loading}
              onUpdateRide={onUpdateRide}
              onCloseRide={onCloseRide}
              onShareRides={onShareRides}
              digestRecipient={account?.email}
            />
            <ActivitySection
              title="Réservations"
              emptyMessage="Aucune réservation enregistrée pour ce compte."
              items={bookings}
              getKey={(booking) => booking.id}
              renderItem={(booking) => (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">
                      Réservation #{booking.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-slate-500">
                      Créée {formatDate(booking.createdAt)} • {booking.seats} places
                    </p>
                  </div>
                  <div className="text-sm text-slate-600 text-right">
                    <span className="block">{formatAmount(booking.amount)}</span>
                    <span className="block text-xs text-slate-400">Statut : {booking.status}</span>
                  </div>
                </div>
              )}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
                Statuts de réservation
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                {bookingSummary && Object.keys(bookingSummary.byStatus).length > 0 ? (
                  Object.entries(bookingSummary.byStatus).map(([status, count]) => (
                    <li key={status} className="flex items-center justify-between">
                      <span>{status}</span>
                      <span className="font-medium">{count}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500 text-sm">Aucune donnée</li>
                )}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
                Totaux financiers
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center justify-between">
                  <span>Montant réservé (hors frais)</span>
                  <span className="font-semibold">
                    {formatAmount(bookingSummary?.amountTotal ?? 0)}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Places réservées</span>
                  <span className="font-semibold">{bookingSummary?.seatsTotal ?? 0}</span>
                </li>
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function CompanyFleetAdmin({
  fleet,
  fleetLoading,
  fleetError,
  onReloadFleet,
  scheduleState,
  onLoadSchedules,
}: {
  fleet?: FleetListResponse;
  fleetLoading?: boolean;
  fleetError?: string;
  onReloadFleet?: () => void;
  scheduleState?: FleetSchedulesState;
  onLoadSchedules?: (vehicleId: string, window?: 'upcoming' | 'past' | 'all') => void;
}) {
  const fleetVehicles = Array.isArray(fleet?.data) ? fleet.data : [];
  const fleetSummary = fleet?.summary;
  const totalVehicles = fleetVehicles.length;
  const activeVehicles = fleetSummary?.active ?? 0;
  const totalSeats = fleetSummary?.fleetSeats ?? 0;
  const upcomingTrips = fleetSummary?.upcomingTrips ?? 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Flotte entreprise
        </h3>
        <button
          type="button"
          onClick={() => onReloadFleet?.()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          disabled={fleetLoading || !onReloadFleet}
        >
          <RefreshCw size={14} /> Rafraîchir
        </button>
      </div>

      {fleetError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {fleetError}
        </div>
      )}

      {fleetLoading ? (
        <p className="text-sm text-slate-500">Chargement de la flotte…</p>
      ) : !fleet ? (
        <p className="text-sm text-slate-500">
          Aucune donnée de flotte disponible pour ce compte.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4 text-xs text-slate-600">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="uppercase font-semibold text-slate-500">Véhicules</p>
              <p className="mt-1 text-lg font-semibold text-slate-800">{totalVehicles}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="uppercase font-semibold text-slate-500">Actifs</p>
              <p className="mt-1 text-lg font-semibold text-emerald-600">{activeVehicles}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="uppercase font-semibold text-slate-500">Capacité</p>
              <p className="mt-1 text-lg font-semibold text-slate-800">
                {totalSeats} sièges
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="uppercase font-semibold text-slate-500">Départs à venir</p>
              <p className="mt-1 text-lg font-semibold text-slate-800">
                {upcomingTrips}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {fleetVehicles.map((vehicle) => {
              const state = scheduleState?.[vehicle.id];
              const schedules = state?.items ?? vehicle.upcomingSchedules ?? [];
              const statusTone =
                vehicle.status === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-200 text-slate-600';
              return (
                <div
                  key={vehicle.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {vehicle.label}{' '}
                        <span className="text-xs text-slate-500">({vehicle.plateNumber})</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {vehicle.category} • {vehicle.seats} sièges
                        {vehicle.brand ? ` • ${vehicle.brand} ${vehicle.model ?? ''}` : ''}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone}`}>
                      {vehicle.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} />
                      {vehicle.metrics?.upcomingTrips ?? 0} départ(s) planifiés
                    </span>
                    {vehicle.metrics?.nextDepartureAt && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        Prochain : {formatDate(vehicle.metrics.nextDepartureAt)}
                      </span>
                    )}
                    {vehicle.amenities && vehicle.amenities.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        Équipements : {vehicle.amenities.join(', ')}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {schedules.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Aucun départ enregistré. Utilise la page « Gestion de flotte » pour programmer les prochains voyages.
                      </p>
                    ) : (
                      schedules.slice(0, 3).map((schedule) => (
                        <div
                          key={schedule.id}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-slate-700">
                              {schedule.originCity} → {schedule.destinationCity}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={11} />
                              {formatDate(schedule.departureAt)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                            <span>{schedule.plannedSeats} sièges</span>
                            <span>Statut : {schedule.status}</span>
                            {schedule.pricePerSeat > 0 && (
                              <span>{schedule.pricePerSeat.toLocaleString()} XOF / siège</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {onLoadSchedules && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => onLoadSchedules?.(vehicle.id, 'upcoming')}
                        disabled={!onLoadSchedules}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                      >
                        {state?.loading ? 'Chargement…' : 'Voir à venir'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onLoadSchedules?.(vehicle.id, 'past')}
                        disabled={!onLoadSchedules}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Historique
                      </button>
                    </div>
                  )}
                  {state?.error && (
                    <p className="text-[11px] text-amber-600">{state.error}</p>
                  )}
                  {state && state.window === 'past' && state.items.length > 0 && (
                    <p className="text-[11px] text-slate-500">
                      Affichage des trajets passés (dernier chargement).
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type RideManagementPanelProps = {
  title: string;
  account?: Account;
  rides: RideAdminItem[];
  summary?: RideAdminSummary;
  metrics?: {
    upcoming: number;
    past: number;
    seatsPublished: number;
    seatsReserved: number;
  };
  loading?: boolean;
  error?: string;
  enableDigest?: boolean;
  digestRecipient?: string;
  onAfterMutation?: () => void | Promise<void>;
  onUpdateRide?: (id: string, payload: AdminUpdateRidePayload) => Promise<RideAdminItem | undefined>;
  onCloseRide?: (id: string) => Promise<RideAdminItem | undefined>;
  onShareRides?: (payload: AdminRideDigestPayload) => Promise<AdminRideDigestResponse>;
  onRefresh?: () => void | Promise<void>;
};

type RideEditFormState = {
  originCity: string;
  destinationCity: string;
  departureLocal: string;
  seatsTotal: string;
  seatsAvailable: string;
  pricePerSeat: string;
  status: 'PUBLISHED' | 'CLOSED';
};

function RideManagementPanel({
  title,
  account,
  rides,
  summary,
  metrics,
  loading,
  error,
  enableDigest = true,
  digestRecipient,
  onAfterMutation,
  onUpdateRide,
  onCloseRide,
  onShareRides,
  onRefresh,
}: RideManagementPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rideForm, setRideForm] = useState<RideEditFormState | null>(null);
  const [rideBusy, setRideBusy] = useState(false);
  const [closingId, setClosingId] = useState<string>();
  const [rideFeedback, setRideFeedback] = useState<{ kind: 'success' | 'error'; message: string }>();
  const rideItems = Array.isArray(rides) ? rides : [];
  const emptyMessage = title.toLowerCase().includes('venir')
    ? 'Aucun trajet planifié pour cette période.'
    : 'Aucun trajet disponible pour ce filtre.';
  const [refreshing, setRefreshing] = useState(false);

  const [digestSending, setDigestSending] = useState(false);
  const [digestFeedback, setDigestFeedback] = useState<{
    success?: string;
    error?: string;
    insights?: AdminRideDigestInsights;
  }>({});
  const digestRecipientEmail = digestRecipient ?? account?.email ?? '';
  const digestEnabled = enableDigest && Boolean(onShareRides) && Boolean(digestRecipientEmail);
  const [digestForm, setDigestForm] = useState<{
    status: 'ALL' | 'PUBLISHED' | 'CLOSED';
    limit: number;
    includeUpcomingOnly: boolean;
    attachCsv: boolean;
    includeInsights: boolean;
    targetScope: 'ALL' | 'ACCOUNT_ONLY';
    message: string;
  }>({
    status: 'ALL',
    limit: 25,
    includeUpcomingOnly: true,
    attachCsv: true,
    includeInsights: true,
    targetScope: account?.type === 'INDIVIDUAL' ? 'ACCOUNT_ONLY' : 'ALL',
    message: '',
  });

  const handlePanelRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setEditingId(null);
    setRideForm(null);
    setRideFeedback(undefined);
  }, [account?.id]);

  useEffect(() => {
    if (!digestEnabled) {
      setDigestFeedback({});
      return;
    }
    setDigestForm((prev) => ({
      ...prev,
      targetScope: account?.type === 'INDIVIDUAL' ? 'ACCOUNT_ONLY' : prev.targetScope,
    }));
    setDigestFeedback({});
  }, [account?.id, account?.type, digestEnabled]);

  useEffect(() => {
    if (!editingId) return;
    const ride = rideItems.find((item) => item.id === editingId);
    if (!ride) return;
    setRideForm({
      originCity: ride.originCity,
      destinationCity: ride.destinationCity,
      departureLocal: toLocalInput(ride.departureAt),
      seatsTotal: String(ride.seatsTotal),
      seatsAvailable: String(ride.seatsAvailable),
      pricePerSeat: String(ride.pricePerSeat),
      status: ride.status as 'PUBLISHED' | 'CLOSED',
    });
  }, [editingId, rideItems]);

  const occupancyRate = summary?.occupancyRate ?? 0;
  const occupancyPercent = Math.round(occupancyRate * 1000) / 10;

  const topRoutes = summary?.topRoutes ?? [];

  const handleEdit = (rideId: string) => {
    if (editingId === rideId) {
      setEditingId(null);
      setRideForm(null);
    } else {
      setEditingId(rideId);
      setRideFeedback(undefined);
    }
  };

  const handleRideSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId || !rideForm || !onUpdateRide) return;
    setRideBusy(true);
    setRideFeedback(undefined);
    try {
      const seatsTotal = Number(rideForm.seatsTotal);
      const seatsAvailable = Number(rideForm.seatsAvailable);
      const pricePerSeat = Number(rideForm.pricePerSeat);
      if (!Number.isFinite(seatsTotal) || seatsTotal <= 0) throw new Error('Nombre de places invalide');
      if (!Number.isFinite(seatsAvailable) || seatsAvailable < 0) throw new Error('Places restantes invalides');
      const payload: AdminUpdateRidePayload = {
        originCity: rideForm.originCity.trim(),
        destinationCity: rideForm.destinationCity.trim(),
        seatsTotal,
        seatsAvailable,
        pricePerSeat,
        status: rideForm.status,
      };
      if (rideForm.departureLocal) {
        const departureDate = new Date(rideForm.departureLocal);
        if (Number.isNaN(departureDate.getTime())) {
          throw new Error('Date de départ invalide');
        }
        payload.departureAt = departureDate.toISOString();
      }
      await onUpdateRide(editingId, payload);
      if (onAfterMutation) {
        await onAfterMutation();
      }
      setRideFeedback({ kind: 'success', message: 'Trajet mis à jour.' });
      setEditingId(null);
      setRideForm(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Mise à jour impossible.';
      setRideFeedback({ kind: 'error', message: msg });
    } finally {
      setRideBusy(false);
    }
  };

  const handleCloseRide = async (rideId: string) => {
    if (!onCloseRide) return;
    setClosingId(rideId);
    setRideFeedback(undefined);
    try {
      await onCloseRide(rideId);
      if (onAfterMutation) {
        await onAfterMutation();
      }
      setRideFeedback({ kind: 'success', message: 'Trajet clôturé.' });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Impossible de clôturer le trajet.';
      setRideFeedback({ kind: 'error', message: msg });
    } finally {
      setClosingId(undefined);
    }
  };

  const handleSendDigest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onShareRides || !account?.email) return;
    setDigestSending(true);
    setDigestFeedback({});
    try {
      const response = await onShareRides({
        recipient: account.email,
        status: digestForm.status,
        limit: digestForm.limit,
        includeUpcomingOnly: digestForm.includeUpcomingOnly,
        attachCsv: digestForm.attachCsv,
        includeInsights: digestForm.includeInsights,
        targetScope: digestForm.targetScope,
        driverId:
          digestForm.targetScope === 'ACCOUNT_ONLY' && account.id ? account.id : undefined,
        message: digestForm.message.trim() ? digestForm.message.trim() : undefined,
      });
      if (response.reason === 'empty' || response.count === 0) {
        setDigestFeedback({
          error: "Aucun trajet correspondant aux filtres n'a été trouvé.",
          insights: response.insights,
        });
      } else if (response.delivered) {
        setDigestFeedback({
          success: `Digest envoyé (${response.count ?? 0} trajets).`,
          insights: response.insights,
        });
      } else {
        setDigestFeedback({
          error: "Le digest n'a pas pu être délivré (vérifie la configuration SMTP).",
          insights: response.insights,
        });
      }
    } catch (err: any) {
      const rawMessage = err?.response?.data?.message || err?.message || 'Envoi impossible.';
      const friendly = DIGEST_ERROR_MESSAGES[rawMessage] ?? rawMessage;
      setDigestFeedback({ error: friendly });
    } finally {
      setDigestSending(false);
    }
  };

  const disableActions = !onUpdateRide;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            {title}
          </h3>
          <p className="text-xs text-slate-500">
            {digestEnabled
              ? 'Ajuste les trajets, clôture les publications ou partage un digest personnalisé.'
              : 'Visualise et ajuste les trajets directement depuis cet espace.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {onRefresh && (
            <button
              type="button"
              onClick={() => void handlePanelRefresh()}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:border-sky-200 hover:text-sky-600 disabled:opacity-50"
            >
              <RefreshCw size={12} /> Recharger
            </button>
          )}
          {digestEnabled && digestRecipientEmail && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
              <MapPin size={12} /> {digestRecipientEmail}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 text-sm text-slate-600">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="uppercase text-xs font-semibold text-slate-500">Départs à venir</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">
            {summary?.upcoming ?? metrics?.upcoming ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="uppercase text-xs font-semibold text-slate-500">Remplissage moyen</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">
            {Number.isFinite(occupancyPercent) ? `${occupancyPercent.toFixed(1)} %` : '0 %'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="uppercase text-xs font-semibold text-slate-500">Prix moyen</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">
            {(summary?.averagePrice ?? 0).toLocaleString('fr-FR')} F CFA
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 flex flex-wrap items-center justify-between gap-2">
          <span>{error}</span>
          {onRefresh && (
            <button
              type="button"
              onClick={() => void handlePanelRefresh()}
              disabled={refreshing || loading}
              className="rounded-full border border-rose-300 px-3 py-1 font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              Réessayer
            </button>
          )}
        </div>
      )}

      {rideFeedback && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            rideFeedback.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {rideFeedback.message}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Itinéraire</th>
              <th className="px-3 py-2 text-left">Départ</th>
              <th className="px-3 py-2 text-center">Places</th>
              <th className="px-3 py-2 text-right">Prix</th>
              <th className="px-3 py-2 text-center">Statut</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                  Chargement des trajets…
                </td>
              </tr>
            ) : rideItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rideItems.map((ride) => {
                const reserved = ride.seatsTotal - ride.seatsAvailable;
                const isEditing = editingId === ride.id;
                return (
                  <tr
                    key={ride.id}
                    className={`border-t border-slate-100 ${isEditing ? 'bg-sky-50/60' : 'bg-white'}`}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">
                        {ride.originCity} → {ride.destinationCity}
                      </div>
                      <div className="text-xs text-slate-500">#{ride.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(ride.departureAt)}</td>
                    <td className="px-3 py-2 text-center text-slate-600">
                      {reserved}/{ride.seatsTotal}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {ride.pricePerSeat.toLocaleString('fr-FR')} F
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          ride.status === 'PUBLISHED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {ride.status === 'PUBLISHED' ? 'Publié' : 'Clôturé'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(ride.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-sky-200 hover:text-sky-600"
                      >
                        <Pencil size={12} /> Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCloseRide(ride.id)}
                        disabled={ride.status === 'CLOSED' || closingId === ride.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
                      >
                        <XCircle size={12} /> Clôturer
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editingId && rideForm && (
        <form
          onSubmit={handleRideSubmit}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500">Origine</label>
              <input
                value={rideForm.originCity}
                onChange={(e) =>
                  setRideForm((prev) => (prev ? { ...prev, originCity: e.target.value } : prev))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500">Destination</label>
              <input
                value={rideForm.destinationCity}
                onChange={(e) =>
                  setRideForm((prev) =>
                    prev ? { ...prev, destinationCity: e.target.value } : prev,
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500">Départ</label>
              <input
                type="datetime-local"
                value={rideForm.departureLocal}
                onChange={(e) =>
                  setRideForm((prev) =>
                    prev ? { ...prev, departureLocal: e.target.value } : prev,
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500">Places totales</label>
              <input
                type="number"
                min={1}
                value={rideForm.seatsTotal}
                onChange={(e) =>
                  setRideForm((prev) => (prev ? { ...prev, seatsTotal: e.target.value } : prev))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500">Places restantes</label>
              <input
                type="number"
                min={0}
                value={rideForm.seatsAvailable}
                onChange={(e) =>
                  setRideForm((prev) =>
                    prev ? { ...prev, seatsAvailable: e.target.value } : prev,
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500">Prix / place</label>
              <input
                type="number"
                min={0}
                value={rideForm.pricePerSeat}
                onChange={(e) =>
                  setRideForm((prev) =>
                    prev ? { ...prev, pricePerSeat: e.target.value } : prev,
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500">Statut</label>
              <select
                value={rideForm.status}
                onChange={(e) =>
                  setRideForm((prev) =>
                    prev
                      ? { ...prev, status: e.target.value as 'PUBLISHED' | 'CLOSED' }
                      : prev,
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                <option value="PUBLISHED">Publié</option>
                <option value="CLOSED">Clôturé</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="submit"
              disabled={rideBusy || disableActions}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              <Save size={14} /> Enregistrer
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setRideForm(null);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {digestEnabled && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <form onSubmit={handleSendDigest} className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">Partager par email</p>
              <p className="text-xs text-slate-500">
                Envoie un digest synthétique au contact sélectionné (CSV en pièce jointe).
              </p>
            </div>
            <button
              type="submit"
              disabled={digestSending || !onShareRides || !account?.email}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              <Send size={14} /> Envoyer le digest
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500">Statut</label>
              <select
                value={digestForm.status}
                onChange={(e) =>
                  setDigestForm((prev) => ({ ...prev, status: e.target.value as typeof prev.status }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                <option value="ALL">Tous</option>
                <option value="PUBLISHED">Publies</option>
                <option value="CLOSED">Clotures</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500">Limite</label>
              <input
                type="number"
                min={1}
                max={500}
                value={digestForm.limit}
                onChange={(e) =>
                  setDigestForm((prev) => ({
                    ...prev,
                    limit: Math.max(1, Math.min(500, Number(e.target.value) || 0)),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500">Portée</label>
              <select
                value={digestForm.targetScope}
                onChange={(e) =>
                  setDigestForm((prev) => ({
                    ...prev,
                    targetScope: e.target.value as typeof prev.targetScope,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                <option value="ACCOUNT_ONLY">Trajets du compte</option>
                <option value="ALL">Catalogue global</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 text-xs text-slate-600">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={digestForm.includeUpcomingOnly}
                onChange={(e) =>
                  setDigestForm((prev) => ({ ...prev, includeUpcomingOnly: e.target.checked }))
                }
              />
              Trajets à venir uniquement
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={digestForm.attachCsv}
                onChange={(e) =>
                  setDigestForm((prev) => ({ ...prev, attachCsv: e.target.checked }))
                }
              />
              Joindre le CSV
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={digestForm.includeInsights}
                onChange={(e) =>
                  setDigestForm((prev) => ({ ...prev, includeInsights: e.target.checked }))
                }
              />
              Inclure les insights
            </label>
          </div>

          <textarea
            value={digestForm.message}
            onChange={(e) => setDigestForm((prev) => ({ ...prev, message: e.target.value }))}
            rows={2}
            placeholder="Ajoute un message personnalisé (facultatif)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </form>

        {digestSending && (
          <p className="text-xs text-slate-500">Préparation et envoi du digest…</p>
        )}
        {digestFeedback.success && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {digestFeedback.success}
          </div>
        )}
        {digestFeedback.error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {digestFeedback.error}
          </div>
        )}
      {digestEnabled && digestFeedback.insights && digestForm.includeInsights && (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            {digestFeedback.insights.nextDeparture ? (
              <p>
                Prochain départ mis en avant :{' '}
                <strong>
                  {digestFeedback.insights.nextDeparture.originCity} →{' '}
                  {digestFeedback.insights.nextDeparture.destinationCity}
                </strong>{' '}
                ({formatDate(digestFeedback.insights.nextDeparture.departureAt)}).
              </p>
            ) : (
              <p>Aucun départ à venir n'a été identifié.</p>
            )}
            {digestFeedback.insights.topRoutes && digestFeedback.insights.topRoutes.length > 0 && (
              <p className="mt-1">
                Itinéraires populaires :{' '}
                {digestFeedback.insights.topRoutes
                  .map((route) => `${route.origin} → ${route.destination} (${route.count})`)
                  .join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
      )}

      {topRoutes.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Top itinéraires</p>
          <ul className="mt-2 space-y-1">
            {topRoutes.map((route) => (
              <li key={`${route.origin}-${route.destination}`}>
                {route.origin} → {route.destination} ({route.count})
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

type RideDigestComposerProps = {
  defaultRecipient?: string;
  disabled?: boolean;
  onShare: (payload: AdminRideDigestPayload) => Promise<AdminRideDigestResponse>;
};

function RideDigestComposer({ defaultRecipient, disabled, onShare }: RideDigestComposerProps) {
  const [recipient, setRecipient] = useState(defaultRecipient ?? '');
  const [status, setStatus] = useState<'ALL' | 'PUBLISHED' | 'CLOSED'>('ALL');
  const [timeframe, setTimeframe] = useState<'UPCOMING' | 'PAST' | 'ALL'>('UPCOMING');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [limit, setLimit] = useState(50);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ success?: string; error?: string }>();

  useEffect(() => {
    setRecipient(defaultRecipient ?? '');
  }, [defaultRecipient]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!recipient.trim() || disabled) return;
    setBusy(true);
    setFeedback(undefined);
    try {
      const nowIso = new Date().toISOString();
      const payload: AdminRideDigestPayload = {
        recipient: recipient.trim(),
        status: status === 'ALL' ? undefined : status,
        limit: Math.min(Math.max(limit, 1), 200),
        includeInsights: true,
        attachCsv: true,
        includeUpcomingOnly: timeframe === 'UPCOMING',
        targetScope: 'ALL',
      };
      if (timeframe === 'PAST') {
        payload.includeUpcomingOnly = false;
        payload.departureBefore = nowIso;
      } else if (timeframe === 'UPCOMING') {
        payload.departureAfter = nowIso;
      }
      if (origin.trim()) payload.origin = origin.trim();
      if (destination.trim()) payload.destination = destination.trim();
      if (message.trim()) payload.message = message.trim();

      const response = await onShare(payload);
      if (response.delivered) {
        const sentCount = response.count ?? response.summary?.published ?? 0;
        setFeedback({ success: `Digest envoyé (${sentCount} trajets).` });
      } else {
        setFeedback({ error: response.reason || "Le digest n'a pas pu être délivré." });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Envoi impossible.';
      setFeedback({ error: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Partager les trajets par email
        </p>
        <p className="text-sm text-slate-600">
          Diffuse une sélection filtrée vers n’importe quel destinataire (CSV et insights inclus).
        </p>
      </div>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          <label className="text-xs font-semibold text-slate-500">Destinataire</label>
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
            placeholder="ex: admin@entreprise.ci"
            required
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-500">Période</label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as 'UPCOMING' | 'PAST' | 'ALL')}
            >
              <option value="UPCOMING">Trajets à venir</option>
              <option value="PAST">Trajets passés</option>
              <option value="ALL">Tous les trajets</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Statut</label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ALL' | 'PUBLISHED' | 'CLOSED')}
            >
              <option value="ALL">Tous</option>
              <option value="PUBLISHED">Publiés</option>
              <option value="CLOSED">Clôturés</option>
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-500">Origine (optionnel)</label>
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Abidjan"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Destination (optionnel)</label>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Bouaké"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-500">Limite (max 200)</label>
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Message</label>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Contexte du partage"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy || disabled || !recipient.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          <Send size={14} /> {busy ? 'Envoi en cours…' : 'Envoyer le digest'}
        </button>
      </form>
      {feedback?.success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {feedback.success}
        </div>
      )}
      {feedback?.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {feedback.error}
        </div>
      )}
    </aside>
  );
}

function toLocalInput(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function MiniKpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase font-semibold text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-800 mt-1">{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function ActivitySection<T>({
  title,
  items,
  emptyMessage,
  renderItem,
  getKey,
}: {
  title: string;
  items: T[];
  emptyMessage: string;
  renderItem: (item: T) => ReactNode;
  getKey?: (item: T, index: number) => string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h3>
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">{emptyMessage}</p>
        ) : (
          items.map((item, idx) => {
            const key = getKey ? getKey(item, idx) : idx;
            return (
              <div
                key={key}
                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-600"
              >
                {renderItem(item)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
