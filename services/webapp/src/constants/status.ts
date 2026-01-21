type StatusInfo = { label: string; tone: string };

export const BOOKING_STATUS_INFO: Record<string, StatusInfo> = {
  PENDING: { label: 'En attente', tone: 'text-amber-700 bg-amber-100' },
  CONFIRMED: { label: 'Confirmée', tone: 'text-sky-700 bg-sky-100' },
  PAID: { label: 'Payée', tone: 'text-emerald-700 bg-emerald-100' },
  CANCELLED: { label: 'Annulée', tone: 'text-rose-700 bg-rose-100' },
  CANCELED: { label: 'Annulée', tone: 'text-rose-700 bg-rose-100' },
};

export const PAYMENT_STATUS_INFO: Record<string, StatusInfo> = {
  PENDING: { label: 'Paiement en attente', tone: 'text-amber-700 bg-amber-100' },
  CONFIRMED: { label: 'Paiement confirmé', tone: 'text-emerald-700 bg-emerald-100' },
  FAILED: { label: 'Paiement échoué', tone: 'text-rose-700 bg-rose-100' },
  REFUNDED: { label: 'Remboursé', tone: 'text-slate-700 bg-slate-100' },
};

export const RIDE_STATUS_INFO: Record<string, StatusInfo> = {
  PUBLISHED: { label: 'En ligne', tone: 'text-emerald-700 bg-emerald-100' },
  CLOSED: { label: 'Clôturé', tone: 'text-slate-700 bg-slate-200' },
  CANCELLED: { label: 'Annulé', tone: 'text-rose-700 bg-rose-100' },
  CANCELED: { label: 'Annulé', tone: 'text-rose-700 bg-rose-100' },
  DRAFT: { label: 'Brouillon', tone: 'text-amber-700 bg-amber-100' },
  ARCHIVED: { label: 'Archivé', tone: 'text-slate-700 bg-slate-100' },
};

export function getBookingStatusInfo(status?: string | null) {
  return BOOKING_STATUS_INFO[status ?? ''] ?? { label: status ?? 'Inconnu', tone: 'text-slate-600 bg-slate-100' };
}

export function getRideStatusInfo(status?: string | null) {
  return RIDE_STATUS_INFO[status ?? ''] ?? { label: status ?? 'Inconnu', tone: 'text-slate-600 bg-slate-100' };
}

export function getPaymentStatusInfo(status?: string | null) {
  return PAYMENT_STATUS_INFO[status ?? ''] ?? { label: status ?? 'Paiement', tone: 'text-slate-600 bg-slate-100' };
}
