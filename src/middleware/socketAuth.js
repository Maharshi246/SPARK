// src/middleware/socketAuth.js
// Socket.io middleware: verifies JWT and attaches userId to socket.data

import jwt from 'jsonwebtoken';

const extractToken = (socket) => {
  const header = socket?.handshake?.headers?.authorization;
  if (header && typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.split(' ')[1];
  }

  const authToken = socket?.handshake?.auth?.token;
  if (authToken && typeof authToken === 'string') return authToken;

  return null;
};

export const socketAuth = (socket, next) => {
  try {
    const token = extractToken(socket);
    if (!token) return next(new Error('Unauthorized'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?.userId || decoded?.id;
    if (!userId) return next(new Error('Unauthorized'));

    socket.data.userId = String(userId);
    return next();
  } catch {
    return next(new Error('Unauthorized'));
  }
};
