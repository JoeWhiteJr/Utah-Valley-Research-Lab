const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get all categories for a project
router.get('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM action_items WHERE category_id = c.id) as action_count
      FROM categories c
      WHERE c.project_id = $1
      ORDER BY c.name ASC
    `, [req.params.projectId]);

    res.json({ categories: result.rows });
  } catch (error) {
    next(error);
  }
});

// Create category for a project
router.post('/project/:projectId', authenticate, [
  body('name').trim().notEmpty().isLength({ max: 50 }),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/)
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { name, color } = req.body;
    const projectId = req.params.projectId;

    // Check if project exists
    const projectCheck = await db.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    // Check for duplicate category name in this project
    const existingCheck = await db.query(
      'SELECT id FROM categories WHERE project_id = $1 AND LOWER(name) = LOWER($2)',
      [projectId, name]
    );
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: { message: 'A category with this name already exists in the project' } });
    }

    const result = await db.query(
      'INSERT INTO categories (project_id, name, color) VALUES ($1, $2, $3) RETURNING *',
      [projectId, name, color || '#6366f1']
    );

    res.status(201).json({ category: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Update category
router.put('/:id', authenticate, [
  body('name').optional().trim().notEmpty().isLength({ max: 50 }),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/)
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { name, color } = req.body;

    // Get existing category
    const existing = await db.query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Category not found' } });
    }

    const category = existing.rows[0];

    // If name is changing, check for duplicates
    if (name && name.toLowerCase() !== category.name.toLowerCase()) {
      const duplicateCheck = await db.query(
        'SELECT id FROM categories WHERE project_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
        [category.project_id, name, req.params.id]
      );
      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({ error: { message: 'A category with this name already exists in the project' } });
      }
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) { updates.push(`name = $${paramCount++}`); values.push(name); }
    if (color !== undefined) { updates.push(`color = $${paramCount++}`); values.push(color); }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ category: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Delete category
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Category not found' } });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
