import { ReactNode } from 'react';
import { BrandLogo } from './BrandLogo';

type Props = {
  title: string;
  subtitle?: string;
  hero: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthLayout({ title, subtitle, hero, footer, children }: Props) {
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-panel__content space-y-6">
          <BrandLogo />

          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>

          <div className="space-y-6">{children}</div>

          {footer && <div className="pt-2 text-xs text-slate-500">{footer}</div>}
        </div>

        <aside className="auth-panel__hero">
          {hero}
        </aside>
      </div>
    </div>
  );
}
