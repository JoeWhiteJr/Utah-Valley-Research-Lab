const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'), 'audio');
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
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit for audio
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Audio file type not allowed'), false);
    }
  }
});

// Get meetings for a project
router.get('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT m.*, u.name as creator_name
      FROM meetings m
      JOIN users u ON m.created_by = u.id
      WHERE m.project_id = $1
      ORDER BY m.recorded_at DESC NULLS LAST, m.created_at DESC
    `, [req.params.projectId]);

    res.json({ meetings: result.rows });
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
      WHERE m.id = $1
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
router.post('/project/:projectId', authenticate, upload.single('audio'), [
  body('title').trim().notEmpty(),
  body('recorded_at').optional().isISO8601(),
  body('notes').optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, recorded_at, notes } = req.body;

    const result = await db.query(
      `INSERT INTO meetings (project_id, title, audio_path, recorded_at, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        req.params.projectId,
        title,
        req.file ? req.file.path : null,
        recorded_at || null,
        notes || null,
        req.user.id
      ]
    );

    res.status(201).json({ meeting: result.rows[0] });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(error);
  }
});

// Update meeting (transcript, summary, notes, etc.)
router.put('/:id', authenticate, [
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

    const existing = await db.query('SELECT id FROM meetings WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Meeting not found' } });
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

// Delete meeting
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Meeting not found' } });
    }

    const meeting = result.rows[0];

    await db.query('DELETE FROM meetings WHERE id = $1', [req.params.id]);

    // Delete audio file if exists
    if (meeting.audio_path) {
      fs.unlink(meeting.audio_path, (err) => {
        if (err) console.error('Error deleting audio file:', err);
      });
    }

    res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
