import { apiFetch, ENDPOINTS } from './http';

export async function loginAccount(email, password) {
  return apiFetch(`${ENDPOINTS.identity}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function registerIndividual(payload) {
  return apiFetch(`${ENDPOINTS.identity}/auth/register/individual`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateIndividualProfile(token, payload) {
  return apiFetch(`${ENDPOINTS.identity}/profiles/me/individual`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function updateCompanyProfile(token, payload) {
  return apiFetch(`${ENDPOINTS.identity}/profiles/me/company`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function requestGmailOtp(payload) {
  return apiFetch(`${ENDPOINTS.identity}/auth/gmail/request`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyGmailOtp(payload) {
  return apiFetch(`${ENDPOINTS.identity}/auth/gmail/verify`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
