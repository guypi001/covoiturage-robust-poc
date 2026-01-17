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

export async function createBooking(token, { rideId, seats }) {
  return apiFetch(`${ENDPOINTS.bff}/bookings`, {
    method: 'POST',
    headers: withAuth(token),
    body: JSON.stringify({ rideId, seats }),
  });
}
