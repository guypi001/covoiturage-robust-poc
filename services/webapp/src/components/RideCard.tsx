import { ArrowRight, Clock, MapPin, User2, Shield, Info } from "lucide-react";

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
  onBook?: () => void;
  onDetails?: () => void;
  onContact?: () => void;
  contactBusy?: boolean;
  variant?: 'light' | 'dark';
};

export default function RideCard({
  originCity,
  destinationCity,
  departureAt,
  pricePerSeat,
  seatsAvailable,
  seatsTotal,
  driverId,
  driverLabel,
  onBook,
  onDetails,
  onContact,
  contactBusy,
  variant = 'light',
}: Props) {
  const dt = new Date(departureAt);
  const dateLabel = dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeLabel = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const seatsLabel = typeof seatsTotal === 'number' ? `${seatsAvailable}/${seatsTotal}` : `${seatsAvailable}`;

  const palette = variant === 'dark'
    ? {
        container: 'rounded-[26px] border border-white/10 bg-slate-900/60 p-5 shadow-md shadow-slate-900/40 backdrop-blur',
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
        container: 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-lg',
        title: 'text-slate-900',
        subtitle: 'text-slate-500',
        badgeBase: 'inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600',
        price: 'text-slate-900',
        chipDriver: 'inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-700',
        actionsBorder: 'border-slate-200 text-slate-700 hover:bg-slate-50',
        contact: 'border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100',
        button: 'btn-primary inline-flex items-center gap-2 px-5 py-2',
      };

  return (
    <article className={palette.container}>
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
                <User2 size={12} /> {seatsLabel} siège(s)
              </span>
              {(driverLabel || driverId) && (
                <span className={palette.chipDriver}>
                  <Shield size={12} /> {driverLabel ?? driverId}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${palette.price}`}>{pricePerSeat.toLocaleString()} XOF</div>
            <div className={`text-xs ${palette.subtitle}`}>par siège</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
              className={palette.button}
              onClick={onBook}
            >
              Réserver
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
