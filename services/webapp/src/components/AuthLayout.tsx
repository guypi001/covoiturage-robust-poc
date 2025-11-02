import { ReactNode, useId } from 'react';
import { BrandLogo } from './BrandLogo';

type Props = {
  title: string;
  subtitle?: string;
  hero: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthLayout({ title, subtitle, hero, footer, children }: Props) {
  const headingId = useId();

  return (
    <main className="auth-shell" role="main" aria-labelledby={headingId}>
      <section className="auth-panel">
        <aside className="auth-panel__hero">
          {hero}
        </aside>

        <div className="auth-panel__content">
          <header className="auth-panel__header">
            <BrandLogo />

            <div className="auth-panel__heading" id={headingId}>
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </header>

          <section className="auth-panel__body">{children}</section>

          {footer && <footer className="auth-panel__footer">{footer}</footer>}
        </div>
      </section>
    </main>
  );
}
