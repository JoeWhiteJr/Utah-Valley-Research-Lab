const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireRole, generateToken } = require('../middleware/auth');
const { logAdminAction } = require('../middleware/auditLog');

const router = express.Router();

// Submit application (public - no auth required)
router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('message').trim().notEmpty().withMessage('Message is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { name, email, message } = req.body;

    // Check if email already has a pending application
    const existing = await db.query(
      'SELECT id FROM applications WHERE email = $1 AND status = $2',
      [email, 'pending']
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: { message: 'An application with this email is already pending' } });
    }

    // Check if user already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: { message: 'An account with this email already exists' } });
    }

    const result = await db.query(
      'INSERT INTO applications (name, email, message) VALUES ($1, $2, $3) RETURNING *',
      [name, email, message]
    );

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

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const role = req.body.role || 'researcher';

    // Create user account
    const userResult = await client.query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
      [application.email, passwordHash, application.name, role]
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

    res.json({
      message: 'Application approved successfully',
      user: userResult.rows[0],
      temporaryPassword: tempPassword
    });
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
          const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
          const passwordHash = await bcrypt.hash(tempPassword, 12);

          const userResult = await client.query(
            'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
            [application.email, passwordHash, application.name, 'researcher']
          );

          await client.query(
            'INSERT INTO user_preferences (user_id) VALUES ($1)',
            [userResult.rows[0].id]
          );

          await client.query(
            'UPDATE applications SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP WHERE id = $3',
            ['approved', req.user.id, id]
          );

          results.success.push({ id, userId: userResult.rows[0].id, temporaryPassword: tempPassword });
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
