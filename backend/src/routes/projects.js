const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { createNotificationForUsers } = require('./notifications');
const socketService = require('../services/socketService');

const router = express.Router();

// Configure multer for cover image uploads
const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'), 'covers');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const coverUpload = multer({
  storage: coverStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /^(jpeg|jpg|png|gif|webp)$/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase().replace('.', ''));
    const mime = allowed.test(file.mimetype.split('/')[1]);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get all projects
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const validStatuses = ['active', 'completed', 'archived', 'inactive'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: { message: 'Invalid status filter' } });
    }

    let countQuery = 'SELECT COUNT(*) FROM projects p';
    let query = `
      SELECT p.*, u.name as creator_name,
        COALESCE(ai_stats.total_actions, 0) as total_actions,
        COALESCE(ai_stats.completed_actions, 0) as completed_actions,
        CASE WHEN COALESCE(ai_stats.total_actions, 0) = 0 THEN 0
          ELSE ROUND(COALESCE(ai_stats.completed_actions, 0)::numeric / ai_stats.total_actions::numeric * 100)
        END as calculated_progress,
        COALESCE(mem_stats.member_count, 0) as member_count,
        lead_u.name as lead_name,
        lead_u.email as lead_email,
        CASE
          WHEN my_mem.user_id IS NOT NULL THEN 'member'
          WHEN my_req.id IS NOT NULL THEN 'pending'
          ELSE 'none'
        END as membership_status
      FROM projects p
      JOIN users u ON p.created_by = u.id
      LEFT JOIN users lead_u ON p.lead_id = lead_u.id
      LEFT JOIN (
        SELECT project_id,
          COUNT(*) as total_actions,
          COUNT(*) FILTER (WHERE completed = true) as completed_actions
        FROM action_items
        GROUP BY project_id
      ) ai_stats ON ai_stats.project_id = p.id
      LEFT JOIN (
        SELECT project_id, COUNT(*) as member_count
        FROM project_members
        GROUP BY project_id
      ) mem_stats ON mem_stats.project_id = p.id
      LEFT JOIN project_members my_mem
        ON my_mem.project_id = p.id AND my_mem.user_id = $1
      LEFT JOIN project_join_requests my_req
        ON my_req.project_id = p.id AND my_req.user_id = $1 AND my_req.status = 'pending'
    `;
    const params = [req.user.id];
    const countParams = [];

    if (status) {
      query += ' WHERE p.status = $2';
      countQuery += ' WHERE p.status = $1';
      params.push(status);
      countParams.push(status);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    query += ' ORDER BY p.updated_at DESC';
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await db.query(query, params);
    // Override progress with auto-calculated value from tasks
    const isAdmin = req.user.role === 'admin';
    const projects = result.rows.map(p => ({
      ...p,
      progress: parseInt(p.calculated_progress) || 0,
      membership_status: isAdmin ? 'member' : p.membership_status
    }));
    res.json({ projects, total, limit, offset });
  } catch (error) {
    next(error);
  }
});

// Get single project
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT p.*, u.name as creator_name,
        COALESCE(ai_stats.total_actions, 0) as total_actions,
        COALESCE(ai_stats.completed_actions, 0) as completed_actions,
        CASE WHEN COALESCE(ai_stats.total_actions, 0) = 0 THEN 0
          ELSE ROUND(COALESCE(ai_stats.completed_actions, 0)::numeric / ai_stats.total_actions::numeric * 100)
        END as calculated_progress,
        COALESCE(mem_stats.member_count, 0) as member_count,
        lead_u.name as lead_name
      FROM projects p
      JOIN users u ON p.created_by = u.id
      LEFT JOIN users lead_u ON p.lead_id = lead_u.id
      LEFT JOIN (
        SELECT project_id,
          COUNT(*) as total_actions,
          COUNT(*) FILTER (WHERE completed = true) as completed_actions
        FROM action_items
        GROUP BY project_id
      ) ai_stats ON ai_stats.project_id = p.id
      LEFT JOIN (
        SELECT project_id, COUNT(*) as member_count
        FROM project_members
        GROUP BY project_id
      ) mem_stats ON mem_stats.project_id = p.id
      WHERE p.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    const project = {
      ...result.rows[0],
      progress: parseInt(result.rows[0].calculated_progress) || 0
    };
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

// Create project
router.post('/', authenticate, requireRole('admin', 'project_lead'), [
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('description').optional().trim().isLength({ max: 10000 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, description, header_image } = req.body;

    const result = await db.query(
      'INSERT INTO projects (title, description, header_image, created_by, lead_id) VALUES ($1, $2, $3, $4, $4) RETURNING *',
      [title, description || null, header_image || null, req.user.id]
    );

    // Auto-add creator as lead member
    await db.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [result.rows[0].id, req.user.id, 'lead']
    );

    res.status(201).json({ project: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Update project
router.put('/:id', authenticate, requireRole('admin', 'project_lead'), [
  body('title').optional().trim().notEmpty().isLength({ max: 200 }),
  body('description').optional().trim().isLength({ max: 10000 }),
  body('status').optional().isIn(['active', 'completed', 'archived', 'inactive']),
  body('progress').optional().isInt({ min: 0, max: 100 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { title, description, header_image, status, progress } = req.body;

    // Only admins can update title, status, and progress
    if (req.user.role !== 'admin') {
      if (title !== undefined || status !== undefined || progress !== undefined) {
        return res.status(403).json({ error: { message: 'Only admins can edit title, status, and progress' } });
      }
    }

    const existing = await db.query('SELECT id FROM projects WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) { updates.push(`title = $${paramCount++}`); values.push(title); }
    if (description !== undefined) { updates.push(`description = $${paramCount++}`); values.push(description); }
    if (header_image !== undefined) { updates.push(`header_image = $${paramCount++}`); values.push(header_image); }
    if (status !== undefined) { updates.push(`status = $${paramCount++}`); values.push(status); }
    if (progress !== undefined) { updates.push(`progress = $${paramCount++}`); values.push(progress); }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ project: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Upload cover image
router.post('/:id/cover', authenticate, requireRole('admin', 'project_lead'), coverUpload.single('cover'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No image file provided' } });
    }

    const existing = await db.query('SELECT id FROM projects WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    const imageUrl = `/uploads/covers/${req.file.filename}`;
    await db.query(
      'UPDATE projects SET header_image = $1 WHERE id = $2',
      [imageUrl, req.params.id]
    );

    // Return full project with creator_name to match the shape expected by the frontend
    const result = await db.query(`
      SELECT p.*, u.name as creator_name
      FROM projects p
      JOIN users u ON p.created_by = u.id
      WHERE p.id = $1
    `, [req.params.id]);

    res.json({ project: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Delete project
router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM projects WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// PROJECT MEMBERS
// ==========================================

// Get project members
router.get('/:id/members', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT pm.id, pm.user_id, pm.role, pm.joined_at,
             u.name, u.email, u.avatar_url
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = $1
      ORDER BY pm.role DESC, pm.joined_at ASC
    `, [req.params.id]);

    res.json({ members: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get current user's membership status
router.get('/:id/membership-status', authenticate, async (req, res, next) => {
  try {
    const memberResult = await db.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (memberResult.rows.length > 0) {
      return res.json({ status: 'member', role: memberResult.rows[0].role });
    }

    const requestResult = await db.query(
      'SELECT status FROM project_join_requests WHERE project_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
      [req.params.id, req.user.id]
    );

    if (requestResult.rows.length > 0 && requestResult.rows[0].status === 'pending') {
      return res.json({ status: 'pending' });
    }

    res.json({ status: 'none' });
  } catch (error) {
    next(error);
  }
});

// Submit join request
router.post('/:id/join-request', authenticate, [
  body('message').optional().trim().isLength({ max: 500 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    // Check if already a member
    const memberCheck = await db.query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (memberCheck.rows.length > 0) {
      return res.status(400).json({ error: { message: 'Already a member of this project' } });
    }

    // Check if pending request exists
    const pendingCheck = await db.query(
      "SELECT 1 FROM project_join_requests WHERE project_id = $1 AND user_id = $2 AND status = 'pending'",
      [req.params.id, req.user.id]
    );
    if (pendingCheck.rows.length > 0) {
      return res.status(400).json({ error: { message: 'You already have a pending join request' } });
    }

    const { message } = req.body;

    // Delete any old rejected request before inserting
    await db.query(
      "DELETE FROM project_join_requests WHERE project_id = $1 AND user_id = $2 AND status = 'rejected'",
      [req.params.id, req.user.id]
    );

    const result = await db.query(
      'INSERT INTO project_join_requests (project_id, user_id, message) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, req.user.id, message || null]
    );

    // Notify admins and project lead about the join request
    try {
      const project = await db.query('SELECT title, lead_id FROM projects WHERE id = $1', [req.params.id]);
      const admins = await db.query(
        "SELECT id FROM users WHERE role = 'admin' AND id != $1 AND deleted_at IS NULL",
        [req.user.id]
      );

      const recipientIds = [...new Set([
        ...admins.rows.map(a => a.id),
        ...(project.rows[0]?.lead_id && project.rows[0].lead_id !== req.user.id ? [project.rows[0].lead_id] : [])
      ])];

      if (recipientIds.length > 0) {
        const notifications = await createNotificationForUsers(
          recipientIds,
          'system',
          `Join request: ${project.rows[0].title}`,
          `${req.user.name} has requested to join this project.`,
          req.params.id,
          'project'
        );

        for (const notification of notifications) {
          socketService.emitToUser(notification.user_id, 'notification', notification);
        }
      }
    } catch (notifError) {
      console.error('Failed to send join request notifications:', notifError);
    }

    res.status(201).json({ request: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// List pending join requests (lead/admin only)
router.get('/:id/join-requests', authenticate, async (req, res, next) => {
  try {
    // Check if user is lead or admin
    if (req.user.role !== 'admin') {
      const leadCheck = await db.query(
        "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2 AND role = 'lead'",
        [req.params.id, req.user.id]
      );
      if (leadCheck.rows.length === 0) {
        return res.status(403).json({ error: { message: 'Only project lead or admin can view join requests' } });
      }
    }

    const result = await db.query(`
      SELECT pjr.*, u.name as user_name, u.email as user_email, u.avatar_url as user_avatar
      FROM project_join_requests pjr
      JOIN users u ON pjr.user_id = u.id
      WHERE pjr.project_id = $1 AND pjr.status = 'pending'
      ORDER BY pjr.created_at ASC
    `, [req.params.id]);

    res.json({ requests: result.rows });
  } catch (error) {
    next(error);
  }
});

// Approve/reject join request (lead/admin only)
router.put('/:id/join-requests/:reqId', authenticate, [
  body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    // Check if user is lead or admin
    if (req.user.role !== 'admin') {
      const leadCheck = await db.query(
        "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2 AND role = 'lead'",
        [req.params.id, req.user.id]
      );
      if (leadCheck.rows.length === 0) {
        return res.status(403).json({ error: { message: 'Only project lead or admin can review join requests' } });
      }
    }

    const { action } = req.body;
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const result = await db.query(
      'UPDATE project_join_requests SET status = $1, reviewed_by = $2, updated_at = NOW() WHERE id = $3 AND project_id = $4 RETURNING *',
      [newStatus, req.user.id, req.params.reqId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Join request not found' } });
    }

    // If approved, add user as member
    if (action === 'approve') {
      await db.query(
        "INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
        [req.params.id, result.rows[0].user_id]
      );
    }

    res.json({ request: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Leave project
router.delete('/:id/leave', authenticate, async (req, res, next) => {
  try {
    // Check if user is the lead
    const memberResult = await db.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (memberResult.rows.length === 0) {
      return res.status(400).json({ error: { message: 'You are not a member of this project' } });
    }

    if (memberResult.rows[0].role === 'lead') {
      return res.status(400).json({ error: { message: 'Project lead cannot leave. Assign a new lead first.' } });
    }

    await db.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    res.json({ message: 'Left project successfully' });
  } catch (error) {
    next(error);
  }
});

// Assign/change project lead (admin only)
router.put('/:id/lead', authenticate, requireRole('admin'), [
  body('user_id').notEmpty().withMessage('User ID is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { user_id } = req.body;
    const projectId = req.params.id;

    // Verify project exists
    const projectCheck = await db.query('SELECT id, lead_id FROM projects WHERE id = $1', [projectId]);
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    // Demote old lead to member (if exists)
    const oldLeadId = projectCheck.rows[0].lead_id;
    if (oldLeadId) {
      await db.query(
        "UPDATE project_members SET role = 'member' WHERE project_id = $1 AND user_id = $2 AND role = 'lead'",
        [projectId, oldLeadId]
      );
    }

    // Add new lead as member if not already
    await db.query(
      "INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'lead') ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'lead'",
      [projectId, user_id]
    );

    // Update projects table
    await db.query('UPDATE projects SET lead_id = $1 WHERE id = $2', [user_id, projectId]);

    res.json({ message: 'Project lead updated successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
