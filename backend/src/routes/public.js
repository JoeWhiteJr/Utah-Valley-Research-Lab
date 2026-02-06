const express = require('express');
const db = require('../config/database');

const router = express.Router();

// Get all published projects (no auth required)
router.get('/projects', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        pp.id,
        pp.project_id,
        pp.published_title,
        pp.published_description,
        pp.published_image,
        pp.published_status,
        pp.published_at
      FROM published_projects pp
      ORDER BY pp.published_at DESC
    `);

    res.json({ projects: result.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
