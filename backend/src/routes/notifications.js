const express = require('express');
const { query, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { sendEmail } = require('../services/email');
const emailTemplates = require('../services/emailTemplates');
const logger = require('../config/logger');

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

// Get unread counts grouped by reference_type
router.get('/unread-counts-by-type', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT reference_type, COUNT(*)::int as count
       FROM notifications
       WHERE user_id = $1 AND read_at IS NULL AND reference_type IS NOT NULL
       GROUP BY reference_type`,
      [req.user.id]
    );

    const counts = {};
    for (const row of result.rows) {
      counts[row.reference_type] = row.count;
    }

    res.json({ counts });
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

// Mark all notifications of a given reference_type as read
router.put('/read-by-type/:referenceType', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE notifications
       SET read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND read_at IS NULL AND reference_type = $2
       RETURNING id`,
      [req.user.id, req.params.referenceType]
    );

    res.json({
      message: `Notifications of type '${req.params.referenceType}' marked as read`,
      count: result.rows.length
    });
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
    logger.error({ err: error }, 'Failed to create notification');
    return null;
  }
};

// Map notification type to user preference column
const typeToEmailPref = {
  chat_message: 'email_chat',
  mention: 'email_mentions',
  application_received: 'email_applications',
  application_status: 'email_applications',
};

// Send email notifications to users who have opted in
const sendNotificationEmails = async (userIds, type, title, body, referenceId) => {
  if (!userIds || userIds.length === 0) return;

  const ALLOWED_PREF_COLUMNS = ['email_chat', 'email_mentions', 'email_applications', 'email_system'];
  const prefColumn = typeToEmailPref[type] || 'email_system';
  if (!ALLOWED_PREF_COLUMNS.includes(prefColumn)) {
    logger.error({ type, prefColumn }, 'Invalid email preference column');
    return;
  }
  const appUrl = process.env.APP_URL || 'http://localhost:5173';

  try {
    // prefColumn is safe — validated against ALLOWED_PREF_COLUMNS whitelist above
    const result = await db.query(
      `SELECT u.id, u.name, u.email, up.${prefColumn} AS email_enabled
       FROM users u
       JOIN user_preferences up ON up.user_id = u.id
       WHERE u.id = ANY($1) AND up.${prefColumn} = true`,
      [userIds]
    );

    for (const user of result.rows) {
      let template;
      if (type === 'chat_message') {
        template = emailTemplates.chatMessageEmail({
          senderName: title.replace(/^New message from /, '').replace(/ in .*$/, '') || 'Someone',
          roomName: title.replace(/^.*in /, '') || 'a chat room',
          messagePreview: body || '',
          appUrl,
        });
      } else if (type === 'mention') {
        template = emailTemplates.mentionEmail({
          senderName: title.replace(/ mentioned you.*$/, '') || 'Someone',
          context: body || '',
          appUrl,
        });
      } else if (type === 'application_status') {
        template = emailTemplates.applicationStatusEmail({
          applicantName: user.name,
          status: body || 'updated',
          appUrl,
        });
      } else {
        template = emailTemplates.systemNotificationEmail({
          title,
          body: body || '',
          appUrl,
        });
      }

      sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      }).catch(err => logger.error({ err, userId: user.id, type }, 'Failed to send notification email'));
    }
  } catch (error) {
    logger.error({ err: error, type }, 'Failed to query email preferences for notifications');
  }
};

// Create notification for multiple users
const createNotificationForUsers = async (userIds, type, title, body, referenceId, referenceType) => {
  if (!userIds || userIds.length === 0) return [];
  const values = [];
  const placeholders = [];
  let paramCount = 1;
  for (const userId of userIds) {
    placeholders.push(`($${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++})`);
    values.push(userId, type, title, body, referenceId || null, referenceType || null);
  }
  const result = await db.query(
    `INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type) VALUES ${placeholders.join(', ')} RETURNING *`,
    values
  );

  // Fire-and-forget email notifications
  sendNotificationEmails(userIds, type, title, body, referenceId);

  return result.rows;
};

module.exports = router;
module.exports.createNotification = createNotification;
module.exports.createNotificationForUsers = createNotificationForUsers;
