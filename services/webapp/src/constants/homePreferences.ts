export const QUICK_ACTION_OPTIONS = [
  {
    id: 'create_ride',
    label: 'Publier un trajet',
    description: 'Accéder rapidement au formulaire de publication.',
    to: '/create',
  },
  {
    id: 'view_messages',
    label: 'Messages',
    description: 'Consulter les conversations et notifications.',
    to: '/messages',
  },
  {
    id: 'view_bookings',
    label: 'Mes trajets réservés',
    description: 'Retrouver l’historique des réservations.',
    to: '/results',
  },
  {
    id: 'explore_offers',
    label: 'Explorer les offres',
    description: 'Revenir à la recherche de trajets populaires.',
    to: '/',
  },
  {
    id: 'profile_settings',
    label: 'Préférences',
    description: 'Personnaliser ton expérience depuis la page profil.',
    to: '/profile',
  },
] as const;

export const HOME_THEME_OPTIONS = [
  {
    id: 'default',
    label: 'Classique',
    gradient: 'from-white via-sky-50/60 to-white',
    accent: 'text-sky-600',
  },
  {
    id: 'sunset',
    label: 'Coucher de soleil',
    gradient: 'from-amber-50 via-rose-50/70 to-white',
    accent: 'text-amber-600',
  },
  {
    id: 'night',
    label: 'Nuit sereine',
    gradient: 'from-slate-900 via-slate-800 to-slate-900',
    accent: 'text-indigo-300',
  },
] as const;

export const HOME_THEME_STYLE = HOME_THEME_OPTIONS.reduce<
  Record<string, { gradient: string; accent: string }>
>((acc, option) => {
  acc[option.id] = { gradient: option.gradient, accent: option.accent };
  return acc;
}, {});
