import { apiFetch, ENDPOINTS } from './http';

export async function getConversations(userId) {
  const url = `${ENDPOINTS.messaging}/conversations?userId=${encodeURIComponent(userId)}`;
  return apiFetch(url);
}

export async function getMessages(conversationId, userId) {
  const url = `${ENDPOINTS.messaging}/conversations/${conversationId}/messages?userId=${encodeURIComponent(userId)}`;
  return apiFetch(url);
}
