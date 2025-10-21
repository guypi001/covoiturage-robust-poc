export function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function rankCity(query: string, city: string) {
  const q = normalize(query);
  const c = normalize(city);
  if (!q) return 999;
  if (c.startsWith(q)) return 0;       // meilleur score : préfixe
  const idx = c.indexOf(q);
  return idx === -1 ? 999 : idx + 1;   // sinon : position dans la chaîne
}
