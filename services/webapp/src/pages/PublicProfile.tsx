import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Calendar, Mail, MessageCircle, Phone, Shield, Star } from 'lucide-react';
import { createReport, getPublicProfile, resolveIdentityAssetUrl, type Account } from '../api';
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

const PROFILE_QUESTIONS = [
  { key: 'smokeFree', label: 'Non-fumeur' },
  { key: 'acceptsPets', label: 'Animaux acceptes' },
  { key: 'likesConversation', label: 'Aime discuter' },
  { key: 'musicOk', label: 'Musique ok' },
  { key: 'luggageSpace', label: 'Place bagages' },
  { key: 'acOk', label: 'Climatisation' },
];

export default function PublicProfile() {
  const { accountId } = useParams<{ accountId: string }>();
  const token = useApp((state) => state.token);
  const currentAccount = useApp((state) => state.account);
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Comportement inapproprié');
  const [reportMessage, setReportMessage] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<string>();

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
  const emailVerified = Boolean(profile?.emailVerifiedAt);
  const phoneVerified = Boolean(profile?.phoneVerifiedAt);

  const handleReport = async () => {
    if (!token || !profile?.id) {
      setReportFeedback('Connecte-toi pour signaler ce profil.');
      return;
    }
    setReportBusy(true);
    setReportFeedback(undefined);
    try {
      await createReport(token, {
        targetAccountId: profile.id,
        category: 'ACCOUNT',
        reason: reportReason,
        message: reportMessage || undefined,
      });
      setReportFeedback('Signalement envoyé. Merci pour ton aide.');
      setReportMessage('');
      setReportOpen(false);
    } catch (err: any) {
      setReportFeedback(err?.response?.data?.message || err?.message || 'Signalement impossible.');
    } finally {
      setReportBusy(false);
    }
  };
  const since = useMemo(() => formatDate(profile?.createdAt), [profile?.createdAt]);
  const lastLogin = useMemo(() => formatDate(profile?.lastLoginAt || undefined), [profile?.lastLoginAt]);
  const isCompany = profile?.type === 'COMPANY';
  const canMessage = Boolean(profile && currentAccount?.id && profile.id !== currentAccount.id);
  const ratingSummary = profile?.ratingSummary;
  const ratingCount = ratingSummary?.count ?? 0;
  const ratingAverage = ratingSummary?.averages?.overall ?? 0;

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
              <div className="h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                {profile.profilePhotoUrl ? (
                  <img
                    src={resolveIdentityAssetUrl(profile.profilePhotoUrl)}
                    alt={`Photo de ${name}`}
                    className="h-full w-full object-cover"
                  />
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
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase">
                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      emailVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {emailVerified ? 'Email vérifié' : 'Email non vérifié'}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      phoneVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {phoneVerified ? 'Téléphone vérifié' : 'Téléphone non vérifié'}
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-700">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Note globale</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, index) => {
                        const active = index + 1 <= Math.round(ratingAverage);
                        return (
                          <Star
                            key={`star-${index}`}
                            size={16}
                            className={active ? 'text-amber-500 fill-amber-400' : 'text-slate-300'}
                          />
                        );
                      })}
                    </div>
                    <span className="text-sm font-semibold text-slate-700">
                      {ratingCount ? ratingAverage.toFixed(1) : '--'} ({ratingCount})
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                    <span>Ponctualite: {ratingCount ? ratingSummary?.averages?.punctuality?.toFixed?.(1) : '--'}</span>
                    <span>Conduite: {ratingCount ? ratingSummary?.averages?.driving?.toFixed?.(1) : '--'}</span>
                    <span>Proprete: {ratingCount ? ratingSummary?.averages?.cleanliness?.toFixed?.(1) : '--'}</span>
                  </div>
                </div>
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

            {profile.profileAnswers && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Profil voyageur</p>
                <div className="flex flex-wrap gap-2">
                  {PROFILE_QUESTIONS.filter((q) => typeof profile.profileAnswers?.[q.key] === 'boolean').map(
                    (q) => {
                      const value = profile.profileAnswers?.[q.key];
                      return (
                        <span
                          key={q.key}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                            value
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-rose-200 bg-rose-50 text-rose-600'
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {q.label}
                        </span>
                      );
                    },
                  )}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Signaler ce profil</p>
                <button
                  type="button"
                  onClick={() => setReportOpen((prev) => !prev)}
                  className="text-xs font-semibold text-rose-700 hover:text-rose-800"
                >
                  {reportOpen ? 'Fermer' : 'Ouvrir'}
                </button>
              </div>
              {reportOpen && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {['Comportement inapproprié', 'Profil suspect', 'Fausse identité', 'Autre'].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setReportReason(reason)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          reportReason === reason
                            ? 'bg-rose-600 text-white'
                            : 'border border-rose-200 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reportMessage}
                    onChange={(event) => setReportMessage(event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-rose-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                    placeholder="Ajoute un détail utile si nécessaire."
                  />
                  <button
                    type="button"
                    onClick={handleReport}
                    disabled={reportBusy}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    Envoyer le signalement
                  </button>
                </>
              )}
              {reportFeedback && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {reportFeedback}
                </div>
              )}
            </div>
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
