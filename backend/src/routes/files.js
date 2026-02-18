const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, requireProjectAccess } = require('../middleware/auth');
const { logAdminAction } = require('../middleware/auditLog');
const { indexFile } = require('../services/ragIndexingService');

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
    const allowedTypes = [
      'application/pdf', 'application/msword',
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
      'video/quicktime'
    ];
    const allowedExtensions = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|png|jpg|jpeg|gif|webp|mp3|wav|ogg|m4a|mp4|webm|mov)$/i;
    const extValid = allowedExtensions.test(file.originalname);
    if ((allowedTypes.includes(file.mimetype) ||
        file.mimetype.startsWith('image/') ||
        file.mimetype.startsWith('audio/') ||
        file.mimetype.startsWith('video/')) && extValid) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Get files for a project
router.get('/project/:projectId', authenticate, requireProjectAccess(), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const folderId = req.query.folder_id;

    const countResult = await db.query(
      folderId
        ? 'SELECT COUNT(*) FROM files WHERE project_id = $1 AND deleted_at IS NULL AND folder_id = $2'
        : 'SELECT COUNT(*) FROM files WHERE project_id = $1 AND deleted_at IS NULL AND folder_id IS NULL',
      folderId ? [req.params.projectId, folderId] : [req.params.projectId]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(
      folderId
        ? `SELECT f.*, u.name as uploader_name
           FROM files f
           JOIN users u ON f.uploaded_by = u.id
           WHERE f.project_id = $1 AND f.deleted_at IS NULL AND f.folder_id = $4
           ORDER BY f.uploaded_at DESC
           LIMIT $2 OFFSET $3`
        : `SELECT f.*, u.name as uploader_name
           FROM files f
           JOIN users u ON f.uploaded_by = u.id
           WHERE f.project_id = $1 AND f.deleted_at IS NULL AND f.folder_id IS NULL
           ORDER BY f.uploaded_at DESC
           LIMIT $2 OFFSET $3`,
      folderId ? [req.params.projectId, limit, offset, folderId] : [req.params.projectId, limit, offset]
    );

    res.json({ files: result.rows, total, limit, offset });
  } catch (error) {
    next(error);
  }
});

// Upload file
router.post('/project/:projectId', authenticate, requireProjectAccess(), upload.single('file'), async (req, res, next) => {
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

    // Fire-and-forget background indexing for RAG
    const fileId = result.rows[0].id;
    indexFile(fileId).catch(err => {
      logger.warn({ err, fileId }, 'Background indexing failed');
    });

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
    const result = await db.query('SELECT * FROM files WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'File not found' } });
    }
    const file = result.rows[0];

    // Check project access (admins can access all)
    if (req.user.role !== 'admin') {
      const accessCheck = await db.query(
        `SELECT id FROM projects WHERE id = $1 AND created_by = $2
         UNION
         SELECT p.id FROM projects p
         JOIN action_items ai ON ai.project_id = p.id
         JOIN action_item_assignees aia ON aia.action_item_id = ai.id
         WHERE p.id = $1 AND aia.user_id = $2
         LIMIT 1`,
        [file.project_id, req.user.id]
      );
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    }

    res.download(file.storage_path, file.original_filename);
  } catch (error) {
    next(error);
  }
});

// Delete file
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM files WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'File not found' } });
    }
    const file = result.rows[0];

    // Check project access (admins can access all)
    if (req.user.role !== 'admin') {
      const accessCheck = await db.query(
        `SELECT id FROM projects WHERE id = $1 AND created_by = $2
         UNION
         SELECT p.id FROM projects p
         JOIN action_items ai ON ai.project_id = p.id
         JOIN action_item_assignees aia ON aia.action_item_id = ai.id
         WHERE p.id = $1 AND aia.user_id = $2
         LIMIT 1`,
        [file.project_id, req.user.id]
      );
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    }

    await db.query('UPDATE files SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL', [req.user.id, req.params.id]);
    logAdminAction(req, 'delete_file', 'file', req.params.id, { filename: file.original_filename, project_id: file.project_id }, null);
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Move file to folder
router.put('/:id/move', authenticate, async (req, res, next) => {
  try {
    const { folder_id } = req.body;

    const existing = await db.query('SELECT * FROM files WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'File not found' } });
    }

    // If folder_id provided, verify folder exists
    if (folder_id) {
      const folder = await db.query('SELECT id FROM folders WHERE id = $1 AND deleted_at IS NULL', [folder_id]);
      if (folder.rows.length === 0) {
        return res.status(404).json({ error: { message: 'Folder not found' } });
      }
    }

    const result = await db.query(
      'UPDATE files SET folder_id = $1 WHERE id = $2 RETURNING *',
      [folder_id || null, req.params.id]
    );

    res.json({ file: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
