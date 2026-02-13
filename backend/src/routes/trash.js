const express = require('express');
const fs = require('fs');
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all trashed items (admin only)
router.get('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const [projects, notes, actions, meetings, files] = await Promise.all([
      db.query(`
        SELECT p.id, p.title, p.deleted_at, u.name as deleted_by_name, 'projects' as type
        FROM projects p
        LEFT JOIN users u ON p.deleted_by = u.id
        WHERE p.deleted_at IS NOT NULL
        ORDER BY p.deleted_at DESC
      `),
      db.query(`
        SELECT n.id, n.title, n.deleted_at, u.name as deleted_by_name, 'notes' as type
        FROM notes n
        LEFT JOIN users u ON n.deleted_by = u.id
        WHERE n.deleted_at IS NOT NULL
        ORDER BY n.deleted_at DESC
      `),
      db.query(`
        SELECT a.id, a.title, a.deleted_at, u.name as deleted_by_name, 'actions' as type
        FROM action_items a
        LEFT JOIN users u ON a.deleted_by = u.id
        WHERE a.deleted_at IS NOT NULL
        ORDER BY a.deleted_at DESC
      `),
      db.query(`
        SELECT m.id, m.title, m.deleted_at, u.name as deleted_by_name, 'meetings' as type
        FROM meetings m
        LEFT JOIN users u ON m.deleted_by = u.id
        WHERE m.deleted_at IS NOT NULL
        ORDER BY m.deleted_at DESC
      `),
      db.query(`
        SELECT f.id, f.original_filename as title, f.deleted_at, u.name as deleted_by_name, 'files' as type
        FROM files f
        LEFT JOIN users u ON f.deleted_by = u.id
        WHERE f.deleted_at IS NOT NULL
        ORDER BY f.deleted_at DESC
      `)
    ]);

    res.json({
      projects: projects.rows,
      notes: notes.rows,
      actions: actions.rows,
      meetings: meetings.rows,
      files: files.rows
    });
  } catch (error) {
    next(error);
  }
});

// Restore a soft-deleted item (admin only)
router.post('/:type/:id/restore', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const tableMap = {
      projects: 'projects',
      notes: 'notes',
      actions: 'action_items',
      meetings: 'meetings',
      files: 'files'
    };

    const table = tableMap[type];
    if (!table) {
      return res.status(400).json({ error: { message: 'Invalid type' } });
    }

    const result = await db.query(
      `UPDATE ${table} SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Item not found in trash' } });
    }

    res.json({ message: 'Item restored successfully' });
  } catch (error) {
    next(error);
  }
});

// Permanently delete an item (admin only)
router.delete('/:type/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const tableMap = {
      projects: 'projects',
      notes: 'notes',
      actions: 'action_items',
      meetings: 'meetings',
      files: 'files'
    };

    const table = tableMap[type];
    if (!table) {
      return res.status(400).json({ error: { message: 'Invalid type' } });
    }

    // For files and meetings, handle physical file cleanup
    if (type === 'files') {
      const fileResult = await db.query('SELECT storage_path FROM files WHERE id = $1 AND deleted_at IS NOT NULL', [id]);
      if (fileResult.rows.length > 0 && fileResult.rows[0].storage_path) {
        fs.unlink(fileResult.rows[0].storage_path, (err) => {
          if (err) logger.error({ err }, 'Error deleting physical file during permanent delete');
        });
      }
    }

    if (type === 'meetings') {
      const meetingResult = await db.query('SELECT audio_path FROM meetings WHERE id = $1 AND deleted_at IS NOT NULL', [id]);
      if (meetingResult.rows.length > 0 && meetingResult.rows[0].audio_path) {
        fs.unlink(meetingResult.rows[0].audio_path, (err) => {
          if (err) logger.error({ err }, 'Error deleting audio file during permanent delete');
        });
      }
    }

    const result = await db.query(
      `DELETE FROM ${table} WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Item not found in trash' } });
    }

    res.json({ message: 'Item permanently deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
