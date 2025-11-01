export type HomeThemeId = 'default' | 'sunset' | 'night';

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
  {
    id: 'manage_fleet',
    label: 'Gestion de flotte',
    description: 'Accéder à la planification des véhicules (comptes entreprise).',
    to: '/company/fleet',
  },
] as const;

export const HOME_THEME_OPTIONS = [
  {
    id: 'default' as HomeThemeId,
    label: 'Classique',
    gradient: 'from-[#f6fbff] via-white to-[#eef5ff]',
    accent: 'text-sky-600',
  },
  {
    id: 'sunset' as HomeThemeId,
    label: 'Coucher de soleil',
    gradient: 'from-[#fff4ec] via-[#ffe5dc] to-[#fff8f3]',
    accent: 'text-amber-600',
  },
  {
    id: 'night' as HomeThemeId,
    label: 'Nuit sereine',
    gradient: 'from-[#030712] via-[#0f172a] to-[#020617]',
    accent: 'text-indigo-200',
  },
] as const;

export type HomeThemeStyle = {
  gradient: string;
  pattern?: string;
  glow: string;
  accent: string;
  hero: {
    badge: string;
    badgeIcon: string;
    title: string;
    text: string;
    card: string;
    cardText: string;
    iconWrap: string;
    iconColor: string;
    sectionTitle: string;
  };
  search: {
    panel: string;
    icon: string;
    fieldLg: string;
    fieldSm: string;
    button: string;
    hint: string;
  };
  chips: {
    accent: string;
    neutral: string;
  };
  quickActions: {
    active: string;
    inactive: string;
  };
  surface: string;
  surfaceMuted: string;
};

export type HomeSearchTheme = HomeThemeStyle['search'];

export const HOME_THEME_STYLE: Record<HomeThemeId, HomeThemeStyle> = {
  default: {
    gradient: 'from-[#f6fbff] via-white to-[#eef5ff]',
    pattern:
      'bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.12),transparent_60%)]',
    glow: 'bg-sky-200/40',
    accent: 'text-sky-600',
    hero: {
      badge:
        'bg-white/90 border border-sky-100/70 text-sky-600 shadow-sm shadow-sky-100/40',
      badgeIcon: 'text-sky-500',
      title: 'text-slate-900',
      text: 'text-slate-600',
      card:
        'border border-white/60 bg-white/85 backdrop-blur-sm shadow-lg shadow-sky-100/40',
      cardText: 'text-slate-600',
      iconWrap: 'bg-sky-500/12 text-sky-600',
      iconColor: 'text-sky-500',
      sectionTitle: 'text-slate-900',
    },
    search: {
      panel:
        'border border-white/80 bg-white/95 shadow-2xl shadow-sky-100/70 backdrop-blur-xl',
      icon: 'text-sky-500/80',
      fieldLg: 'border-slate-200 focus:border-sky-200 focus:ring-sky-100',
      fieldSm: 'border-slate-200 focus:border-sky-200 focus:ring-sky-100',
      button: 'bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-200/60',
      hint: 'text-slate-500',
    },
    chips: {
      accent: 'border-sky-200 bg-sky-50 text-sky-700',
      neutral: 'border-slate-200 bg-white text-slate-500',
    },
    quickActions: {
      active: 'border-sky-200 bg-sky-50 text-sky-700 shadow-sm',
      inactive:
        'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-600',
    },
    surface: 'border border-slate-200 bg-white/85 backdrop-blur shadow-sm',
    surfaceMuted: 'border border-slate-200 bg-slate-50/80',
  },
  sunset: {
    gradient: 'from-[#fff4ec] via-[#ffe0d1] to-[#fff7f1]',
    pattern:
      'bg-[radial-gradient(circle_at_80%_10%,rgba(249,115,22,0.14),transparent_60%)]',
    glow: 'bg-rose-200/40',
    accent: 'text-amber-600',
    hero: {
      badge:
        'bg-white/90 border border-amber-200/70 text-amber-600 shadow-md shadow-amber-100/50',
      badgeIcon: 'text-amber-500',
      title: 'text-[#5b1f00]',
      text: 'text-[#7c3a10]',
      card:
        'border border-white/60 bg-white/80 backdrop-blur-sm shadow-xl shadow-amber-100/60',
      cardText: 'text-[#7c3a10]',
      iconWrap: 'bg-amber-500/12 text-amber-600',
      iconColor: 'text-amber-500',
      sectionTitle: 'text-[#5b1f00]',
    },
    search: {
      panel:
        'border border-white/70 bg-white/95 shadow-2xl shadow-amber-100/70 backdrop-blur-xl',
      icon: 'text-amber-500/80',
      fieldLg: 'border-amber-100 focus:border-amber-300 focus:ring-amber-100',
      fieldSm: 'border-amber-100 focus:border-amber-300 focus:ring-amber-100',
      button: 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-200/50',
      hint: 'text-[#9f5f26]',
    },
    chips: {
      accent: 'border-amber-200 bg-amber-50 text-amber-700',
      neutral: 'border-[#f3d8bf] bg-white/85 text-[#9f5f26]',
    },
    quickActions: {
      active: 'border-amber-200 bg-amber-50 text-amber-700 shadow-sm',
      inactive:
        'border-amber-100 bg-white/85 text-[#9f5f26] hover:border-amber-200 hover:text-amber-700',
    },
    surface: 'border border-amber-100 bg-white/90 backdrop-blur shadow-sm',
    surfaceMuted: 'border border-amber-100 bg-amber-50/80',
  },
  night: {
    gradient: 'from-[#020617] via-[#0f172a] to-[#020617]',
    pattern:
      'bg-[radial-gradient(circle_at_10%_10%,rgba(129,140,248,0.18),transparent_65%)]',
    glow: 'bg-indigo-500/20',
    accent: 'text-indigo-200',
    hero: {
      badge:
        'bg-slate-900/80 border border-indigo-500/40 text-indigo-200 shadow-indigo-900/40',
      badgeIcon: 'text-indigo-200',
      title: 'text-white',
      text: 'text-slate-300',
      card:
        'border border-indigo-500/30 bg-slate-900/75 backdrop-blur-xl shadow-2xl shadow-indigo-950/60',
      cardText: 'text-slate-300',
      iconWrap: 'bg-indigo-500/20 text-indigo-200',
      iconColor: 'text-indigo-200',
      sectionTitle: 'text-indigo-100',
    },
    search: {
      panel:
        'border border-indigo-500/40 bg-slate-900/80 shadow-2xl shadow-indigo-950/70 backdrop-blur-2xl',
      icon: 'text-indigo-300/90',
      fieldLg:
        'border-slate-700 bg-slate-900/70 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:ring-indigo-300/40',
      fieldSm:
        'border-slate-700 bg-slate-900/70 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:ring-indigo-300/40',
      button: 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-900/60',
      hint: 'text-indigo-200/70',
    },
    chips: {
      accent: 'border-indigo-500/50 bg-indigo-500/15 text-indigo-100',
      neutral: 'border-slate-700 bg-slate-900/70 text-slate-200',
    },
    quickActions: {
      active:
        'border-indigo-500/50 bg-indigo-500/20 text-indigo-100 shadow shadow-indigo-900/40',
      inactive:
        'border-slate-700 bg-slate-900/70 text-slate-200 hover:border-indigo-500/60 hover:text-indigo-100',
    },
    surface: 'border border-indigo-500/40 bg-slate-900/75 backdrop-blur-xl shadow-lg',
    surfaceMuted: 'border border-slate-800 bg-slate-900/70',
  },
};
