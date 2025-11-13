import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, ShieldCheck, CircleAlert, CheckCircle2, EyeOff } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { useApp } from '../store';
import { resetPassword } from '../api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const initialToken = searchParams.get('token') ?? '';

  const authReady = useApp((state) => state.authReady);
  const initializeAuth = useApp((state) => state.initializeAuth);
  const setSession = useApp((state) => state.setSession);

  useEffect(() => {
    if (!authReady) {
      initializeAuth();
    }
  }, [authReady, initializeAuth]);

  const navigate = useNavigate();

  const [token, setToken] = useState(initialToken);
  const [tokenLocked, setTokenLocked] = useState(Boolean(initialToken));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();

  useEffect(() => {
    if (initialToken) {
      setToken(initialToken);
      setTokenLocked(true);
    }
  }, [initialToken]);

  const tokenPreview = useMemo(() => {
    if (!token) return '';
    const [idPart = '', secretPart = ''] = token.split(':');
    const shortId = idPart.slice(0, 6);
    const shortSecret = secretPart.slice(-4);
    return `${shortId || '••••••'}…${shortSecret || '••••'}`;
  }, [token]);

  const translateError = (code?: string) => {
    switch (code) {
      case 'reset_expired':
        return 'Le lien a expiré. Relance une demande depuis la page Mot de passe oublié.';
      case 'reset_invalid':
      case 'reset_used':
      case 'reset_blocked':
        return 'Ce lien ne peut pas être utilisé. Fais-en générer un nouveau.';
      case 'account_suspended':
        return 'Ton compte est suspendu. Contacte un administrateur.';
      default:
        return code || 'Impossible de mettre à jour ton mot de passe.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setInfo(undefined);
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError('Colle le lien reçu par email.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Choisis un mot de passe d’au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    try {
      setSubmitting(true);
      const res = await resetPassword({ token: trimmedToken, password });
      setSession(res.token, res.account);
      setInfo('Mot de passe mis à jour. Redirection en cours…');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 500);
    } catch (err: any) {
      setError(translateError(err?.response?.data?.message || err?.message));
    } finally {
      setSubmitting(false);
    }
  };

  const hero = useMemo(
    () => (
      <div className="space-y-6" aria-hidden="true">
        <span className="auth-panel__badge">
          <ShieldCheck size={16} />
          Sécurise ton accès
        </span>
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight leading-tight">Choisis un nouveau mot de passe</h2>
          <p className="text-sm leading-relaxed text-white/85">
            Le lien reçu par email permet de valider que tu es bien le propriétaire du compte.
          </p>
        </div>
        <ul className="auth-panel__list text-white/90">
          <li>
            <span className="icon text-white" style={{ background: 'rgba(15,23,42,.18)' }}>
              <KeyRound size={18} />
            </span>
            <div>
              <p className="font-semibold">Un seul lien par demande</p>
              <p className="text-sm text-white/80">Il expire automatiquement pour protéger ton compte.</p>
            </div>
          </li>
          <li>
            <span className="icon text-white" style={{ background: 'rgba(15,23,42,.18)' }}>
              <CheckCircle2 size={18} />
            </span>
            <div>
              <p className="font-semibold">Accès immédiat</p>
              <p className="text-sm text-white/80">Une fois validé, tu es directement connecté.</p>
            </div>
          </li>
        </ul>
      </div>
    ),
    [],
  );

  return (
    <AuthLayout
      title="Nouveau mot de passe"
      subtitle="Colle le lien reçu pour finaliser la réinitialisation."
      hero={hero}
      footer={
        <>
          Tu n’as pas reçu d’email ?{' '}
          <Link to="/forgot-password" className="text-sky-600 font-semibold">
            Relancer l’envoi
          </Link>
        </>
      }
    >
      <form className="card highlight p-5 sm:p-6 lg:p-8 space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Jeton de réinitialisation</label>
          {tokenLocked ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <EyeOff size={16} />
                Jeton sécurisé détecté
              </div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {tokenPreview}
              </div>
              <button
                type="button"
                className="self-start text-xs font-semibold text-sky-600 hover:text-sky-700"
                onClick={() => {
                  setToken('');
                  setTokenLocked(false);
                }}
              >
                Utiliser un autre lien
              </button>
            </div>
          ) : (
            <input
              type="text"
              className="input w-full"
              value={token}
              onChange={(e) => setToken(e.currentTarget.value)}
              placeholder="Ex: 123e4567-...:abcd1234"
              required
            />
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Nouveau mot de passe</label>
          <input
            type="password"
            className="input w-full"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            placeholder="••••••••"
            minLength={8}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Confirmation</label>
          <input
            type="password"
            className="input w-full"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.currentTarget.value)}
            placeholder="••••••••"
            minLength={8}
            required
          />
        </div>

        {info && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>{info}</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <CircleAlert size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full h-11 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Validation…' : 'Mettre à jour'}
        </button>
      </form>
    </AuthLayout>
  );
}
