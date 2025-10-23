// src/lib/ci-cities.ts
export type City = { name: string; region?: string; alt?: string[] };

export const CI_CITIES: City[] = [
  { name: 'Abidjan', region: 'Autonome' },
  { name: 'Yamoussoukro', region: 'Autonome' },
  { name: 'Bouaké', region: 'Gbêkê', alt: ['Bouake'] },
  { name: 'Daloa', region: 'Haut-Sassandra' },
  { name: 'San-Pédro', region: 'San-Pédro', alt: ['San Pedro', 'San-Pedro'] },
  { name: 'Korhogo', region: 'Poro' },
  { name: 'Man', region: 'Tonkpi' },
  { name: 'Abengourou', region: 'Indénié-Djuablin', alt: ['Abenguru'] },
  { name: 'Divo', region: 'Lôh-Djiboua' },
  { name: 'Gagnoa', region: 'Gôh' },
  { name: 'Anyama', region: 'Autonome Abidjan' },
  { name: 'Agboville', region: 'Agneby-Tiassa' },
  { name: 'Soubré', region: 'Nawa', alt: ['Soubre'] },
  { name: 'Bouaflé', region: 'Marahoué', alt: ['Bouafle'] },
  { name: 'Séguéla', region: 'Worodougou', alt: ['Seguela'] },
  { name: 'Bondoukou', region: 'Gontougo' },
  { name: 'Aboisso', region: 'Sud-Comoé' },
  { name: 'Odienné', region: 'Kabadougou', alt: ['Odienne'] },
  { name: 'Ferkessédougou', region: 'Tchologo', alt: ['Ferkessedougou', 'Ferké'] },
  { name: 'Issia', region: 'Haut-Sassandra' },
  { name: 'Tiassalé', region: 'Agneby-Tiassa', alt: ['Tiassale'] },
  { name: 'Toumodi', region: 'Bélier' },
  { name: 'Sakassou', region: 'Gbêkê', alt: ['Sakasou'] },
  { name: 'Méagui', region: 'Nawa', alt: ['Meagui'] },
  { name: 'Guiglo', region: 'Cavally' },
  { name: 'Lakota', region: 'Lôh-Djiboua' },
  { name: 'Bongouanou', region: 'Moronou' },
  { name: 'Mankono', region: 'Béré' },
  { name: 'Katiola', region: 'Hambol' },
  { name: 'Sinfra', region: 'Gôh' },
  { name: 'Tabou', region: 'San-Pédro' },
  { name: 'Adiaké', region: 'Sud-Comoé', alt: ['Adiake'] },
  { name: 'Grand-Bassam', region: 'Sud-Comoé', alt: ['Bassam'] },
  { name: 'Jacqueville', region: 'Grands-Ponts' },
];

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

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

export const POPULAR_CITIES: City[] = [
  { name: 'Abidjan' },
  { name: 'Yamoussoukro' },
  { name: 'Bouaké' },
  { name: 'San-Pédro' },
  { name: 'Daloa' },
  { name: 'Korhogo' },
  { name: 'Man' },
  { name: 'Grand-Bassam' },
];
