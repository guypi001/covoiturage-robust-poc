import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'kari_cookie_consent_v1';
const ACCEPT_TTL = 1000 * 60 * 60 * 24 * 90; // 90 jours
const DISMISS_TTL = 1000 * 60 * 60 * 24 * 7; // 7 jours

type ConsentRecord = {
  status: 'accepted' | 'dismissed';
  ts: number;
};

const readRecord = (): ConsentRecord | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.status !== 'string' || typeof parsed.ts !== 'number') return null;
    if (parsed.status !== 'accepted' && parsed.status !== 'dismissed') return null;
    return parsed as ConsentRecord;
  } catch {
    return null;
  }
};

const shouldPrompt = (record: ConsentRecord | null) => {
  if (!record) return true;
  const now = Date.now();
  const ttl = record.status === 'accepted' ? ACCEPT_TTL : DISMISS_TTL;
  return now - record.ts > ttl;
};

const writeRecord = (record: ConsentRecord) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore storage errors
  }
};

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const record = readRecord();
    setVisible(shouldPrompt(record));
    setReady(true);
  }, []);

  const handleAccept = () => {
    writeRecord({ status: 'accepted', ts: Date.now() });
    setVisible(false);
  };

  const handleLater = () => {
    writeRecord({ status: 'dismissed', ts: Date.now() });
    setVisible(false);
  };

  if (!ready || !visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-6 z-50 lg:inset-x-auto lg:right-6 lg:w-96">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 p-5 space-y-3">
        <p className="text-sm font-semibold text-slate-900">Nous utilisons des cookies 🍪</p>
        <p className="text-sm text-slate-600">
          Ils servent à sécuriser ta session, mesurer l’usage et personnaliser ton expérience. Tu peux en savoir
          plus sur notre {''}
          <Link to="/legal/cookies" className="font-semibold text-sky-600 hover:underline">
            politique cookies
          </Link>
          .
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Accepter
          </button>
          <button
            type="button"
            onClick={handleLater}
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Me le rappeler plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
