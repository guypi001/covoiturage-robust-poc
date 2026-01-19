export const BOOKING_STATUS_LABELS = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
  CANCELED: 'Annulée',
};

export const RIDE_STATUS_LABELS = {
  PUBLISHED: 'En ligne',
  CLOSED: 'Clôturé',
  CANCELLED: 'Annulé',
  CANCELED: 'Annulé',
  DRAFT: 'Brouillon',
  ARCHIVED: 'Archivé',
};

export const formatBookingStatus = (status) =>
  BOOKING_STATUS_LABELS[status] || status || 'Inconnu';

export const formatRideStatus = (status) =>
  RIDE_STATUS_LABELS[status] || status || 'Inconnu';
