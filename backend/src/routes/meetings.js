const express = require('express');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, requireProjectAccess } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');
const { processUpload } = require('../middleware/uploadProcessor');
const { createUploader } = require('../middleware/uploads');
const { userHasProjectAccess } = require('../services/ragQueryService');

const router = express.Router();

// Meeting audio uploads — 500MB, audio only. Extension allowlist added during
// multer consolidation (factory enforces ext + MIME). Codec parameters are
// stripped from the MIME inside the factory.
const upload = createUploader({
  subdir: 'audio',
  maxBytes: 500 * 1024 * 1024,
  allowedMimes: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg'],
  allowedExts: ['.mp3', '.wav', '.m4a', '.mp4', '.webm', '.ogg']
});

// Get meetings for a project
router.get('/project/:projectId', authenticate, requireProjectAccess(), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const countResult = await db.query(
      'SELECT COUNT(*) FROM meetings WHERE project_id = $1 AND deleted_at IS NULL',
      [req.params.projectId]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(`
      SELECT m.*, u.name as creator_name
      FROM meetings m
      JOIN users u ON m.created_by = u.id
      WHERE m.project_id = $1 AND m.deleted_at IS NULL
      ORDER BY m.recorded_at DESC NULLS LAST, m.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.params.projectId, limit, offset]);

    res.json({ meetings: result.rows, total, limit, offset });
  } catch (error) {
    next(error);
  }
});

// Get single meeting
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT m.*, u.name as creator_name
      FROM meetings m
      JOIN users u ON m.created_by = u.id
      WHERE m.id = $1 AND m.deleted_at IS NULL
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Meeting not found' } });
    }

    res.json({ meeting: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Upload meeting audio
router.post('/project/:projectId', authenticate, requireProjectAccess(), upload.single('audio'), processUpload({ category: 'audio' }), sanitizeBody('notes'), [
  body('title').trim().notEmpty(),
  body('recorded_at').optional().isISO8601(),
  body('notes').optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file && req.file.storageBackend !== 's3') fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, recorded_at, notes } = req.body;

    const result = await db.query(
      `INSERT INTO meetings (project_id, title, audio_path, recorded_at, notes, created_by,
        checksum_sha256, detected_mime_type, s3_key, s3_bucket, storage_backend)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        req.params.projectId,
        title,
        req.file ? (req.file.s3Key || req.file.path) : null,
        recorded_at || null,
        notes || null,
        req.user.id,
        req.file?.checksum || null,
        req.file?.detectedMimeType || null,
        req.file?.s3Key || null,
        req.file?.s3Bucket || null,
        req.file?.storageBackend || 'local'
      ]
    );

    res.status(201).json({ meeting: result.rows[0] });
  } catch (error) {
    if (req.file && req.file.storageBackend !== 's3') fs.unlink(req.file.path, () => {});
    next(error);
  }
});

// Update meeting (transcript, summary, notes, etc.)
router.put('/:id', authenticate, sanitizeBody('notes'), [
  body('title').optional().trim().notEmpty(),
  body('transcript').optional(),
  body('summary').optional(),
  body('notes').optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, transcript, summary, notes } = req.body;

    const existing = await db.query('SELECT id, project_id FROM meetings WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Meeting not found' } });
    }

    // Verify project access (admin, creator, project_member, or assignee)
    const hasAccess = await userHasProjectAccess(req.user.id, req.user.role, existing.rows[0].project_id);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) { updates.push(`title = $${paramCount++}`); values.push(title); }
    if (transcript !== undefined) { updates.push(`transcript = $${paramCount++}`); values.push(transcript); }
    if (summary !== undefined) { updates.push(`summary = $${paramCount++}`); values.push(summary); }
    if (notes !== undefined) { updates.push(`notes = $${paramCount++}`); values.push(notes); }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE meetings SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ meeting: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Get audio file
router.get('/:id/audio', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT audio_path FROM meetings WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Meeting not found' } });
    }

    const audioPath = result.rows[0].audio_path;

    if (!audioPath) {
      return res.status(404).json({ error: { message: 'No audio file for this meeting' } });
    }

    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ error: { message: 'Audio file not found on server' } });
    }

    const stat = fs.statSync(audioPath);
    const fileSize = stat.size;
    const ext = path.extname(audioPath).toLowerCase();

    // Determine content type
    const contentTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.webm': 'audio/webm',
      '.ogg': 'audio/ogg'
    };
    const contentType = contentTypes[ext] || 'audio/mpeg';

    // Support range requests for seeking
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      const file = fs.createReadStream(audioPath, { start, end });

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

      fs.createReadStream(audioPath).pipe(res);
    }
  } catch (error) {
    next(error);
  }
});

// Get transcript
router.get('/:id/transcript', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT transcript FROM meetings WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Meeting not found' } });
    }

    res.json({ transcript: result.rows[0].transcript });
  } catch (error) {
    next(error);
  }
});

// Trigger transcription (placeholder - would integrate with Whisper API)
router.post('/:id/transcribe', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Meeting not found' } });
    }

    const meeting = result.rows[0];

    // Verify project access (admin, creator, project_member, or assignee)
    const hasAccess = await userHasProjectAccess(req.user.id, req.user.role, meeting.project_id);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    if (!meeting.audio_path) {
      return res.status(400).json({ error: { message: 'No audio file associated with this meeting' } });
    }

    // Placeholder: In production, this would queue a transcription job
    // using Whisper API or similar service
    res.json({
      message: 'Transcription queued',
      meeting_id: meeting.id,
      status: 'pending'
    });
  } catch (error) {
    next(error);
  }
});

// Upload audio to existing meeting
const audioProcessUpload = processUpload({ category: 'audio' });
router.put('/:id/audio', authenticate, upload.single('audio'), async (req, res, next) => {
  try {
    const existing = await db.query('SELECT id, project_id FROM meetings WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (existing.rows.length === 0) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: { message: 'Meeting not found' } });
    }

    // Verify project access BEFORE checking req.file presence so the response
    // for an outsider is identical regardless of whether they sent a body.
    // Otherwise the 400-vs-403 split lets unauthorized callers probe meeting
    // state in other projects (same probe-leak class fixed in PR #89 for
    // /transcribe). Multer has already written the upload to disk by the time
    // this handler runs, so on access denial we must fs.unlink the orphaned
    // file (same cleanup pattern as PR #83).
    const hasAccess = await userHasProjectAccess(req.user.id, req.user.role, existing.rows[0].project_id);
    if (!hasAccess) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    if (!req.file) {
      return res.status(400).json({ error: { message: 'No audio file provided' } });
    }

    // Run uploadProcessor (checksum + magic bytes + optional S3) inline so it
    // executes AFTER the 404/403/400 ladder above. Wrapping the middleware as
    // a Promise keeps its early-return semantics: if magic-byte validation
    // fails it sends its own 400 response and we bail without touching the DB.
    const processed = await new Promise((resolve, reject) => {
      audioProcessUpload(req, res, (err) => {
        if (err) return reject(err);
        resolve(!res.headersSent);
      });
    });
    if (!processed) return; // processUpload already responded (e.g. magic-byte 400)

    const result = await db.query(
      `UPDATE meetings SET audio_path = $1, checksum_sha256 = $2, detected_mime_type = $3,
        s3_key = $4, s3_bucket = $5, storage_backend = $6 WHERE id = $7 RETURNING *`,
      [
        req.file.s3Key || req.file.path,
        req.file.checksum || null,
        req.file.detectedMimeType || null,
        req.file.s3Key || null,
        req.file.s3Bucket || null,
        req.file.storageBackend || 'local',
        req.params.id
      ]
    );

    res.json({ meeting: result.rows[0] });
  } catch (error) {
    if (req.file && req.file.storageBackend !== 's3') fs.unlink(req.file.path, () => {});
    next(error);
  }
});

// Delete meeting
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM meetings WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Meeting not found' } });
    }

    const meeting = result.rows[0];

    // Verify project access (admin, creator, project_member, or assignee)
    const hasAccess = await userHasProjectAccess(req.user.id, req.user.role, meeting.project_id);
    if (!hasAccess) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    await db.query('UPDATE meetings SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2', [req.user.id, req.params.id]);

    res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
