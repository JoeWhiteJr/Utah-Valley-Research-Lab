const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Configure multer for cover image uploads
const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'), 'covers');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const coverUpload = multer({
  storage: coverStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /^(jpeg|jpg|png|gif|webp)$/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase().replace('.', ''));
    const mime = allowed.test(file.mimetype.split('/')[1]);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get all projects
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status } = req.query;
    const validStatuses = ['active', 'completed', 'archived', 'inactive'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: { message: 'Invalid status filter' } });
    }

    let query = `
      SELECT p.*, u.name as creator_name,
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id) as total_actions,
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND completed = true) as completed_actions,
        CASE
          WHEN (SELECT COUNT(*) FROM action_items WHERE project_id = p.id) = 0 THEN 0
          ELSE ROUND(
            (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND completed = true)::numeric /
            (SELECT COUNT(*) FROM action_items WHERE project_id = p.id)::numeric * 100
          )
        END as calculated_progress
      FROM projects p
      JOIN users u ON p.created_by = u.id
    `;
    const params = [];

    if (status) {
      query += ' WHERE p.status = $1';
      params.push(status);
    }

    query += ' ORDER BY p.updated_at DESC';

    const result = await db.query(query, params);
    // Override progress with auto-calculated value from tasks
    const projects = result.rows.map(p => ({
      ...p,
      progress: parseInt(p.calculated_progress) || 0
    }));
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

// Get single project
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT p.*, u.name as creator_name,
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id) as total_actions,
        (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND completed = true) as completed_actions,
        CASE
          WHEN (SELECT COUNT(*) FROM action_items WHERE project_id = p.id) = 0 THEN 0
          ELSE ROUND(
            (SELECT COUNT(*) FROM action_items WHERE project_id = p.id AND completed = true)::numeric /
            (SELECT COUNT(*) FROM action_items WHERE project_id = p.id)::numeric * 100
          )
        END as calculated_progress
      FROM projects p
      JOIN users u ON p.created_by = u.id
      WHERE p.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    const project = {
      ...result.rows[0],
      progress: parseInt(result.rows[0].calculated_progress) || 0
    };
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

// Create project
router.post('/', authenticate, requireRole('admin', 'project_lead'), [
  body('title').trim().notEmpty(),
  body('description').optional().trim()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, description, header_image } = req.body;

    const result = await db.query(
      'INSERT INTO projects (title, description, header_image, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description || null, header_image || null, req.user.id]
    );

    res.status(201).json({ project: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Update project
router.put('/:id', authenticate, requireRole('admin', 'project_lead'), [
  body('title').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('status').optional().isIn(['active', 'completed', 'archived', 'inactive']),
  body('progress').optional().isInt({ min: 0, max: 100 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, description, header_image, status, progress } = req.body;

    // Only admins can update title, status, and progress
    if (req.user.role !== 'admin') {
      if (title !== undefined || status !== undefined || progress !== undefined) {
        return res.status(403).json({ error: { message: 'Only admins can edit title, status, and progress' } });
      }
    }

    const existing = await db.query('SELECT id FROM projects WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) { updates.push(`title = $${paramCount++}`); values.push(title); }
    if (description !== undefined) { updates.push(`description = $${paramCount++}`); values.push(description); }
    if (header_image !== undefined) { updates.push(`header_image = $${paramCount++}`); values.push(header_image); }
    if (status !== undefined) { updates.push(`status = $${paramCount++}`); values.push(status); }
    if (progress !== undefined) { updates.push(`progress = $${paramCount++}`); values.push(progress); }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ project: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Upload cover image
router.post('/:id/cover', authenticate, requireRole('admin', 'project_lead'), coverUpload.single('cover'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No image file provided' } });
    }

    const existing = await db.query('SELECT id FROM projects WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    const imageUrl = `/uploads/covers/${req.file.filename}`;
    await db.query(
      'UPDATE projects SET header_image = $1 WHERE id = $2',
      [imageUrl, req.params.id]
    );

    // Return full project with creator_name to match the shape expected by the frontend
    const result = await db.query(`
      SELECT p.*, u.name as creator_name
      FROM projects p
      JOIN users u ON p.created_by = u.id
      WHERE p.id = $1
    `, [req.params.id]);

    res.json({ project: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Delete project
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM projects WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
