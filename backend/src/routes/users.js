const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get all team members (for assignment dropdowns)
router.get('/team', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, name, role FROM users ORDER BY name ASC'
    );
    res.json({ users: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get user notification preferences
router.get('/preferences', authenticate, async (req, res, next) => {
  try {
    let result = await db.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [req.user.id]
    );

    // If no preferences exist, create default ones
    if (result.rows.length === 0) {
      result = await db.query(
        'INSERT INTO user_preferences (user_id) VALUES ($1) RETURNING *',
        [req.user.id]
      );
    }

    const prefs = result.rows[0];
    // Remove internal fields
    delete prefs.id;
    delete prefs.user_id;
    delete prefs.created_at;
    delete prefs.updated_at;

    res.json({ preferences: prefs });
  } catch (error) {
    next(error);
  }
});

// Update user notification preferences
router.put('/preferences', authenticate, [
  body('email_chat').optional().isBoolean(),
  body('email_applications').optional().isBoolean(),
  body('email_mentions').optional().isBoolean(),
  body('email_system').optional().isBoolean(),
  body('in_app_chat').optional().isBoolean(),
  body('in_app_applications').optional().isBoolean(),
  body('in_app_mentions').optional().isBoolean(),
  body('in_app_system').optional().isBoolean()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const allowedFields = [
      'email_chat', 'email_applications', 'email_mentions', 'email_system',
      'in_app_chat', 'in_app_applications', 'in_app_mentions', 'in_app_system'
    ];

    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramCount++}`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    // Upsert preferences
    values.push(req.user.id);
    const result = await db.query(`
      INSERT INTO user_preferences (user_id, ${allowedFields.filter(f => req.body[f] !== undefined).join(', ')})
      VALUES ($${paramCount}, ${values.slice(0, -1).map((_, i) => `$${i + 1}`).join(', ')})
      ON CONFLICT (user_id) DO UPDATE SET ${updates.join(', ')}
      RETURNING *
    `, values);

    const prefs = result.rows[0];
    delete prefs.id;
    delete prefs.user_id;
    delete prefs.created_at;
    delete prefs.updated_at;

    res.json({ preferences: prefs, message: 'Preferences updated' });
  } catch (error) {
    next(error);
  }
});

// Get user by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/profile', authenticate, [
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail().normalizeEmail()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { name, email } = req.body;

    // Check if email is already taken by another user
    if (email) {
      const existing = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, req.user.id]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: { message: 'Email already in use' } });
      }
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) { updates.push(`name = $${paramCount++}`); values.push(name); }
    if (email !== undefined) { updates.push(`email = $${paramCount++}`); values.push(email); }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    values.push(req.user.id);
    const result = await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, email, name, role`,
      values
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Change password
router.put('/password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { currentPassword, newPassword } = req.body;

    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: { message: 'Current password is incorrect' } });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Update user role (admin only)
router.put('/:id/role', authenticate, requireRole('admin'), [
  body('role').isIn(['admin', 'project_lead', 'researcher', 'viewer'])
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { role } = req.body;

    const result = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role',
      [role, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Delete user (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: { message: 'Cannot delete your own account' } });
    }

    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
