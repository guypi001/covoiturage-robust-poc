import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Calendar, Mail, MessageCircle, Phone, Shield, Star } from 'lucide-react';
import { getPublicProfile, type Account } from '../api';
import { useApp } from '../store';

const formatDate = (value?: string | null) => {
  if (!value) return undefined;
  try {
    return new Date(value).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return undefined;
  }
};

const extractDisplayName = (account?: Account | null) => {
  if (!account) return 'Conducteur KariGo';
  return account.fullName || account.companyName || account.email || 'Conducteur KariGo';
};

export default function PublicProfile() {
  const { accountId } = useParams<{ accountId: string }>();
  const token = useApp((state) => state.token);
  const currentAccount = useApp((state) => state.account);
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!accountId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(undefined);
        const data = await getPublicProfile(accountId, token);
        if (!cancelled) setProfile(data);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.message || err?.message || 'Profil introuvable.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, token]);

  const name = extractDisplayName(profile);
  const since = useMemo(() => formatDate(profile?.createdAt), [profile?.createdAt]);
  const lastLogin = useMemo(() => formatDate(profile?.lastLoginAt || undefined), [profile?.lastLoginAt]);
  const isCompany = profile?.type === 'COMPANY';
  const canMessage = Boolean(profile && currentAccount?.id && profile.id !== currentAccount.id);

  if (!accountId) {
    return (
      <div className="glass rounded-2xl p-6 text-red-500">
        Identifiant de profil manquant.
      </div>
    );
  }

  return (
    <div className="glass rounded-[28px] p-6 space-y-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Retour
      </button>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white/40 p-4 text-sm text-slate-600">
          Chargement du profil…
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {error}
        </div>
      )}

      {profile && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white/60 p-6 space-y-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="h-24 w-24 overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
                {profile.profilePhotoUrl ? (
                  <img src={profile.profilePhotoUrl} alt={`Photo de ${name}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-slate-500">
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-wide text-slate-500">
                  {isCompany ? 'Trajet pro' : 'Conducteur particulier'}
                  {profile.status === 'ACTIVE' && <BadgeCheck size={12} className="text-emerald-500" />}
                </div>
                <h1 className="text-2xl font-semibold text-slate-900">{name}</h1>
                {profile.tagline && <p className="text-sm text-slate-600">{profile.tagline}</p>}
                {since && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
                    <Calendar size={12} />
                    Membre depuis {since}
                  </div>
                )}
              </div>
            </div>

            {(profile.email || profile.contactPhone) && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-700">
                <p className="text-xs uppercase tracking-wide text-slate-500">Coordonnées</p>
                {profile.email && (
                  <div className="inline-flex items-center gap-2 text-slate-700">
                    <Mail size={14} className="text-sky-500" />
                    {profile.email}
                  </div>
                )}
                {profile.contactPhone && (
                  <div className="inline-flex items-center gap-2 text-slate-700">
                    <Phone size={14} className="text-emerald-500" />
                    {profile.contactPhone}
                  </div>
                )}
              </div>
            )}

            {profile.comfortPreferences?.length ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Confort & préférences</p>
                <div className="flex flex-wrap gap-2">
                  {profile.comfortPreferences.map((pref) => (
                    <span
                      key={pref}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      <Star size={11} className="text-amber-500" />
                      {pref}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white/60 p-5 space-y-4 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-500">Fiabilité</p>
              <div className="flex flex-col gap-3">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  <Shield size={14} className="text-emerald-500" />
                  {profile.role === 'ADMIN' ? 'Administrateur KariGo' : 'Conducteur vérifié'}
                </div>
                {lastLogin && (
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    <Calendar size={14} className="text-sky-500" />
                    Dernière connexion {lastLogin}
                  </div>
                )}
                <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  <Shield size={14} className="text-slate-500" />
                  Statut : {profile.status === 'ACTIVE' ? 'Actif' : 'Suspendu'}
                </div>
              </div>
            </div>

            {isCompany && (
              <div className="rounded-3xl border border-slate-200 bg-white/60 p-5 text-sm text-slate-700 space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Entreprise</p>
                {profile.companyName && <p>Nom : <span className="font-semibold">{profile.companyName}</span></p>}
                {profile.registrationNumber && <p>Immatriculation : <span className="font-semibold">{profile.registrationNumber}</span></p>}
                {profile.contactName && <p>Contact : <span className="font-semibold">{profile.contactName}</span></p>}
              </div>
            )}

            {canMessage && (
              <button
                type="button"
                onClick={() =>
                  navigate('/messages', {
                    state: {
                      contact: {
                        id: profile.id,
                        type: profile.type,
                        label: name,
                        email: profile.email,
                      },
                    },
                  })
                }
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <MessageCircle size={16} />
                Contacter ce conducteur
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
