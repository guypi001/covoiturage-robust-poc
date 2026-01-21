import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../store';
import {
  type AccountType,
  type FavoriteRoute,
  type HomePreferencesPayload,
  deleteProfilePhoto,
  getCompanyVerification,
  resolveIdentityAssetUrl,
  updateCompanyProfile,
  updateIndividualProfile,
  uploadCompanyDocument,
  uploadProfilePhoto,
} from '../api';
import { HOME_THEME_OPTIONS, QUICK_ACTION_OPTIONS } from '../constants/homePreferences';

type EditableRoute = { from: string; to: string };

const MAX_ROUTES = 5;
const MAX_PHOTO_SIZE = 2 * 1024 * 1024;
const MAX_PHOTO_DIMENSION = 512;

const optimizeProfilePhoto = async (file: File) => {
  if (!file.type.startsWith('image/')) return file;
  if (typeof createImageBitmap === 'undefined') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = Math.max(bitmap.width, bitmap.height);
    const scale = maxSide > MAX_PHOTO_DIMENSION ? MAX_PHOTO_DIMENSION / maxSide : 1;
    if (scale === 1 && file.size <= MAX_PHOTO_SIZE) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82),
    );
    if (!blob) return file;
    const filename = file.name.replace(/\.\w+$/, '.jpg');
    return new File([blob], filename, { type: 'image/jpeg' });
  } catch {
    return file;
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function ProfileSettings() {
  const token = useApp((state) => state.token);
  const account = useApp((state) => state.account);
  const setSession = useApp((state) => state.setSession);

  const [tagline, setTagline] = useState('');
  const [comfort, setComfort] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [favoriteRoutes, setFavoriteRoutes] = useState<EditableRoute[]>([]);
  const [quickActions, setQuickActions] = useState<string[]>([]);
  const [theme, setTheme] = useState<'default' | 'sunset' | 'night'>('default');
  const [heroMessage, setHeroMessage] = useState('');
  const [showTips, setShowTips] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [companyVerification, setCompanyVerification] = useState<any>(null);
  const [companyDocUploading, setCompanyDocUploading] = useState(false);
  const [companyDocType, setCompanyDocType] = useState('legal');

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
    setPhotoFile(null);
    setPhotoPreview('');

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

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const loadCompanyVerification = async () => {
    if (!token || account?.type !== 'COMPANY') return;
    try {
      const data = await getCompanyVerification(token);
      setCompanyVerification(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Impossible de charger la verification.');
    }
  };

  useEffect(() => {
    void loadCompanyVerification();
  }, [token, account?.type]);

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

  const displayName = account.fullName || account.companyName || account.email;
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  const resolvedPhotoUrl = resolveIdentityAssetUrl(photoUrl || account.profilePhotoUrl);
  const statusLabel = account.status === 'ACTIVE' ? 'Actif' : 'Suspendu';
  const roleLabel = account.role === 'ADMIN' ? 'Administrateur' : 'Utilisateur';
  const typeLabel = account.type === 'COMPANY' ? 'Entreprise' : 'Particulier';

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
      const trimmedTagline = tagline.trim();
      const shouldRemoveTagline = trimmedTagline.length === 0;
      const commonPayload = {
        removeTagline: shouldRemoveTagline,
        homePreferences,
      };

      let updated = account;
      if (removePhoto) {
        updated = await deleteProfilePhoto(token);
        setPhotoUrl('');
        setPhotoPreview('');
        setPhotoFile(null);
      } else if (photoFile) {
        updated = await uploadProfilePhoto(token, photoFile);
        setPhotoUrl(updated.profilePhotoUrl ?? '');
        setPhotoPreview('');
        setPhotoFile(null);
      }

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
    <section className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Profil</h1>
        <p className="text-sm text-slate-600">
          Gère ton identité, tes préférences de trajet et la personnalisation de ton espace KariGo.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={handleSubmit} className="space-y-10">
          <section className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Identité</h2>
              <p className="text-xs text-slate-500">
                Photo, signature et informations visibles dans tes trajets et conversations.
              </p>
            </header>
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="relative h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                {removePhoto ? (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                    Photo supprimée
                  </div>
                ) : photoPreview || resolvedPhotoUrl ? (
                  <img
                    src={photoPreview || resolvedPhotoUrl || ''}
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
              <div className="flex items-center gap-3 text-xs">
                <label className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-100 cursor-pointer">
                  Importer une photo
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0];
                      if (!file) return;
                      void (async () => {
                        if (photoPreview) URL.revokeObjectURL(photoPreview);
                        setError(undefined);
                        const optimized = await optimizeProfilePhoto(file);
                        if (optimized.size > MAX_PHOTO_SIZE) {
                          setError('La photo est trop lourde. Maximum 2 Mo après compression.');
                          return;
                        }
                        setPhotoFile(optimized);
                        setPhotoPreview(URL.createObjectURL(optimized));
                        setRemovePhoto(false);
                      })();
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-100"
                  onClick={() => {
                    setRemovePhoto(true);
                    setPhotoUrl('');
                    if (photoPreview) URL.revokeObjectURL(photoPreview);
                    setPhotoPreview('');
                    setPhotoFile(null);
                  }}
                >
                  Retirer la photo
                </button>
                <span className="text-slate-500">Formats JPG, PNG, WebP. 2 Mo max, compression automatique.</span>
              </div>
            </div>
            </div>
          </section>

          {account.type === 'COMPANY' && (
            <section className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <header className="space-y-1">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Verification entreprise
                </h2>
                <p className="text-xs text-slate-500">
                  Charge les documents legaux pour activer le badge entreprise verifiee.
                </p>
              </header>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span
                  className={`rounded-full px-3 py-1 font-semibold ${
                    companyVerification?.verifiedAt
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {companyVerification?.verifiedAt ? 'Entreprise verifiee' : 'Verification en attente'}
                </span>
                <span className="text-slate-500">
                  {companyVerification?.verifiedAt
                    ? `Valide le ${formatDate(companyVerification.verifiedAt)}`
                    : 'Validation sous 24-48h'}
                </span>
              </div>
              <div className="grid gap-3 text-xs text-slate-600">
                {(companyVerification?.documents ?? []).length === 0 ? (
                  <span>Aucun document soumis pour le moment.</span>
                ) : (
                  companyVerification.documents.map((doc: any) => (
                    <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">{doc.type || 'Document'}</span>
                      <span className="text-slate-500">{doc.status}</span>
                      <a
                        className="text-sky-600 hover:text-sky-700"
                        href={resolveIdentityAssetUrl(doc.fileUrl)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ouvrir
                      </a>
                    </div>
                  ))
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  value={companyDocType}
                  onChange={(e) => setCompanyDocType(e.target.value)}
                >
                  <option value="legal">Document legal</option>
                  <option value="registration">Immatriculation</option>
                  <option value="insurance">Assurance</option>
                </select>
                <label className="rounded-lg border border-slate-300 px-3 py-2 text-slate-600 hover:bg-slate-100 cursor-pointer">
                  Importer un document
                  <input
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.currentTarget.files?.[0];
                      if (!file || !token) return;
                      setCompanyDocUploading(true);
                      setError(undefined);
                      try {
                        await uploadCompanyDocument(token, { file, type: companyDocType });
                        await loadCompanyVerification();
                        setSuccess('Document transmis pour verification.');
                      } catch (err: any) {
                        setError(
                          err?.response?.data?.message ||
                            err?.message ||
                            'Impossible d envoyer le document.',
                        );
                      } finally {
                        setCompanyDocUploading(false);
                      }
                    }}
                  />
                </label>
                {companyDocUploading && <span className="text-slate-500">Upload en cours…</span>}
              </div>
            </section>
          )}

        <section className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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

        <section className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center text-lg font-semibold">
                {initials || 'K'}
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">{displayName}</p>
                <p className="text-xs text-slate-500">{account.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{statusLabel}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{typeLabel}</span>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">{roleLabel}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase">
              <span
                className={`rounded-full px-3 py-1 ${
                  account.emailVerifiedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {account.emailVerifiedAt ? 'Email vérifié' : 'Email non vérifié'}
              </span>
              <span
                className={`rounded-full px-3 py-1 ${
                  account.phoneVerifiedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {account.phoneVerifiedAt ? 'Téléphone vérifié' : 'Téléphone non vérifié'}
              </span>
            </div>
            <div className="grid gap-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Dernière connexion</span>
                <span className="font-semibold text-slate-900">{formatDate(account.lastLoginAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Membre depuis</span>
                <span className="font-semibold text-slate-900">{formatDate(account.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Connexions</span>
                <span className="font-semibold text-slate-900">{account.loginCount ?? 0}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
