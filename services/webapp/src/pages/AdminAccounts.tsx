import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, RefreshCw } from 'lucide-react';
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

  const canAccess = account?.role === 'ADMIN';

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

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as FilterState['status'];
    setFilters((prev) => ({ ...prev, status: value }));
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as FilterState['type'];
    setFilters((prev) => ({ ...prev, type: value }));
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
    <section className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Gestion des comptes & activité</h1>
        <p className="text-sm text-slate-600">
          Supervise les comptes, promeus les administrateurs et suis les trajets ou réservations
          publiés par chaque utilisateur.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Comptes actifs" value={list?.stats.byStatus.ACTIVE ?? 0} tone="green" />
        <StatCard title="Comptes suspendus" value={list?.stats.byStatus.SUSPENDED ?? 0} tone="amber" />
        <StatCard title="Administrateurs" value={list?.stats.byRole.ADMIN ?? 0} tone="sky" />
      </div>

      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col md:flex-row md:items-end gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
      >
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">Recherche</label>
          <input
            type="search"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
            placeholder="Email, nom, entreprise…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Statut</label>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={filters.status}
            onChange={handleStatusChange}
          >
            <option value="ALL">Tous</option>
            <option value="ACTIVE">Actif</option>
            <option value="SUSPENDED">Suspendu</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={filters.type}
            onChange={handleTypeChange}
          >
            <option value="ALL">Tous</option>
            <option value="INDIVIDUAL">Particulier</option>
            <option value="COMPANY">Entreprise</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-10 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition"
        >
          Filtrer
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700 px-4 py-3">
          {error}
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
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
                <td colSpan={8} className="text-center px-4 py-6 text-slate-500">
                  Chargement…
                </td>
              </tr>
            )}
            {!loading && (list?.data.length ?? 0) === 0 && (
              <tr>
                <td colSpan={8} className="text-center px-4 py-6 text-slate-500">
                  Aucun compte trouvé.
                </td>
              </tr>
            )}
            {!loading &&
              list?.data.map((item) => {
                const isSelected = selectedAccountId === item.id;
                return (
                <tr
                  key={item.id}
                  onClick={() => fetchActivity(item.id)}
                  className={`border-t border-slate-100 transition ${
                    isSelected ? 'bg-sky-50/60' : 'bg-white'
                  } cursor-pointer`}
                >
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{item.email}</div>
                      <div className="text-xs text-slate-500">{TYPE_LABEL[item.type]}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.type === 'INDIVIDUAL'
                        ? item.fullName || '—'
                        : item.companyName || item.contactName || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                          item.role === 'ADMIN'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {ROLE_LABEL[item.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(item.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{item.loginCount ?? 0}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(item.createdAt, false)}</td>
                    <td className="px-4 py-3 space-y-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewActivity(item);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Voir activité
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(item);
                      }}
                      disabled={updatingId === item.id || disableStatusAction(item)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {item.status === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleRole(item);
                      }}
                      disabled={updatingId === item.id || disableRoleAction(item)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {item.role === 'ADMIN' ? 'Retirer admin' : 'Promouvoir admin'}
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <div>
          Page {page + 1} / {totalPages} — {list?.total ?? 0} comptes
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

      {selectedAccountId && (
        <ActivityPanel
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
        />
      )}
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

function ActivityPanel({
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
}: {
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

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Activité{account ? ` – ${account.fullName || account.companyName || account.email}` : ''}
          </h2>
          <p className="text-sm text-slate-500">
            Visualise les trajets publiés et ajuste le profil utilisateur en temps réel.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          {loading && <span>Chargement…</span>}
          <button
            type="button"
            onClick={onRefresh}
            disabled={!account || loading}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Rafraîchir l’activité
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ActivitySection
              title="Trajets"
              emptyMessage="Aucun trajet publié pour ce compte."
              items={rides}
              getKey={(ride) => ride.id}
              renderItem={(ride) => (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">
                      {ride.originCity} → {ride.destinationCity}
                    </p>
                    <p className="text-xs text-slate-500">
                      Départ {formatDate(ride.departureAt)} • {ride.pricePerSeat} F CFA / place
                    </p>
                  </div>
                  <div className="text-sm text-slate-600">
                    <span className="block">
                      {ride.seatsTotal - ride.seatsAvailable}/{ride.seatsTotal} places réservées
                    </span>
                    <span className="block text-xs text-slate-400">Statut : {ride.status}</span>
                  </div>
                </div>
              )}
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
              <p className="mt-1 text-lg font-semibold text-slate-800">{fleet.data.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="uppercase font-semibold text-slate-500">Actifs</p>
              <p className="mt-1 text-lg font-semibold text-emerald-600">{fleet.summary.active}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="uppercase font-semibold text-slate-500">Capacité</p>
              <p className="mt-1 text-lg font-semibold text-slate-800">
                {fleet.summary.fleetSeats} sièges
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="uppercase font-semibold text-slate-500">Départs à venir</p>
              <p className="mt-1 text-lg font-semibold text-slate-800">
                {fleet.summary.upcomingTrips}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {fleet.data.map((vehicle) => {
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
