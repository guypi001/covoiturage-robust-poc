import L from 'leaflet';
import clsx from 'clsx';
import { memo } from 'react';

const CITY_ICON_MAP: Record<string, string> = {
  abidjan: 'building',
  "abidjan, cote d'ivoire": 'building',
  "abidjan, côte d'ivoire": 'building',
  yamoussoukro: 'monument',
  bouake: 'tower',
  bouaké: 'tower',
  'san pedro': 'port',
  'san-pedro': 'port',
  korhogo: 'mountain',
  daloa: 'leaf',
  man: 'mountain',
};

const SVG_MAP: Record<string, string> = {
  building: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="12" y="6" width="40" height="52" rx="10" fill="#0ea5e9"/>
  <rect x="20" y="16" width="8" height="10" fill="#e0f2fe"/>
  <rect x="36" y="16" width="8" height="10" fill="#e0f2fe"/>
  <rect x="20" y="32" width="8" height="10" fill="#e0f2fe"/>
  <rect x="36" y="32" width="8" height="10" fill="#e0f2fe"/>
  <rect x="26" y="44" width="12" height="14" rx="2" fill="#0b4f8a"/>
  </svg>`,
  monument: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M8 54h48v4H8z" fill="#0b4f8a"/>
  <path d="M18 50h28l-6-16H24z" fill="#0ea5e9"/>
  <path d="M28 34h8l-2-18h-4z" fill="#0b4f8a"/>
  <circle cx="32" cy="10" r="6" fill="#0ea5e9"/>
  </svg>`,
  tower: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="24" y="6" width="16" height="10" rx="3" fill="#0b4f8a"/>
  <rect x="20" y="16" width="24" height="38" rx="6" fill="#0ea5e9"/>
  <rect x="26" y="24" width="12" height="8" fill="#e0f2fe"/>
  <rect x="26" y="36" width="12" height="8" fill="#e0f2fe"/>
  <rect x="24" y="46" width="16" height="12" rx="2" fill="#0b4f8a"/>
  </svg>`,
  port: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M10 48h44v10H10z" fill="#0b4f8a"/>
  <path d="M20 18h8v24h-8z" fill="#0ea5e9"/>
  <path d="M36 10h8v32h-8z" fill="#0ea5e9"/>
  <path d="M12 42c4 4 12 10 20 10s16-6 20-10" stroke="#0ea5e9" stroke-width="4" fill="none"/>
  <circle cx="24" cy="26" r="3" fill="#e0f2fe"/>
  <circle cx="40" cy="18" r="3" fill="#e0f2fe"/>
  </svg>`,
  mountain: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M6 54l16-28 10 18 8-14 18 24H6z" fill="#0ea5e9"/>
  <path d="M22 26l-4 6h10z" fill="#e0f2fe"/>
  <path d="M40 26l-4 6h10z" fill="#e0f2fe"/>
  </svg>`,
  leaf: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M12 36c0-14 10-24 26-24 8 0 14 3 14 3s-4 36-32 36c-6 0-8-4-8-15z" fill="#0ea5e9"/>
  <path d="M16 40c6 0 14-4 18-12" stroke="#0b4f8a" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`,
  default: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M32 4c-9.4 0-17 7.6-17 17 0 12.8 17 35 17 35s17-22.2 17-35c0-9.4-7.6-17-17-17z" fill="#2563eb"/>
  <circle cx="32" cy="21" r="7" fill="#e0f2fe"/>
  </svg>`,
};

const cacheLeaflet = new Map<string, L.Icon>();

const normalizeCity = (value?: string) => value?.trim().toLowerCase();

export const cityIconId = (city?: string) => {
  const key = normalizeCity(city);
  if (!key) return 'default';
  return CITY_ICON_MAP[key] ?? 'default';
};

export const cityIconSvg = (city?: string) => {
  const id = cityIconId(city);
  return SVG_MAP[id] ?? SVG_MAP.default;
};

export const cityIconDataUrl = (city?: string) => `data:image/svg+xml;utf8,${encodeURIComponent(cityIconSvg(city))}`;

export const getLeafletIcon = (city?: string, size: [number, number] = [44, 44]) => {
  const id = cityIconId(city);
  const cacheKey = `${id}_${size.join('x')}`;
  const cached = cacheLeaflet.get(cacheKey);
  if (cached) return cached;
  const icon = L.icon({
    iconUrl: cityIconDataUrl(city),
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]],
    popupAnchor: [0, -size[1]],
    className: 'shadow-none',
  });
  cacheLeaflet.set(cacheKey, icon);
  return icon;
};

type CityIconProps = {
  city?: string;
  size?: number;
  className?: string;
};

export const CityIcon = memo(function CityIcon({ city, size = 18, className }: CityIconProps) {
  const src = cityIconDataUrl(city);
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={clsx('inline-block align-middle select-none', className)}
      loading="lazy"
    />
  );
});

type CityBadgeProps = {
  name: string;
  muted?: boolean;
  className?: string;
};

export function CityBadge({ name, muted = false, className }: CityBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold',
        muted ? 'bg-slate-50 text-slate-600' : 'bg-sky-50 text-slate-900',
        className,
      )}
    >
      <CityIcon city={name} size={18} />
      <span className="truncate">{name}</span>
    </span>
  );
}
