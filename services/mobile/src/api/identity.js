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

export async function requestPasswordReset(payload) {
  return apiFetch(`${ENDPOINTS.identity}/auth/password/forgot`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resetPassword(payload) {
  return apiFetch(`${ENDPOINTS.identity}/auth/password/reset`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadProfilePhoto(token, file) {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(`${ENDPOINTS.identity}/profiles/me/photo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || 'photo_upload_failed');
  }
  return response.json();
}

export async function deleteProfilePhoto(token) {
  const response = await fetch(`${ENDPOINTS.identity}/profiles/me/photo`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || 'photo_delete_failed');
  }
  return response.json();
}

export async function requestPhoneOtp(token, payload) {
  return apiFetch(`${ENDPOINTS.identity}/profiles/me/phone/request`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function verifyPhoneOtp(token, payload) {
  return apiFetch(`${ENDPOINTS.identity}/profiles/me/phone/verify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function createReport(token, payload) {
  return apiFetch(`${ENDPOINTS.identity}/reports`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function saveSearch(token, payload) {
  return apiFetch(`${ENDPOINTS.identity}/saved-searches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function getPublicProfile(token, accountId) {
  return apiFetch(`${ENDPOINTS.identity}/profiles/${accountId}/public`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
