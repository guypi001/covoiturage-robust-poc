import { CONFIG } from '../config';

export async function registerPushToken({ ownerId, token, platform, deviceId }) {
  const response = await fetch(`${CONFIG.notificationUrl}/push/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerId, token, platform, deviceId }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || 'push_register_failed');
  }
  return response.json();
}

export async function sendTestNotification({ ownerId, title, body }) {
  const response = await fetch(`${CONFIG.notificationUrl}/push/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerId, title, body }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || 'push_test_failed');
  }
  return response.json();
}
