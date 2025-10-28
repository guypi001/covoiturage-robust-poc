import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ShieldCheck, Sparkles, MailCheck, KeyRound, CircleAlert } from 'lucide-react';
import { loginAccount, requestGmailOtp, verifyGmailOtp } from '../api';
import { useApp } from '../store';
import { AuthLayout } from '../components/AuthLayout';
import { GmailLogo } from '../components/icons/GmailLogo';

type Mode = 'password' | 'gmail';
type OtpStep = 'email' | 'code';

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
      setOtpMessage('Code envoyé ! Vérifie ta boîte Gmail (ou spam).');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Impossible d’envoyer le code.');
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setOtpMessage(undefined);
    if (!otpCode.trim()) {
      setError('Entre le code reçu par email.');
      return;
    }
    try {
      setOtpVerifying(true);
      const res = await verifyGmailOtp({ email: otpEmail.trim().toLowerCase(), code: otpCode.trim() });
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

  const showLoader = !authReady || authLoading;

  const hero = useMemo(
    () => (
      <div className="space-y-6">
        <span className="auth-panel__badge">
          <ShieldCheck size={16} />
          Sécurité renforcée
        </span>

        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight leading-tight">
            Rejoins KariGo en toute confiance
          </h2>
          <p className="text-sm leading-relaxed text-white/85">
            Accède instantanément à tes trajets sauvegardés, réservations passées et préférences de
            confort. Deux méthodes simples pour te connecter, selon ton envie.
          </p>
        </div>

        <ul className="auth-panel__list text-white/90">
          <li>
            <span className="icon text-white" style={{ background: 'rgba(15,23,42,.2)' }}>
              <GmailLogo className="h-6 w-6" />
            </span>
            <div>
              <p className="font-semibold">OTP Gmail</p>
              <p className="text-sm text-white/80">
                Recevoir un code à usage unique directement sur ton adresse Gmail pour une connexion
                rapide et sécurisée.
              </p>
            </div>
          </li>
          <li>
            <span className="icon text-white" style={{ background: 'rgba(15,23,42,.2)' }}>
              <MailCheck size={18} />
            </span>
            <div>
              <p className="font-semibold">Notifications fiables</p>
              <p className="text-sm text-white/80">
                Rappels de départ, suivi de réservation et confirmation envoyés dans une interface
                familière.
              </p>
            </div>
          </li>
          <li>
            <span className="icon text-white" style={{ background: 'rgba(15,23,42,.2)' }}>
              <Sparkles size={18} />
            </span>
            <div>
              <p className="font-semibold">Expérience fluide</p>
              <p className="text-sm text-white/80">
                Interface harmonisée entre nos applications web et mobile pour préparer chaque
                trajet sans friction.
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
      title="Connexion"
      subtitle="Choisis entre connexion classique ou validation par Gmail + code à usage unique."
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
      <div className="card highlight p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl text-sm">
          <button
            className={clsx(
              'flex-1 basis-32 rounded-xl px-4 py-2 flex items-center justify-center gap-2 transition',
              mode === 'password'
                ? 'bg-white shadow-sm shadow-sky-100/60 text-slate-900'
                : 'text-slate-500 hover:text-slate-700',
            )}
            onClick={() => {
              setMode('password');
              setError(undefined);
            }}
            type="button"
          >
            <KeyRound
              size={16}
              className={mode === 'password' ? 'text-sky-500' : 'text-slate-400 transition'}
            />
            <span className="font-medium">Mot de passe</span>
          </button>
          <button
            className={clsx(
              'flex-1 basis-32 rounded-xl px-4 py-2 flex items-center justify-center gap-2 transition',
              mode === 'gmail'
                ? 'bg-white shadow-sm shadow-sky-100/60 text-slate-900'
                : 'text-slate-500 hover:text-slate-700',
            )}
            onClick={() => {
              setMode('gmail');
              resetOtp();
            }}
            type="button"
          >
            <GmailLogo className="h-5 w-5" />
            <span className="font-medium">Gmail + OTP</span>
          </button>
        </div>

        {mode === 'password' && (
          <form onSubmit={submitPassword} className="space-y-5">
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
            </div>

            {(error || authError) && (
              <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-600">
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
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <GmailLogo className="h-6 w-6 shrink-0" />
              <p>
                Utilise ton adresse Gmail pour recevoir un code unique d’une durée de validité
                limitée. Aucun mot de passe n’est requis.
              </p>
            </div>

            {otpStep === 'email' && (
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

                {(error || authError) && (
                  <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-600">
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
              <form className="space-y-4" onSubmit={verifyOtp}>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">
                    Code reçu sur {otpEmail}
                  </label>
                  <input
                    type="text"
                    className="input w-full text-center tracking-widest text-lg"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.currentTarget.value.replace(/\s+/g, ''))}
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
    </AuthLayout>
  );
}
