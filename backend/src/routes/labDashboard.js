const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { body, param, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Configure multer for resource file uploads
const resourceUploadDir = path.join(
  process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
  'resources'
);

const resourceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(resourceUploadDir)) {
      fs.mkdirSync(resourceUploadDir, { recursive: true });
    }
    cb(null, resourceUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const resourceUpload = multer({
  storage: resourceStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// All routes require authentication
router.use(authenticate);

// ─── News ───────────────────────────────────────────────────────────

// GET /api/lab-dashboard/news
router.get('/news', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT n.*, u.name as author_name, u.avatar_url as author_avatar
       FROM lab_news n
       JOIN users u ON n.created_by = u.id
       ORDER BY n.created_at DESC`
    );
    res.json({ news: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/lab-dashboard/news
router.post('/news', requireRole('admin'), [
  body('title').trim().notEmpty().isLength({ max: 255 }),
  body('body').optional().trim(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, body: newsBody } = req.body;
    const result = await db.query(
      `INSERT INTO lab_news (title, body, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [title, newsBody || null, req.user.id]
    );

    // Fetch with author info
    const full = await db.query(
      `SELECT n.*, u.name as author_name, u.avatar_url as author_avatar
       FROM lab_news n JOIN users u ON n.created_by = u.id
       WHERE n.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json({ item: full.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PUT /api/lab-dashboard/news/:id
router.put('/news/:id', requireRole('admin'), [
  param('id').isUUID(),
  body('title').optional().trim().notEmpty().isLength({ max: 255 }),
  body('body').optional().trim().notEmpty(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { id } = req.params;
    const { title, body: newsBody } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) { updates.push(`title = $${paramCount++}`); values.push(title); }
    if (newsBody !== undefined) { updates.push(`body = $${paramCount++}`); values.push(newsBody); }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE lab_news SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'News item not found' } });
    }

    // Fetch with author info
    const full = await db.query(
      `SELECT n.*, u.name as author_name, u.avatar_url as author_avatar
       FROM lab_news n JOIN users u ON n.created_by = u.id
       WHERE n.id = $1`,
      [id]
    );

    res.json({ item: full.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/lab-dashboard/news/:id
router.delete('/news/:id', requireRole('admin'), [
  param('id').isUUID(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const result = await db.query(
      'DELETE FROM lab_news WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'News item not found' } });
    }

    res.json({ message: 'News item deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── Content (site_content for lab_dashboard section) ───────────────

// GET /api/lab-dashboard/content
router.get('/content', async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT key, value FROM site_content WHERE section = 'lab_dashboard'"
    );

    const content = {};
    for (const row of result.rows) {
      content[row.key] = row.value;
    }

    res.json({ content });
  } catch (error) {
    next(error);
  }
});

// PUT /api/lab-dashboard/content
router.put('/content', requireRole('admin'), [
  body('key').isString().trim().notEmpty().isLength({ max: 100 }),
  body('value').exists(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { key, value } = req.body;

    const result = await db.query(
      `INSERT INTO site_content (section, key, value, updated_by)
       VALUES ('lab_dashboard', $1, $2, $3)
       ON CONFLICT (section, key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING *`,
      [key, JSON.stringify(value), req.user.id]
    );

    res.json({ content: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ─── Resource File Uploads ──────────────────────────────────────────

// POST /api/lab-dashboard/resources/upload  (admin only)
router.post('/resources/upload', requireRole('admin'), (req, res, next) => {
  resourceUpload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: { message: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 50 MB)' : err.message } });
      }
      return res.status(400).json({ error: { message: err.message || 'Upload failed' } });
    }
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No file provided' } });
    }
    res.status(201).json({
      file: {
        url: `/uploads/resources/${req.file.filename}`,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
      }
    });
  });
});

// DELETE /api/lab-dashboard/resources/file/:filename  (admin only)
router.delete('/resources/file/:filename', requireRole('admin'), (req, res) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const filePath = path.join(resourceUploadDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: { message: 'File not found' } });
  }

  fs.unlinkSync(filePath);
  res.json({ message: 'File deleted' });
});

module.exports = router;
