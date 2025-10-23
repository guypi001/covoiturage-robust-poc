import { ArrowRight, Clock, MapPin, User2, Shield } from "lucide-react";

type Props = {
  rideId?: string;
  originCity: string;
  destinationCity: string;
  departureAt: string;
  pricePerSeat: number;
  seatsAvailable: number;
  seatsTotal?: number;
  driverId?: string;
  onBook?: () => void;
  onDetails?: () => void;
};

export default function RideCard({
  originCity, destinationCity, departureAt,
  pricePerSeat, seatsAvailable, seatsTotal, driverId, onBook, onDetails,
}: Props) {
  const dt = new Date(departureAt);
  const date = dt.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
  const time = dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <article className="card p-4 md:p-5 hover:shadow-md transition">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-slate-900 text-base md:text-lg font-medium truncate">
            <MapPin className="text-sky-600 shrink-0" size={16}/>
            <span className="truncate">{originCity}</span>
            <ArrowRight size={16} className="text-slate-400 shrink-0"/>
            <span className="truncate">{destinationCity}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="badge"><Clock size={14}/> {date} • {time}</span>
            <span className="badge"><User2 size={14}/> {seatsAvailable}{typeof seatsTotal==='number' ? ` / ${seatsTotal}` : ''} siège(s)</span>
            {driverId && <span className="badge"><Shield size={14}/> Chauffeur : {driverId}</span>}
          </div>
        </div>

        <div className="flex flex-col items-end md:items-center gap-3 md:gap-4">
          <div className="text-right">
            <div className="text-3xl font-extrabold tracking-tight text-slate-900 leading-none">
              {pricePerSeat.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">XOF • par siège</div>
          </div>
          {(onDetails || onBook) && (
            <div className="flex items-center gap-2">
              {onDetails && (
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
                  onClick={onDetails}
                >
                  Détails
                </button>
              )}
              {onBook && (
                <button
                  type="button"
                  className="btn-primary whitespace-nowrap"
                  onClick={onBook}
                >
                  Réserver
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
