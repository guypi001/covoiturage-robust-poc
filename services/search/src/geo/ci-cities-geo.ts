// services/search/src/geo/ci-cities-geo.ts
export type CiCityGeo = {
  name: string;
  lat: number;
  lng: number;
  region?: string;
  alt?: string[];
};

export const CI_CITIES_GEO: CiCityGeo[] = [
  { name: 'Abidjan',        lat: 5.3599517,  lng: -4.0082563,  region: 'Autonome', alt: ['Abijan'] },
  { name: 'Yamoussoukro',   lat: 6.82055,    lng: -5.27674,    region: 'Autonome' },
  { name: 'Bouaké',         lat: 7.68949,    lng: -5.02027,    region: 'Gbêkê', alt: ['Bouake'] },
  { name: 'Daloa',          lat: 6.87735,    lng: -6.45022,    region: 'Haut-Sassandra' },
  { name: 'San-Pédro',      lat: 4.745,      lng: -6.6500,     region: 'San-Pédro', alt:['San Pedro','San-Pedro'] },
  { name: 'Korhogo',        lat: 9.45804,    lng: -5.62961,    region: 'Poro' },
  { name: 'Man',            lat: 7.41251,    lng: -7.55383,    region: 'Tonkpi' },
  { name: 'Abengourou',     lat: 6.7292,     lng: -3.4963,     region: 'Indénié-Djuablin', alt:['Abenguru'] },
  { name: 'Divo',           lat: 5.839,      lng: -5.357,      region: 'Lôh-Djiboua' },
  { name: 'Gagnoa',         lat: 6.13193,    lng: -5.94736,    region: 'Gôh' },
  { name: 'Anyama',         lat: 5.49462,    lng: -4.05183,    region: 'Autonome Abidjan' },
  { name: 'Agboville',      lat: 5.92801,    lng: -4.21319,    region: 'Agneby-Tiassa' },
  { name: 'Soubré',         lat: 5.78297,    lng: -6.60828,    region: 'Nawa', alt:['Soubre'] },
  { name: 'Bouaflé',        lat: 6.99041,    lng: -5.7442,     region: 'Marahoué', alt:['Bouafle'] },
  { name: 'Séguéla',        lat: 7.96111,    lng: -6.67306,    region: 'Worodougou', alt:['Seguela'] },
  { name: 'Bondoukou',      lat: 8.03333,    lng: -2.8,        region: 'Gontougo' },
  { name: 'Aboisso',        lat: 5.467,      lng: -3.208,      region: 'Sud-Comoé' },
  { name: 'Odienné',        lat: 9.5,        lng: -7.5667,     region: 'Kabadougou', alt:['Odienne'] },
  { name: 'Ferkessédougou', lat: 9.6000,     lng: -5.2000,     region: 'Tchologo', alt:['Ferkessedougou','Ferké'] },
  { name: 'Issia',          lat: 6.49211,    lng: -6.5856,     region: 'Haut-Sassandra' },
  { name: 'Tiassalé',       lat: 5.898,      lng: -4.822,      region: 'Agneby-Tiassa', alt:['Tiassale'] },
  { name: 'Toumodi',        lat: 6.553,      lng: -5.017,      region: 'Bélier' },
  { name: 'Sakassou',       lat: 7.455,      lng: -5.288,      region: 'Gbêkê', alt:['Sakasou'] },
  { name: 'Méagui',         lat: 5.333,      lng: -6.583,      region: 'Nawa', alt:['Meagui'] },
  { name: 'Guiglo',         lat: 6.55,       lng: -7.5,        region: 'Cavally' },
  { name: 'Lakota',         lat: 5.85,       lng: -5.683,      region: 'Lôh-Djiboua' },
  { name: 'Bongouanou',     lat: 6.649,      lng: -4.204,      region: 'Moronou' },
  { name: 'Mankono',        lat: 8.058,      lng: -6.188,      region: 'Béré' },
  { name: 'Katiola',        lat: 8.137,      lng: -5.102,      region: 'Hambol' },
  { name: 'Sinfra',         lat: 6.617,      lng: -5.917,      region: 'Gôh' },
  { name: 'Tabou',          lat: 4.423,      lng: -7.353,      region: 'San-Pédro' },
  { name: 'Adiaké',         lat: 5.286,      lng: -3.304,      region: 'Sud-Comoé', alt:['Adiake'] },
  { name: 'Grand-Bassam',   lat: 5.2118,     lng: -3.73884,    region: 'Sud-Comoé', alt:['Bassam','Grand Bassam'] },
  { name: 'Jacqueville',    lat: 5.213,      lng: -4.413,      region: 'Grands-Ponts' },
];

const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

const normalizedCityIndex = new Map<string, CiCityGeo>();
for (const city of CI_CITIES_GEO) {
  normalizedCityIndex.set(norm(city.name), city);
  if (city.alt) {
    for (const alt of city.alt) {
      normalizedCityIndex.set(norm(alt), city);
    }
  }
}

export function findCityGeo(name: string): { lat: number; lng: number; name: string } | null {
  const entry = normalizedCityIndex.get(norm(name));
  return entry ? { lat: entry.lat, lng: entry.lng, name: entry.name } : null;
}
