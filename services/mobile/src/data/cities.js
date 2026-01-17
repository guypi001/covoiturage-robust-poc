export const CITIES = [
  { name: 'Abidjan', region: 'Autonome' },
  { name: 'Yamoussoukro', region: 'Autonome' },
  { name: 'Bouaké', region: 'Gbêkê' },
  { name: 'Daloa', region: 'Haut-Sassandra' },
  { name: 'San-Pédro', region: 'San-Pédro' },
  { name: 'Korhogo', region: 'Poro' },
  { name: 'Man', region: 'Tonkpi' },
  { name: 'Grand-Bassam', region: 'Sud-Comoé' },
  { name: 'Abengourou', region: 'Indénié-Djuablin' },
  { name: 'Gagnoa', region: 'Gôh' },
  { name: 'Divo', region: 'Lôh-Djiboua' },
  { name: 'Agboville', region: 'Agneby-Tiassa' },
  { name: 'Bondoukou', region: 'Gontougo' },
  { name: 'Odienné', region: 'Kabadougou' },
  { name: 'Toumodi', region: 'Bélier' },
  { name: 'Sinfra', region: 'Gôh' },
  { name: 'Séguéla', region: 'Worodougou' },
  { name: 'Bouaflé', region: 'Marahoué' },
  { name: 'Aboisso', region: 'Sud-Comoé' },
  { name: 'Sassandra', region: 'Gbôklé' },
  { name: 'Ferkessédougou', region: 'Tchologo' },
];

const POPULAR = ['Abidjan', 'Yamoussoukro', 'Bouaké', 'San-Pédro', 'Daloa', 'Korhogo'];

const strip = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function searchCities(query, limit = 8) {
  const q = strip(query || '');
  if (!q) {
    return CITIES.filter((c) => POPULAR.includes(c.name)).slice(0, limit);
  }
  return CITIES.map((city) => ({ city, score: strip(city.name).includes(q) ? 2 : strip(city.region || '').includes(q) ? 1 : 0 }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name))
    .slice(0, limit)
    .map((entry) => entry.city);
}
