import http from 'node:http';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../../../../backend/src/app.js';
import { wireDomainEvents } from '../../../../backend/src/events/wire.js';
import {
  initSocketServer,
  resetSocketServerForTests,
} from '../../../../backend/src/realtime/socket.server.js';

let httpServer = null;

export async function startRealtimeServer() {
  wireDomainEvents();
  resetSocketServerForTests();

  const app = createApp();
  httpServer = http.createServer(app);
  initSocketServer(httpServer);

  await new Promise((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve);
  });

  const { port } = httpServer.address();
  return {
    port,
    baseUrl: `http://127.0.0.1:${port}`,
  };
}

export async function stopRealtimeServer() {
  if (!httpServer) return;

  const server = httpServer;
  httpServer = null;

  await new Promise((resolve) => {
    server.close(() => resolve());
  });
  resetSocketServerForTests();
}

export function connectSocket(baseUrl, token) {
  return ioClient(baseUrl, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token },
    forceNew: true,
    reconnection: false,
  });
}

export function waitForEvent(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timeout aguardando evento ${event}`));
    }, timeoutMs);

    function onEvent(payload) {
      clearTimeout(timer);
      resolve(payload);
    }

    socket.once(event, onEvent);
  });
}

export function expectNoEvent(socket, event, waitMs = 800) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      resolve();
    }, waitMs);

    function onEvent(payload) {
      clearTimeout(timer);
      reject(
        new Error(
          `Evento inesperado ${event}: ${JSON.stringify(payload).slice(0, 200)}`
        )
      );
    }

    socket.once(event, onEvent);
  });
}
