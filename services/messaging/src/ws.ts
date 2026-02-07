import { WebSocketServer, WebSocket } from 'ws';
import { createHmac, timingSafeEqual } from 'crypto';

type ClientMeta = {
  userId?: string;
  socket: WebSocket;
};

type WsPayload = {
  type: string;
  data?: any;
};

let wss: WebSocketServer | null = null;
const clientsByUser = new Map<string, Set<WebSocket>>();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64');
}

function verifyWsToken(token: string): { sub: string } | null {
  try {
    const [rawHeader, rawPayload, rawSignature] = token.split('.');
    if (!rawHeader || !rawPayload || !rawSignature) return null;

    const header = JSON.parse(base64UrlDecode(rawHeader).toString('utf8'));
    if (header?.alg !== 'HS256') return null;

    const payload = JSON.parse(base64UrlDecode(rawPayload).toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload?.exp === 'number' && payload.exp < now) return null;
    if (typeof payload?.sub !== 'string' || !payload.sub.trim()) return null;

    const signingInput = `${rawHeader}.${rawPayload}`;
    const expected = createHmac('sha256', JWT_SECRET).update(signingInput).digest();
    const provided = base64UrlDecode(rawSignature);
    if (expected.length !== provided.length) return null;
    if (!timingSafeEqual(expected, provided)) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

const bindUser = (userId: string, socket: WebSocket) => {
  if (!clientsByUser.has(userId)) {
    clientsByUser.set(userId, new Set());
  }
  clientsByUser.get(userId)?.add(socket);
};

const unbindUser = (userId: string, socket: WebSocket) => {
  const set = clientsByUser.get(userId);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) clientsByUser.delete(userId);
};

const safeSend = (socket: WebSocket, payload: WsPayload) => {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
};

const broadcastAll = (payload: WsPayload) => {
  clientsByUser.forEach((sockets) => {
    sockets.forEach((socket) => safeSend(socket, payload));
  });
};

export function attachWebSocketServer(server: any) {
  if (wss) return wss;
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket: WebSocket) => {
    const meta: ClientMeta = { socket };

    socket.on('message', (raw: any) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'subscribe' && typeof msg?.token === 'string') {
          const verified = verifyWsToken(msg.token);
          if (!verified?.sub) {
            safeSend(socket, { type: 'error', data: { code: 'invalid_token' } });
            socket.close(1008, 'invalid_token');
            return;
          }
          const userId = verified.sub;
          const wasOnline = clientsByUser.has(userId);
          meta.userId = userId;
          bindUser(userId, socket);
          safeSend(socket, { type: 'subscribed', data: { userId } });
          if (!wasOnline) {
            broadcastAll({ type: 'presence.update', data: { userId, online: true } });
          }
        }
        if (msg?.type === 'ping') {
          safeSend(socket, { type: 'pong' });
        }
        if (
          msg?.type === 'typing' &&
          typeof meta.userId === 'string' &&
          typeof msg?.recipientId === 'string' &&
          typeof msg?.conversationId === 'string'
        ) {
          wsSendToUsers([meta.userId, msg.recipientId], {
            type: 'typing.update',
            data: {
              userId: meta.userId,
              active: Boolean(msg.active),
              conversationId: msg.conversationId,
            },
          });
        }
      } catch {
        // ignore malformed payloads
      }
    });

    socket.on('close', () => {
      if (meta.userId) {
        const stillOnline = clientsByUser.get(meta.userId)?.size ?? 0;
        unbindUser(meta.userId, socket);
        const nowOnline = clientsByUser.get(meta.userId)?.size ?? 0;
        if (stillOnline > 0 && nowOnline === 0) {
          broadcastAll({ type: 'presence.update', data: { userId: meta.userId, online: false } });
        }
      }
    });
  });

  return wss;
}

export function wsSendToUsers(userIds: string[], payload: WsPayload) {
  userIds.forEach((userId) => {
    const sockets = clientsByUser.get(userId);
    if (!sockets) return;
    sockets.forEach((socket) => safeSend(socket, payload));
  });
}
