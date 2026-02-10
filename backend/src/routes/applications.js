const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAdminAction } = require('../middleware/auditLog');
const { createNotificationForUsers } = require('./notifications');
const socketService = require('../services/socketService');

const router = express.Router();

// Submit application (public - no auth required)
router.post('/', [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('message').trim().notEmpty().withMessage('Message is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { firstName, lastName, email, password, message } = req.body;

    // Check if email already has a pending application
    const existing = await db.query(
      'SELECT id FROM applications WHERE email = $1 AND status = $2',
      [email, 'pending']
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: { message: 'An application with this email is already pending' } });
    }

    // Check if user already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: { message: 'An account with this email already exists' } });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.query(
      'INSERT INTO applications (first_name, last_name, email, message, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [firstName, lastName, email, message, passwordHash]
    );

    // Notify admins about the new application
    try {
      const admins = await db.query(
        "SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL"
      );
      const adminIds = admins.rows.map(a => a.id);
      if (adminIds.length > 0) {
        const notifications = await createNotificationForUsers(
          adminIds, 'system',
          `New application: ${firstName} ${lastName}`,
          `${email} has applied to join the lab.`,
          result.rows[0].id, 'application'
        );
        for (const notification of notifications) {
          socketService.emitToUser(notification.user_id, 'notification', notification);
        }
      }
    } catch (notifError) {
      console.error('Failed to send application notifications:', notifError);
    }

    res.status(201).json({
      application: result.rows[0],
      message: 'Application submitted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// List all applications (admin only)
router.get('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const validStatuses = ['pending', 'approved', 'rejected'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: { message: 'Invalid status filter' } });
    }

    let query = `
      SELECT a.*, u.name as reviewer_name
      FROM applications a
      LEFT JOIN users u ON a.reviewed_by = u.id
    `;
    const params = [];

    if (status) {
      query += ' WHERE a.status = $1';
      params.push(status);
    }

    query += ' ORDER BY a.created_at DESC';

    const result = await db.query(query, params);
    res.json({ applications: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get single application (admin only)
router.get('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT a.*, u.name as reviewer_name
      FROM applications a
      LEFT JOIN users u ON a.reviewed_by = u.id
      WHERE a.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Application not found' } });
    }

    res.json({ application: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Approve application & create user account (admin only)
router.put('/:id/approve', authenticate, requireRole('admin'), [
  body('role').optional().isIn(['project_lead', 'researcher', 'viewer'])
], async (req, res, next) => {
  const client = await db.getClient();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    await client.query('BEGIN');

    // Get the application
    const appResult = await client.query(
      'SELECT * FROM applications WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );

    if (appResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: { message: 'Application not found' } });
    }

    const application = appResult.rows[0];

    if (application.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: { message: 'Application has already been reviewed' } });
    }

    // Use stored password if available (from registration), otherwise generate temp password
    let tempPassword = null;
    let passwordHash;
    if (application.password_hash) {
      passwordHash = application.password_hash;
    } else {
      tempPassword = crypto.randomBytes(16).toString('base64url');
      passwordHash = await bcrypt.hash(tempPassword, 12);
    }
    const role = req.body.role || 'viewer';

    // Create user account
    const userResult = await client.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role',
      [application.email, passwordHash, application.first_name, application.last_name, role]
    );

    // Create default preferences for new user
    await client.query(
      'INSERT INTO user_preferences (user_id) VALUES ($1)',
      [userResult.rows[0].id]
    );

    // Update application status
    await client.query(
      'UPDATE applications SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['approved', req.user.id, req.params.id]
    );

    await client.query('COMMIT');

    // Log admin action
    await logAdminAction(req, 'approve_application', 'application', req.params.id,
      { status: 'pending' },
      { status: 'approved', created_user_id: userResult.rows[0].id }
    );

    const response = {
      message: tempPassword
        ? 'Application approved. User account created. Temporary password has been set.'
        : 'Application approved. User account created.',
      user: userResult.rows[0]
    };
    res.json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// Reject application (admin only)
router.put('/:id/reject', authenticate, requireRole('admin'), [
  body('reason').optional().trim()
], async (req, res, next) => {
  try {
    const { reason } = req.body;

    // Get current application state for audit
    const current = await db.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Application not found' } });
    }

    if (current.rows[0].status !== 'pending') {
      return res.status(400).json({ error: { message: 'Application has already been reviewed' } });
    }

    const result = await db.query(
      `UPDATE applications
       SET status = 'rejected', rejection_reason = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [reason || null, req.user.id, req.params.id]
    );

    // Log admin action
    await logAdminAction(req, 'reject_application', 'application', req.params.id,
      { status: 'pending' },
      { status: 'rejected', rejection_reason: reason }
    );

    res.json({
      application: result.rows[0],
      message: 'Application rejected'
    });
  } catch (error) {
    next(error);
  }
});

// Update admin notes (admin only)
router.put('/:id/notes', authenticate, requireRole('admin'), [
  body('notes').trim()
], async (req, res, next) => {
  try {
    const { notes } = req.body;

    const result = await db.query(
      'UPDATE applications SET admin_notes = $1 WHERE id = $2 RETURNING *',
      [notes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Application not found' } });
    }

    res.json({ application: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Delete application (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const current = await db.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Application not found' } });
    }

    await db.query('DELETE FROM applications WHERE id = $1', [req.params.id]);

    // Log admin action
    await logAdminAction(req, 'delete_application', 'application', req.params.id,
      current.rows[0], null
    );

    res.json({ message: 'Application deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Bulk approve/reject (admin only)
router.post('/bulk', authenticate, requireRole('admin'), [
  body('ids').isArray({ min: 1 }),
  body('ids.*').isUUID(),
  body('action').isIn(['approve', 'reject']),
  body('reason').optional().trim()
], async (req, res, next) => {
  const client = await db.getClient();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { ids, action, reason } = req.body;
    await client.query('BEGIN');

    const results = { success: [], failed: [] };

    for (const id of ids) {
      try {
        const appResult = await client.query(
          'SELECT * FROM applications WHERE id = $1 AND status = $2 FOR UPDATE',
          [id, 'pending']
        );

        if (appResult.rows.length === 0) {
          results.failed.push({ id, reason: 'Not found or already reviewed' });
          continue;
        }

        const application = appResult.rows[0];

        if (action === 'approve') {
          let tempPassword = null;
          let passwordHash;
          if (application.password_hash) {
            passwordHash = application.password_hash;
          } else {
            tempPassword = crypto.randomBytes(16).toString('base64url');
            passwordHash = await bcrypt.hash(tempPassword, 12);
          }

          const userResult = await client.query(
            'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [application.email, passwordHash, application.first_name, application.last_name, 'viewer']
          );

          await client.query(
            'INSERT INTO user_preferences (user_id) VALUES ($1)',
            [userResult.rows[0].id]
          );

          await client.query(
            'UPDATE applications SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP WHERE id = $3',
            ['approved', req.user.id, id]
          );

          const successEntry = { id, userId: userResult.rows[0].id };
          if (tempPassword) {
            successEntry.message = 'Temporary password has been set.';
          }
          results.success.push(successEntry);
        } else {
          await client.query(
            `UPDATE applications SET status = 'rejected', rejection_reason = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [reason || null, req.user.id, id]
          );
          results.success.push({ id });
        }
      } catch (err) {
        results.failed.push({ id, reason: err.message });
      }
    }

    await client.query('COMMIT');

    res.json({
      message: `Bulk ${action} completed`,
      results
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
