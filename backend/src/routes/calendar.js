const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/sanitize');

// All calendar routes require authentication
router.use(authenticate);

// Helper: check if user can manage lab events
const canManageLab = (user) => user.role === 'admin' || user.role === 'project_lead';

// Helper: validate request
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
  }
  return null;
};

// ==========================================
// EVENTS
// ==========================================

// GET /api/calendar/events/deadlines - Get action item due dates as calendar events
// (must be before /:id route)
router.get('/events/deadlines', [
  query('start').isISO8601().withMessage('start date required'),
  query('end').isISO8601().withMessage('end date required'),
], async (req, res, next) => {
  const err = validate(req, res);
  if (err) return;

  try {
    const { start, end } = req.query;

    const result = await db.query(
      `SELECT ai.id, ai.title, ai.due_date, ai.completed,
              p.id as project_id, p.title as project_title,
              ai.assigned_to
       FROM action_items ai
       JOIN projects p ON ai.project_id = p.id
       WHERE ai.due_date IS NOT NULL
         AND ai.due_date >= $1::date
         AND ai.due_date <= $2::date
         AND ai.completed = false
         AND ai.assigned_to = $3
       ORDER BY ai.due_date ASC`,
      [start, end, req.user.id]
    );

    // Map to calendar-event-like shape
    const deadlines = result.rows.map(row => ({
      id: `deadline-${row.id}`,
      title: row.title,
      start_time: new Date(row.due_date).toISOString(),
      end_time: new Date(row.due_date).toISOString(),
      all_day: true,
      scope: 'deadline',
      project_id: row.project_id,
      project_title: row.project_title,
      assigned_to: row.assigned_to,
      is_deadline: true,
    }));

    res.json({ deadlines });
  } catch (error) {
    next(error);
  }
});

// GET /api/calendar/events - List events with filters
router.get('/events', [
  query('start').isISO8601().withMessage('start date required'),
  query('end').isISO8601().withMessage('end date required'),
], async (req, res, next) => {
  const err = validate(req, res);
  if (err) return;

  try {
    const { scope, start, end, project_id, category_id } = req.query;
    const userId = req.user.id;

    let whereClause = 'WHERE ce.start_time <= $1 AND ce.end_time >= $2';
    const params = [end, start];
    let paramIndex = 3;

    // Scope filtering
    if (scope === 'lab') {
      whereClause += ` AND ce.scope = 'lab'`;
    } else if (scope === 'personal') {
      whereClause += ` AND ce.scope = 'personal' AND ce.created_by = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    } else if (scope === 'project') {
      whereClause += ` AND ce.scope = 'project'`;
    } else if (scope === 'dashboard') {
      // Dashboard: personal events + project events from joined projects
      whereClause += ` AND (
        (ce.scope = 'personal' AND ce.created_by = $${paramIndex})
        OR (ce.scope = 'project' AND ce.project_id IN (
          SELECT project_id FROM project_members WHERE user_id = $${paramIndex}
        ))
      )`;
      params.push(userId);
      paramIndex++;
    } else {
      // 'all' or default: lab events + own personal events + project events from joined projects
      whereClause += ` AND (ce.scope = 'lab' OR (ce.scope = 'personal' AND ce.created_by = $${paramIndex})
        OR (ce.scope = 'project' AND ce.project_id IN (
          SELECT project_id FROM project_members WHERE user_id = $${paramIndex}
        )))`;
      params.push(userId);
      paramIndex++;
    }

    // Optional project filter
    if (project_id) {
      whereClause += ` AND ce.project_id = $${paramIndex}`;
      params.push(project_id);
      paramIndex++;
    }

    // Optional category filter
    if (category_id) {
      whereClause += ` AND ce.category_id = $${paramIndex}`;
      params.push(category_id);
      paramIndex++;
    }

    const result = await db.query(
      `SELECT ce.*,
              u.name as creator_name,
              cc.name as category_name, cc.color as category_color,
              p.title as project_title,
              m.title as meeting_title,
              (SELECT json_agg(json_build_object(
                'user_id', cea.user_id,
                'status', cea.status,
                'name', au.name
              )) FROM calendar_event_attendees cea
              JOIN users au ON cea.user_id = au.id
              WHERE cea.event_id = ce.id) as attendees
       FROM calendar_events ce
       LEFT JOIN users u ON ce.created_by = u.id
       LEFT JOIN calendar_categories cc ON ce.category_id = cc.id
       LEFT JOIN projects p ON ce.project_id = p.id
       LEFT JOIN meetings m ON ce.meeting_id = m.id
       ${whereClause}
       ORDER BY ce.start_time ASC`,
      params
    );

    res.json({ events: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/calendar/events/:id - Get single event
router.get('/events/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT ce.*,
              u.name as creator_name,
              cc.name as category_name, cc.color as category_color,
              p.title as project_title,
              m.title as meeting_title,
              (SELECT json_agg(json_build_object(
                'user_id', cea.user_id,
                'status', cea.status,
                'name', au.name
              )) FROM calendar_event_attendees cea
              JOIN users au ON cea.user_id = au.id
              WHERE cea.event_id = ce.id) as attendees
       FROM calendar_events ce
       LEFT JOIN users u ON ce.created_by = u.id
       LEFT JOIN calendar_categories cc ON ce.category_id = cc.id
       LEFT JOIN projects p ON ce.project_id = p.id
       LEFT JOIN meetings m ON ce.meeting_id = m.id
       WHERE ce.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Event not found' } });
    }

    const event = result.rows[0];

    // Privacy check: personal events only visible to owner
    if (event.scope === 'personal' && event.created_by !== req.user.id) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }

    // Privacy check: project events only visible to members and admins
    if (event.scope === 'project' && req.user.role !== 'admin') {
      const memberCheck = await db.query(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
        [event.project_id, req.user.id]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    }

    res.json({ event });
  } catch (error) {
    next(error);
  }
});

// POST /api/calendar/events - Create event
router.post('/events', sanitizeBody('notes'), [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('start_time').isISO8601().withMessage('Valid start time required'),
  body('end_time').isISO8601().withMessage('Valid end time required'),
  body('scope').isIn(['lab', 'personal', 'project']).withMessage('Scope must be lab, personal, or project'),
], async (req, res, next) => {
  const err = validate(req, res);
  if (err) return;

  try {
    const { title, description, start_time, end_time, all_day, scope,
            category_id, project_id, meeting_id, repeat_rule, reminders, notes, attendee_ids } = req.body;

    // Permission check: only admin/project_lead can create lab events
    if (scope === 'lab' && !canManageLab(req.user)) {
      return res.status(403).json({ error: { message: 'Only admins and project leads can create lab events' } });
    }

    // Permission check: project events require membership and project_id
    if (scope === 'project') {
      if (!project_id) {
        return res.status(400).json({ error: { message: 'project_id is required for project events' } });
      }
      const memberCheck = await db.query(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
        [project_id, req.user.id]
      );
      if (memberCheck.rows.length === 0 && req.user.role !== 'admin') {
        return res.status(403).json({ error: { message: 'You must be a project member to create project events' } });
      }
    }

    const result = await db.query(
      `INSERT INTO calendar_events (title, description, start_time, end_time, all_day, scope,
        created_by, category_id, project_id, meeting_id, repeat_rule, reminders, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [title, description || '', start_time, end_time, all_day || false, scope,
       req.user.id, category_id || null, project_id || null, meeting_id || null,
       repeat_rule ? JSON.stringify(repeat_rule) : null,
       JSON.stringify(reminders || []), notes || '']
    );

    const event = result.rows[0];

    // Add attendees if provided
    if (attendee_ids && attendee_ids.length > 0) {
      for (const userId of attendee_ids) {
        await db.query(
          `INSERT INTO calendar_event_attendees (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [event.id, userId]
        );
      }
    }

    // Fetch complete event with joins
    const fullResult = await db.query(
      `SELECT ce.*,
              u.name as creator_name,
              cc.name as category_name, cc.color as category_color,
              p.title as project_title,
              m.title as meeting_title,
              (SELECT json_agg(json_build_object(
                'user_id', cea.user_id,
                'status', cea.status,
                'name', au.name
              )) FROM calendar_event_attendees cea
              JOIN users au ON cea.user_id = au.id
              WHERE cea.event_id = ce.id) as attendees
       FROM calendar_events ce
       LEFT JOIN users u ON ce.created_by = u.id
       LEFT JOIN calendar_categories cc ON ce.category_id = cc.id
       LEFT JOIN projects p ON ce.project_id = p.id
       LEFT JOIN meetings m ON ce.meeting_id = m.id
       WHERE ce.id = $1`,
      [event.id]
    );

    res.status(201).json({ event: fullResult.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PUT /api/calendar/events/:id - Update event
router.put('/events/:id', sanitizeBody('notes'), [
  body('title').optional().trim().notEmpty(),
  body('start_time').optional().isISO8601(),
  body('end_time').optional().isISO8601(),
], async (req, res, next) => {
  try {
    // Fetch existing event
    const existing = await db.query('SELECT * FROM calendar_events WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Event not found' } });
    }

    const event = existing.rows[0];

    // Permission check
    if (event.scope === 'lab' && !canManageLab(req.user)) {
      return res.status(403).json({ error: { message: 'Only admins and project leads can edit lab events' } });
    }
    if (event.scope === 'personal' && event.created_by !== req.user.id) {
      return res.status(403).json({ error: { message: 'You can only edit your own personal events' } });
    }
    if (event.scope === 'project') {
      const memberCheck = await db.query(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
        [event.project_id, req.user.id]
      );
      if (memberCheck.rows.length === 0 && req.user.role !== 'admin') {
        return res.status(403).json({ error: { message: 'You must be a project member to edit project events' } });
      }
    }

    const { title, description, start_time, end_time, all_day,
            category_id, project_id, meeting_id, repeat_rule, reminders, notes, attendee_ids } = req.body;

    await db.query(
      `UPDATE calendar_events SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        start_time = COALESCE($3, start_time),
        end_time = COALESCE($4, end_time),
        all_day = COALESCE($5, all_day),
        category_id = $6,
        project_id = $7,
        meeting_id = $8,
        repeat_rule = $9,
        reminders = COALESCE($10, reminders),
        notes = COALESCE($11, notes),
        updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [title, description, start_time, end_time, all_day,
       category_id !== undefined ? category_id : event.category_id,
       project_id !== undefined ? project_id : event.project_id,
       meeting_id !== undefined ? meeting_id : event.meeting_id,
       repeat_rule !== undefined ? (repeat_rule ? JSON.stringify(repeat_rule) : null) : event.repeat_rule,
       reminders ? JSON.stringify(reminders) : undefined,
       notes, req.params.id]
    );

    // Update attendees if provided
    if (attendee_ids !== undefined) {
      await db.query('DELETE FROM calendar_event_attendees WHERE event_id = $1', [req.params.id]);
      for (const userId of (attendee_ids || [])) {
        await db.query(
          `INSERT INTO calendar_event_attendees (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [req.params.id, userId]
        );
      }
    }

    // Fetch complete event
    const fullResult = await db.query(
      `SELECT ce.*,
              u.name as creator_name,
              cc.name as category_name, cc.color as category_color,
              p.title as project_title,
              m.title as meeting_title,
              (SELECT json_agg(json_build_object(
                'user_id', cea.user_id,
                'status', cea.status,
                'name', au.name
              )) FROM calendar_event_attendees cea
              JOIN users au ON cea.user_id = au.id
              WHERE cea.event_id = ce.id) as attendees
       FROM calendar_events ce
       LEFT JOIN users u ON ce.created_by = u.id
       LEFT JOIN calendar_categories cc ON ce.category_id = cc.id
       LEFT JOIN projects p ON ce.project_id = p.id
       LEFT JOIN meetings m ON ce.meeting_id = m.id
       WHERE ce.id = $1`,
      [req.params.id]
    );

    res.json({ event: fullResult.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/calendar/events/:id - Delete event
router.delete('/events/:id', async (req, res, next) => {
  try {
    const existing = await db.query('SELECT * FROM calendar_events WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Event not found' } });
    }

    const event = existing.rows[0];

    if (event.scope === 'lab' && !canManageLab(req.user)) {
      return res.status(403).json({ error: { message: 'Only admins and project leads can delete lab events' } });
    }
    if (event.scope === 'personal' && event.created_by !== req.user.id) {
      return res.status(403).json({ error: { message: 'You can only delete your own personal events' } });
    }
    if (event.scope === 'project') {
      const memberCheck = await db.query(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
        [event.project_id, req.user.id]
      );
      if (memberCheck.rows.length === 0 && req.user.role !== 'admin') {
        return res.status(403).json({ error: { message: 'You must be a project member to delete project events' } });
      }
    }

    await db.query('DELETE FROM calendar_events WHERE id = $1', [req.params.id]);
    res.json({ message: 'Event deleted' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/calendar/events/:id/move - Move/resize event (drag-drop)
router.patch('/events/:id/move', [
  body('start_time').isISO8601().withMessage('Valid start time required'),
  body('end_time').isISO8601().withMessage('Valid end time required'),
], async (req, res, next) => {
  const err = validate(req, res);
  if (err) return;

  try {
    const existing = await db.query('SELECT * FROM calendar_events WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Event not found' } });
    }

    const event = existing.rows[0];

    if (event.scope === 'lab' && !canManageLab(req.user)) {
      return res.status(403).json({ error: { message: 'Insufficient permissions' } });
    }
    if (event.scope === 'personal' && event.created_by !== req.user.id) {
      return res.status(403).json({ error: { message: 'Access denied' } });
    }
    if (event.scope === 'project') {
      const memberCheck = await db.query(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
        [event.project_id, req.user.id]
      );
      if (memberCheck.rows.length === 0 && req.user.role !== 'admin') {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    }

    const { start_time, end_time } = req.body;

    const result = await db.query(
      `UPDATE calendar_events SET start_time = $1, end_time = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [start_time, end_time, req.params.id]
    );

    res.json({ event: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/calendar/events/:id/attend - RSVP to event
router.post('/events/:id/attend', [
  body('status').isIn(['accepted', 'declined']).withMessage('Status must be accepted or declined'),
], async (req, res, next) => {
  const err = validate(req, res);
  if (err) return;

  try {
    const { status } = req.body;

    const result = await db.query(
      `UPDATE calendar_event_attendees
       SET status = $1, responded_at = NOW()
       WHERE event_id = $2 AND user_id = $3
       RETURNING *`,
      [status, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'You are not an attendee of this event' } });
    }

    res.json({ attendee: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// CATEGORIES
// ==========================================

// GET /api/calendar/categories - List categories
router.get('/categories', async (req, res, next) => {
  try {
    const { scope } = req.query;
    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    if (scope === 'personal') {
      whereClause = `WHERE scope = 'personal' AND created_by = $${paramIndex}`;
      params.push(req.user.id);
      paramIndex++;
    } else if (scope === 'lab') {
      whereClause = `WHERE scope = 'lab'`;
    } else if (scope) {
      whereClause = `WHERE scope = $${paramIndex}`;
      params.push(scope);
      paramIndex++;
    }

    const result = await db.query(
      `SELECT * FROM calendar_categories ${whereClause} ORDER BY name ASC`,
      params
    );

    res.json({ categories: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/calendar/categories - Create category
router.post('/categories', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('color').matches(/^#[0-9a-fA-F]{6}$/).withMessage('Color must be a valid hex color'),
  body('scope').optional().isIn(['lab', 'personal']),
], async (req, res, next) => {
  const err = validate(req, res);
  if (err) return;

  try {
    const { name, color, scope } = req.body;
    const categoryScope = scope || 'lab';

    // Only admin/project_lead can create lab categories
    if (categoryScope === 'lab' && !canManageLab(req.user)) {
      return res.status(403).json({ error: { message: 'Only admins and project leads can create lab categories' } });
    }

    const result = await db.query(
      `INSERT INTO calendar_categories (name, color, scope, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, color, categoryScope, req.user.id]
    );

    res.status(201).json({ category: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: { message: 'Category name already exists for this scope' } });
    }
    next(error);
  }
});

// PUT /api/calendar/categories/:id - Update category
router.put('/categories/:id', [
  body('name').optional().trim().notEmpty(),
  body('color').optional().matches(/^#[0-9a-fA-F]{6}$/),
], async (req, res, next) => {
  try {
    const existing = await db.query('SELECT * FROM calendar_categories WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Category not found' } });
    }

    const category = existing.rows[0];

    // Permission check: lab categories need admin/project_lead, personal only owner
    if (category.scope === 'lab' && !canManageLab(req.user)) {
      return res.status(403).json({ error: { message: 'Only admins and project leads can edit lab categories' } });
    }
    if (category.scope === 'personal' && category.created_by !== req.user.id) {
      return res.status(403).json({ error: { message: 'You can only edit your own categories' } });
    }

    const { name, color } = req.body;

    const result = await db.query(
      `UPDATE calendar_categories SET
        name = COALESCE($1, name),
        color = COALESCE($2, color)
       WHERE id = $3 RETURNING *`,
      [name, color, req.params.id]
    );

    res.json({ category: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/calendar/categories/:id - Delete category
router.delete('/categories/:id', async (req, res, next) => {
  try {
    const existing = await db.query('SELECT * FROM calendar_categories WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Category not found' } });
    }

    const category = existing.rows[0];

    // Permission check: lab categories need admin/project_lead, personal only owner
    if (category.scope === 'lab' && !canManageLab(req.user)) {
      return res.status(403).json({ error: { message: 'Only admins and project leads can delete lab categories' } });
    }
    if (category.scope === 'personal' && category.created_by !== req.user.id) {
      return res.status(403).json({ error: { message: 'You can only delete your own categories' } });
    }

    await db.query('DELETE FROM calendar_categories WHERE id = $1', [req.params.id]);
    res.json({ message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
