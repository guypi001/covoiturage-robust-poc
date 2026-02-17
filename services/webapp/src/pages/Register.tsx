import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ShieldCheck, Sparkles, UserRound, Building2, CircleAlert, MailCheck } from 'lucide-react';
import {
  registerIndividualAccount,
  registerCompanyAccount,
  verifyGmailOtp,
  requestGmailOtp,
  updateIndividualProfile,
} from '../api';
import { useApp } from '../store';
import { AuthLayout } from '../components/AuthLayout';
import { GmailLogo } from '../components/icons/GmailLogo';

type AccountKind = 'individual' | 'company';
type Method = 'password' | 'gmail';
type OtpStep = 'email' | 'code';

const mapMailError = (err: any, fallback: string) => {
  const message = err?.response?.data?.message || err?.message;
  if (message === 'reset_email_failed' || message === 'otp_email_failed') {
    return "Le service d'envoi d'email est indisponible. Réessaie dans quelques minutes.";
  }
  return message || fallback;
};

const mapRegisterError = (err: any, fallback: string) => {
  const message = err?.response?.data?.message || err?.message;
  if (message === 'email_already_exists') {
    return 'Cet email est déjà utilisé. Connecte-toi ou utilise "Mot de passe oublié".';
  }
  if (message === 'email_already_exists_other_account_type') {
    return 'Cet email est déjà lié à un autre type de compte. Connecte-toi avec cet email.';
  }
  return mapMailError(err, fallback);
};

export default function Register() {
  const navigate = useNavigate();
  const token = useApp((state) => state.token);
  const authReady = useApp((state) => state.authReady);
  const authLoading = useApp((state) => state.authLoading);
  const initializeAuth = useApp((state) => state.initializeAuth);
  const setSession = useApp((state) => state.setSession);
  const clearSession = useApp((state) => state.clearSession);

  const [method, setMethod] = useState<Method>('password');
  const [kind, setKind] = useState<AccountKind>('individual');

  // Password signup state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [comfort, setComfort] = useState('');
  const [tagline, setTagline] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingOtp, setPendingOtp] = useState(false);

  // Gmail OTP state
  const [otpStep, setOtpStep] = useState<OtpStep>('email');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string>();

  const [error, setError] = useState<string>();

  const sanitizeOtpInput = (value: string) => value.replace(/\D+/g, '').slice(0, 8);

  const buildFullName = () =>
    [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

  useEffect(() => {
    if (!authReady) initializeAuth();
  }, [authReady, initializeAuth]);

  useEffect(() => {
    if (token && authReady) navigate('/', { replace: true });
  }, [token, authReady, navigate]);

  useEffect(() => {
    if (kind === 'company' && method === 'gmail') {
      setMethod('password');
    }
  }, [kind, method]);

  const resetOtp = () => {
    setOtpStep('email');
    setOtpEmail('');
    setOtpCode('');
    setOtpSending(false);
    setOtpVerifying(false);
    setOtpMessage(undefined);
    setPendingOtp(false);
    setError(undefined);
  };

  const onSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!email || !password) {
      setError('Renseigne un email et un mot de passe.');
      return;
    }
    try {
      setSubmitting(true);
      if (kind === 'individual') {
        if (!firstName.trim() || !lastName.trim()) {
          setError('Renseigne ton prénom et ton nom.');
          setSubmitting(false);
          return;
        }
        const mergedFullName = buildFullName();
        const comfortList = comfort
          ? comfort
              .split(',')
              .map((c) => c.trim())
              .filter(Boolean)
          : undefined;
        const res = await registerIndividualAccount({
          email,
          password,
          fullName: mergedFullName,
          comfortPreferences: comfortList,
          tagline: tagline || undefined,
        });
        if ('pending' in res) {
          setPendingOtp(true);
          setOtpEmail(email.trim().toLowerCase());
          setOtpStep('code');
          setOtpMessage('Code envoyé par email.');
          return;
        }
        setSession(res.token, res.account);
      } else {
        if (!companyName.trim()) {
          setError('Renseigne le nom de la compagnie.');
          setSubmitting(false);
          return;
        }
        const res = await registerCompanyAccount({
          email,
          password,
          companyName,
          registrationNumber: registrationNumber || undefined,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
        });
        if ('pending' in res) {
          setPendingOtp(true);
          setOtpEmail(email.trim().toLowerCase());
          setOtpStep('code');
          setOtpMessage('Code envoyé par email.');
          return;
        }
        setSession(res.token, res.account);
      }
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(mapRegisterError(err, 'Inscription impossible.'));
      clearSession();
    } finally {
      setSubmitting(false);
    }
  };

  const resendPendingOtp = async () => {
    if (!otpEmail.trim()) {
      setError('Email manquant pour renvoyer le code.');
      return;
    }
    try {
      setOtpSending(true);
      await requestGmailOtp({ email: otpEmail.trim().toLowerCase() });
      setOtpMessage('Code envoyé par email.');
    } catch (err: any) {
      setError(mapMailError(err, 'Impossible d’envoyer le code.'));
    } finally {
      setOtpSending(false);
    }
  };

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setOtpMessage(undefined);
    if (kind === 'individual' && (!firstName.trim() || !lastName.trim())) {
      setError('Ajoute ton prénom et ton nom avant de continuer.');
      return;
    }
    const trimmed = otpEmail.trim().toLowerCase();
    if (!trimmed.endsWith('@gmail.com')) {
      setError('Utilise une adresse Gmail valide.');
      return;
    }
    try {
      setOtpSending(true);
      await requestGmailOtp({ email: trimmed });
      setOtpStep('code');
      setOtpMessage('Code envoyé sur ta boîte Gmail.');
    } catch (err: any) {
      setError(mapMailError(err, 'Impossible d’envoyer le code.'));
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setOtpMessage(undefined);
    const code = sanitizeOtpInput(otpCode);
    if (!code) {
      setError('Entre le code reçu par email.');
      return;
    }
    try {
      setOtpVerifying(true);
      const res = await verifyGmailOtp({ email: otpEmail.trim().toLowerCase(), code });
      let accountPayload = res.account;
      if (kind === 'individual') {
        const mergedFullName = buildFullName();
        if (mergedFullName) {
          try {
            accountPayload = await updateIndividualProfile(res.token, { fullName: mergedFullName });
          } catch (err) {
            console.warn('Impossible de mettre à jour le profil après l’OTP :', err);
          }
        }
      }
      setSession(res.token, accountPayload);
      setPendingOtp(false);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Code invalide.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const showLoader = !authReady || authLoading;

  const renderError = (message?: string) =>
    message ? (
      <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-600">
        <CircleAlert size={18} className="mt-0.5 shrink-0" />
        <span>{message}</span>
      </div>
    ) : null;

  const hero = useMemo(
    () => (
      <div className="space-y-6">
        <span className="auth-panel__badge">
          <Sparkles size={16} />
          Onboarding express
        </span>

        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight leading-tight">
            Construis un profil qui inspire confiance
          </h2>
          <p className="text-sm leading-relaxed text-white/85">
            KariGo t’accompagne de l’inscription à la mise en relation avec des passagers ou
            chauffeurs fiables. Un parcours unique pour les voyageurs comme pour les compagnies.
          </p>
        </div>

        <ul className="auth-panel__list text-white/90">
          <li>
            <span className="icon text-white" style={{ background: 'rgba(15,23,42,.2)' }}>
              <UserRound size={18} />
            </span>
            <div>
              <p className="font-semibold">Profil voyageur</p>
              <p className="text-sm text-white/80">
                Personnalise ton expérience, partage tes préférences de confort et réserve en toute
                sérénité.
              </p>
            </div>
          </li>
          <li>
            <span className="icon text-white" style={{ background: 'rgba(15,23,42,.2)' }}>
              <Building2 size={18} />
            </span>
            <div>
              <p className="font-semibold">Compte compagnie</p>
              <p className="text-sm text-white/80">
                Centralise ton équipe, publie des trajets réguliers et offre un suivi premium à tes
                passagers.
              </p>
            </div>
          </li>
          <li>
            <span className="icon text-white" style={{ background: 'rgba(15,23,42,.2)' }}>
              <ShieldCheck size={18} />
            </span>
            <div>
              <p className="font-semibold">Sécurité intégrée</p>
              <p className="text-sm text-white/80">
                Mot de passe robuste ou code Gmail à usage unique : choisis la méthode adaptée à ton
                organisation.
              </p>
            </div>
          </li>
        </ul>
      </div>
    ),
    [],
  );

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Sélectionne ton profil et choisis la méthode qui correspond à ton organisation."
      hero={hero}
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link to="/login" className="text-sky-600 font-semibold">
            Connexion
          </Link>
        </>
      }
    >
      <div className="card highlight p-6 space-y-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Type de profil
            </span>
            <div className="flex flex-wrap items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl text-sm">
              <button
                className={clsx(
                  'flex-1 basis-32 rounded-xl px-4 py-2 flex items-center justify-center gap-2 transition',
                  kind === 'individual'
                    ? 'bg-white shadow-sm shadow-sky-100/60 text-slate-900'
                    : 'text-slate-500 hover:text-slate-700',
                )}
                onClick={() => {
                  setKind('individual');
                  setError(undefined);
                }}
                type="button"
              >
                <UserRound
                  size={18}
                  className={kind === 'individual' ? 'text-sky-500' : 'text-slate-400 transition'}
                />
                <span className="font-medium">Voyageur</span>
              </button>
              <button
                className={clsx(
                  'flex-1 basis-32 rounded-xl px-4 py-2 flex items-center justify-center gap-2 transition',
                  kind === 'company'
                    ? 'bg-white shadow-sm shadow-sky-100/60 text-slate-900'
                    : 'text-slate-500 hover:text-slate-700',
                )}
                onClick={() => {
                  setKind('company');
                  setError(undefined);
                }}
                type="button"
              >
                <Building2
                  size={18}
                  className={kind === 'company' ? 'text-sky-500' : 'text-slate-400 transition'}
                />
                <span className="font-medium">Compagnie</span>
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {kind === 'individual'
                ? 'Parfait pour planifier tes trajets personnels, définir des préférences et suivre tes réservations.'
                : 'Pensé pour les équipes et flottes professionnelles qui souhaitent gérer plusieurs trajets.'}
            </p>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Méthode d’inscription
            </span>
            <div className="flex flex-wrap items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl text-sm">
              <button
                className={clsx(
                  'flex-1 basis-32 rounded-xl px-4 py-2 flex items-center justify-center gap-2 transition',
                  method === 'password'
                    ? 'bg-white shadow-sm shadow-sky-100/60 text-slate-900'
                    : 'text-slate-500 hover:text-slate-700',
                )}
                onClick={() => {
                  setMethod('password');
                  resetOtp();
                }}
                type="button"
              >
                <ShieldCheck
                  size={18}
                  className={method === 'password' ? 'text-sky-500' : 'text-slate-400 transition'}
                />
                <span className="font-medium">Mot de passe</span>
              </button>
              <button
                className={clsx(
                  'flex-1 basis-32 rounded-xl px-4 py-2 flex items-center justify-center gap-2 transition',
                  method === 'gmail'
                    ? 'bg-white shadow-sm shadow-sky-100/60 text-slate-900'
                    : 'text-slate-500 hover:text-slate-700',
                )}
                onClick={() => {
                  setMethod('gmail');
                  resetOtp();
                }}
                type="button"
              >
                <GmailLogo className="h-5 w-5" />
                <span className="font-medium">Gmail + OTP</span>
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {method === 'password'
                ? 'Crée un mot de passe que tu pourras modifier à tout moment dans ton espace compte.'
                : 'Nous envoyons un code unique sur ton adresse Gmail pour valider la création sans mot de passe.'}
            </p>
          </div>
        </div>

        {method === 'password' ? (
          pendingOtp ? (
            <form className="space-y-4" onSubmit={verifyOtp}>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">
                  Code reçu sur {otpEmail}
                </label>
                <input
                  type="text"
                  className="input w-full text-center tracking-widest text-lg"
                  value={otpCode}
                  onChange={(e) => setOtpCode(sanitizeOtpInput(e.currentTarget.value))}
                  maxLength={8}
                  autoComplete="one-time-code"
                  required
                />
              </div>

              {renderError(error)}

              {otpMessage && (
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <MailCheck size={18} className="mt-0.5 shrink-0 text-sky-600" />
                  <span>{otpMessage}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={otpVerifying || showLoader}
                  className="btn-primary flex-1 h-11 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {otpVerifying || showLoader ? 'Vérification…' : 'Valider le code'}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-medium"
                  onClick={resendPendingOtp}
                  disabled={otpSending}
                >
                  Renvoyer le code
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-medium"
                  onClick={() => {
                    setPendingOtp(false);
                    setOtpCode('');
                    setOtpMessage(undefined);
                    setError(undefined);
                  }}
                >
                  Changer d’email
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={onSubmitPassword} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Email</label>
                  <input
                    type="email"
                    className="input w-full"
                    value={email}
                    onChange={(e) => setEmail(e.currentTarget.value)}
                    placeholder="contact@karigo.ci"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Mot de passe</label>
                  <input
                    type="password"
                    className="input w-full"
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {kind === 'individual' ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">Prénom</label>
                      <input
                        type="text"
                        className="input w-full"
                        value={firstName}
                        onChange={(e) => setFirstName(e.currentTarget.value)}
                        placeholder="Prénom"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">Nom</label>
                      <input
                        type="text"
                        className="input w-full"
                        value={lastName}
                        onChange={(e) => setLastName(e.currentTarget.value)}
                        placeholder="Nom"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">
                        Phrase d’accroche (optionnel)
                      </label>
                      <input
                        type="text"
                        className="input w-full"
                        value={tagline}
                        onChange={(e) => setTagline(e.currentTarget.value)}
                        placeholder="Toujours à l’heure, trajet confortable garanti"
                      />
                      <p className="text-xs text-slate-400">
                        Optionnel — visible sur ton profil quand tu proposes un trajet.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">
                        Préférences de confort (séparées par des virgules)
                      </label>
                      <input
                        type="text"
                        className="input w-full"
                        value={comfort}
                        onChange={(e) => setComfort(e.currentTarget.value)}
                        placeholder="Climatisation, musique douce, bouteille d’eau"
                      />
                      <p className="text-xs text-slate-400">
                        Exemple : Climatisation, Wi-Fi, Snacks.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">Nom de la compagnie</label>
                      <input
                        type="text"
                        className="input w-full"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.currentTarget.value)}
                        placeholder="KariGo Transports"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">
                        Numéro d’immatriculation (optionnel)
                      </label>
                      <input
                        type="text"
                        className="input w-full"
                        value={registrationNumber}
                        onChange={(e) => setRegistrationNumber(e.currentTarget.value)}
                        placeholder="RC-123456"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">
                        Contact principal (optionnel)
                      </label>
                      <input
                        type="text"
                        className="input w-full"
                        value={contactName}
                        onChange={(e) => setContactName(e.currentTarget.value)}
                        placeholder="Responsable flotte"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">
                        Téléphone du contact (optionnel)
                      </label>
                      <input
                        type="tel"
                        className="input w-full"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.currentTarget.value)}
                        placeholder="+225 01 23 45 67 89"
                      />
                    </div>
                  </div>
                </>
              )}

              {renderError(error)}

              <button
                type="submit"
                disabled={submitting || showLoader}
                className="btn-primary w-full h-11 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting || showLoader ? 'Création…' : 'Créer le compte'}
            </button>
          </form>
        )
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <GmailLogo className="h-6 w-6 shrink-0" />
              <p>
                Renseigne une adresse Gmail pour recevoir un code unique. Après validation, ton
                compte KariGo est créé et tu pourras compléter les informations manquantes dans ton
                espace profil.
              </p>
            </div>

            {kind === 'individual' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Prénom</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={firstName}
                    onChange={(e) => setFirstName(e.currentTarget.value)}
                    placeholder="Prénom"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Nom</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={lastName}
                    onChange={(e) => setLastName(e.currentTarget.value)}
                    placeholder="Nom"
                    required
                  />
                </div>
              </div>
            )}

            {otpStep === 'email' ? (
              <form className="space-y-4" onSubmit={sendOtp}>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Adresse Gmail</label>
                  <input
                    type="email"
                    className="input w-full"
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.currentTarget.value)}
                    placeholder="tonadresse@gmail.com"
                    required
                  />
                </div>

                {renderError(error)}

                <button
                  type="submit"
                  disabled={otpSending || showLoader}
                  className="btn-primary w-full h-11 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {otpSending || showLoader ? 'Envoi…' : 'Recevoir un code'}
                </button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={verifyOtp}>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">
                    Code reçu sur {otpEmail}
                  </label>
                  <input
                    type="text"
                    className="input w-full text-center tracking-widest text-lg"
                    value={otpCode}
                    onChange={(e) => setOtpCode(sanitizeOtpInput(e.currentTarget.value))}
                    maxLength={8}
                    autoComplete="one-time-code"
                    required
                  />
                </div>

                {renderError(error)}

                {otpMessage && (
                  <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <MailCheck size={18} className="mt-0.5 shrink-0 text-sky-600" />
                    <span>{otpMessage}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={otpVerifying || showLoader}
                    className="btn-primary flex-1 h-11 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {otpVerifying || showLoader ? 'Vérification…' : 'Valider le code'}
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-medium"
                    onClick={() => {
                      setOtpStep('email');
                      setOtpCode('');
                      setOtpMessage(undefined);
                      setError(undefined);
                    }}
                  >
                    Changer d’email
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
