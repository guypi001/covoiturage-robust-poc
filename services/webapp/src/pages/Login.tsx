import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ShieldCheck, MailCheck, KeyRound, CircleAlert } from 'lucide-react';
import { loginAccount, requestGmailOtp, verifyGmailOtp } from '../api';
import { useApp } from '../store';
import { AuthLayout } from '../components/AuthLayout';
import { GmailLogo } from '../components/icons/GmailLogo';

type Mode = 'password' | 'gmail';
type OtpStep = 'email' | 'code';

const mapMailError = (err: any, fallback: string) => {
  const message = err?.response?.data?.message || err?.message;
  if (message === 'reset_email_failed' || message === 'otp_email_failed') {
    return "Le service d'envoi d'email est indisponible. Réessaie dans quelques minutes.";
  }
  return message || fallback;
};

export default function Login() {
  const navigate = useNavigate();
  const token = useApp((state) => state.token);
  const authReady = useApp((state) => state.authReady);
  const authLoading = useApp((state) => state.authLoading);
  const initializeAuth = useApp((state) => state.initializeAuth);
  const setSession = useApp((state) => state.setSession);
  const clearSession = useApp((state) => state.clearSession);
  const authError = useApp((state) => state.authError);

  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const [otpStep, setOtpStep] = useState<OtpStep>('email');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string>();
  const sanitizeOtpInput = (value: string) => value.replace(/\D+/g, '').slice(0, 8);
  const [googleAuthPending, setGoogleAuthPending] = useState(false);

  useEffect(() => {
    if (!authReady) {
      initializeAuth();
    }
  }, [authReady, initializeAuth]);

  useEffect(() => {
    if (token && authReady) {
      navigate('/', { replace: true });
    }
  }, [token, authReady, navigate]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!event?.data || event.data.type !== 'kari:oauth') return;
      if (event.origin !== window.location.origin) return;
      setGoogleAuthPending(false);
      const payload = event.data.payload;
      if (payload?.error) {
        setError(payload.error);
        return;
      }
      if (payload?.token && payload?.account) {
        setSession(payload.token, payload.account);
        navigate('/', { replace: true });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate, setSession]);

  const resetOtp = () => {
    setOtpStep('email');
    setOtpEmail('');
    setOtpCode('');
    setOtpSending(false);
    setOtpVerifying(false);
    setOtpMessage(undefined);
    setError(undefined);
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!email || !password) {
      setError('Renseigne email et mot de passe.');
      return;
    }
    try {
      setSubmitting(true);
      const res = await loginAccount({ email, password });
      setSession(res.token, res.account);
      navigate('/', { replace: true });
    } catch (err: any) {
      const message = err?.response?.data?.message;
      if (message === 'account_suspended') {
        setError('Ton compte est suspendu. Contacte un administrateur.');
      } else {
        setError(message || err?.message || 'Connexion impossible.');
      }
      clearSession();
    } finally {
      setSubmitting(false);
    }
  };

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setOtpMessage(undefined);
    const trimmed = otpEmail.trim().toLowerCase();
    if (!trimmed.endsWith('@gmail.com')) {
      setError('Utilise une adresse Gmail.');
      return;
    }
    try {
      setOtpSending(true);
      await requestGmailOtp({ email: trimmed });
      setOtpStep('code');
      setOtpMessage('Code envoyé. Vérifie Gmail ou tes spams.');
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
      setSession(res.token, res.account);
      navigate('/', { replace: true });
    } catch (err: any) {
      const message = err?.response?.data?.message;
      if (message === 'account_suspended') {
        setError('Ton compte est suspendu. Contacte un administrateur.');
      } else {
        setError(message || err?.message || 'Code invalide.');
      }
    } finally {
      setOtpVerifying(false);
    }
  };

  const startGoogleOAuth = useCallback(() => {
    setError(undefined);
    if (typeof window === 'undefined') return;
    const width = 520;
    const height = 640;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const identityBase = new URL('/api/identity/', window.location.origin).toString().replace(/\/$/, '');
    const url = `${identityBase}/auth/google/start?redirect=${encodeURIComponent(window.location.origin)}`;
    const popup = window.open(
      url,
      'kari-google-oauth',
      `width=${width},height=${height},left=${left},top=${top},resizable,scrollbars`,
    );
    if (!popup) {
      setError('Fenêtre pop-up bloquée. Autorise les pop-ups pour KariGo.');
      return;
    }
    setGoogleAuthPending(true);
  }, []);

  const showLoader = !authReady || authLoading;

  const hero = useMemo(
    () => (
      <div className="space-y-6" aria-hidden="true">
        <span className="auth-panel__badge">
          <ShieldCheck size={16} />
          Connexion sécurisée
        </span>

        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight leading-tight">
            Connecte-toi en quelques secondes
          </h2>
          <p className="text-sm leading-relaxed text-white/85">
            Clique sur « Continuer avec Google », utilise ton mot de passe ou reçois un code Gmail.
          </p>
        </div>

        <ul className="auth-panel__list text-white/90">
          <li>
            <span className="icon text-white" style={{ background: 'rgba(15,23,42,.18)' }}>
              <GmailLogo className="h-6 w-6" />
            </span>
            <div>
              <p className="font-semibold">Code Gmail express</p>
              <p className="text-sm text-white/80">Un code à usage unique, sans mot de passe.</p>
            </div>
          </li>
          <li>
            <span className="icon text-white" style={{ background: 'rgba(15,23,42,.18)' }}>
              <MailCheck size={18} />
            </span>
            <div>
              <p className="font-semibold">Alertes instantanées</p>
              <p className="text-sm text-white/80">Notifications de réservation dès qu’elles arrivent.</p>
            </div>
          </li>
        </ul>
      </div>
    ),
    [],
  );

  return (
    <AuthLayout
      title="Connexion"
      subtitle="Accède à ton interface conducteur ou passager."
      hero={hero}
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to="/register" className="text-sky-600 font-semibold">
            Inscription
          </Link>
        </>
      }
    >
      <div className="card highlight p-5 sm:p-6 lg:p-8 space-y-6 sm:space-y-7">
        <div className="space-y-3">
          <button
            type="button"
            onClick={startGoogleOAuth}
            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
          >
            <GmailLogo className="h-5 w-5" />
            <span>{googleAuthPending ? 'Fenêtre Google ouverte…' : 'Continuer avec Google'}</span>
          </button>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-slate-400">
            <span className="flex-1 border-t border-slate-200" />
            <span>ou</span>
            <span className="flex-1 border-t border-slate-200" />
          </div>
        </div>

        <div
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 bg-slate-100/80 p-1.5 sm:p-2 rounded-2xl text-sm"
          role="tablist"
          aria-label="Modes de connexion"
        >
          <button
            className={clsx(
              'w-full sm:flex-1 rounded-xl px-4 py-2 flex items-center justify-center gap-2 transition text-center',
              mode === 'password'
                ? 'bg-white shadow-sm shadow-sky-100/60 text-slate-900'
                : 'text-slate-500 hover:text-slate-700',
            )}
            onClick={() => {
              setMode('password');
              setError(undefined);
            }}
            type="button"
            role="tab"
            aria-selected={mode === 'password'}
            aria-controls="login-password-panel"
            id="login-password-tab"
          >
            <KeyRound
              size={16}
              className={mode === 'password' ? 'text-sky-500' : 'text-slate-400 transition'}
            />
            <span className="font-medium">Mot de passe</span>
          </button>
          <button
            className={clsx(
              'w-full sm:flex-1 rounded-xl px-4 py-2 flex items-center justify-center gap-2 transition text-center',
              mode === 'gmail'
                ? 'bg-white shadow-sm shadow-sky-100/60 text-slate-900'
                : 'text-slate-500 hover:text-slate-700',
            )}
            onClick={() => {
              setMode('gmail');
              resetOtp();
            }}
            type="button"
            role="tab"
            aria-selected={mode === 'gmail'}
            aria-controls="login-gmail-panel"
            id="login-gmail-tab"
          >
            <GmailLogo className="h-5 w-5" />
            <span className="font-medium">Code Gmail</span>
          </button>
        </div>

        {mode === 'password' && (
          <form
            onSubmit={submitPassword}
            className="space-y-5 sm:space-y-6"
            id="login-password-panel"
            role="tabpanel"
            aria-labelledby="login-password-tab"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Email</label>
              <input
                type="email"
                className="input w-full"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                placeholder="utilisateur@karigo.ci"
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
              <div className="text-right">
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
            </div>

            {(error || authError) && (
              <div
                className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-600"
                role="alert"
                aria-live="polite"
              >
                <CircleAlert size={18} className="mt-0.5 shrink-0" />
                <span>{error || authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || showLoader}
              className="btn-primary w-full h-11 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting || showLoader ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        )}

        {mode === 'gmail' && (
          <div
            className="space-y-5 sm:space-y-6"
            id="login-gmail-panel"
            role="tabpanel"
            aria-labelledby="login-gmail-tab"
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <GmailLogo className="h-6 w-6 shrink-0" />
              <p>
                Entre ton adresse Gmail pour recevoir un code unique valable quelques minutes.
              </p>
            </div>

            {otpStep === 'email' && (
              <form className="space-y-4 sm:space-y-5" onSubmit={sendOtp}>
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

                {(error || authError) && (
                  <div
                    className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-600"
                    role="alert"
                    aria-live="polite"
                  >
                    <CircleAlert size={18} className="mt-0.5 shrink-0" />
                    <span>{error || authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={otpSending || showLoader}
                  className="btn-primary w-full h-11 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {otpSending || showLoader ? 'Envoi…' : 'Envoyer un code'}
                </button>
              </form>
            )}

            {otpStep === 'code' && (
              <form className="space-y-4 sm:space-y-5" onSubmit={verifyOtp}>
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

                {(error || authError) && (
                  <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-600">
                    <CircleAlert size={18} className="mt-0.5 shrink-0" />
                    <span>{error || authError}</span>
                  </div>
                )}

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
      <div className="mt-4 text-center text-xs text-slate-500">
        Juste curieux ?{' '}
        <Link to="/" className="font-semibold text-sky-600">
          Continuer en visiteur
        </Link>
      </div>
    </AuthLayout>
  );
}
