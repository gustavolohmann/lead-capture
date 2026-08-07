import { Server } from 'socket.io';
import { socketAuth } from './socket.auth.js';
import { registerSocketHandlers } from './socket.handlers.js';
import { logger } from '../utils/logger.js';

let io = null;

/**
 * Anexa Socket.IO ao HTTP server existente (não cria segundo servidor HTTP).
 */
export function initSocketServer(httpServer) {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    path: '/socket.io',
  });

  io.use(socketAuth);

  io.on('connection', (socket) => {
    registerSocketHandlers(socket);
  });

  logger.info('Socket.IO inicializado');
  return io;
}

export function getIO() {
  return io;
}

/** Apenas para testes: limpa singleton entre suites. */
export function resetSocketServerForTests() {
  if (io) {
    io.removeAllListeners();
    io = null;
  }
}
