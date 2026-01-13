import { useState } from 'react';
import { Info, Heart, Link2 } from 'lucide-react';
import { useApp } from '../store';
import { useRideAvailability } from '../hooks/useRideAvailability';
import { CityIcon } from '../utils/cityIcons';

type Props = {
  rideId?: string;
  originCity: string;
  destinationCity: string;
  departureAt: string;
  pricePerSeat: number;
  seatsAvailable: number;
  seatsTotal?: number;
  selectedSeats?: number;
  driverId?: string;
  driverLabel?: string | null;
  driverPhotoUrl?: string | null;
  showPublisher?: boolean;
  onBook?: () => void;
  onDetails?: () => void;
  onContact?: () => void;
  contactBusy?: boolean;
  variant?: 'light' | 'dark';
  saved?: boolean;
  onToggleSaved?: () => void;
};

export default function RideCard({
  rideId,
  originCity,
  destinationCity,
  departureAt,
  pricePerSeat,
  seatsAvailable,
  seatsTotal,
  selectedSeats,
  driverId,
  driverLabel,
  driverPhotoUrl,
  onBook,
  onDetails,
  onContact,
  contactBusy,
  variant = 'light',
  showPublisher = true,
  saved = false,
  onToggleSaved,
}: Props) {
  const viewer = useApp((state) => state.account);
  const { seatsAvailable: liveSeatsAvailable, seatsTotal: liveSeatsTotal } = useRideAvailability(
    rideId,
    seatsAvailable,
    seatsTotal,
  );
  const soldOut = liveSeatsAvailable <= 0;
  const extractFirstName = (value?: string | null) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.split(/\s+/)[0];
  };
  const dt = new Date(departureAt);
  const dateLabel = dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeLabel = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const seatsLabel =
    typeof liveSeatsTotal === 'number' ? `${liveSeatsAvailable}/${liveSeatsTotal}` : `${liveSeatsAvailable}`;
  const seatsCount = Math.max(1, Number.isFinite(selectedSeats as number) ? Number(selectedSeats) : 1);
  const totalPrice = pricePerSeat * seatsCount;
  const [shareFeedback, setShareFeedback] = useState<'idle' | 'copied' | 'error'>('idle');
  const [photoError, setPhotoError] = useState(false);
  const shareUrl = rideId
    ? typeof window !== 'undefined'
      ? `${window.location.origin}/ride/${rideId}`
      : `/ride/${rideId}`
    : undefined;
  const baseActionClass =
    'inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition';
  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareFeedback('copied');
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.left = '-1000px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setShareFeedback('copied');
      }
    } catch {
      setShareFeedback('error');
    } finally {
      setTimeout(() => setShareFeedback('idle'), 2000);
    }
  };

  const palette = variant === 'dark'
    ? {
        container: 'relative rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-lg',
        title: 'text-white',
        subtitle: 'text-slate-300',
        price: 'text-emerald-300',
        info: 'text-slate-200',
        actionsBorder: 'border-white/15 text-slate-100 hover:bg-white/10',
        contact: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20',
        button: 'bg-emerald-500 hover:bg-emerald-400 text-slate-900',
      }
    : {
        container: 'relative rounded-2xl border border-slate-200 bg-white p-5 shadow-md shadow-slate-200/70',
        title: 'text-slate-900',
        subtitle: 'text-slate-500',
        price: 'text-slate-900',
        info: 'text-slate-700',
        actionsBorder: 'border-slate-200 text-slate-700 hover:bg-slate-50',
        contact: 'border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100',
        button: 'bg-slate-900 text-white hover:bg-slate-800 inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold',
      };

  const normalizedDriverLabel = driverLabel?.trim();
  const fallbackViewerLabel =
    driverId && viewer?.id === driverId
      ? viewer.fullName || viewer.companyName || viewer.email || undefined
      : undefined;
  const rawName = normalizedDriverLabel || fallbackViewerLabel;
  const authorName =
    extractFirstName(rawName) ||
    (rawName && rawName.length > 0 ? rawName : undefined) ||
    'Conducteur KariGo';
  const authorInitial = authorName.charAt(0).toUpperCase();
  const showAvatarPhoto = Boolean(driverPhotoUrl && !photoError);
  return (
    <article
      className={`${palette.container} ${
        soldOut ? 'grayscale opacity-80 transition-none hover:shadow-none' : ''
      }`}
    >
      {soldOut && (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-slate-300/60 bg-slate-200/60"></div>
          <span className="pointer-events-none absolute right-5 top-5 inline-flex items-center rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white mix-blend-multiply">
            Complet
          </span>
        </>
      )}
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            <p className="text-xs font-semibold uppercase tracking-wide">Départ</p>
            <p className="text-sm font-semibold text-slate-800">
              {dateLabel} · {timeLabel}
            </p>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div className="text-sm">
              <p className={`text-2xl font-bold ${palette.price}`}>{pricePerSeat.toLocaleString()} XOF</p>
              <p className={`text-xs font-semibold ${palette.info}`}>
                {soldOut ? 'Complet' : `${liveSeatsAvailable} pl. (${seatsLabel})`}
              </p>
              {seatsCount > 1 && (
                <p className={`text-[11px] ${palette.subtitle}`}>
                  Total pour {seatsCount} sièges : {totalPrice.toLocaleString()} XOF
                </p>
              )}
            </div>
            {onToggleSaved && (
              <button
                type="button"
                onClick={onToggleSaved}
                className={`rounded-full border p-2 transition ${
                  saved
                    ? 'border-rose-300 bg-rose-50 text-rose-600'
                    : variant === 'dark'
                      ? 'border-white/20 text-slate-300 hover:border-rose-300 hover:text-rose-400'
                      : 'border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-500'
                }`}
                aria-label={saved ? 'Retirer de ma liste' : 'Sauvegarder ce trajet'}
              >
                <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>
        </header>

        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-50 to-white px-3 py-1.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200">
              <CityIcon city={originCity} />
              <span>{originCity}</span>
            </div>
            <div className="relative flex-1">
              <svg viewBox="0 0 200 30" preserveAspectRatio="none" className="w-full h-10">
                <defs>
                  <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#7dd3fc" />
                    <stop offset="50%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#0ea5e9" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 20 C40 10, 60 30, 100 15 S160 25, 200 12"
                  fill="none"
                  stroke="url(#waveGrad)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="drop-shadow"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-between px-4">
                <div className="h-3 w-3 rounded-full bg-white ring-2 ring-sky-400 shadow-sm" />
                <div className="h-3 w-3 rounded-full bg-white ring-2 ring-sky-600 shadow-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-white to-sky-50 px-3 py-1.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200">
              <CityIcon city={destinationCity} />
              <span>{destinationCity}</span>
            </div>
          </div>
        </div>

        {showPublisher && (
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <div className="h-9 w-9 overflow-hidden rounded-full border border-slate-200 bg-white shadow-inner">
              {showAvatarPhoto ? (
                <img
                  src={driverPhotoUrl || ''}
                  alt={`Photo de ${authorName}`}
                  className="h-full w-full object-cover"
                  onError={() => setPhotoError(true)}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-semibold">
                  {authorInitial}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{authorName}</p>
              <p className="text-[11px] text-slate-500 truncate">
                {normalizedDriverLabel ? 'Conducteur vérifié' : 'Trajet KariGo'}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {shareUrl && (
            <button
              type="button"
              onClick={handleCopyLink}
              className={`${baseActionClass} ${palette.actionsBorder}`}
            >
              <Link2 size={14} />
              {shareFeedback === 'copied'
                ? 'Lien copié'
                : shareFeedback === 'error'
                  ? 'Impossible de copier'
                  : 'Partager'}
            </button>
          )}
          {onDetails && (
            <button
              type="button"
              className={`${baseActionClass} ${palette.actionsBorder}`}
              onClick={onDetails}
            >
              <Info size={14} /> Détails
            </button>
          )}
          {onContact && (
            <button
              type="button"
              onClick={onContact}
              disabled={contactBusy}
              className={`${baseActionClass} ${palette.contact} disabled:opacity-50`}
            >
              {contactBusy ? 'Ouverture…' : 'Contacter'}
            </button>
          )}
          {onBook && (
            <button
              type="button"
              className={`${palette.button} ${soldOut ? 'cursor-not-allowed opacity-60' : ''}`}
              onClick={onBook}
              disabled={soldOut}
            >
              {soldOut ? 'Complet' : 'Réserver'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
