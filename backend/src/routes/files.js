const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/mp4',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'application/zip',
      'application/x-rar-compressed'
    ];
    if (allowedTypes.includes(file.mimetype) ||
        file.mimetype.startsWith('image/') ||
        file.mimetype.startsWith('audio/') ||
        file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Get files for a project
router.get('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT f.*, u.name as uploader_name
      FROM files f
      JOIN users u ON f.uploaded_by = u.id
      WHERE f.project_id = $1
      ORDER BY f.uploaded_at DESC
    `, [req.params.projectId]);

    res.json({ files: result.rows });
  } catch (error) {
    next(error);
  }
});

// Upload file
router.post('/project/:projectId', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No file uploaded' } });
    }

    const result = await db.query(
      `INSERT INTO files (project_id, filename, original_filename, storage_path, file_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        req.params.projectId,
        req.file.filename,
        req.file.originalname,
        req.file.path,
        req.file.mimetype,
        req.file.size,
        req.user.id
      ]
    );

    res.status(201).json({ file: result.rows[0] });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    next(error);
  }
});

// Download file
router.get('/:id/download', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM files WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'File not found' } });
    }

    const file = result.rows[0];
    res.download(file.storage_path, file.original_filename);
  } catch (error) {
    next(error);
  }
});

// Delete file
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM files WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'File not found' } });
    }

    const file = result.rows[0];

    // Delete from database
    await db.query('DELETE FROM files WHERE id = $1', [req.params.id]);

    // Delete physical file
    fs.unlink(file.storage_path, (err) => {
      if (err) console.error('Error deleting file:', err);
    });

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
