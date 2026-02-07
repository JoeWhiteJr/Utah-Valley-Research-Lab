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

// Helper: log an activity (exported for use by other routes)
module.exports.logActivityEvent = async (userId, action, entityType, entityId, entityTitle, projectId, metadata) => {
  try {
    await db.query(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_title, project_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [userId, action, entityType, entityId || null, entityTitle || null, projectId || null, metadata || {}]);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
