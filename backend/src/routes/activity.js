const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get recent activity
router.get('/', authenticate, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = parseInt(req.query.offset) || 0;

    const result = await db.query(`
      SELECT a.*, u.name as user_name
      FROM activity_log a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({ activities: result.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
