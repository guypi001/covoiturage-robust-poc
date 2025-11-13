import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, MailCheck, CircleAlert } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { useApp } from '../store';
import { requestPasswordReset } from '../api';

export default function ForgotPassword() {
  const authReady = useApp((state) => state.authReady);
  const initializeAuth = useApp((state) => state.initializeAuth);

  useEffect(() => {
    if (!authReady) {
      initializeAuth();
    }
  }, [authReady, initializeAuth]);

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setMessage(undefined);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Indique ton adresse email.');
      return;
    }
    try {
      setSubmitting(true);
      await requestPasswordReset({ email: trimmed });
      setMessage(
        'Si un compte est associé à cette adresse, un lien de réinitialisation vient de t’être envoyé.',
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Impossible d’envoyer l’email.');
    } finally {
      setSubmitting(false);
    }
  };

  const hero = useMemo(
    () => (
      <div className="space-y-6" aria-hidden="true">
        <span className="auth-panel__badge">
          <ShieldAlert size={16} />
          Assistance sécurité
        </span>
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight leading-tight">
            Mot de passe oublié ?
          </h2>
          <p className="text-sm leading-relaxed text-white/85">
            Reçois un lien sécurisé pour choisir un nouveau mot de passe KariGo.
          </p>
        </div>
        <ul className="auth-panel__list text-white/90">
          <li>
            <span className="icon text-white" style={{ background: 'rgba(15,23,42,.18)' }}>
              <MailCheck size={18} />
            </span>
            <div>
              <p className="font-semibold">Lien valable quelques minutes</p>
              <p className="text-sm text-white/80">Il suffit d’ouvrir l’email pour continuer.</p>
            </div>
          </li>
          <li>
            <span className="icon text-white" style={{ background: 'rgba(15,23,42,.18)' }}>
              <CircleAlert size={18} />
            </span>
            <div>
              <p className="font-semibold">Aucun risque</p>
              <p className="text-sm text-white/80">Ignore l’email si tu n’es pas à l’origine.</p>
            </div>
          </li>
        </ul>
      </div>
    ),
    [],
  );

  return (
    <AuthLayout
      title="Réinitialisation"
      subtitle="On va t’aider à retrouver l’accès à ton compte."
      hero={hero}
      footer={
        <>
          Tu connais ton mot de passe ?{' '}
          <Link to="/login" className="text-sky-600 font-semibold">
            Retour à la connexion
          </Link>
        </>
      }
    >
      <form className="card highlight p-5 sm:p-6 lg:p-8 space-y-5" onSubmit={submit}>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Adresse email</label>
          <input
            type="email"
            className="input w-full"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            placeholder="utilisateur@karigo.ci"
            required
          />
        </div>

        {message && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <MailCheck size={18} className="mt-0.5 shrink-0" />
            <span>{message}</span>
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
          {submitting ? 'Envoi…' : 'Recevoir un lien'}
        </button>

        <p className="text-xs text-slate-500 text-center">
          Pense à vérifier tes spams si tu ne vois rien arriver dans les prochaines minutes.
        </p>
      </form>
    </AuthLayout>
  );
}
