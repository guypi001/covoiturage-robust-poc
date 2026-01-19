import { Platform } from 'react-native';

export const colors = {
  brandPrimary: '#0ea5e9',
  brandDark: '#0f172a',
  brandAccent: '#10b981',
  brandSoft: '#e0f2fe',
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748b',
  slate200: '#e2e8f0',
  slate100: '#f1f5f9',
  slate50: '#f8fafc',
  sky600: '#0284c7',
  sky500: '#0ea5e9',
  sky100: '#e0f2fe',
  emerald500: '#10b981',
  emerald100: '#d1fae5',
  amber700: '#b45309',
  amber100: '#fef3c7',
  rose600: '#e11d48',
  rose100: '#ffe4e6',
  white: '#ffffff',
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
};

export const shadows = {
  card: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  soft: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
};

export const fonts = {
  display: Platform.select({
    ios: 'AvenirNext-DemiBold',
    android: 'sans-serif-medium',
    default: 'System',
  }),
  text: Platform.select({
    ios: 'AvenirNext-Regular',
    android: 'sans-serif',
    default: 'System',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'System',
  }),
};

export const text = {
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.slate900,
    fontFamily: fonts.display,
  },
  subtitle: {
    fontSize: 14,
    color: colors.slate600,
    fontFamily: fonts.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate900,
    fontFamily: fonts.display,
  },
  body: {
    fontSize: 14,
    color: colors.slate700,
    fontFamily: fonts.text,
  },
  caption: {
    fontSize: 12,
    color: colors.slate500,
    fontFamily: fonts.text,
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: colors.slate500,
    fontFamily: fonts.text,
  },
};
