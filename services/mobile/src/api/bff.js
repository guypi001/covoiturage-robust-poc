import { apiFetch, ENDPOINTS, withAuth } from './http';

export async function getMyProfile(token) {
  return apiFetch(`${ENDPOINTS.bff}/me/profile`, {
    headers: withAuth(token),
  });
}

export async function getMyBookings(token) {
  return apiFetch(`${ENDPOINTS.bff}/me/bookings`, {
    headers: withAuth(token),
  });
}

export async function cancelBooking(token, bookingId) {
  return apiFetch(`${ENDPOINTS.bff}/me/bookings/${bookingId}/cancel`, {
    method: 'POST',
    headers: withAuth(token),
  });
}

export async function getMyRides(token) {
  return apiFetch(`${ENDPOINTS.bff}/me/rides`, {
    headers: withAuth(token),
  });
}

export async function getMyPaymentMethods(token) {
  return apiFetch(`${ENDPOINTS.bff}/me/payment-methods`, {
    headers: withAuth(token),
  });
}

export async function getMyWallet(token) {
  return apiFetch(`${ENDPOINTS.bff}/me/wallet`, {
    headers: withAuth(token),
  });
}

export async function getMyWalletTransactions(token, limit = 50) {
  const params = new URLSearchParams({ limit: String(limit) });
  return apiFetch(`${ENDPOINTS.bff}/me/wallet/transactions?${params.toString()}`, {
    headers: withAuth(token),
  });
}

export async function createBooking(token, { rideId, seats, passengerName, passengerEmail, passengerPhone }) {
  return apiFetch(`${ENDPOINTS.bff}/bookings`, {
    method: 'POST',
    headers: withAuth(token),
    body: JSON.stringify({
      rideId,
      seats,
      passengerName,
      passengerEmail,
      passengerPhone,
    }),
  });
}
