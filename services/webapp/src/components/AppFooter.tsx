import { Link } from 'react-router-dom';

const footerLinks = [
  {
    title: 'Produit',
    items: [
      { label: 'Rechercher un trajet', to: '/' },
      { label: 'Publier un trajet', to: '/create' },
      { label: 'Mes trajets', to: '/my-trips' },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Centre d’aide', href: 'mailto:support@karigo.ci' },
      { label: 'FAQ', to: '/faq' },
      { label: 'Signaler un problème', href: 'mailto:support@karigo.ci?subject=Support%20KariGo' },
    ],
  },
  {
    title: 'Légal',
    items: [
      { label: 'Conditions d’utilisation', to: '/legal/terms' },
      { label: 'Politique de confidentialité', to: '/legal/privacy' },
      { label: 'Cookies', to: '/legal/cookies' },
    ],
  },
];

export function AppFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white/95">
      <div className="container-wide py-10 lg:py-12 text-sm text-slate-600">
        <div className="flex flex-col gap-8 lg:flex-row lg:justify-between">
          <div className="max-w-sm space-y-3">
            <p className="text-lg font-semibold text-slate-900">KariGo</p>
            <p>
              Plateforme ivoirienne de co-mobilité. Nous connectons les passagers et conducteurs
              autour de trajets fiables et responsables.
            </p>
            <div className="text-xs text-slate-500">
              Besoin d’aide ?{' '}
              <a href="mailto:support@karigo.ci" className="font-semibold text-sky-600">
                support@karigo.ci
              </a>{' '}
              ou +225 01 23 45 67 89
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {footerLinks.map((section) => (
              <div key={section.title} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {section.title}
                </p>
                <ul className="space-y-2 text-sm">
                  {section.items.map((item) => (
                    <li key={item.label}>
                      {item.to ? (
                        <Link
                          to={item.to}
                          className="transition hover:text-sky-600"
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <a
                          href={item.href}
                          className="transition hover:text-sky-600"
                          target={item.href?.startsWith('http') ? '_blank' : undefined}
                          rel={item.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                        >
                          {item.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-slate-100 pt-6 text-xs text-slate-500 lg:flex-row lg:items-center lg:justify-between">
          <p>© {new Date().getFullYear()} KariGo. Tous droits réservés.</p>
          <p className="text-slate-400">
            Fait avec ❤️ à Abidjan • Conforme RGPD / NDPC
          </p>
        </div>
      </div>
    </footer>
  );
}
