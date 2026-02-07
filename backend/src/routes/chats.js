const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { body, query, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');
const socketService = require('../services/socketService');
const { createNotificationForUsers } = require('./notifications');

const router = express.Router();

// Configure multer for chat file/audio uploads
const chatUploadDir = path.join(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'), 'chat');
if (!fs.existsSync(chatUploadDir)) {
  fs.mkdirSync(chatUploadDir, { recursive: true });
}

const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, chatUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const chatUpload = multer({
  storage: chatStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv',
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4',
      'video/mp4', 'video/webm'
    ];
    if (allowedTypes.includes(file.mimetype) ||
        file.mimetype.startsWith('audio/') ||
        file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Get user's chat rooms
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        cr.*,
        cm.last_read_at,
        (
          SELECT COUNT(*)
          FROM messages m
          WHERE m.room_id = cr.id
            AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01')
            AND m.sender_id != $1
            AND m.deleted_at IS NULL
        ) as unread_count,
        (
          SELECT json_build_object('content', m.content, 'sender_name', u.name, 'created_at', m.created_at)
          FROM messages m
          JOIN users u ON m.sender_id = u.id
          WHERE m.room_id = cr.id AND m.deleted_at IS NULL
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as last_message,
        (
          SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', cm2.role))
          FROM chat_members cm2
          JOIN users u ON cm2.user_id = u.id
          WHERE cm2.room_id = cr.id
        ) as members
      FROM chat_rooms cr
      JOIN chat_members cm ON cr.id = cm.room_id
      WHERE cm.user_id = $1
        AND cr.deleted_at IS NULL
      ORDER BY (
        SELECT MAX(m.created_at) FROM messages m WHERE m.room_id = cr.id
      ) DESC NULLS LAST
    `, [req.user.id]);

    res.json({ rooms: result.rows });
  } catch (error) {
    next(error);
  }
});

// Create new chat room
router.post('/', authenticate, [
  body('type').isIn(['direct', 'group']),
  body('name').optional().trim(),
  body('memberIds').isArray({ min: 1 }),
  body('memberIds.*').isUUID()
], async (req, res, next) => {
  const client = await db.getClient();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { type, name, memberIds } = req.body;

    // Only admins can create group chats
    if (type === 'group' && req.user.role !== 'admin') {
      return res.status(403).json({ error: { message: 'Only admins can create group chats' } });
    }

    // For direct chats, check if one already exists between these users
    if (type === 'direct' && memberIds.length === 1) {
      const existingDirect = await db.query(`
        SELECT cr.id
        FROM chat_rooms cr
        WHERE cr.type = 'direct'
          AND EXISTS (SELECT 1 FROM chat_members WHERE room_id = cr.id AND user_id = $1)
          AND EXISTS (SELECT 1 FROM chat_members WHERE room_id = cr.id AND user_id = $2)
          AND (SELECT COUNT(*) FROM chat_members WHERE room_id = cr.id) = 2
      `, [req.user.id, memberIds[0]]);

      if (existingDirect.rows.length > 0) {
        // Return existing room
        const roomId = existingDirect.rows[0].id;
        const roomResult = await db.query(`
          SELECT cr.*,
            (SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', cm.role))
             FROM chat_members cm JOIN users u ON cm.user_id = u.id WHERE cm.room_id = cr.id) as members
          FROM chat_rooms cr WHERE cr.id = $1
        `, [roomId]);
        return res.json({ room: roomResult.rows[0], existing: true });
      }
    }

    await client.query('BEGIN');

    // Create the room
    const roomResult = await client.query(
      'INSERT INTO chat_rooms (name, type, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name || null, type, req.user.id]
    );
    const room = roomResult.rows[0];

    // Add creator as admin member
    await client.query(
      'INSERT INTO chat_members (room_id, user_id, role) VALUES ($1, $2, $3)',
      [room.id, req.user.id, 'admin']
    );

    // Add other members
    for (const memberId of memberIds) {
      if (memberId !== req.user.id) {
        await client.query(
          'INSERT INTO chat_members (room_id, user_id, role) VALUES ($1, $2, $3)',
          [room.id, memberId, 'member']
        );
      }
    }

    await client.query('COMMIT');

    // Fetch complete room data
    const fullRoom = await db.query(`
      SELECT cr.*,
        (SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', cm.role))
         FROM chat_members cm JOIN users u ON cm.user_id = u.id WHERE cm.room_id = cr.id) as members
      FROM chat_rooms cr WHERE cr.id = $1
    `, [room.id]);

    // Notify all members about the new room
    const allMemberIds = [req.user.id, ...memberIds.filter(id => id !== req.user.id)];
    for (const memberId of allMemberIds) {
      socketService.emitToUser(memberId, 'new_room', fullRoom.rows[0]);
      socketService.addUserToRoom(memberId, room.id);
    }

    res.status(201).json({ room: fullRoom.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// Get room messages (paginated)
router.get('/:id/messages', authenticate, [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('before').optional().isUUID()
], async (req, res, next) => {
  try {
    // Check if user is a member
    const membership = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: { message: 'Not a member of this chat' } });
    }

    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before;

    let messagesQuery = `
      SELECT m.*, u.name as sender_name,
        CASE WHEN m.deleted_at IS NOT NULL THEN 'Message deleted' ELSE m.content END as content,
        rm.content as reply_to_content,
        rm.sender_id as reply_to_sender_id,
        ru2.name as reply_to_sender_name,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', mr.id, 'emoji', mr.emoji, 'user_id', mr.user_id,
            'user_name', ru.name
          ))
          FROM message_reactions mr
          JOIN users ru ON mr.user_id = ru.id
          WHERE mr.message_id = m.id),
          '[]'::json
        ) as reactions
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN messages rm ON m.reply_to_id = rm.id
      LEFT JOIN users ru2 ON rm.sender_id = ru2.id
      WHERE m.room_id = $1
    `;
    const params = [req.params.id];

    if (before) {
      const beforeMsg = await db.query('SELECT created_at FROM messages WHERE id = $1', [before]);
      if (beforeMsg.rows.length > 0) {
        messagesQuery += ' AND m.created_at < $2';
        params.push(beforeMsg.rows[0].created_at);
      }
    }

    messagesQuery += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(messagesQuery, params);

    // Get read receipts
    const readResult = await db.query(`
      SELECT cm.user_id, cm.last_read_at, u.name as user_name
      FROM chat_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.room_id = $1 AND cm.last_read_at IS NOT NULL
    `, [req.params.id]);

    res.json({
      messages: result.rows.reverse(),
      hasMore: result.rows.length === limit,
      read_receipts: readResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// Send message
router.post('/:id/messages', authenticate, sanitizeBody('content'), [
  body('content').trim().notEmpty(),
  body('type').optional().isIn(['text', 'file', 'ai'])
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    // Check if user is a member
    const membership = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: { message: 'Not a member of this chat' } });
    }

    const { content, type = 'text', file_url, file_name, reply_to_id } = req.body;

    const result = await db.query(
      `INSERT INTO messages (room_id, sender_id, content, type, file_url, file_name, reply_to_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *, (SELECT name FROM users WHERE id = $2) as sender_name`,
      [req.params.id, req.user.id, content, type, file_url || null, file_name || null, reply_to_id || null]
    );

    // Update room's updated_at
    await db.query('UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);

    // Emit to room via socket for real-time update
    socketService.emitToRoom(req.params.id, 'new_message', result.rows[0]);

    // Create notifications for other members
    const members = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id != $2',
      [req.params.id, req.user.id]
    );

    const roomName = (await db.query('SELECT name FROM chat_rooms WHERE id = $1', [req.params.id])).rows[0]?.name || 'Chat';
    const senderName = result.rows[0].sender_name;
    const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;

    const otherMemberIds = members.rows.map(m => m.user_id);
    if (otherMemberIds.length > 0) {
      const notifications = await createNotificationForUsers(
        otherMemberIds,
        'chat_message',
        `${senderName} in ${roomName}`,
        preview,
        req.params.id,
        'chat_room'
      );
      for (const notification of notifications) {
        socketService.emitToUser(notification.user_id, 'notification', notification);
      }
    }

    res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Delete message (soft delete - admin or sender only)
router.delete('/:id/messages/:messageId', authenticate, async (req, res, next) => {
  try {
    const message = await db.query(
      'SELECT * FROM messages WHERE id = $1 AND room_id = $2',
      [req.params.messageId, req.params.id]
    );

    if (message.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Message not found' } });
    }

    // Only sender or admin can delete
    if (message.rows[0].sender_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: { message: 'Cannot delete this message' } });
    }

    await db.query(
      'UPDATE messages SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1 WHERE id = $2',
      [req.user.id, req.params.messageId]
    );

    // Emit message deletion to room
    socketService.emitToRoom(req.params.id, 'message_deleted', {
      roomId: req.params.id,
      messageId: req.params.messageId
    });

    res.json({ message: 'Message deleted' });
  } catch (error) {
    next(error);
  }
});

// Toggle reaction on a message
router.post('/:id/messages/:messageId/reactions', authenticate, [
  body('emoji').trim().notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    // Check membership
    const membership = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: { message: 'Not a member of this chat' } });
    }

    // Check message exists
    const message = await db.query(
      'SELECT id FROM messages WHERE id = $1 AND room_id = $2',
      [req.params.messageId, req.params.id]
    );
    if (message.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Message not found' } });
    }

    const { emoji } = req.body;

    // Check if reaction already exists (toggle)
    const existing = await db.query(
      'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [req.params.messageId, req.user.id, emoji]
    );

    let action;
    if (existing.rows.length > 0) {
      // Remove reaction
      await db.query(
        'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
        [req.params.messageId, req.user.id, emoji]
      );
      action = 'removed';
    } else {
      // Add reaction
      await db.query(
        'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
        [req.params.messageId, req.user.id, emoji]
      );
      action = 'added';
    }

    // Get updated reactions for this message
    const reactions = await db.query(
      `SELECT mr.id, mr.emoji, mr.user_id, u.name as user_name
       FROM message_reactions mr
       JOIN users u ON mr.user_id = u.id
       WHERE mr.message_id = $1`,
      [req.params.messageId]
    );

    // Emit reaction update to room
    socketService.emitToRoom(req.params.id, 'reaction_updated', {
      messageId: req.params.messageId,
      reactions: reactions.rows
    });

    res.json({ action, reactions: reactions.rows });
  } catch (error) {
    next(error);
  }
});

// Get reactions for a message
router.get('/:id/messages/:messageId/reactions', authenticate, async (req, res, next) => {
  try {
    // Check membership
    const membership = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: { message: 'Not a member of this chat' } });
    }

    const reactions = await db.query(
      `SELECT mr.id, mr.emoji, mr.user_id, u.name as user_name
       FROM message_reactions mr
       JOIN users u ON mr.user_id = u.id
       WHERE mr.message_id = $1`,
      [req.params.messageId]
    );

    res.json({ reactions: reactions.rows });
  } catch (error) {
    next(error);
  }
});

// Upload audio message
router.post('/:id/audio', authenticate, chatUpload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No audio file provided' } });
    }

    // Check membership
    const membership = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: { message: 'Not a member of this chat' } });
    }

    const audioUrl = `/uploads/chat/${req.file.filename}`;
    const duration = parseInt(req.body.duration) || 0;

    const result = await db.query(
      `INSERT INTO messages (room_id, sender_id, content, type, audio_url, audio_duration)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *, (SELECT name FROM users WHERE id = $2) as sender_name`,
      [req.params.id, req.user.id, 'Audio message', 'audio', audioUrl, duration]
    );

    // Update room's updated_at
    await db.query('UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);

    // Emit to room
    socketService.emitToRoom(req.params.id, 'new_message', result.rows[0]);

    // Create notifications for other members
    const members = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id != $2',
      [req.params.id, req.user.id]
    );
    const senderName = result.rows[0].sender_name;
    const roomName = (await db.query('SELECT name FROM chat_rooms WHERE id = $1', [req.params.id])).rows[0]?.name || 'Chat';

    const otherMemberIds = members.rows.map(m => m.user_id);
    if (otherMemberIds.length > 0) {
      const notifications = await createNotificationForUsers(
        otherMemberIds,
        'chat_message',
        `${senderName} in ${roomName}`,
        'Sent an audio message',
        req.params.id,
        'chat_room'
      );
      for (const notification of notifications) {
        socketService.emitToUser(notification.user_id, 'notification', notification);
      }
    }

    res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Upload file in chat
router.post('/:id/upload', authenticate, chatUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No file provided' } });
    }

    // Check membership
    const membership = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: { message: 'Not a member of this chat' } });
    }

    const fileUrl = `/uploads/chat/${req.file.filename}`;
    const fileName = req.file.originalname;

    const result = await db.query(
      `INSERT INTO messages (room_id, sender_id, content, type, file_url, file_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *, (SELECT name FROM users WHERE id = $2) as sender_name`,
      [req.params.id, req.user.id, fileName, 'file', fileUrl, fileName]
    );

    // Update room's updated_at
    await db.query('UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);

    // Emit to room
    socketService.emitToRoom(req.params.id, 'new_message', result.rows[0]);

    // Create notifications for other members
    const members = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id != $2',
      [req.params.id, req.user.id]
    );
    const senderName = result.rows[0].sender_name;
    const roomName = (await db.query('SELECT name FROM chat_rooms WHERE id = $1', [req.params.id])).rows[0]?.name || 'Chat';

    const otherMemberIds = members.rows.map(m => m.user_id);
    if (otherMemberIds.length > 0) {
      const notifications = await createNotificationForUsers(
        otherMemberIds,
        'chat_message',
        `${senderName} in ${roomName}`,
        `Shared a file: ${fileName}`,
        req.params.id,
        'chat_room'
      );
      for (const notification of notifications) {
        socketService.emitToUser(notification.user_id, 'notification', notification);
      }
    }

    res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Add members to group chat
router.post('/:id/members', authenticate, [
  body('userIds').isArray({ min: 1 }),
  body('userIds.*').isUUID()
], async (req, res, next) => {
  const client = await db.getClient();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    // Check if user is admin of this room
    const membership = await db.query(
      'SELECT role FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (membership.rows.length === 0 || (membership.rows[0].role !== 'admin' && req.user.role !== 'admin')) {
      return res.status(403).json({ error: { message: 'Only room admins can add members' } });
    }

    // Check room is a group
    const room = await db.query('SELECT type FROM chat_rooms WHERE id = $1', [req.params.id]);
    if (room.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Room not found' } });
    }
    if (room.rows[0].type !== 'group') {
      return res.status(400).json({ error: { message: 'Can only add members to group chats' } });
    }

    await client.query('BEGIN');

    const { userIds } = req.body;
    const added = [];

    for (const userId of userIds) {
      const existing = await client.query(
        'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
        [req.params.id, userId]
      );

      if (existing.rows.length === 0) {
        await client.query(
          'INSERT INTO chat_members (room_id, user_id, role) VALUES ($1, $2, $3)',
          [req.params.id, userId, 'member']
        );
        added.push(userId);
      }
    }

    await client.query('COMMIT');

    // Notify room of member changes and add new users to socket room
    if (added.length > 0) {
      socketService.notifyRoomUpdate(req.params.id);
      for (const userId of added) {
        socketService.addUserToRoom(userId, req.params.id);
      }
    }

    res.json({ message: 'Members added', addedCount: added.length });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// Remove member from group chat
router.delete('/:id/members/:userId', authenticate, async (req, res, next) => {
  try {
    // Check if requester is admin of this room
    const membership = await db.query(
      'SELECT role FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (membership.rows.length === 0 || (membership.rows[0].role !== 'admin' && req.user.role !== 'admin')) {
      // Users can remove themselves
      if (req.params.userId !== req.user.id) {
        return res.status(403).json({ error: { message: 'Only room admins can remove members' } });
      }
    }

    await db.query(
      'DELETE FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    );

    // Notify room of member change
    socketService.notifyRoomUpdate(req.params.id);
    // Notify the removed user
    socketService.emitToUser(req.params.userId, 'removed_from_room', { roomId: req.params.id });

    res.json({ message: 'Member removed' });
  } catch (error) {
    next(error);
  }
});

// Mark room as read
router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      'UPDATE chat_members SET last_read_at = CURRENT_TIMESTAMP WHERE room_id = $1 AND user_id = $2 RETURNING last_read_at',
      [req.params.id, req.user.id]
    );

    // Emit read receipt to room so others can update "seen by" indicators
    socketService.emitToRoom(req.params.id, 'room_read', {
      roomId: req.params.id,
      user_id: req.user.id,
      user_name: req.user.name,
      last_read_at: result.rows[0]?.last_read_at
    });

    res.json({ message: 'Marked as read' });
  } catch (error) {
    next(error);
  }
});

// Delete chat room (admin only, soft delete)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: { message: 'Only admins can delete chat rooms' } });
    }

    const room = await db.query('SELECT id FROM chat_rooms WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (room.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Chat room not found' } });
    }

    await db.query(
      'UPDATE chat_rooms SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1 WHERE id = $2',
      [req.user.id, req.params.id]
    );

    // Notify all members that the room has been deleted
    const members = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1',
      [req.params.id]
    );
    for (const member of members.rows) {
      socketService.emitToUser(member.user_id, 'room_deleted', { roomId: req.params.id });
    }

    res.json({ message: 'Chat room deleted' });
  } catch (error) {
    next(error);
  }
});

// Get single room details
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    // Check if user is a member
    const membership = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: { message: 'Not a member of this chat' } });
    }

    const result = await db.query(`
      SELECT cr.*,
        (SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', cm.role))
         FROM chat_members cm JOIN users u ON cm.user_id = u.id WHERE cm.room_id = cr.id) as members
      FROM chat_rooms cr WHERE cr.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Room not found' } });
    }

    res.json({ room: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Serve chat uploads with authentication
router.get('/uploads/:filename', authenticate, async (req, res, next) => {
  try {
    const pathModule = require('path');
    const uploadDir = process.env.UPLOAD_DIR || pathModule.join(__dirname, '../../uploads');
    const safeName = pathModule.basename(req.params.filename);

    // Verify the file belongs to a chat room the user is a member of
    const messageCheck = await db.query(
      `SELECT m.id FROM messages m
       JOIN chat_members cm ON cm.room_id = m.room_id
       WHERE m.file_url LIKE $1 AND cm.user_id = $2
       LIMIT 1`,
      [`%${safeName}`, req.user.id]
    );

    if (messageCheck.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    const filePath = pathModule.join(uploadDir, 'chat', safeName);
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: { message: 'File not found' } });
    }

    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

// Edit a message (sender only)
router.put('/:roomId/messages/:messageId', authenticate, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: { message: 'Message content is required' } });
    }

    const result = await db.query(
      'SELECT * FROM messages WHERE id = $1 AND room_id = $2',
      [req.params.messageId, req.params.roomId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Message not found' } });
    }

    const message = result.rows[0];
    if (message.sender_id !== req.user.id) {
      return res.status(403).json({ error: { message: 'You can only edit your own messages' } });
    }

    if (message.deleted_at) {
      return res.status(400).json({ error: { message: 'Cannot edit a deleted message' } });
    }

    const updated = await db.query(
      'UPDATE messages SET content = $1, edited_at = NOW() WHERE id = $2 RETURNING *',
      [content.trim(), req.params.messageId]
    );

    // Emit socket event
    socketService.emitToRoom(req.params.roomId, 'message_edited', {
      roomId: req.params.roomId,
      message: updated.rows[0]
    });

    res.json({ message: updated.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
