export type LocationMode = 'city' | 'current' | 'manual' | 'place';

export type LocationMeta = {
  city: string;
  label: string;
  lat?: number;
  lng?: number;
  distanceKm?: number;
  accuracyMeters?: number;
  note?: string;
  mode: LocationMode;
  placeId?: string;
  provider?: 'google';
};

export const isLocationMeta = (value: unknown): value is LocationMeta =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'city' in value &&
      'label' in value &&
      typeof (value as any).city === 'string' &&
      typeof (value as any).label === 'string',
  );
