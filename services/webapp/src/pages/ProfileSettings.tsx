import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../store';
import {
  type AccountType,
  type FavoriteRoute,
  type HomePreferencesPayload,
  updateCompanyProfile,
  updateIndividualProfile,
} from '../api';
import { HOME_THEME_OPTIONS, QUICK_ACTION_OPTIONS } from '../constants/homePreferences';

type EditableRoute = { from: string; to: string };

const MAX_ROUTES = 5;

export default function ProfileSettings() {
  const token = useApp((state) => state.token);
  const account = useApp((state) => state.account);
  const setSession = useApp((state) => state.setSession);

  const [tagline, setTagline] = useState('');
  const [comfort, setComfort] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [removePhoto, setRemovePhoto] = useState(false);
  const [favoriteRoutes, setFavoriteRoutes] = useState<EditableRoute[]>([]);
  const [quickActions, setQuickActions] = useState<string[]>([]);
  const [theme, setTheme] = useState<'default' | 'sunset' | 'night'>('default');
  const [heroMessage, setHeroMessage] = useState('');
  const [showTips, setShowTips] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const accountType = account?.type as AccountType | undefined;

  useEffect(() => {
    if (!account) return;
    if (account.type === 'INDIVIDUAL') {
      setTagline(account.tagline ?? '');
      setComfort((account.comfortPreferences ?? []).join(', '));
    } else {
      setTagline(account.tagline ?? '');
    }
    setPhotoUrl(account.profilePhotoUrl ?? '');
    setRemovePhoto(false);

    const prefs = account.homePreferences;
    setFavoriteRoutes(
      (prefs?.favoriteRoutes ?? []).map((route) => ({
        from: route.from,
        to: route.to,
      })),
    );
    setQuickActions(prefs?.quickActions ?? []);
    setTheme((prefs?.theme as typeof theme | undefined) ?? 'default');
    setHeroMessage(prefs?.heroMessage ?? '');
    setShowTips(prefs?.showTips ?? true);
  }, [account]);

  const comfortList = useMemo(
    () =>
      comfort
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [comfort],
  );

  if (!token) return <Navigate to="/login" replace />;
  if (!account) return null;

  const handleRouteChange = (index: number, field: keyof EditableRoute, value: string) => {
    setFavoriteRoutes((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addFavoriteRoute = () => {
    if (favoriteRoutes.length >= MAX_ROUTES) return;
    setFavoriteRoutes((prev) => [...prev, { from: '', to: '' }]);
  };

  const removeFavoriteRoute = (index: number) => {
    setFavoriteRoutes((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleQuickAction = (actionId: string) => {
    setQuickActions((prev) =>
      prev.includes(actionId) ? prev.filter((id) => id !== actionId) : [...prev, actionId],
    );
  };

  const buildHomePreferences = (): HomePreferencesPayload | undefined => {
    const routes: FavoriteRoute[] = favoriteRoutes
      .map((route) => ({
        from: route.from.trim(),
        to: route.to.trim(),
      }))
      .filter((route) => route.from && route.to)
      .slice(0, MAX_ROUTES);

    const payload: HomePreferencesPayload = {};
    if (routes.length) payload.favoriteRoutes = routes;
    if (quickActions.length) payload.quickActions = quickActions;
    if (theme) payload.theme = theme;
    if (heroMessage.trim()) payload.heroMessage = heroMessage.trim();
    payload.showTips = showTips;

    return Object.keys(payload).length ? payload : undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !account) return;
    setSaving(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const homePreferences = buildHomePreferences();
      const trimmedPhoto = photoUrl.trim();
      const trimmedTagline = tagline.trim();
      const shouldRemoveTagline = trimmedTagline.length === 0;
      const commonPayload = {
        profilePhotoUrl: removePhoto ? undefined : trimmedPhoto || undefined,
        removeProfilePhoto: removePhoto || (!trimmedPhoto && Boolean(account.profilePhotoUrl)),
        removeTagline: shouldRemoveTagline,
        homePreferences,
      };

      let updated;
      if (account.type === 'INDIVIDUAL') {
        updated = await updateIndividualProfile(token, {
          comfortPreferences: comfortList,
          tagline: shouldRemoveTagline ? undefined : trimmedTagline,
          ...commonPayload,
        });
      } else {
        updated = await updateCompanyProfile(token, {
          tagline: trimmedTagline || undefined,
          ...commonPayload,
        });
      }
      setSession(token, updated);
      setSuccess('Profil mis à jour avec succès.');
      setRemovePhoto(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Impossible de mettre à jour le profil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Personnalisation du profil</h1>
        <p className="text-sm text-slate-600">
          Mets à jour ta photo, tes préférences de confort et l’expérience affichée sur ta page d’accueil.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-10">
        <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              {removePhoto ? (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                  Photo supprimée
                </div>
              ) : account.profilePhotoUrl || photoUrl ? (
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
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">Photo (URL)</label>
                <input
                  type="url"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                  placeholder="https://…"
                  value={photoUrl}
                  onChange={(e) => {
                    setPhotoUrl(e.target.value);
                    setRemovePhoto(false);
                  }}
                />
              </div>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-100"
                  onClick={() => {
                    setRemovePhoto(true);
                    setPhotoUrl('');
                  }}
                >
                  Retirer la photo
                </button>
                <span className="text-slate-500">
                  Astuce : héberge ton image (600×600) sur un CDN ou un cloud public.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">
              Accroche affichée sur ton profil
            </label>
            <textarea
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              placeholder="Exemple : Conducteur attentif – Climatisation et playlist sur-mesure."
            />
            <p className="mt-1 text-xs text-slate-500">
              Affichée sur ta fiche publique et dans les conversations.
            </p>
          </div>

          {accountType === 'INDIVIDUAL' && (
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                Préférences de confort (séparées par une virgule)
              </label>
              <textarea
                value={comfort}
                onChange={(e) => setComfort(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                placeholder="Musique douce, Pause café, Climatisation légère"
              />
              <p className="mt-1 text-xs text-slate-500">
                Jusqu’à 10 préférences — elles seront proposées aux passagers avant la réservation.
              </p>
            </div>
          )}
        </section>

        <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <header>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Personnalisation de la page d’accueil
            </h2>
            <p className="text-xs text-slate-500">
              Choisis les raccourcis, le thème graphique et les trajets favoris proposés en un clic.
            </p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Thème</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                value={theme}
                onChange={(e) => setTheme(e.target.value as typeof theme)}
              >
                {HOME_THEME_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                Message d’accroche sur la page d’accueil
              </label>
              <input
                type="text"
                value={heroMessage}
                onChange={(e) => setHeroMessage(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                placeholder="Une phrase inspirante pour accueillir les passagers."
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-500">Raccourcis rapides</p>
            <div className="flex flex-wrap gap-3">
              {QUICK_ACTION_OPTIONS.map((action) => {
                const active = quickActions.includes(action.id);
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
            <p className="text-xs text-slate-500">
              Sélectionne jusqu’à 5 raccourcis. Ils s’afficheront au-dessus de la barre de recherche.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-slate-500">Trajets favoris</p>
              <button
                type="button"
                className="text-xs font-medium text-sky-600 hover:text-sky-700"
                onClick={addFavoriteRoute}
                disabled={favoriteRoutes.length >= MAX_ROUTES}
              >
                Ajouter un trajet
              </button>
            </div>
            {favoriteRoutes.length === 0 && (
              <p className="text-sm text-slate-500">
                Ajoute tes itinéraires récurrents (ex : Abidjan → Yamoussoukro) pour les retrouver en un clic.
              </p>
            )}
            {favoriteRoutes.map((route, index) => (
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
        </section>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Sauvegarder'}
          </button>
        </div>
      </form>
    </section>
  );
}
