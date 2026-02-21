const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, optionalAuthenticate, requireRole } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');
const logger = require('../config/logger');

const router = express.Router();

// Rate limiter for public submissions
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: { message: 'Too many submissions. Please try again later.' } }
});

// POST / — submit a recommendation (public, optionally authenticated)
router.post('/',
  submitLimiter,
  optionalAuthenticate,
  sanitizeBody('message', 'submitter_name'),
  [
    body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 5000 }).withMessage('Message too long'),
    body('submitter_name').optional().trim().isLength({ max: 255 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg } });
      }

      const { message, submitter_name } = req.body;
      const userId = req.user?.id || null;
      const name = req.user?.name || submitter_name || 'Anonymous';

      const result = await db.query(
        `INSERT INTO recommendations (message, submitter_name, submitter_user_id)
         VALUES ($1, $2, $3) RETURNING id, created_at`,
        [message, name, userId]
      );

      logger.info({ id: result.rows[0].id, submitter: name }, 'New recommendation submitted');
      res.status(201).json({ message: 'Thank you for your suggestion!', id: result.rows[0].id });
    } catch (error) {
      next(error);
    }
  }
);

// GET / — list recommendations (admin only)
router.get('/',
  authenticate,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const { status, priority, limit = 20, offset = 0 } = req.query;

      const conditions = [];
      const params = [];
      let paramIndex = 1;

      if (status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(status);
      }
      if (priority) {
        conditions.push(`priority = $${paramIndex++}`);
        params.push(priority);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await db.query(
        `SELECT COUNT(*) FROM recommendations ${where}`,
        params
      );

      params.push(parseInt(limit));
      params.push(parseInt(offset));

      const result = await db.query(
        `SELECT r.*, u.name as user_name, u.avatar_url as user_avatar
         FROM recommendations r
         LEFT JOIN users u ON r.submitter_user_id = u.id
         ${where}
         ORDER BY r.created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        params
      );

      res.json({
        recommendations: result.rows,
        total: parseInt(countResult.rows[0].count)
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /new-count — count of new recommendations (admin only)
router.get('/new-count',
  authenticate,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const result = await db.query(
        "SELECT COUNT(*) FROM recommendations WHERE status = 'new'"
      );
      res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /:id — update a recommendation (admin only)
router.put('/:id',
  authenticate,
  requireRole('admin'),
  sanitizeBody('admin_notes'),
  [
    param('id').isUUID(),
    body('status').optional().isIn(['new', 'in_progress', 'completed']),
    body('priority').optional().isIn(['low', 'medium', 'high']),
    body('admin_notes').optional().trim()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg } });
      }

      const { id } = req.params;
      const { status, priority, admin_notes } = req.body;

      const fields = [];
      const params = [];
      let paramIndex = 1;

      if (status !== undefined) { fields.push(`status = $${paramIndex++}`); params.push(status); }
      if (priority !== undefined) { fields.push(`priority = $${paramIndex++}`); params.push(priority); }
      if (admin_notes !== undefined) { fields.push(`admin_notes = $${paramIndex++}`); params.push(admin_notes); }

      if (fields.length === 0) {
        return res.status(400).json({ error: { message: 'No fields to update' } });
      }

      params.push(id);
      const result = await db.query(
        `UPDATE recommendations SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Recommendation not found' } });
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /:id — delete a recommendation (admin only)
router.delete('/:id',
  authenticate,
  requireRole('admin'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: { message: errors.array()[0].msg } });
      }

      const result = await db.query(
        'DELETE FROM recommendations WHERE id = $1 RETURNING id',
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Recommendation not found' } });
      }

      res.json({ message: 'Recommendation deleted' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
