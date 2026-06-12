// src/socket/index.js
// Socket.io initialization and event handlers

import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { socketAuth } from '../middleware/socketAuth.js';
import { registerSocket, unregisterSocket } from './activeSockets.js';
import User from '../models/userModel.js';
import Circle from '../models/circleModel.js';
import Message from '../models/messageModel.js';
import { logEngagementEvent } from '../services/engagementLogService.js';

const roomNameForCircle = (circleId) => `circle_${circleId}`;

const toObjectId = (value) => {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
};

export const initSocket = (httpServer) => {
  const origin = process.env.SOCKET_CORS_ORIGIN
    ? process.env.SOCKET_CORS_ORIGIN.split(',').map((s) => s.trim())
    : true;

  const io = new Server(httpServer, {
    cors: {
      origin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(socketAuth);

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    registerSocket(userId, socket.id);

    // Fire-and-forget session_start logging
    logEngagementEvent({ userId, eventType: 'session_start' }).catch(() => {});

    // Cache sender display_name on socket (best-effort)
    try {
      const user = await User.findById(userId).select('display_name');
      socket.data.senderName = user?.display_name || null;
    } catch {
      socket.data.senderName = null;
    }

    socket.on('join_circle', async (payload, ack) => {
      try {
        const circleId = payload?.circleId;
        const circleObjectId = toObjectId(circleId);
        if (!circleObjectId) {
          if (typeof ack === 'function') ack({ success: false, message: 'Invalid circleId' });
          return;
        }

        // Verify circle membership before joining room
        const circle = await Circle.findOne({
          _id: circleObjectId,
          members: toObjectId(userId)
        });
        if (!circle) {
          if (typeof ack === 'function') ack({ success: false, message: 'Not a member of this circle' });
          return;
        }

        const room = roomNameForCircle(String(circleId));
        await socket.join(room);

        if (typeof ack === 'function') ack({ success: true, room });
      } catch {
        if (typeof ack === 'function') ack({ success: false, message: 'Failed to join circle' });
      }
    });

    socket.on('leave_circle', async (payload, ack) => {
      try {
        const circleId = payload?.circleId;
        const circleObjectId = toObjectId(circleId);
        if (!circleObjectId) {
          if (typeof ack === 'function') ack({ success: false, message: 'Invalid circleId' });
          return;
        }

        const room = roomNameForCircle(String(circleId));
        await socket.leave(room);

        if (typeof ack === 'function') ack({ success: true, room });
      } catch {
        if (typeof ack === 'function') ack({ success: false, message: 'Failed to leave circle' });
      }
    });

    socket.on('typing_start', (payload) => {
      const circleId = payload?.circleId;
      if (!circleId) return;

      const room = roomNameForCircle(String(circleId));
      socket.to(room).emit('typing_start', {
        circleId: String(circleId),
        senderId: String(userId),
      });
    });

    socket.on('typing_stop', (payload) => {
      const circleId = payload?.circleId;
      if (!circleId) return;

      const room = roomNameForCircle(String(circleId));
      socket.to(room).emit('typing_stop', {
        circleId: String(circleId),
        senderId: String(userId),
      });
    });

    socket.on('send_message', async (payload, ack) => {
      try {
        const circleId = payload?.circleId;
        const circleObjectId = toObjectId(circleId);
        if (!circleObjectId) {
          if (typeof ack === 'function') ack({ success: false, message: 'Invalid circleId' });
          return;
        }

        const text = payload?.message;
        if (typeof text !== 'string' || text.trim().length === 0) {
          if (typeof ack === 'function') ack({ success: false, message: 'Message is required' });
          return;
        }

        const room = roomNameForCircle(String(circleId));

        const doc = await Message.create({
          circle_id: circleObjectId,
          sender_id: toObjectId(userId),
          message: text.trim(),
        });

        const eventPayload = {
          message: doc.message,
          senderId: String(userId),
          senderName: socket.data.senderName,
          timestamp: doc.createdAt,
        };

        io.to(room).emit('send_message', eventPayload);
        if (typeof ack === 'function') ack({ success: true, data: eventPayload });

        // Fire-and-forget logging (no content logged to engagement system)
        logEngagementEvent({ userId, eventType: 'message_sent', circleId: String(circleObjectId) }).catch(() => {});
      } catch {
        if (typeof ack === 'function') ack({ success: false, message: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      unregisterSocket(socket.id);

      // Fire-and-forget logging
      logEngagementEvent({ userId, eventType: 'session_end' }).catch(() => {});
    });
  });

  return io;
};
