const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');

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
    // Strip codec parameters (e.g., "audio/webm;codecs=opus" -> "audio/webm")
    const baseType = file.mimetype.split(';')[0].trim();
    if (allowedTypes.includes(baseType)) {
      cb(null, true);
    } else {
      cb(new Error('Audio file type not allowed'), false);
    }
  }
});

// List all books grouped by status + vote counts
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT b.*,
        (SELECT COUNT(*) FROM book_club_votes v WHERE v.book_id = b.id) as vote_count,
        EXISTS(SELECT 1 FROM book_club_votes v WHERE v.book_id = b.id AND v.user_id = $1) as user_voted
      FROM book_club_books b
      WHERE b.deleted_at IS NULL
      ORDER BY b.status, b.created_at DESC`,
      [req.user.id]
    );

    const books = result.rows;

    const currentBook = books.find(b => b.status === 'current') || null;
    const upcomingBooks = books.filter(b => b.status === 'upcoming');
    const pastBooks = books.filter(b => b.status === 'past').sort((a, b) => new Date(b.meet_date) - new Date(a.meet_date));

    // Get user's current vote
    const voteResult = await db.query(
      'SELECT book_id FROM book_club_votes WHERE user_id = $1',
      [req.user.id]
    );
    const userVoteBookId = voteResult.rows.length > 0 ? voteResult.rows[0].book_id : null;

    res.json({ currentBook, upcomingBooks, pastBooks, userVoteBookId });
  } catch (error) {
    next(error);
  }
});

// Create book
router.post('/', authenticate, requireRole('admin'), [
  body('title').trim().notEmpty(),
  body('author').trim().notEmpty(),
  body('description').optional(),
  body('meet_date').optional({ values: 'falsy' }).isISO8601()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, author, description, meet_date } = req.body;

    const result = await db.query(
      'INSERT INTO book_club_books (title, author, description, meet_date, status, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, author, description || null, meet_date || null, 'upcoming', req.user.id]
    );

    res.status(201).json({ book: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Update book
router.put('/:id', authenticate, requireRole('admin'), [
  body('title').optional().trim().notEmpty(),
  body('author').optional().trim().notEmpty(),
  body('description').optional(),
  body('status').optional().isIn(['upcoming', 'current', 'past']),
  body('meet_date').optional({ values: 'falsy' }).isISO8601()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const existing = await db.query(
      'SELECT id FROM book_club_books WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Book not found' } });
    }

    const { title, author, description, status, meet_date } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) { updates.push(`title = $${paramCount++}`); values.push(title); }
    if (author !== undefined) { updates.push(`author = $${paramCount++}`); values.push(author); }
    if (description !== undefined) { updates.push(`description = $${paramCount++}`); values.push(description); }
    if (status !== undefined) { updates.push(`status = $${paramCount++}`); values.push(status); }
    if (meet_date !== undefined) { updates.push(`meet_date = $${paramCount++}`); values.push(meet_date || null); }

    if (values.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE book_club_books SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ book: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Soft delete book
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const existing = await db.query(
      'SELECT id FROM book_club_books WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Book not found' } });
    }

    await db.query(
      'UPDATE book_club_books SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2',
      [req.user.id, req.params.id]
    );

    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Set book as current (transaction)
router.post('/:id/set-current', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    await db.query('BEGIN');

    // Move any current book to past
    await db.query(
      "UPDATE book_club_books SET status = 'past' WHERE status = 'current' AND deleted_at IS NULL"
    );

    // Set the target book as current (with optional meet_date)
    const { meet_date } = req.body || {};
    const result = await db.query(
      `UPDATE book_club_books SET status = 'current'${meet_date ? ', meet_date = $2' : ''} WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      meet_date ? [req.params.id, meet_date] : [req.params.id]
    );

    if (result.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: { message: 'Book not found' } });
    }

    // Clear all votes
    await db.query('DELETE FROM book_club_votes');

    await db.query('COMMIT');

    res.json({ book: result.rows[0] });
  } catch (error) {
    await db.query('ROLLBACK');
    next(error);
  }
});

// Move book back to upcoming (undo current or past)
router.post('/:id/move-to-upcoming', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query(
      "UPDATE book_club_books SET status = 'upcoming' WHERE id = $1 AND deleted_at IS NULL RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Book not found' } });
    }

    res.json({ book: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Shelve book (move current to past)
router.post('/:id/shelve', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query(
      "UPDATE book_club_books SET status = 'past' WHERE id = $1 AND deleted_at IS NULL RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Book not found' } });
    }

    res.json({ book: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Vote for a book (upsert - user can only have one vote)
router.post('/:id/vote', authenticate, async (req, res, next) => {
  try {
    // Verify the book exists and is upcoming
    const bookResult = await db.query(
      "SELECT id FROM book_club_books WHERE id = $1 AND status = 'upcoming' AND deleted_at IS NULL",
      [req.params.id]
    );
    if (bookResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Book not found or not available for voting' } });
    }

    await db.query(
      `INSERT INTO book_club_votes (book_id, user_id) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET book_id = EXCLUDED.book_id, created_at = CURRENT_TIMESTAMP`,
      [req.params.id, req.user.id]
    );

    res.json({ message: 'Vote recorded', book_id: req.params.id });
  } catch (error) {
    next(error);
  }
});

// Remove vote
router.delete('/:id/vote', authenticate, async (req, res, next) => {
  try {
    await db.query(
      'DELETE FROM book_club_votes WHERE user_id = $1',
      [req.user.id]
    );

    res.json({ message: 'Vote removed' });
  } catch (error) {
    next(error);
  }
});

// Update meeting details (notes, summary, transcript)
router.put('/:id/meeting', authenticate, requireRole('admin'), sanitizeBody('notes'), [
  body('notes').optional(),
  body('summary').optional(),
  body('transcript').optional()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const existing = await db.query(
      'SELECT id FROM book_club_books WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Book not found' } });
    }

    const { notes, summary, transcript } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (notes !== undefined) { updates.push(`notes = $${paramCount++}`); values.push(notes); }
    if (summary !== undefined) { updates.push(`summary = $${paramCount++}`); values.push(summary); }
    if (transcript !== undefined) { updates.push(`transcript = $${paramCount++}`); values.push(transcript); }

    if (values.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE book_club_books SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ book: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Upload audio for book club meeting
router.put('/:id/audio', authenticate, requireRole('admin'), upload.single('audio'), async (req, res, next) => {
  try {
    const existing = await db.query(
      'SELECT id FROM book_club_books WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (existing.rows.length === 0) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: { message: 'Book not found' } });
    }

    if (!req.file) {
      return res.status(400).json({ error: { message: 'No audio file provided' } });
    }

    const result = await db.query(
      'UPDATE book_club_books SET audio_path = $1 WHERE id = $2 RETURNING *',
      [req.file.path, req.params.id]
    );

    res.json({ book: result.rows[0] });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(error);
  }
});

// Stream audio with range request support
router.get('/:id/audio', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT audio_path FROM book_club_books WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Book not found' } });
    }

    const audioPath = result.rows[0].audio_path;

    if (!audioPath) {
      return res.status(404).json({ error: { message: 'No audio file for this book' } });
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

module.exports = router;
