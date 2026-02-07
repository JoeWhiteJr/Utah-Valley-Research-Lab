const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');

const router = express.Router();

// Get comments for an action item
router.get('/actions/:actionId/comments', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT c.*, u.name as user_name
      FROM action_item_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.action_item_id = $1
      ORDER BY c.created_at ASC
    `, [req.params.actionId]);
    res.json({ comments: result.rows });
  } catch (error) {
    next(error);
  }
});

// Add a comment
router.post('/actions/:actionId/comments', authenticate, sanitizeBody('content'), [
  body('content').trim().notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Content is required' } });
    }

    const result = await db.query(`
      INSERT INTO action_item_comments (action_item_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.params.actionId, req.user.id, req.body.content.trim()]);

    // Get user name for response
    const comment = result.rows[0];
    comment.user_name = req.user.name;

    res.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
});

// Delete a comment (own only, or admin)
router.delete('/actions/:actionId/comments/:commentId', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM action_item_comments WHERE id = $1 AND action_item_id = $2',
      [req.params.commentId, req.params.actionId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Comment not found' } });
    }
    if (result.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: { message: 'Not authorized' } });
    }
    await db.query('DELETE FROM action_item_comments WHERE id = $1', [req.params.commentId]);
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    next(error);
  }
});

// Get comment count for action items in a project
router.get('/project/:projectId/comment-counts', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT c.action_item_id, COUNT(*)::int as count
      FROM action_item_comments c
      JOIN action_items a ON c.action_item_id = a.id
      WHERE a.project_id = $1
      GROUP BY c.action_item_id
    `, [req.params.projectId]);
    const counts = {};
    result.rows.forEach(r => { counts[r.action_item_id] = r.count; });
    res.json({ counts });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
