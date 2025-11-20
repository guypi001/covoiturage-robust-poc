import { useState } from 'react';
import { ArrowRight, Clock, MapPin, User2, Shield, Info, Link2, Heart } from 'lucide-react';
import { useApp } from '../store';
import { useRideAvailability } from '../hooks/useRideAvailability';

type Props = {
  rideId?: string;
  originCity: string;
  destinationCity: string;
  departureAt: string;
  pricePerSeat: number;
  seatsAvailable: number;
  seatsTotal?: number;
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
  const [shareFeedback, setShareFeedback] = useState<'idle' | 'copied' | 'error'>('idle');
  const [photoError, setPhotoError] = useState(false);
  const shareUrl = rideId
    ? typeof window !== 'undefined'
      ? `${window.location.origin}/ride/${rideId}`
      : `/ride/${rideId}`
    : undefined;

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareFeedback('copied');
      } else {
        if (typeof document !== 'undefined') {
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
        } else {
          setShareFeedback('error');
        }
      }
    } catch {
      setShareFeedback('error');
    } finally {
      setTimeout(() => setShareFeedback('idle'), 2000);
    }
  };

  const palette = variant === 'dark'
    ? {
        container: 'relative rounded-[26px] border border-white/10 bg-slate-900/60 p-5 shadow-md shadow-slate-900/40 backdrop-blur',
        title: 'text-slate-50',
        subtitle: 'text-slate-300',
        badgeBase: 'inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200',
        price: 'text-emerald-300',
        chipDriver: 'inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200',
        actionsBorder: 'border-white/15 text-slate-100 hover:bg-white/10',
        contact: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20',
        button: 'bg-emerald-500 hover:bg-emerald-400 text-slate-900',
      }
    : {
        container: 'relative rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-lg',
        title: 'text-slate-900',
        subtitle: 'text-slate-500',
        badgeBase: 'inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600',
        price: 'text-slate-900',
        chipDriver: 'inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-700',
        actionsBorder: 'border-slate-200 text-slate-700 hover:bg-slate-50',
        contact: 'border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100',
        button: 'btn-primary inline-flex items-center gap-2 px-5 py-2',
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
  const authorStyles =
    variant === 'dark'
      ? {
          text: 'text-slate-300',
          name: 'text-white',
          avatar: 'border-white/20 bg-white/10 text-white',
        }
      : {
          text: 'text-slate-500',
          name: 'text-slate-800',
          avatar: 'border-slate-200 bg-slate-100 text-slate-600',
        };

  return (
    <article
      className={`${palette.container} ${
        soldOut ? 'grayscale opacity-70 transition-none hover:shadow-none' : ''
      }`}
    >
      {soldOut && (
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-slate-300/60 bg-slate-200/60"></div>
      )}
      {soldOut && (
        <span className="pointer-events-none absolute right-5 top-5 inline-flex items-center rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white mix-blend-multiply">
          Complet
        </span>
      )}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${palette.subtitle}`}>
              <span>{dateLabel}</span>
            </div>
            <div className={`flex items-center gap-2 text-lg font-semibold truncate ${palette.title}`}>
              <MapPin className={variant === 'dark' ? 'text-emerald-300 shrink-0' : 'text-sky-600 shrink-0'} size={18} />
              <span className="truncate">{originCity}</span>
              <ArrowRight size={16} className={variant === 'dark' ? 'text-slate-500' : 'text-slate-300'} />
              <span className="truncate">{destinationCity}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`${palette.badgeBase}`}>
                <Clock size={12} /> {timeLabel}
              </span>
              <span className={`${palette.badgeBase}`}>
                <User2 size={12} /> {soldOut ? 'Complet' : `${seatsLabel} siège(s)`}
              </span>
              {(normalizedDriverLabel || driverId) && (
                <span className={palette.chipDriver}>
                  <Shield size={12} /> {extractFirstName(normalizedDriverLabel) ?? authorName}
                </span>
              )}
            </div>
          </div>
          <div className="text-right w-full sm:w-auto flex items-start justify-end gap-3">
            <div>
              <div className={`text-2xl font-bold ${palette.price}`}>{pricePerSeat.toLocaleString()} XOF</div>
              <div className={`text-xs ${palette.subtitle}`}>par siège</div>
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
        </div>
        {showPublisher && (
          <div className={`flex items-center gap-3 text-xs ${authorStyles.text}`}>
            <div className={`h-9 w-9 overflow-hidden rounded-full border ${authorStyles.avatar}`}>
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
              <p className={`text-sm font-semibold ${authorStyles.name}`}>{authorName}</p>
              <p className="text-xs truncate">{normalizedDriverLabel ? 'Trajet proposé par ce conducteur' : 'Référence KariGo'}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {shareUrl && (
            <button
              type="button"
              onClick={handleCopyLink}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${palette.actionsBorder}`}
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
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${palette.actionsBorder}`}
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
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${palette.contact}`}
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
