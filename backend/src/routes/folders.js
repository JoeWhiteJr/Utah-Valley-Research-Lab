const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router();

// GET /api/folders/project/:projectId - List folders for a project (flat list with parent_id)
router.get('/project/:projectId', authenticate, requireProjectAccess(), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT f.*, u.name as creator_name
      FROM folders f
      JOIN users u ON f.created_by = u.id
      WHERE f.project_id = $1 AND f.deleted_at IS NULL
      ORDER BY f.name ASC
    `, [req.params.projectId]);
    res.json({ folders: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/folders/project/:projectId - Create folder
// Body: { name, parent_id? }
// Enforce 5-level depth limit
router.post('/project/:projectId', authenticate, requireProjectAccess(), [
  body('name').trim().notEmpty().isLength({ max: 255 }),
  body('parent_id').optional({ nullable: true }).isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { name, parent_id } = req.body;

    // Enforce 5-level depth limit
    if (parent_id) {
      let depth = 1;
      let currentId = parent_id;
      while (currentId) {
        const parent = await db.query('SELECT parent_id FROM folders WHERE id = $1 AND deleted_at IS NULL', [currentId]);
        if (parent.rows.length === 0) break;
        currentId = parent.rows[0].parent_id;
        depth++;
        if (depth >= 5) {
          return res.status(400).json({ error: { message: 'Maximum folder depth of 5 levels reached' } });
        }
      }
    }

    const result = await db.query(
      'INSERT INTO folders (project_id, name, parent_id, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.projectId, name, parent_id || null, req.user.id]
    );

    res.status(201).json({ folder: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PUT /api/folders/:id - Rename folder
router.put('/:id', authenticate, [
  body('name').trim().notEmpty().isLength({ max: 255 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const existing = await db.query('SELECT * FROM folders WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Folder not found' } });
    }

    const result = await db.query(
      'UPDATE folders SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [req.body.name, req.params.id]
    );

    res.json({ folder: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PUT /api/folders/:id/move - Move folder to new parent
router.put('/:id/move', authenticate, [
  body('parent_id').optional({ nullable: true }).isUUID()
], async (req, res, next) => {
  try {
    const existing = await db.query('SELECT * FROM folders WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Folder not found' } });
    }

    const { parent_id } = req.body;

    // Prevent moving folder into itself or its descendants
    if (parent_id) {
      let currentId = parent_id;
      while (currentId) {
        if (currentId === req.params.id) {
          return res.status(400).json({ error: { message: 'Cannot move folder into itself or its descendants' } });
        }
        const parent = await db.query('SELECT parent_id FROM folders WHERE id = $1 AND deleted_at IS NULL', [currentId]);
        if (parent.rows.length === 0) break;
        currentId = parent.rows[0].parent_id;
      }

      // Enforce 5-level depth
      let depth = 1;
      currentId = parent_id;
      while (currentId) {
        const parent = await db.query('SELECT parent_id FROM folders WHERE id = $1 AND deleted_at IS NULL', [currentId]);
        if (parent.rows.length === 0) break;
        currentId = parent.rows[0].parent_id;
        depth++;
        if (depth >= 5) {
          return res.status(400).json({ error: { message: 'Maximum folder depth of 5 levels reached' } });
        }
      }
    }

    const result = await db.query(
      'UPDATE folders SET parent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [parent_id || null, req.params.id]
    );

    res.json({ folder: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/folders/:id - Soft-delete folder (cascades to subfolders)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await db.query('SELECT * FROM folders WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Folder not found' } });
    }

    // Soft-delete folder and all descendants recursively
    const softDeleteRecursive = async (folderId) => {
      await db.query(
        'UPDATE folders SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2',
        [req.user.id, folderId]
      );
      // Move files in this folder to root (set folder_id to null)
      await db.query('UPDATE files SET folder_id = NULL WHERE folder_id = $1', [folderId]);
      // Recursively delete children
      const children = await db.query('SELECT id FROM folders WHERE parent_id = $1 AND deleted_at IS NULL', [folderId]);
      for (const child of children.rows) {
        await softDeleteRecursive(child.id);
      }
    };

    await softDeleteRecursive(req.params.id);

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
