import { apiFetch, ENDPOINTS } from './http';

export async function getConversations(userId) {
  const url = `${ENDPOINTS.messaging}/conversations?userId=${encodeURIComponent(userId)}`;
  return apiFetch(url);
}

export async function getMessages(conversationId, userId) {
  const url = `${ENDPOINTS.messaging}/conversations/${conversationId}/messages?userId=${encodeURIComponent(userId)}`;
  return apiFetch(url);
}

export async function sendMessage(payload) {
  return apiFetch(`${ENDPOINTS.messaging}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function markConversationRead(conversationId, userId) {
  return apiFetch(`${ENDPOINTS.messaging}/conversations/${conversationId}/read`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function markMessagesRead(userId, messageIds) {
  return apiFetch(`${ENDPOINTS.messaging}/messages/read`, {
    method: 'POST',
    body: JSON.stringify({ userId, messageIds }),
  });
}

export async function getNotifications(userId) {
  const url = `${ENDPOINTS.messaging}/notifications?userId=${encodeURIComponent(userId)}`;
  return apiFetch(url);
}

export async function uploadMessageAttachment(file) {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(`${ENDPOINTS.messaging}/attachments`, {
    method: 'POST',
    body,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || 'upload_failed');
  }
  return response.json();
}

export function getMessagingWsUrl() {
  const base = ENDPOINTS.messaging.replace(/^http/, 'ws');
  return `${base}/ws`;
}
