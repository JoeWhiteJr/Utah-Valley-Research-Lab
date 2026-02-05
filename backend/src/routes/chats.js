const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const socketService = require('../services/socketService');

const router = express.Router();

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
  body('memberIds').isArray({ min: 1 })
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

    let query = `
      SELECT m.*, u.name as sender_name,
        CASE WHEN m.deleted_at IS NOT NULL THEN 'Message deleted' ELSE m.content END as content
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.room_id = $1
    `;
    const params = [req.params.id];

    if (before) {
      const beforeMsg = await db.query('SELECT created_at FROM messages WHERE id = $1', [before]);
      if (beforeMsg.rows.length > 0) {
        query += ' AND m.created_at < $2';
        params.push(beforeMsg.rows[0].created_at);
      }
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(query, params);

    res.json({
      messages: result.rows.reverse(),
      hasMore: result.rows.length === limit
    });
  } catch (error) {
    next(error);
  }
});

// Send message
router.post('/:id/messages', authenticate, [
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

    const { content, type = 'text', file_url, file_name } = req.body;

    const result = await db.query(
      `INSERT INTO messages (room_id, sender_id, content, type, file_url, file_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *, (SELECT name FROM users WHERE id = $2) as sender_name`,
      [req.params.id, req.user.id, content, type, file_url || null, file_name || null]
    );

    // Update room's updated_at
    await db.query('UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);

    // Emit to room via socket for real-time update
    socketService.emitToRoom(req.params.id, 'new_message', result.rows[0]);

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

// Add members to group chat
router.post('/:id/members', authenticate, [
  body('userIds').isArray({ min: 1 })
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
    await db.query(
      'UPDATE chat_members SET last_read_at = CURRENT_TIMESTAMP WHERE room_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    res.json({ message: 'Marked as read' });
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

module.exports = router;
