import { clsx } from 'clsx';

type Props = {
  className?: string;
  compact?: boolean;
};

export function BrandLogo({ className, compact }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 font-black tracking-tight text-slate-900',
        className,
      )}
      aria-label="KariGo"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-lg shadow-sky-500/40">
        <svg
          aria-hidden
          viewBox="0 0 32 32"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 20.5v-4c0-3 2.4-5.4 5.4-5.5l10-.3c3-.1 5.6 2.3 5.6 5.3v4.5M6.5 22h-2a2 2 0 0 0-2 2v2h5M25.5 22h2a2 2 0 0 1 2 2v2h-5"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 14.5h1m4 0h1m4 0h1M8 20.5h6m12.5 3a3 3 0 1 1-6 0m-9 0a3 3 0 1 1-6 0"
          />
        </svg>
      </span>
      {!compact && (
        <span className="text-xl sm:text-2xl">
          Kari<span className="text-sky-600">Go</span>
        </span>
      )}
    </span>
  );
}
