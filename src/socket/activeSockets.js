// src/socket/activeSockets.js
// In-memory active socket registry

const userToSockets = new Map(); // userId -> Set(socketId)
const socketToUser = new Map(); // socketId -> userId

export const registerSocket = (userId, socketId) => {
  const key = String(userId);
  const id = String(socketId);

  let set = userToSockets.get(key);
  if (!set) {
    set = new Set();
    userToSockets.set(key, set);
  }

  set.add(id);
  socketToUser.set(id, key);
};

export const unregisterSocket = (socketId) => {
  const id = String(socketId);
  const userId = socketToUser.get(id);
  if (!userId) return;

  socketToUser.delete(id);
  const set = userToSockets.get(userId);
  if (!set) return;

  set.delete(id);
  if (set.size === 0) {
    userToSockets.delete(userId);
  }
};

export const getActiveSocketsByUser = (userId) => {
  return userToSockets.get(String(userId)) || new Set();
};
