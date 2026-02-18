const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');

const router = express.Router();

// List user's personal notes
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM personal_notes
       WHERE created_by = $1 AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [req.user.id]
    );

    res.json({ notes: result.rows });
  } catch (error) {
    next(error);
  }
});

// Create personal note
router.post('/', authenticate, sanitizeBody('content'), [
  body('title').trim().notEmpty(),
  body('content').optional().isLength({ max: 50000 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, content } = req.body;

    const result = await db.query(
      'INSERT INTO personal_notes (title, content, created_by) VALUES ($1, $2, $3) RETURNING *',
      [title, content || null, req.user.id]
    );

    res.status(201).json({ note: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Update personal note
router.put('/:id', authenticate, sanitizeBody('content'), [
  body('title').optional().trim().notEmpty(),
  body('content').optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const existing = await db.query(
      'SELECT id FROM personal_notes WHERE id = $1 AND created_by = $2 AND deleted_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Note not found' } });
    }

    const { title, content } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    updates.push('updated_at = CURRENT_TIMESTAMP');

    if (title !== undefined) { updates.push(`title = $${paramCount++}`); values.push(title); }
    if (content !== undefined) { updates.push(`content = $${paramCount++}`); values.push(content); }

    if (values.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE personal_notes SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ note: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Soft delete personal note
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await db.query(
      'SELECT id FROM personal_notes WHERE id = $1 AND created_by = $2 AND deleted_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Note not found' } });
    }

    await db.query(
      'UPDATE personal_notes SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2',
      [req.user.id, req.params.id]
    );

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
