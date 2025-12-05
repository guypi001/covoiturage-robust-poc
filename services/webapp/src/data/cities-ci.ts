// src/lib/ci-cities.ts
export type City = {
  name: string;
  region?: string;
  alt?: string[];
  lat: number;
  lng: number;
};

export const CI_CITIES: City[] = [
  { name: 'Abidjan', region: 'Autonome', lat: 5.3599517, lng: -4.0082563 },
  { name: 'Yamoussoukro', region: 'Autonome', lat: 6.82055, lng: -5.27674 },
  { name: 'Bouaké', region: 'Gbêkê', alt: ['Bouake'], lat: 7.68949, lng: -5.02027 },
  { name: 'Daloa', region: 'Haut-Sassandra', lat: 6.87735, lng: -6.45022 },
  { name: 'San-Pédro', region: 'San-Pédro', alt: ['San Pedro', 'San-Pedro'], lat: 4.745, lng: -6.65 },
  { name: 'Korhogo', region: 'Poro', lat: 9.45804, lng: -5.62961 },
  { name: 'Man', region: 'Tonkpi', lat: 7.41251, lng: -7.55383 },
  { name: 'Abengourou', region: 'Indénié-Djuablin', alt: ['Abenguru'], lat: 6.7292, lng: -3.4963 },
  { name: 'Divo', region: 'Lôh-Djiboua', lat: 5.839, lng: -5.357 },
  { name: 'Gagnoa', region: 'Gôh', lat: 6.13193, lng: -5.94736 },
  { name: 'Anyama', region: 'Autonome Abidjan', lat: 5.49462, lng: -4.05183 },
  { name: 'Agboville', region: 'Agneby-Tiassa', lat: 5.92801, lng: -4.21319 },
  { name: 'Soubré', region: 'Nawa', alt: ['Soubre'], lat: 5.78297, lng: -6.60828 },
  { name: 'Bouaflé', region: 'Marahoué', alt: ['Bouafle'], lat: 6.99041, lng: -5.7442 },
  { name: 'Séguéla', region: 'Worodougou', alt: ['Seguela'], lat: 7.96111, lng: -6.67306 },
  { name: 'Bondoukou', region: 'Gontougo', lat: 8.03333, lng: -2.8 },
  { name: 'Aboisso', region: 'Sud-Comoé', lat: 5.467, lng: -3.208 },
  { name: 'Odienné', region: 'Kabadougou', alt: ['Odienne'], lat: 9.5, lng: -7.5667 },
  {
    name: 'Ferkessédougou',
    region: 'Tchologo',
    alt: ['Ferkessedougou', 'Ferké'],
    lat: 9.6,
    lng: -5.2,
  },
  { name: 'Issia', region: 'Haut-Sassandra', lat: 6.49211, lng: -6.5856 },
  { name: 'Tiassalé', region: 'Agneby-Tiassa', alt: ['Tiassale'], lat: 5.898, lng: -4.822 },
  { name: 'Toumodi', region: 'Bélier', lat: 6.553, lng: -5.017 },
  { name: 'Sakassou', region: 'Gbêkê', alt: ['Sakasou'], lat: 7.455, lng: -5.288 },
  { name: 'Méagui', region: 'Nawa', alt: ['Meagui'], lat: 5.333, lng: -6.583 },
  { name: 'Guiglo', region: 'Cavally', lat: 6.55, lng: -7.5 },
  { name: 'Lakota', region: 'Lôh-Djiboua', lat: 5.85, lng: -5.683 },
  { name: 'Bongouanou', region: 'Moronou', lat: 6.649, lng: -4.204 },
  { name: 'Mankono', region: 'Béré', lat: 8.058, lng: -6.188 },
  { name: 'Katiola', region: 'Hambol', lat: 8.137, lng: -5.102 },
  { name: 'Sinfra', region: 'Gôh', lat: 6.617, lng: -5.917 },
  { name: 'Tabou', region: 'San-Pédro', lat: 4.423, lng: -7.353 },
  { name: 'Adiaké', region: 'Sud-Comoé', alt: ['Adiake'], lat: 5.286, lng: -3.304 },
  {
    name: 'Grand-Bassam',
    region: 'Sud-Comoé',
    alt: ['Bassam', 'Grand Bassam'],
    lat: 5.2118,
    lng: -3.73884,
  },
  {
    name: 'Jacqueville',
    region: 'Grands-Ponts',
    alt: ['Jacque Ville', 'Jacque-Ville'],
    lat: 5.213,
    lng: -4.413,
  },
  {
    name: 'Assinie-Mafia',
    region: 'Sud-Comoé',
    alt: ['Assinie', 'Assinie Mafia'],
    lat: 5.1307,
    lng: -3.2745,
  },
  {
    name: 'Grand-Lahou',
    region: 'Grands-Ponts',
    alt: ['Grand Lahou'],
    lat: 5.2353,
    lng: -5.0024,
  },
  {
    name: 'Sassandra',
    region: 'Gbôklé',
    lat: 4.9529,
    lng: -6.0857,
  },
];

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

export function findCityByName(name: string): City | undefined {
  const target = strip(name);
  return CI_CITIES.find((c) => {
    if (strip(c.name) === target) return true;
    return c.alt?.some((a) => strip(a) === target);
  });
}

export function isKnownCiCity(name: string): boolean {
  return Boolean(findCityByName(name));
}

export function searchCiCities(q: string, limit = 8): City[] {
  const s = strip(q);
  if (!s) return POPULAR_CITIES;
  const scored = CI_CITIES.map((c) => {
    const hay = [c.name, c.region, ...(c.alt ?? [])].filter(Boolean).map(strip).join(' | ');
    let score = 0;
    if (hay.startsWith(s)) score += 3;
    if (hay.includes(` ${s}`)) score += 2;
    if (hay.includes(s)) score += 1;
    return { c, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
  return scored.slice(0, limit).map((x) => x.c);
}

const POPULAR_CITY_NAMES = [
  'Abidjan',
  'Yamoussoukro',
  'Bouaké',
  'San-Pédro',
  'Daloa',
  'Korhogo',
  'Man',
  'Grand-Bassam',
] as const;

export const POPULAR_CITIES: City[] = POPULAR_CITY_NAMES.map((name) => {
  const city = findCityByName(name);
  return (
    city ?? {
      name,
      lat: 0,
      lng: 0,
    }
  );
});

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function nearestCiCity(lat: number, lng: number): { city: City; distanceKm: number } {
  let best = CI_CITIES[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const city of CI_CITIES) {
    const dist = haversineKm({ lat, lng }, { lat: city.lat, lng: city.lng });
    if (dist < bestDist) {
      best = city;
      bestDist = dist;
    }
  }
  return { city: best, distanceKm: bestDist };
}
