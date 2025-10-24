import { clsx } from 'clsx';

type Props = {
  className?: string;
};

export function GmailLogo({ className }: Props) {
  return (
    <svg
      viewBox="0 0 512 512"
      role="img"
      aria-label="Logo Gmail"
      className={clsx('h-8 w-8', className)}
    >
      <path fill="#fbbc04" d="M64 128h64v256H64z" />
      <path fill="#34a853" d="M448 128v256h-64V180z" />
      <path
        fill="#ea4335"
        d="M448 128H64l192 160z"
      />
      <path
        fill="#4285f4"
        d="M128 384V180l128 108 128-108v204z"
      />
    </svg>
  );
}
