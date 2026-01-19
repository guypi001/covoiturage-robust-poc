import { CONFIG } from '../config';

export async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedHandler?.();
    }
    const payload = await response.json().catch(() => ({}));
    const message = payload?.message || payload?.error || 'request_failed';
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}

let unauthorizedHandler;

export function registerUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function withAuth(token) {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export const ENDPOINTS = {
  identity: CONFIG.identityUrl,
  bff: CONFIG.bffUrl,
  messaging: CONFIG.messagingUrl,
  booking: CONFIG.bookingUrl,
  payment: CONFIG.paymentUrl,
  wallet: CONFIG.walletUrl,
  notification: CONFIG.notificationUrl,
};
