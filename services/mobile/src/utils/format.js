export function formatXof(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '0 F CFA';
  return value.toLocaleString('fr-FR') + ' F CFA';
}

export function formatDepartureBadge(isoDate) {
  if (!isoDate) return 'Date flexible';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Date flexible';

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((targetStart - todayStart) / 86400000);

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Demain';
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
}
