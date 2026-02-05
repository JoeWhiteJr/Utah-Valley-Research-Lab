const { Server } = require('socket.io');
const socketAuth = require('../middleware/socketAuth');
const db = require('../config/database');

let io = null;

// Track online users: Map<userId, Set<socketId>>
const onlineUsers = new Map();

// Track typing status: Map<roomId, Map<userId, { userName, timeout }>>
const typingUsers = new Map();

/**
 * Initialize Socket.io with HTTP server
 */
const initialize = (httpServer, corsOrigin) => {
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Apply authentication middleware
  io.use(socketAuth);

  // Handle connections
  io.on('connection', handleConnection);

  console.log('Socket.io initialized');
  return io;
};

/**
 * Handle new socket connection
 */
const handleConnection = async (socket) => {
  const userId = socket.userId;
  const userName = socket.user.name;

  console.log(`User connected: ${userName} (${userId})`);

  // Track online status
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
    // Broadcast that user came online
    socket.broadcast.emit('user_online', { userId, userName });
  }
  onlineUsers.get(userId).add(socket.id);

  // Join user's personal room for direct notifications
  socket.join(`user:${userId}`);

  // Auto-join all chat rooms user is a member of
  try {
    const rooms = await db.query(
      'SELECT room_id FROM chat_members WHERE user_id = $1',
      [userId]
    );
    for (const row of rooms.rows) {
      socket.join(`room:${row.room_id}`);
    }
  } catch (error) {
    console.error('Error joining rooms:', error);
  }

  // Send current online users to the newly connected user
  socket.emit('online_users', Array.from(onlineUsers.keys()));

  // Event handlers
  socket.on('join_room', (data) => handleJoinRoom(socket, data));
  socket.on('leave_room', (data) => handleLeaveRoom(socket, data));
  socket.on('send_message', (data) => handleSendMessage(socket, data));
  socket.on('typing_start', (data) => handleTypingStart(socket, data));
  socket.on('typing_stop', (data) => handleTypingStop(socket, data));
  socket.on('disconnect', () => handleDisconnect(socket));
};

/**
 * Handle joining a chat room
 */
const handleJoinRoom = async (socket, { roomId }) => {
  try {
    // Verify user is a member
    const membership = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [roomId, socket.userId]
    );

    if (membership.rows.length === 0) {
      socket.emit('error', { message: 'Not a member of this room' });
      return;
    }

    socket.join(`room:${roomId}`);
    socket.emit('joined_room', { roomId });
  } catch (error) {
    console.error('Error joining room:', error);
    socket.emit('error', { message: 'Failed to join room' });
  }
};

/**
 * Handle leaving a chat room
 */
const handleLeaveRoom = (socket, { roomId }) => {
  socket.leave(`room:${roomId}`);
  socket.emit('left_room', { roomId });
};

/**
 * Handle sending a message via socket (real-time broadcast)
 */
const handleSendMessage = async (socket, { roomId, content, type = 'text' }) => {
  try {
    // Verify membership
    const membership = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [roomId, socket.userId]
    );

    if (membership.rows.length === 0) {
      socket.emit('error', { message: 'Not a member of this room' });
      return;
    }

    // Save message to database
    const result = await db.query(
      `INSERT INTO messages (room_id, sender_id, content, type)
       VALUES ($1, $2, $3, $4)
       RETURNING *, (SELECT name FROM users WHERE id = $2) as sender_name`,
      [roomId, socket.userId, content, type]
    );

    const message = result.rows[0];

    // Update room's updated_at
    await db.query(
      'UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [roomId]
    );

    // Broadcast to room
    io.to(`room:${roomId}`).emit('new_message', message);

    // Clear typing indicator for this user
    clearTyping(roomId, socket.userId);

  } catch (error) {
    console.error('Error sending message:', error);
    socket.emit('error', { message: 'Failed to send message' });
  }
};

/**
 * Handle typing start
 */
const handleTypingStart = (socket, { roomId }) => {
  if (!typingUsers.has(roomId)) {
    typingUsers.set(roomId, new Map());
  }

  const roomTyping = typingUsers.get(roomId);

  // Clear existing timeout if any
  if (roomTyping.has(socket.userId)) {
    clearTimeout(roomTyping.get(socket.userId).timeout);
  }

  // Set typing with auto-clear after 5 seconds
  const timeout = setTimeout(() => {
    clearTyping(roomId, socket.userId);
  }, 5000);

  roomTyping.set(socket.userId, {
    userName: socket.user.name,
    timeout
  });

  // Broadcast to room (except sender)
  socket.to(`room:${roomId}`).emit('user_typing', {
    roomId,
    userId: socket.userId,
    userName: socket.user.name
  });
};

/**
 * Handle typing stop
 */
const handleTypingStop = (socket, { roomId }) => {
  clearTyping(roomId, socket.userId);
};

/**
 * Clear typing indicator for a user in a room
 */
const clearTyping = (roomId, userId) => {
  if (typingUsers.has(roomId)) {
    const roomTyping = typingUsers.get(roomId);
    if (roomTyping.has(userId)) {
      clearTimeout(roomTyping.get(userId).timeout);
      roomTyping.delete(userId);

      // Broadcast typing stopped
      if (io) {
        io.to(`room:${roomId}`).emit('user_stopped_typing', { roomId, userId });
      }
    }
  }
};

/**
 * Handle socket disconnect
 */
const handleDisconnect = (socket) => {
  const userId = socket.userId;
  const userName = socket.user?.name;

  console.log(`User disconnected: ${userName} (${userId})`);

  // Remove socket from online tracking
  if (onlineUsers.has(userId)) {
    onlineUsers.get(userId).delete(socket.id);

    // If no more sockets for this user, they're offline
    if (onlineUsers.get(userId).size === 0) {
      onlineUsers.delete(userId);
      socket.broadcast.emit('user_offline', { userId, userName });
    }
  }

  // Clear any typing indicators for this user
  for (const [roomId] of typingUsers) {
    clearTyping(roomId, userId);
  }
};

// ============================================
// Public API for use by routes
// ============================================

/**
 * Emit event to a specific room
 */
const emitToRoom = (roomId, event, data) => {
  if (io) {
    io.to(`room:${roomId}`).emit(event, data);
  }
};

/**
 * Emit event to a specific user (all their connected sockets)
 */
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

/**
 * Emit event to all connected clients
 */
const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

/**
 * Get list of online user IDs
 */
const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};

/**
 * Check if a user is online
 */
const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

/**
 * Get Socket.io instance
 */
const getIO = () => io;

/**
 * Notify room members of an update (e.g., new member added)
 */
const notifyRoomUpdate = async (roomId) => {
  try {
    const result = await db.query(`
      SELECT cr.*,
        (SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', cm.role))
         FROM chat_members cm JOIN users u ON cm.user_id = u.id WHERE cm.room_id = cr.id) as members
      FROM chat_rooms cr WHERE cr.id = $1
    `, [roomId]);

    if (result.rows.length > 0) {
      emitToRoom(roomId, 'room_updated', result.rows[0]);
    }
  } catch (error) {
    console.error('Error notifying room update:', error);
  }
};

/**
 * Make a user join a room (called when they're added to a chat)
 */
const addUserToRoom = (userId, roomId) => {
  if (io && onlineUsers.has(userId)) {
    for (const socketId of onlineUsers.get(userId)) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.join(`room:${roomId}`);
      }
    }
  }
};

module.exports = {
  initialize,
  emitToRoom,
  emitToUser,
  emitToAll,
  getOnlineUsers,
  isUserOnline,
  getIO,
  notifyRoomUpdate,
  addUserToRoom
};
