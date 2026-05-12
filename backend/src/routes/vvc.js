const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');
const { createUploader } = require('../middleware/uploads');

const router = express.Router();

// VVC video uploads — 2GB. Extension allowlist added during multer
// consolidation (factory enforces ext + MIME).
const videoUpload = createUploader({
  subdir: 'video',
  maxBytes: 2 * 1024 * 1024 * 1024,
  allowedMimes: ['video/mp4', 'video/webm', 'video/quicktime'],
  allowedExts: ['.mp4', '.webm', '.mov']
});

// VVC session image uploads — 20MB.
const imageUpload = createUploader({
  subdir: 'vvc-images',
  maxBytes: 20 * 1024 * 1024,
  allowedMimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'],
  allowedExts: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif']
});

// VVC project screenshot uploads — 20MB.
const screenshotUpload = createUploader({
  subdir: 'vvc-screenshots',
  maxBytes: 20 * 1024 * 1024,
  allowedMimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  allowedExts: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
});

// ============================================================
// SESSION ROUTES
// ============================================================

// List all sessions (ordered by session_date DESC)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM vvc_sessions
       WHERE deleted_at IS NULL
       ORDER BY session_date DESC NULLS LAST, created_at DESC`
    );
    res.json({ sessions: result.rows });
  } catch (error) {
    next(error);
  }
});

// Create session
router.post('/', authenticate, requireRole('admin'), [
  body('title').trim().notEmpty(),
  body('description').optional(),
  body('session_date').optional({ values: 'falsy' }).isISO8601(),
  body('video_url').optional({ values: 'falsy' }).isURL()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, description, session_date, video_url } = req.body;

    const result = await db.query(
      `INSERT INTO vvc_sessions (title, description, session_date, video_url, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, description || null, session_date || null, video_url || null, req.user.id]
    );

    res.status(201).json({ session: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Update session
router.put('/:id', authenticate, requireRole('admin'), sanitizeBody('notes'), [
  body('title').optional().trim().notEmpty(),
  body('description').optional(),
  body('session_date').optional({ values: 'falsy' }).isISO8601(),
  body('video_url').optional({ values: 'falsy' }),
  body('transcript').optional(),
  body('summary').optional(),
  body('notes').optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const existing = await db.query(
      'SELECT id FROM vvc_sessions WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Session not found' } });
    }

    const { title, description, session_date, video_url, transcript, summary, notes } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) { updates.push(`title = $${paramCount++}`); values.push(title); }
    if (description !== undefined) { updates.push(`description = $${paramCount++}`); values.push(description); }
    if (session_date !== undefined) { updates.push(`session_date = $${paramCount++}`); values.push(session_date || null); }
    if (video_url !== undefined) { updates.push(`video_url = $${paramCount++}`); values.push(video_url || null); }
    if (transcript !== undefined) { updates.push(`transcript = $${paramCount++}`); values.push(transcript); }
    if (summary !== undefined) { updates.push(`summary = $${paramCount++}`); values.push(summary); }
    if (notes !== undefined) { updates.push(`notes = $${paramCount++}`); values.push(notes); }

    if (values.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE vvc_sessions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ session: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Soft delete session
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const existing = await db.query(
      'SELECT id FROM vvc_sessions WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Session not found' } });
    }

    await db.query(
      'UPDATE vvc_sessions SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2',
      [req.user.id, req.params.id]
    );

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Upload video file
router.put('/:id/video', authenticate, requireRole('admin'), videoUpload.single('video'), async (req, res, next) => {
  try {
    const existing = await db.query(
      'SELECT id FROM vvc_sessions WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: { message: 'Session not found' } });
    }

    if (!req.file) {
      return res.status(400).json({ error: { message: 'No video file provided' } });
    }

    const result = await db.query(
      'UPDATE vvc_sessions SET video_path = $1 WHERE id = $2 RETURNING *',
      [req.file.path, req.params.id]
    );

    res.json({ session: result.rows[0] });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(error);
  }
});

// Stream video with range request support
router.get('/:id/video', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT video_path FROM vvc_sessions WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Session not found' } });
    }

    const videoPath = result.rows[0].video_path;

    if (!videoPath) {
      return res.status(404).json({ error: { message: 'No video file for this session' } });
    }

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: { message: 'Video file not found on server' } });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const ext = path.extname(videoPath).toLowerCase();

    const contentTypes = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime'
    };
    const contentType = contentTypes[ext] || 'video/mp4';

    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      const file = fs.createReadStream(videoPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });

      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType
      });

      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    next(error);
  }
});

// Upload images to a session (admin only)
router.post('/:id/images', authenticate, requireRole('admin'), imageUpload.array('images', 10), async (req, res, next) => {
  try {
    const existing = await db.query(
      'SELECT id, images FROM vvc_sessions WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      if (req.files) req.files.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(404).json({ error: { message: 'Session not found' } });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: { message: 'No image files provided' } });
    }

    const currentImages = existing.rows[0].images || [];
    const newImages = req.files.map(f => ({
      id: uuidv4(),
      path: f.path,
      filename: f.originalname,
      uploaded_at: new Date().toISOString()
    }));

    const allImages = [...currentImages, ...newImages];

    const result = await db.query(
      'UPDATE vvc_sessions SET images = $1::jsonb WHERE id = $2 RETURNING *',
      [JSON.stringify(allImages), req.params.id]
    );

    res.json({ session: result.rows[0] });
  } catch (error) {
    if (req.files) req.files.forEach(f => fs.unlink(f.path, () => {}));
    next(error);
  }
});

// Serve a session image
router.get('/:id/images/:imageId', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT images FROM vvc_sessions WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Session not found' } });
    }

    const images = result.rows[0].images || [];
    const image = images.find(img => img.id === req.params.imageId);

    if (!image || !image.path) {
      return res.status(404).json({ error: { message: 'Image not found' } });
    }

    if (!fs.existsSync(image.path)) {
      return res.status(404).json({ error: { message: 'Image file not found on server' } });
    }

    const ext = path.extname(image.path).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.gif': 'image/gif',
      '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif'
    };
    res.setHeader('Content-Type', contentTypes[ext] || 'image/jpeg');
    fs.createReadStream(image.path).pipe(res);
  } catch (error) {
    next(error);
  }
});

// Delete a session image (admin only)
router.delete('/:id/images/:imageId', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const existing = await db.query(
      'SELECT id, images FROM vvc_sessions WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Session not found' } });
    }

    const images = existing.rows[0].images || [];
    const image = images.find(img => img.id === req.params.imageId);
    if (!image) {
      return res.status(404).json({ error: { message: 'Image not found' } });
    }

    // Delete file from disk
    if (image.path && fs.existsSync(image.path)) {
      fs.unlink(image.path, () => {});
    }

    const updatedImages = images.filter(img => img.id !== req.params.imageId);
    const result = await db.query(
      'UPDATE vvc_sessions SET images = $1::jsonb WHERE id = $2 RETURNING *',
      [JSON.stringify(updatedImages), req.params.id]
    );

    res.json({ session: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// RESOURCES ROUTES
// ============================================================

// Get VVC resources from site_content
router.get('/resources', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT key, value FROM site_content WHERE section = 'vvc_resources' ORDER BY key"
    );
    const resources = {};
    result.rows.forEach(row => {
      resources[row.key] = row.value;
    });
    res.json({ resources });
  } catch (error) {
    next(error);
  }
});

// Update VVC resources in site_content
router.put('/resources', authenticate, requireRole('admin'), [
  body('key').trim().notEmpty(),
  body('value').notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { key, value } = req.body;

    await db.query(
      `INSERT INTO site_content (section, key, value)
       VALUES ('vvc_resources', $1, $2::jsonb)
       ON CONFLICT (section, key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );

    res.json({ message: 'Resource updated' });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// MEMBER PROJECTS ROUTES
// ============================================================

// List all projects (any authenticated member)
router.get('/projects', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT p.*, u.name as author_name, u.avatar_url as author_avatar
       FROM vvc_projects p
       JOIN users u ON u.id = p.created_by
       WHERE p.deleted_at IS NULL
       ORDER BY p.created_at DESC`
    );
    res.json({ projects: result.rows });
  } catch (error) {
    next(error);
  }
});

// Create project (any authenticated member)
router.post('/projects', authenticate, [
  body('title').trim().notEmpty(),
  body('description').optional(),
  body('project_url').optional({ values: 'falsy' }).isURL()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, description, project_url } = req.body;

    const result = await db.query(
      `INSERT INTO vvc_projects (title, description, project_url, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, description || null, project_url || null, req.user.id]
    );

    res.status(201).json({ project: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Update project (owner or admin)
router.put('/projects/:id', authenticate, [
  body('title').optional().trim().notEmpty(),
  body('description').optional(),
  body('project_url').optional({ values: 'falsy' })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const existing = await db.query(
      'SELECT id, created_by FROM vvc_projects WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    // Only owner or admin can edit
    if (existing.rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: { message: 'Not authorized to edit this project' } });
    }

    const { title, description, project_url } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) { updates.push(`title = $${paramCount++}`); values.push(title); }
    if (description !== undefined) { updates.push(`description = $${paramCount++}`); values.push(description); }
    if (project_url !== undefined) { updates.push(`project_url = $${paramCount++}`); values.push(project_url || null); }

    if (values.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE vvc_projects SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ project: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Delete project (owner or admin)
router.delete('/projects/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await db.query(
      'SELECT id, created_by FROM vvc_projects WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    // Only owner or admin can delete
    if (existing.rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: { message: 'Not authorized to delete this project' } });
    }

    await db.query(
      'UPDATE vvc_projects SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2',
      [req.user.id, req.params.id]
    );

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Upload screenshot for a project (owner or admin)
router.put('/projects/:id/screenshot', authenticate, screenshotUpload.single('screenshot'), async (req, res, next) => {
  try {
    const existing = await db.query(
      'SELECT id, created_by FROM vvc_projects WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    if (existing.rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: { message: 'Not authorized' } });
    }

    if (!req.file) {
      return res.status(400).json({ error: { message: 'No screenshot file provided' } });
    }

    const result = await db.query(
      'UPDATE vvc_projects SET screenshot_path = $1 WHERE id = $2 RETURNING *',
      [req.file.path, req.params.id]
    );

    res.json({ project: result.rows[0] });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(error);
  }
});

// Serve project screenshot
router.get('/projects/:id/screenshot', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT screenshot_path FROM vvc_projects WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    const screenshotPath = result.rows[0].screenshot_path;

    if (!screenshotPath) {
      return res.status(404).json({ error: { message: 'No screenshot for this project' } });
    }

    if (!fs.existsSync(screenshotPath)) {
      return res.status(404).json({ error: { message: 'Screenshot file not found on server' } });
    }

    const ext = path.extname(screenshotPath).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp'
    };
    res.setHeader('Content-Type', contentTypes[ext] || 'image/jpeg');
    fs.createReadStream(screenshotPath).pipe(res);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
