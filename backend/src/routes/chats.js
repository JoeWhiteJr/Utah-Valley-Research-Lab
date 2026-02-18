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

// Check if user can manage a chat room (rename, add/remove members)
// Returns true for: global admins, chat room admins, project leads on project-linked rooms
async function canManageChat(userId, roomId) {
  // Global admin
  const userResult = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length > 0 && userResult.rows[0].role === 'admin') return true;

  // Chat room admin
  const memberResult = await db.query(
    'SELECT role FROM chat_members WHERE room_id = $1 AND user_id = $2',
    [roomId, userId]
  );
  if (memberResult.rows.length > 0 && memberResult.rows[0].role === 'admin') return true;

  // Project lead for project-linked rooms
  const roomResult = await db.query('SELECT project_id FROM chat_rooms WHERE id = $1', [roomId]);
  if (roomResult.rows[0]?.project_id) {
    const projectMember = await db.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [roomResult.rows[0].project_id, userId]
    );
    if (projectMember.rows.length > 0 && projectMember.rows[0].role === 'lead') return true;
  }

  return false;
}

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
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const showArchived = req.query.archived === 'true';

    const archiveFilter = showArchived ? 'AND cm.archived_at IS NOT NULL' : 'AND cm.archived_at IS NULL';
    const blockFilter = `AND NOT EXISTS (
      SELECT 1 FROM user_blocks ub
      WHERE cr.type = 'direct'
      AND ((ub.blocker_id = $1 AND ub.blocked_id IN (SELECT cm3.user_id FROM chat_members cm3 WHERE cm3.room_id = cr.id AND cm3.user_id != $1))
        OR (ub.blocked_id = $1 AND ub.blocker_id IN (SELECT cm3.user_id FROM chat_members cm3 WHERE cm3.room_id = cr.id AND cm3.user_id != $1)))
    )`;

    const countResult = await db.query(
      `SELECT COUNT(*) FROM chat_rooms cr
       JOIN chat_members cm ON cr.id = cm.room_id
       WHERE cm.user_id = $1 AND cr.deleted_at IS NULL ${archiveFilter} ${blockFilter}`,
      [req.user.id]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(`
      SELECT
        cr.*,
        cm.last_read_at,
        cm.muted,
        cm.pinned_at,
        cm.archived_at,
        cm.marked_unread,
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
          SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', cm2.role, 'avatar_url', u.avatar_url))
          FROM chat_members cm2
          JOIN users u ON cm2.user_id = u.id
          WHERE cm2.room_id = cr.id
        ) as members
      FROM chat_rooms cr
      JOIN chat_members cm ON cr.id = cm.room_id
      WHERE cm.user_id = $1
        AND cr.deleted_at IS NULL
        ${archiveFilter}
        ${blockFilter}
      ORDER BY
        CASE WHEN cm.pinned_at IS NOT NULL THEN 0 ELSE 1 END,
        cm.pinned_at ASC NULLS LAST,
        (SELECT MAX(m.created_at) FROM messages m WHERE m.room_id = cr.id) DESC NULLS LAST
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset]);

    res.json({ rooms: result.rows, total, limit, offset });
  } catch (error) {
    next(error);
  }
});

// Create new chat room
router.post('/', authenticate, [
  body('type').isIn(['direct', 'group']),
  body('name').optional().trim(),
  body('memberIds').isArray({ min: 1 }),
  body('memberIds.*').isUUID(),
  body('projectId').optional().isUUID()
], async (req, res, next) => {
  const client = await db.getClient();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { type, name, memberIds, projectId } = req.body;

    // For direct chats, check block status
    if (type === 'direct' && memberIds.length === 1) {
      const blockCheck = await db.query(
        'SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
        [req.user.id, memberIds[0]]
      );
      if (blockCheck.rows.length > 0) {
        return res.status(403).json({ error: { message: 'Cannot create DM with this user' } });
      }

      const existingDirect = await db.query(`
        SELECT cr.id
        FROM chat_rooms cr
        WHERE cr.type = 'direct'
          AND cr.deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM chat_members WHERE room_id = cr.id AND user_id = $1)
          AND EXISTS (SELECT 1 FROM chat_members WHERE room_id = cr.id AND user_id = $2)
          AND (SELECT COUNT(*) FROM chat_members WHERE room_id = cr.id) = 2
      `, [req.user.id, memberIds[0]]);

      if (existingDirect.rows.length > 0) {
        // Return existing room
        const roomId = existingDirect.rows[0].id;
        const roomResult = await db.query(`
          SELECT cr.*,
            (SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', cm.role, 'avatar_url', u.avatar_url))
             FROM chat_members cm JOIN users u ON cm.user_id = u.id WHERE cm.room_id = cr.id) as members
          FROM chat_rooms cr WHERE cr.id = $1
        `, [roomId]);
        return res.json({ room: roomResult.rows[0], existing: true });
      }
    }

    await client.query('BEGIN');

    // Create the room
    const roomResult = await client.query(
      'INSERT INTO chat_rooms (name, type, created_by, project_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name || null, type, req.user.id, projectId || null]
    );
    const room = roomResult.rows[0];

    // Add creator as admin member
    await client.query(
      'INSERT INTO chat_members (room_id, user_id, role) VALUES ($1, $2, $3)',
      [room.id, req.user.id, 'admin']
    );

    // Add other members (batch insert)
    const otherMembers = memberIds.filter(id => id !== req.user.id);
    if (otherMembers.length > 0) {
      const values = otherMembers.map((_, i) => `($1, $${i + 2}, 'member')`).join(', ');
      await client.query(
        `INSERT INTO chat_members (room_id, user_id, role) VALUES ${values}`,
        [room.id, ...otherMembers]
      );
    }

    await client.query('COMMIT');

    // Fetch complete room data
    const fullRoom = await db.query(`
      SELECT cr.*,
        (SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', cm.role, 'avatar_url', u.avatar_url))
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

// Rename chat room
router.put('/:id', authenticate, [
  body('name').trim().notEmpty().isLength({ max: 255 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    // Check room exists and is a group
    const room = await db.query('SELECT * FROM chat_rooms WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (room.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Chat room not found' } });
    }
    if (room.rows[0].type !== 'group') {
      return res.status(400).json({ error: { message: 'Only group chats can be renamed' } });
    }

    // Check permission
    const hasPermission = await canManageChat(req.user.id, req.params.id);
    if (!hasPermission) {
      return res.status(403).json({ error: { message: 'You do not have permission to rename this chat' } });
    }

    const { name } = req.body;
    const result = await db.query(
      'UPDATE chat_rooms SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [name, req.params.id]
    );

    socketService.notifyRoomUpdate(req.params.id);

    res.json({ room: result.rows[0] });
  } catch (error) {
    next(error);
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
      SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar,
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
  body('content').trim().notEmpty().isLength({ max: 5000 }),
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
       RETURNING *, (SELECT name FROM users WHERE id = $2) as sender_name, (SELECT avatar_url FROM users WHERE id = $2) as sender_avatar`,
      [req.params.id, req.user.id, content, type, file_url || null, file_name || null, reply_to_id || null]
    );

    // Update room's updated_at
    await db.query('UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);

    // Emit to room via socket for real-time update
    socketService.emitToRoom(req.params.id, 'new_message', result.rows[0]);

    // Create notifications for other non-muted members
    const members = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id != $2 AND muted = false',
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
       RETURNING *, (SELECT name FROM users WHERE id = $2) as sender_name, (SELECT avatar_url FROM users WHERE id = $2) as sender_avatar`,
      [req.params.id, req.user.id, 'Audio message', 'audio', audioUrl, duration]
    );

    // Update room's updated_at
    await db.query('UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);

    // Emit to room
    socketService.emitToRoom(req.params.id, 'new_message', result.rows[0]);

    // Create notifications for other non-muted members
    const members = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id != $2 AND muted = false',
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
       RETURNING *, (SELECT name FROM users WHERE id = $2) as sender_name, (SELECT avatar_url FROM users WHERE id = $2) as sender_avatar`,
      [req.params.id, req.user.id, fileName, 'file', fileUrl, fileName]
    );

    // Update room's updated_at
    await db.query('UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);

    // Emit to room
    socketService.emitToRoom(req.params.id, 'new_message', result.rows[0]);

    // Create notifications for other non-muted members
    const members = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id != $2 AND muted = false',
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

    // Check if user can manage this chat
    const hasPermission = await canManageChat(req.user.id, req.params.id);
    if (!hasPermission) {
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

    // Find which users are already members (single query)
    const existingResult = await client.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = ANY($2)',
      [req.params.id, userIds]
    );
    const existingIds = new Set(existingResult.rows.map(r => r.user_id));
    const added = userIds.filter(id => !existingIds.has(id));

    // Batch insert new members
    if (added.length > 0) {
      const values = added.map((_, i) => `($1, $${i + 2}, 'member')`).join(', ');
      await client.query(
        `INSERT INTO chat_members (room_id, user_id, role) VALUES ${values}`,
        [req.params.id, ...added]
      );
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
    // Users can always remove themselves; for others, check management permission
    if (req.params.userId !== req.user.id) {
      const hasPermission = await canManageChat(req.user.id, req.params.id);
      if (!hasPermission) {
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
      'UPDATE chat_members SET last_read_at = CURRENT_TIMESTAMP, marked_unread = false WHERE room_id = $1 AND user_id = $2 RETURNING last_read_at',
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

// Toggle mute for a chat room
router.put('/:id/mute', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      'UPDATE chat_members SET muted = NOT muted WHERE room_id = $1 AND user_id = $2 RETURNING muted',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Not a member of this chat' } });
    }
    res.json({ muted: result.rows[0].muted });
  } catch (error) {
    next(error);
  }
});

// Mark chat as unread
router.put('/:id/mark-unread', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      'UPDATE chat_members SET marked_unread = true WHERE room_id = $1 AND user_id = $2 RETURNING marked_unread',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Not a member of this chat' } });
    }
    res.json({ marked_unread: true });
  } catch (error) {
    next(error);
  }
});

// Toggle pin for a chat room
router.put('/:id/pin', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      'UPDATE chat_members SET pinned_at = CASE WHEN pinned_at IS NULL THEN NOW() ELSE NULL END WHERE room_id = $1 AND user_id = $2 RETURNING pinned_at',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Not a member of this chat' } });
    }
    res.json({ pinned_at: result.rows[0].pinned_at });
  } catch (error) {
    next(error);
  }
});

// Toggle archive for a chat room
router.put('/:id/archive', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      'UPDATE chat_members SET archived_at = CASE WHEN archived_at IS NULL THEN NOW() ELSE NULL END WHERE room_id = $1 AND user_id = $2 RETURNING archived_at',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Not a member of this chat' } });
    }
    res.json({ archived_at: result.rows[0].archived_at });
  } catch (error) {
    next(error);
  }
});

// Search messages in a chat room
router.get('/:id/messages/search', authenticate, async (req, res, next) => {
  try {
    const membership = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: { message: 'Not a member of this chat' } });
    }

    const q = req.query.q;
    if (!q || q.trim().length === 0) {
      return res.json({ messages: [] });
    }

    const result = await db.query(`
      SELECT m.id, m.content, m.created_at, m.sender_id, u.name as sender_name, u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.room_id = $1
        AND m.deleted_at IS NULL
        AND m.content ILIKE $2
      ORDER BY m.created_at DESC
      LIMIT 50
    `, [req.params.id, `%${q.trim()}%`]);

    res.json({ messages: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get media/files for a chat room
router.get('/:id/media', authenticate, async (req, res, next) => {
  try {
    const membership = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: { message: 'Not a member of this chat' } });
    }

    const type = req.query.type || 'media';
    let result;

    if (type === 'media') {
      result = await db.query(`
        SELECT m.id, m.file_url, m.file_name, m.audio_url, m.type, m.created_at, u.name as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.room_id = $1
          AND m.deleted_at IS NULL
          AND (
            (m.file_url IS NOT NULL AND m.file_name ~* '\\.(jpg|jpeg|png|gif|webp|mp4|webm)$')
            OR m.type = 'audio'
          )
        ORDER BY m.created_at DESC
        LIMIT 100
      `, [req.params.id]);
    } else {
      result = await db.query(`
        SELECT m.id, m.file_url, m.file_name, m.type, m.created_at, u.name as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.room_id = $1
          AND m.deleted_at IS NULL
          AND m.file_url IS NOT NULL
          AND m.file_name !~* '\\.(jpg|jpeg|png|gif|webp|mp4|webm)$'
        ORDER BY m.created_at DESC
        LIMIT 100
      `, [req.params.id]);
    }

    res.json({ items: result.rows });
  } catch (error) {
    next(error);
  }
});

// Upload chat room image
router.post('/:id/image', authenticate, chatUpload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No image provided' } });
    }

    // Check membership (admin of room or site admin)
    const membership = await db.query(
      'SELECT role FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: { message: 'Not a member of this chat' } });
    }

    const imageUrl = `/uploads/chat/${req.file.filename}`;
    const result = await db.query(
      'UPDATE chat_rooms SET image_url = $1 WHERE id = $2 RETURNING *',
      [imageUrl, req.params.id]
    );

    socketService.emitToRoom(req.params.id, 'room_updated', result.rows[0]);
    res.json({ room: result.rows[0] });
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

// Get or create a project's chat room
router.get('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    // Find existing project chat room
    let room = await db.query(`
      SELECT cr.*,
        (SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', cm.role, 'avatar_url', u.avatar_url))
         FROM chat_members cm JOIN users u ON cm.user_id = u.id WHERE cm.room_id = cr.id) as members
      FROM chat_rooms cr
      WHERE cr.project_id = $1 AND cr.deleted_at IS NULL
      LIMIT 1
    `, [req.params.projectId]);

    if (room.rows.length > 0) {
      // Ensure current user is a member
      const membership = await db.query(
        'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
        [room.rows[0].id, req.user.id]
      );
      if (membership.rows.length === 0) {
        await db.query(
          'INSERT INTO chat_members (room_id, user_id, role) VALUES ($1, $2, $3)',
          [room.rows[0].id, req.user.id, 'member']
        );
        // Re-fetch with updated members
        room = await db.query(`
          SELECT cr.*,
            (SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', cm.role, 'avatar_url', u.avatar_url))
             FROM chat_members cm JOIN users u ON cm.user_id = u.id WHERE cm.room_id = cr.id) as members
          FROM chat_rooms cr
          WHERE cr.id = $1
        `, [room.rows[0].id]);
      }
      return res.json({ room: room.rows[0] });
    }

    // No room exists — create one
    const project = await db.query('SELECT title FROM projects WHERE id = $1', [req.params.projectId]);
    if (project.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    const projectTitle = project.rows[0].title;

    // Get all project members
    const projectMembers = await db.query(
      'SELECT user_id FROM project_members WHERE project_id = $1',
      [req.params.projectId]
    );
    const memberIds = projectMembers.rows.map(m => m.user_id);

    // Ensure current user is included
    if (!memberIds.includes(req.user.id)) {
      memberIds.push(req.user.id);
    }

    // Create room
    const newRoom = await db.query(
      'INSERT INTO chat_rooms (name, type, created_by, project_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [`${projectTitle} Chat`, 'group', req.user.id, req.params.projectId]
    );

    const roomId = newRoom.rows[0].id;

    // Add all members
    for (const memberId of memberIds) {
      const role = memberId === req.user.id ? 'admin' : 'member';
      await db.query(
        'INSERT INTO chat_members (room_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [roomId, memberId, role]
      );
    }

    // Fetch full room data
    const fullRoom = await db.query(`
      SELECT cr.*,
        (SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', cm.role, 'avatar_url', u.avatar_url))
         FROM chat_members cm JOIN users u ON cm.user_id = u.id WHERE cm.room_id = cr.id) as members
      FROM chat_rooms cr WHERE cr.id = $1
    `, [roomId]);

    res.json({ room: fullRoom.rows[0] });
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
        (SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', cm.role, 'avatar_url', u.avatar_url))
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
