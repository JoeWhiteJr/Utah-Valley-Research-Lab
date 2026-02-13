const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const publicRouter = express.Router();
const adminRouter = express.Router();

// ─── Public Routes (no auth) ────────────────────────────────────────

// GET /api/public/site-content/:section
publicRouter.get('/site-content/:section', async (req, res, next) => {
  try {
    const { section } = req.params;
    const result = await db.query(
      'SELECT key, value FROM site_content WHERE section = $1',
      [section]
    );

    const content = {};
    for (const row of result.rows) {
      content[row.key] = row.value;
    }

    res.json({ section, content });
  } catch (error) {
    next(error);
  }
});

// GET /api/public/team
publicRouter.get('/team', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, name, role, title, bio, category, email, linkedin_url, photo_url
       FROM public_team_members
       WHERE is_visible = true
       ORDER BY display_order ASC, created_at ASC`
    );

    // Group by category
    const grouped = {};
    for (const member of result.rows) {
      if (!grouped[member.category]) grouped[member.category] = [];
      grouped[member.category].push(member);
    }

    res.json({ team: grouped });
  } catch (error) {
    next(error);
  }
});

// ─── Admin Routes (auth + admin role) ───────────────────────────────

adminRouter.use(authenticate);
adminRouter.use(requireRole('admin'));

// GET /api/admin/site-content
adminRouter.get('/site-content', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, section, key, value, updated_by, updated_at FROM site_content ORDER BY section, key'
    );

    // Group by section
    const sections = {};
    for (const row of result.rows) {
      if (!sections[row.section]) sections[row.section] = {};
      sections[row.section][row.key] = { id: row.id, value: row.value, updated_at: row.updated_at };
    }

    res.json({ sections });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/site-content/:section
adminRouter.put('/site-content/:section', [
  param('section').trim().notEmpty().isLength({ max: 100 }),
  body('key').isString().trim().notEmpty().isLength({ max: 100 }),
  body('value').exists(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { section } = req.params;
    const { key, value } = req.body;

    const result = await db.query(
      `INSERT INTO site_content (section, key, value, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (section, key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING *`,
      [section, key, JSON.stringify(value), req.user.id]
    );

    res.json({ content: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/team-members
adminRouter.get('/team-members', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM public_team_members ORDER BY category, display_order ASC, created_at ASC'
    );
    res.json({ members: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/team-members
adminRouter.post('/team-members', [
  body('name').isString().trim().notEmpty().isLength({ max: 200 }),
  body('category').isString().trim().notEmpty().isLength({ max: 100 }),
  body('role').optional().trim().isLength({ max: 100 }),
  body('title').optional().trim().isLength({ max: 200 }),
  body('bio').optional().trim().isLength({ max: 5000 }),
  body('email').optional({ values: 'falsy' }).isEmail(),
  body('linkedin_url').optional({ values: 'falsy' }).isURL(),
  body('display_order').optional().isInt({ min: 0, max: 999 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { name, role, title, bio, category, email, linkedin_url, photo_url, display_order, is_visible } = req.body;

    const result = await db.query(
      `INSERT INTO public_team_members (name, role, title, bio, category, email, linkedin_url, photo_url, display_order, is_visible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (name, category) DO NOTHING
       RETURNING *`,
      [name, role || null, title || null, bio || '', category, email || null, linkedin_url || null, photo_url || null, display_order || 0, is_visible !== false]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: { message: 'A team member with this name and category already exists' } });
    }

    res.status(201).json({ member: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/team-members/:id
adminRouter.put('/team-members/:id', [
  param('id').isUUID(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { id } = req.params;
    const { name, role, title, bio, category, email, linkedin_url, photo_url, display_order, is_visible } = req.body;

    const result = await db.query(
      `UPDATE public_team_members SET
        name = COALESCE($2, name),
        role = COALESCE($3, role),
        title = $4,
        bio = COALESCE($5, bio),
        category = COALESCE($6, category),
        email = $7,
        linkedin_url = $8,
        photo_url = $9,
        display_order = COALESCE($10, display_order),
        is_visible = COALESCE($11, is_visible)
       WHERE id = $1
       RETURNING *`,
      [id, name, role, title || null, bio, category, email || null, linkedin_url || null, photo_url || null, display_order, is_visible]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Team member not found' } });
    }

    res.json({ member: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/team-members/:id
adminRouter.delete('/team-members/:id', [
  param('id').isUUID(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const result = await db.query(
      'DELETE FROM public_team_members WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Team member not found' } });
    }

    res.json({ message: 'Team member deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = { publicRouter, adminRouter };
