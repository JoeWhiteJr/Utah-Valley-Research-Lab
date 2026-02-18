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
    const search = req.query.search;

    let countQuery = 'SELECT COUNT(*) FROM notes WHERE project_id = $1 AND deleted_at IS NULL';
    let countParams = [req.params.projectId];

    if (search) {
      countQuery += ' AND (title ILIKE $2 OR regexp_replace(content, \'<[^>]*>\', \'\', \'g\') ILIKE $2)';
      countParams.push(`%${search}%`);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    let selectQuery = `
      SELECT n.*, u.name as creator_name,
        CASE WHEN np.id IS NOT NULL THEN true ELSE false END as is_pinned,
        n.pinned_for_project
      FROM notes n
      JOIN users u ON n.created_by = u.id
      LEFT JOIN note_pins np ON np.note_id = n.id AND np.user_id = $2
      WHERE n.project_id = $1 AND n.deleted_at IS NULL
    `;
    let selectParams = [req.params.projectId, req.user.id];

    if (search) {
      selectQuery += ` AND (n.title ILIKE $4 OR regexp_replace(n.content, '<[^>]*>', '', 'g') ILIKE $4)`;
      selectQuery += `
      ORDER BY n.pinned_for_project DESC NULLS LAST, CASE WHEN np.id IS NOT NULL THEN 0 ELSE 1 END, n.updated_at DESC
      LIMIT $3 OFFSET $5`;
      selectParams.push(limit, `%${search}%`, offset);
    } else {
      selectQuery += `
      ORDER BY n.pinned_for_project DESC NULLS LAST, CASE WHEN np.id IS NOT NULL THEN 0 ELSE 1 END, n.updated_at DESC
      LIMIT $3 OFFSET $4`;
      selectParams.push(limit, offset);
    }

    const result = await db.query(selectQuery, selectParams);

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

// Toggle personal pin
router.post('/:id/pin', authenticate, async (req, res, next) => {
  try {
    const noteCheck = await db.query('SELECT id FROM notes WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (noteCheck.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Note not found' } });
    }

    const existing = await db.query(
      'SELECT id FROM note_pins WHERE user_id = $1 AND note_id = $2',
      [req.user.id, req.params.id]
    );

    if (existing.rows.length > 0) {
      await db.query('DELETE FROM note_pins WHERE user_id = $1 AND note_id = $2', [req.user.id, req.params.id]);
      res.json({ pinned: false });
    } else {
      await db.query('INSERT INTO note_pins (user_id, note_id) VALUES ($1, $2)', [req.user.id, req.params.id]);
      res.json({ pinned: true });
    }
  } catch (error) {
    next(error);
  }
});

// Toggle project pin (admin/lead only)
router.post('/:id/pin-project', authenticate, async (req, res, next) => {
  try {
    const note = await db.query('SELECT id, project_id, pinned_for_project FROM notes WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (note.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Note not found' } });
    }

    // Check permission - must be admin or project lead
    if (req.user.role !== 'admin') {
      const projectMember = await db.query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [note.rows[0].project_id, req.user.id]
      );
      if (projectMember.rows.length === 0 || projectMember.rows[0].role !== 'lead') {
        return res.status(403).json({ error: { message: 'Only project leads or admins can pin notes for the project' } });
      }
    }

    const newPinned = !note.rows[0].pinned_for_project;
    await db.query(
      'UPDATE notes SET pinned_for_project = $1, pinned_by = $2, pinned_at = $3 WHERE id = $4',
      [newPinned, newPinned ? req.user.id : null, newPinned ? new Date() : null, req.params.id]
    );

    res.json({ pinned_for_project: newPinned });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
