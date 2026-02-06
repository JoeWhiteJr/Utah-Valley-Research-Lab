const express = require('express');
const { query, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const [
      userStats,
      applicationStats,
      projectStats,
      chatStats,
      recentApplications
    ] = await Promise.all([
      // User stats
      db.query(`
        SELECT
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE role = 'admin') as admin_count,
          COUNT(*) FILTER (WHERE role = 'project_lead') as project_lead_count,
          COUNT(*) FILTER (WHERE role = 'researcher') as researcher_count,
          COUNT(*) FILTER (WHERE role = 'viewer') as viewer_count,
          COUNT(*) FILTER (WHERE created_at > CURRENT_DATE - INTERVAL '7 days') as new_this_week,
          COUNT(*) FILTER (WHERE created_at > CURRENT_DATE - INTERVAL '30 days') as new_this_month
        FROM users
        WHERE deleted_at IS NULL
      `),
      // Application stats
      db.query(`
        SELECT
          COUNT(*) as total_applications,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'approved') as approved,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
          COUNT(*) FILTER (WHERE created_at > CURRENT_DATE - INTERVAL '7 days') as new_this_week,
          AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at))/3600) FILTER (WHERE reviewed_at IS NOT NULL) as avg_response_hours
        FROM applications
      `),
      // Project stats
      db.query(`
        SELECT
          COUNT(*) as total_projects,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'archived') as archived,
          AVG(progress) FILTER (WHERE status = 'active') as avg_active_progress
        FROM projects
      `),
      // Chat stats
      db.query(`
        SELECT
          (SELECT COUNT(*) FROM chat_rooms) as total_rooms,
          (SELECT COUNT(*) FROM chat_rooms WHERE type = 'group') as group_rooms,
          (SELECT COUNT(*) FROM messages WHERE created_at > CURRENT_DATE - INTERVAL '7 days') as messages_this_week,
          (SELECT COUNT(*) FROM messages) as total_messages
      `),
      // Recent applications
      db.query(`
        SELECT id, name, email, status, created_at
        FROM applications
        ORDER BY created_at DESC
        LIMIT 5
      `)
    ]);

    res.json({
      stats: {
        users: userStats.rows[0],
        applications: applicationStats.rows[0],
        projects: projectStats.rows[0],
        chats: chatStats.rows[0]
      },
      recentApplications: recentApplications.rows
    });
  } catch (error) {
    next(error);
  }
});

// Get audit log
router.get('/audit-log', authenticate, requireRole('admin'), [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('action').optional().trim(),
  query('entity_type').optional().trim()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const { action, entity_type } = req.query;

    let query = `
      SELECT al.*, u.name as admin_name, u.email as admin_email
      FROM admin_audit_log al
      JOIN users u ON al.admin_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (action) {
      query += ` AND al.action = $${paramCount++}`;
      params.push(action);
    }

    if (entity_type) {
      query += ` AND al.entity_type = $${paramCount++}`;
      params.push(entity_type);
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM admin_audit_log WHERE 1=1';
    const countParams = [];
    let countParamNum = 1;

    if (action) {
      countQuery += ` AND action = $${countParamNum++}`;
      countParams.push(action);
    }
    if (entity_type) {
      countQuery += ` AND entity_type = $${countParamNum++}`;
      countParams.push(entity_type);
    }

    const countResult = await db.query(countQuery, countParams);

    res.json({
      auditLog: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

// Search users
router.get('/users/search', authenticate, requireRole('admin'), [
  query('q').optional().trim(),
  query('role').optional().isIn(['admin', 'project_lead', 'researcher', 'viewer'])
], async (req, res, next) => {
  try {
    const { q, role } = req.query;

    let query = `
      SELECT id, email, name, role, created_at
      FROM users
      WHERE deleted_at IS NULL
    `;
    const params = [];
    let paramCount = 1;

    if (q) {
      query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${q}%`);
      paramCount++;
    }

    if (role) {
      query += ` AND role = $${paramCount++}`;
      params.push(role);
    }

    query += ' ORDER BY name ASC LIMIT 50';

    const result = await db.query(query, params);
    res.json({ users: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get application trends (for charts)
router.get('/applications/trends', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'pending') as pending
      FROM applications
      WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    res.json({ trends: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get all published projects (with original project data)
router.get('/published-projects', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        pp.*,
        p.title as original_title,
        p.description as original_description,
        p.header_image as original_image,
        p.status as original_status
      FROM published_projects pp
      JOIN projects p ON pp.project_id = p.id
      ORDER BY pp.published_at DESC
    `);

    res.json({ publishedProjects: result.rows });
  } catch (error) {
    next(error);
  }
});

// Publish a project
router.post('/publish-project', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { project_id, title, description, image, status } = req.body;

    // Check project exists
    const projectCheck = await db.query('SELECT id FROM projects WHERE id = $1', [project_id]);
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    // Check not already published
    const dupCheck = await db.query('SELECT id FROM published_projects WHERE project_id = $1', [project_id]);
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ error: { message: 'Project is already published' } });
    }

    const result = await db.query(
      `INSERT INTO published_projects (project_id, published_title, published_description, published_image, published_status, published_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [project_id, title, description, image, status, req.user.id]
    );

    res.status(201).json({ publishedProject: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Update a published project
router.put('/published-projects/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, image, status } = req.body;

    const result = await db.query(
      `UPDATE published_projects
       SET published_title = COALESCE($1, published_title),
           published_description = COALESCE($2, published_description),
           published_image = COALESCE($3, published_image),
           published_status = COALESCE($4, published_status)
       WHERE id = $5
       RETURNING *`,
      [title, description, image, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Published project not found' } });
    }

    res.json({ publishedProject: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Unpublish a project (delete record)
router.delete('/published-projects/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM published_projects WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Published project not found' } });
    }

    res.json({ message: 'Project unpublished' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
