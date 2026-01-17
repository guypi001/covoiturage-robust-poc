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
