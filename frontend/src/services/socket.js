import { io } from 'socket.io-client';

function resolveSocketUrl() {
  const apiUrl =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

  if (apiUrl.startsWith('/')) {
    return window.location.origin;
  }

  try {
    const url = new URL(apiUrl);
    return url.origin;
  } catch {
    return 'http://localhost:3001';
  }
}

/**
 * Cria uma conexão Socket.IO autenticada por JWT.
 * Uma conexão por sessão — usar via SocketContext.
 */
export function createSocket(token) {
  if (!token) return null;

  return io(resolveSocketUrl(), {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    auth: { token },
  });
}

export const SocketClientEvents = Object.freeze({
  MESSAGE_CREATED: 'message.created',
  MESSAGE_UPDATED: 'message.updated',
  CONVERSATION_UPDATED: 'conversation.updated',
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_READ: 'notification.read',
  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
});
