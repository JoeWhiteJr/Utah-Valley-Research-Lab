const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireProjectAccess } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');

const router = express.Router();

// Get notes for a project
router.get('/project/:projectId', authenticate, requireProjectAccess(), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    const countResult = await db.query(
      'SELECT COUNT(*) FROM notes WHERE project_id = $1 AND deleted_at IS NULL',
      [req.params.projectId]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(`
      SELECT n.*, u.name as creator_name
      FROM notes n
      JOIN users u ON n.created_by = u.id
      WHERE n.project_id = $1 AND n.deleted_at IS NULL
      ORDER BY n.updated_at DESC
      LIMIT $2 OFFSET $3
    `, [req.params.projectId, limit, offset]);

    res.json({ notes: result.rows, total, limit, offset });
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
      WHERE n.id = $1 AND n.deleted_at IS NULL
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
router.post('/project/:projectId', authenticate, requireProjectAccess(), sanitizeBody('content'), [
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
      'INSERT INTO notes (project_id, title, content, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.projectId, title, content || null, req.user.id]
    );

    res.status(201).json({ note: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Update note
router.put('/:id', authenticate, sanitizeBody('content'), [
  body('title').optional().trim().notEmpty(),
  body('content').optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, content } = req.body;

    const existing = await db.query('SELECT id, project_id FROM notes WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Note not found' } });
    }

    // Verify project access
    const projectAccess = await db.query(
      `SELECT id FROM projects WHERE id = $1 AND (
        created_by = $2 OR
        EXISTS (SELECT 1 FROM action_items ai JOIN action_item_assignees aia ON aia.action_item_id = ai.id WHERE ai.project_id = $1 AND aia.user_id = $2)
      )`,
      [existing.rows[0].project_id, req.user.id]
    );
    if (projectAccess.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

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
    // Verify the note exists and get its project_id
    const existing = await db.query('SELECT project_id FROM notes WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Note not found' } });
    }

    // Verify project access
    const projectAccess = await db.query(
      `SELECT id FROM projects WHERE id = $1 AND (
        created_by = $2 OR
        EXISTS (SELECT 1 FROM action_items ai JOIN action_item_assignees aia ON aia.action_item_id = ai.id WHERE ai.project_id = $1 AND aia.user_id = $2)
      )`,
      [existing.rows[0].project_id, req.user.id]
    );
    if (projectAccess.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    await db.query('UPDATE notes SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2', [req.user.id, req.params.id]);

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
