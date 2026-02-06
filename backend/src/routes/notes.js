const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router();

// Get notes for a project
router.get('/project/:projectId', authenticate, requireProjectAccess(), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT n.*, u.name as creator_name
      FROM notes n
      JOIN users u ON n.created_by = u.id
      WHERE n.project_id = $1
      ORDER BY n.updated_at DESC
    `, [req.params.projectId]);

    res.json({ notes: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get single note
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT n.*, u.name as creator_name
      FROM notes n
      JOIN users u ON n.created_by = u.id
      WHERE n.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Note not found' } });
    }

    res.json({ note: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Create note
router.post('/project/:projectId', authenticate, requireProjectAccess(), [
  body('title').trim().notEmpty(),
  body('content').optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, content } = req.body;

    const result = await db.query(
      'INSERT INTO notes (project_id, title, content, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.projectId, title, content || null, req.user.id]
    );

    res.status(201).json({ note: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Update note
router.put('/:id', authenticate, [
  body('title').optional().trim().notEmpty(),
  body('content').optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, content } = req.body;

    const existing = await db.query('SELECT id FROM notes WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Note not found' } });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    updates.push('updated_at = CURRENT_TIMESTAMP');

    if (title !== undefined) { updates.push(`title = $${paramCount++}`); values.push(title); }
    if (content !== undefined) { updates.push(`content = $${paramCount++}`); values.push(content); }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE notes SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ note: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Delete note
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM notes WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Note not found' } });
    }

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
