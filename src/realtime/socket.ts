import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { verifyAuthToken } from '../utils/jwt.js';

export const createSocketServer = (httpServer: HttpServer) => {
  const io = new SocketServer(httpServer, {
    cors: { origin: '*' },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }

    try {
      const user = verifyAuthToken(token);
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as { userId: string };
    socket.join(user.userId);
  });

  return io;
};
