const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get all action items assigned to current user
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT a.*, u.name as assigned_name, p.title as project_title,
        c.name as category_name, c.color as category_color
      FROM action_items a
      LEFT JOIN users u ON a.assigned_to = u.id
      LEFT JOIN projects p ON a.project_id = p.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.assigned_to = $1
      ORDER BY a.completed ASC, a.due_date ASC NULLS LAST, a.created_at DESC
    `, [req.user.id]);

    res.json({ actions: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get action items for a project
router.get('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT a.*, u.name as assigned_name,
        c.name as category_name, c.color as category_color
      FROM action_items a
      LEFT JOIN users u ON a.assigned_to = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.project_id = $1
      ORDER BY a.sort_order ASC, a.created_at ASC
    `, [req.params.projectId]);

    res.json({ actions: result.rows });
  } catch (error) {
    next(error);
  }
});

// Create action item
router.post('/project/:projectId', authenticate, [
  body('title').trim().notEmpty(),
  body('due_date').optional().isISO8601(),
  body('assigned_to').optional().isUUID(),
  body('category_id').optional({ nullable: true }).isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, due_date, assigned_to, category_id } = req.body;
    const projectId = req.params.projectId;

    // Get max sort order
    const orderResult = await db.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM action_items WHERE project_id = $1',
      [projectId]
    );

    const result = await db.query(
      'INSERT INTO action_items (project_id, title, due_date, assigned_to, category_id, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [projectId, title, due_date || null, assigned_to || null, category_id || null, orderResult.rows[0].next_order]
    );

    // Fetch with category info
    const actionWithCategory = await db.query(`
      SELECT a.*, c.name as category_name, c.color as category_color
      FROM action_items a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id = $1
    `, [result.rows[0].id]);

    res.status(201).json({ action: actionWithCategory.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Reorder action items (must be before /:id route)
router.put('/reorder', authenticate, [
  body('items').isArray(),
  body('items.*.id').isUUID(),
  body('items.*.sort_order').isInt({ min: 0 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { items } = req.body;
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      for (const item of items) {
        await client.query(
          'UPDATE action_items SET sort_order = $1 WHERE id = $2',
          [item.sort_order, item.id]
        );
      }

      await client.query('COMMIT');
      res.json({ message: 'Reorder successful' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// Update action item
router.put('/:id', authenticate, [
  body('title').optional().trim().notEmpty(),
  body('completed').optional().isBoolean(),
  body('due_date').optional({ nullable: true }).isISO8601(),
  body('assigned_to').optional({ nullable: true }).isUUID(),
  body('category_id').optional({ nullable: true }).isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, completed, due_date, assigned_to, category_id } = req.body;

    const existing = await db.query('SELECT id FROM action_items WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Action item not found' } });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) { updates.push(`title = $${paramCount++}`); values.push(title); }
    if (completed !== undefined) { updates.push(`completed = $${paramCount++}`); values.push(completed); }
    if (due_date !== undefined) { updates.push(`due_date = $${paramCount++}`); values.push(due_date); }
    if (assigned_to !== undefined) { updates.push(`assigned_to = $${paramCount++}`); values.push(assigned_to); }
    if (category_id !== undefined) { updates.push(`category_id = $${paramCount++}`); values.push(category_id); }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    values.push(req.params.id);
    await db.query(
      `UPDATE action_items SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    // Fetch with category info
    const result = await db.query(`
      SELECT a.*, u.name as assigned_name, c.name as category_name, c.color as category_color
      FROM action_items a
      LEFT JOIN users u ON a.assigned_to = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id = $1
    `, [req.params.id]);

    res.json({ action: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Delete action item
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM action_items WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Action item not found' } });
    }

    res.json({ message: 'Action item deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
