const express = require('express');
const { query, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get user's notifications
router.get('/', authenticate, [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('unread_only').optional().isBoolean()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const unreadOnly = req.query.unread_only === 'true';

    let queryStr = `
      SELECT *
      FROM notifications
      WHERE user_id = $1
    `;
    const params = [req.user.id];

    if (unreadOnly) {
      queryStr += ' AND read_at IS NULL';
    }

    queryStr += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    params.push(limit, offset);

    const result = await db.query(queryStr, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM notifications WHERE user_id = $1';
    const countParams = [req.user.id];
    if (unreadOnly) {
      countQuery += ' AND read_at IS NULL';
    }
    const countResult = await db.query(countQuery, countParams);

    res.json({
      notifications: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

// Get unread count
router.get('/unread-count', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [req.user.id]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    next(error);
  }
});

// Mark single notification as read
router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE notifications
       SET read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Notification not found' } });
    }

    res.json({ notification: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Mark all notifications as read
router.put('/read-all', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE notifications
       SET read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND read_at IS NULL
       RETURNING id`,
      [req.user.id]
    );

    res.json({
      message: 'All notifications marked as read',
      count: result.rows.length
    });
  } catch (error) {
    next(error);
  }
});

// Delete a notification
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Notification not found' } });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
});

// Helper function to create notifications (used by other parts of the app)
const createNotification = async (userId, type, title, body = null, referenceId = null, referenceType = null) => {
  try {
    const result = await db.query(
      `INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, type, title, body, referenceId, referenceType]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Failed to create notification:', error.message);
    return null;
  }
};

// Create notification for multiple users
const createNotificationForUsers = async (userIds, type, title, body = null, referenceId = null, referenceType = null) => {
  const notifications = [];
  for (const userId of userIds) {
    const notification = await createNotification(userId, type, title, body, referenceId, referenceType);
    if (notification) {
      notifications.push(notification);
    }
  }
  return notifications;
};

module.exports = router;
module.exports.createNotification = createNotification;
module.exports.createNotificationForUsers = createNotificationForUsers;
