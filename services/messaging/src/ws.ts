import { WebSocketServer, WebSocket } from 'ws';

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

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'subscribe' && typeof msg?.userId === 'string') {
          const wasOnline = clientsByUser.has(msg.userId);
          meta.userId = msg.userId;
          bindUser(msg.userId, socket);
          safeSend(socket, { type: 'subscribed', data: { userId: msg.userId } });
          if (!wasOnline) {
            broadcastAll({ type: 'presence.update', data: { userId: msg.userId, online: true } });
          }
        }
        if (msg?.type === 'ping') {
          safeSend(socket, { type: 'pong' });
        }
        if (
          msg?.type === 'typing' &&
          typeof msg?.userId === 'string' &&
          typeof msg?.recipientId === 'string' &&
          typeof msg?.conversationId === 'string'
        ) {
          wsSendToUsers([msg.userId, msg.recipientId], {
            type: 'typing.update',
            data: {
              userId: msg.userId,
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
