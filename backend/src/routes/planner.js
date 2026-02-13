const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Lazy load Google Generative AI SDK (same pattern as ai.js)
let GoogleGenerativeAI = null;
let genAI = null;

const getModel = (modelName = 'gemini-2.5-flash') => {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!genAI) {
    try {
      if (!GoogleGenerativeAI) {
        ({ GoogleGenerativeAI } = require('@google/generative-ai'));
      }
      genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    } catch (error) {
      logger.error({ err: error }, 'Failed to initialize Google AI client');
      return null;
    }
  }
  return genAI.getGenerativeModel({ model: modelName });
};

// Strip markdown fences from AI response before JSON parsing
const parseAIJson = (text) => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
  }
  return JSON.parse(cleaned);
};

// ============================================================
// GET /api/planner/today - Fetch today's plan + pending check-in
// ============================================================
router.get('/today', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Fetch today's plan with steps
    const planRes = await db.query(
      `SELECT * FROM daily_plans WHERE user_id = $1 AND plan_date = $2`,
      [userId, today]
    );

    let plan = null;
    let steps = [];
    let checkin = null;

    if (planRes.rows.length > 0) {
      plan = planRes.rows[0];
      const stepsRes = await db.query(
        `SELECT * FROM daily_plan_steps WHERE plan_id = $1 ORDER BY sort_order ASC, priority_score DESC`,
        [plan.id]
      );
      steps = stepsRes.rows;
    }

    // Check for pending check-in (yesterday's incomplete steps)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const checkinRes = await db.query(
      `SELECT c.* FROM daily_plan_checkins c
       JOIN daily_plans p ON c.plan_id = p.id
       WHERE c.user_id = $1 AND p.plan_date = $2 AND c.responded_at IS NULL AND c.dismissed = false
       ORDER BY c.created_at DESC LIMIT 1`,
      [userId, yesterdayStr]
    );

    if (checkinRes.rows.length > 0) {
      checkin = checkinRes.rows[0];
    }

    res.json({ plan, steps, checkin });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/planner/generate - Generate/regenerate daily plan
// ============================================================
router.post('/generate', authenticate, [
  body('force').optional().isBoolean()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const model = getModel();
    if (!model) {
      return res.status(503).json({
        error: { message: 'AI features are not available. GEMINI_API_KEY not configured.' }
      });
    }

    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const force = req.body.force === true;

    // Check for existing plan
    const existingPlan = await db.query(
      `SELECT id FROM daily_plans WHERE user_id = $1 AND plan_date = $2`,
      [userId, today]
    );

    if (existingPlan.rows.length > 0 && !force) {
      return res.status(409).json({
        error: { message: 'Plan already exists for today. Use force: true to regenerate.' }
      });
    }

    // Gather all user data in parallel
    const [
      actionsRes,
      eventsRes,
      meetingsRes,
      projectsRes,
      notesRes,
      pastPlansRes,
      yesterdayStepsRes
    ] = await Promise.all([
      // Action items assigned to user (incomplete + recently completed)
      db.query(`
        SELECT ai.id, ai.title, ai.description, ai.completed, ai.due_date, ai.priority,
               p.title as project_title, p.id as project_id
        FROM action_items ai
        JOIN projects p ON ai.project_id = p.id
        LEFT JOIN action_item_assignees aia ON ai.id = aia.action_item_id
        WHERE (ai.assigned_to = $1 OR aia.user_id = $1)
          AND ai.deleted_at IS NULL
          AND (ai.completed = false OR ai.updated_at >= NOW() - INTERVAL '2 days')
        ORDER BY ai.completed ASC, ai.due_date ASC NULLS LAST
        LIMIT 50
      `, [userId]),

      // Calendar events for today + next 3 days
      db.query(`
        SELECT id, title, description, start_time, end_time, scope, all_day
        FROM calendar_events
        WHERE (created_by = $1 OR scope IN ('lab'))
          AND start_time >= $2::date
          AND start_time < ($2::date + INTERVAL '4 days')
          AND deleted_at IS NULL
        ORDER BY start_time ASC
      `, [userId, today]),

      // Upcoming meetings for user's projects
      db.query(`
        SELECT m.title, m.recorded_at, p.title as project_title
        FROM meetings m
        JOIN projects p ON m.project_id = p.id
        JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = $1 AND m.deleted_at IS NULL
          AND m.created_at >= NOW() - INTERVAL '7 days'
        ORDER BY m.recorded_at DESC NULLS LAST
        LIMIT 10
      `, [userId]),

      // Projects user is a member of with progress
      db.query(`
        SELECT p.id, p.title, p.status, p.progress,
          (SELECT COUNT(*) FROM action_items ai WHERE ai.project_id = p.id AND ai.deleted_at IS NULL) as total_tasks,
          (SELECT COUNT(*) FROM action_items ai WHERE ai.project_id = p.id AND ai.completed = true AND ai.deleted_at IS NULL) as completed_tasks
        FROM projects p
        JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = $1 AND p.status = 'active' AND p.deleted_at IS NULL
        ORDER BY p.updated_at DESC
      `, [userId]),

      // Recent notes from user's projects
      db.query(`
        SELECT n.title, n.content, p.title as project_title
        FROM notes n
        JOIN projects p ON n.project_id = p.id
        JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = $1 AND n.deleted_at IS NULL
          AND n.created_at >= NOW() - INTERVAL '7 days'
        ORDER BY n.created_at DESC
        LIMIT 10
      `, [userId]),

      // Last 5 daily plans with completion stats
      db.query(`
        SELECT dp.plan_date, dp.ai_summary,
          (SELECT COUNT(*) FROM daily_plan_steps s WHERE s.plan_id = dp.id) as total_steps,
          (SELECT COUNT(*) FROM daily_plan_steps s WHERE s.plan_id = dp.id AND s.completed = true) as completed_steps
        FROM daily_plans dp
        WHERE dp.user_id = $1
        ORDER BY dp.plan_date DESC
        LIMIT 5
      `, [userId]),

      // Yesterday's incomplete steps (for carry-forward)
      db.query(`
        SELECT s.title, s.description, s.priority_label, s.source_type, s.source_id
        FROM daily_plan_steps s
        JOIN daily_plans dp ON s.plan_id = dp.id
        WHERE dp.user_id = $1
          AND dp.plan_date = ($2::date - INTERVAL '1 day')::date
          AND s.completed = false
        ORDER BY s.priority_score DESC
      `, [userId, today])
    ]);

    const actions = actionsRes.rows;
    const events = eventsRes.rows;
    const meetings = meetingsRes.rows;
    const projects = projectsRes.rows;
    const notes = notesRes.rows;
    const pastPlans = pastPlansRes.rows;
    const yesterdayIncomplete = yesterdayStepsRes.rows;

    // Build context for AI
    const now = new Date();
    let contextText = `TODAY: ${today} (${now.toLocaleDateString('en-US', { weekday: 'long' })})\n`;
    contextText += `USER: ${req.user.name}\n\n`;

    // Action items
    contextText += `ACTION ITEMS (${actions.length}):\n`;
    actions.forEach(a => {
      contextText += `- [${a.completed ? 'DONE' : 'TODO'}] "${a.title}" in "${a.project_title}"`;
      if (a.priority) contextText += ` [${a.priority}]`;
      if (a.due_date) contextText += ` (due: ${new Date(a.due_date).toLocaleDateString()})`;
      if (a.description) contextText += ` — ${a.description.substring(0, 150)}`;
      contextText += ` | id:${a.id}\n`;
    });

    // Calendar events
    if (events.length > 0) {
      contextText += `\nCALENDAR EVENTS (next 4 days):\n`;
      events.forEach(e => {
        const start = new Date(e.start_time);
        contextText += `- "${e.title}" on ${start.toLocaleDateString()} at ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        if (e.all_day) contextText += ' (all day)';
        contextText += '\n';
      });
    }

    // Meetings
    if (meetings.length > 0) {
      contextText += `\nRECENT MEETINGS:\n`;
      meetings.forEach(m => {
        contextText += `- "${m.title}" for "${m.project_title}"`;
        if (m.recorded_at) contextText += ` (${new Date(m.recorded_at).toLocaleDateString()})`;
        contextText += '\n';
      });
    }

    // Projects
    contextText += `\nACTIVE PROJECTS (${projects.length}):\n`;
    projects.forEach(p => {
      contextText += `- "${p.title}" — ${p.progress || 0}% complete, ${p.completed_tasks}/${p.total_tasks} tasks done\n`;
    });

    // Notes
    if (notes.length > 0) {
      contextText += `\nRECENT NOTES:\n`;
      notes.forEach(n => {
        contextText += `- "${n.title}" in "${n.project_title}": ${(n.content || '').substring(0, 100)}\n`;
      });
    }

    // Past plan performance
    if (pastPlans.length > 0) {
      contextText += `\nPAST PLAN HISTORY:\n`;
      pastPlans.forEach(pp => {
        const rate = pp.total_steps > 0 ? Math.round((pp.completed_steps / pp.total_steps) * 100) : 0;
        contextText += `- ${pp.plan_date}: ${pp.completed_steps}/${pp.total_steps} steps completed (${rate}%)\n`;
      });
    }

    // Yesterday's incomplete
    if (yesterdayIncomplete.length > 0) {
      contextText += `\nYESTERDAY'S INCOMPLETE STEPS (carry forward):\n`;
      yesterdayIncomplete.forEach(s => {
        contextText += `- "${s.title}" [${s.priority_label}]`;
        if (s.description) contextText += ` — ${s.description.substring(0, 100)}`;
        contextText += '\n';
      });
    }

    const systemPrompt = `You are an AI daily planner for a research lab project management tool. Generate a prioritized daily plan for the user.

RULES:
- Break tasks into actionable steps of 15-60 minutes each
- Assign priority_score (0-10) based on deadline proximity, project importance, and urgency
- Assign priority_label: critical (9-10), high (7-8), medium (4-6), low (0-3)
- Plan for ~6-8 hours of productive work capacity
- Carry forward yesterday's incomplete items with appropriate priority bumps
- If a step relates to an action item, set source_type to "action_item" and source_id to the action item's UUID
- If a step relates to a calendar event, set source_type to "calendar_event" and source_id to null
- Group related steps logically and set sort_order (0-indexed)

RESPOND WITH JSON ONLY (no markdown, no explanation):
{
  "summary": "Brief overview of today's plan (2-3 sentences)",
  "steps": [
    {
      "title": "Step title",
      "description": "What to do and why",
      "estimated_minutes": 30,
      "priority_score": 8,
      "priority_label": "high",
      "source_type": "action_item" | "calendar_event" | null,
      "source_id": "uuid-or-null",
      "sort_order": 0
    }
  ]
}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Generate my daily plan based on this data:\n\n${contextText}` }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] }
    });

    const responseText = result.response.text();
    const tokenUsage = {
      input_tokens: result.response.usageMetadata?.promptTokenCount,
      output_tokens: result.response.usageMetadata?.candidatesTokenCount
    };

    let parsed;
    try {
      parsed = parseAIJson(responseText);
    } catch (parseErr) {
      logger.error({ err: parseErr, responseText }, 'Failed to parse AI plan response');
      return res.status(502).json({ error: { message: 'AI returned an invalid response. Please try again.' } });
    }

    // Store plan + steps in a transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing plan if regenerating
      if (existingPlan.rows.length > 0) {
        await client.query('DELETE FROM daily_plans WHERE id = $1', [existingPlan.rows[0].id]);
      }

      // Insert plan
      const planInsert = await client.query(
        `INSERT INTO daily_plans (user_id, plan_date, ai_summary, ai_prompt_context, token_usage)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, today, parsed.summary, JSON.stringify({ contextText }), JSON.stringify(tokenUsage)]
      );
      const plan = planInsert.rows[0];

      // Insert steps
      const steps = [];
      if (parsed.steps && Array.isArray(parsed.steps)) {
        for (let i = 0; i < parsed.steps.length; i++) {
          const s = parsed.steps[i];
          const stepInsert = await client.query(
            `INSERT INTO daily_plan_steps (plan_id, title, description, estimated_minutes, priority_score, priority_label, source_type, source_id, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
              plan.id,
              s.title,
              s.description || null,
              s.estimated_minutes || null,
              s.priority_score != null ? Math.min(10, Math.max(0, s.priority_score)) : null,
              ['critical', 'high', 'medium', 'low'].includes(s.priority_label) ? s.priority_label : null,
              s.source_type || null,
              s.source_id || null,
              s.sort_order != null ? s.sort_order : i
            ]
          );
          steps.push(stepInsert.rows[0]);
        }
      }

      // Create check-in for yesterday's incomplete steps if any
      if (yesterdayIncomplete.length > 0) {
        const yesterdayPlan = await client.query(
          `SELECT id FROM daily_plans WHERE user_id = $1 AND plan_date = ($2::date - INTERVAL '1 day')::date`,
          [userId, today]
        );
        if (yesterdayPlan.rows.length > 0) {
          // Check if check-in already exists
          const existingCheckin = await client.query(
            `SELECT id FROM daily_plan_checkins WHERE plan_id = $1 AND user_id = $2`,
            [yesterdayPlan.rows[0].id, userId]
          );
          if (existingCheckin.rows.length === 0) {
            const questions = yesterdayIncomplete.map(s => ({
              step_title: s.title,
              question: `How did "${s.title}" go?`
            }));
            await client.query(
              `INSERT INTO daily_plan_checkins (plan_id, user_id, ai_message, questions)
               VALUES ($1, $2, $3, $4)`,
              [
                yesterdayPlan.rows[0].id,
                userId,
                `You had ${yesterdayIncomplete.length} incomplete step(s) from yesterday. Let's check in on your progress.`,
                JSON.stringify(questions)
              ]
            );
          }
        }
      }

      await client.query('COMMIT');
      res.json({ plan, steps, tokenUsage });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({ error: { message: 'AI rate limit exceeded. Please try again later.' } });
    }
    next(error);
  }
});

// ============================================================
// PUT /api/planner/steps/:stepId/toggle - Toggle step completion
// ============================================================
router.put('/steps/:stepId/toggle', authenticate, [
  param('stepId').isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { stepId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const stepRes = await db.query(
      `SELECT s.* FROM daily_plan_steps s
       JOIN daily_plans p ON s.plan_id = p.id
       WHERE s.id = $1 AND p.user_id = $2`,
      [stepId, userId]
    );

    if (stepRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Step not found' } });
    }

    const step = stepRes.rows[0];
    const updated = await db.query(
      `UPDATE daily_plan_steps SET completed = $1 WHERE id = $2 RETURNING *`,
      [!step.completed, stepId]
    );

    res.json({ step: updated.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/planner/checkin/respond - Submit check-in responses
// ============================================================
router.post('/checkin/respond', authenticate, [
  body('checkinId').isUUID(),
  body('responses').isArray()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { checkinId, responses } = req.body;
    const userId = req.user.id;

    // Verify ownership
    const checkinRes = await db.query(
      `SELECT * FROM daily_plan_checkins WHERE id = $1 AND user_id = $2`,
      [checkinId, userId]
    );

    if (checkinRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Check-in not found' } });
    }

    const updated = await db.query(
      `UPDATE daily_plan_checkins SET responses = $1, responded_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(responses), checkinId]
    );

    res.json({ checkin: updated.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/planner/checkin/dismiss - Dismiss a check-in
// ============================================================
router.post('/checkin/dismiss', authenticate, [
  body('checkinId').isUUID()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { checkinId } = req.body;
    const userId = req.user.id;

    const updated = await db.query(
      `UPDATE daily_plan_checkins SET dismissed = true WHERE id = $1 AND user_id = $2 RETURNING *`,
      [checkinId, userId]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Check-in not found' } });
    }

    res.json({ checkin: updated.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /api/planner/history - Past plans with completion stats
// ============================================================
router.get('/history', authenticate, [
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('offset').optional().isInt({ min: 0 })
], async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 14;
    const offset = parseInt(req.query.offset) || 0;

    const plansRes = await db.query(
      `SELECT dp.*,
        (SELECT COUNT(*) FROM daily_plan_steps s WHERE s.plan_id = dp.id) as total_steps,
        (SELECT COUNT(*) FROM daily_plan_steps s WHERE s.plan_id = dp.id AND s.completed = true) as completed_steps,
        (SELECT SUM(estimated_minutes) FROM daily_plan_steps s WHERE s.plan_id = dp.id) as total_minutes,
        (SELECT SUM(estimated_minutes) FROM daily_plan_steps s WHERE s.plan_id = dp.id AND s.completed = true) as completed_minutes
       FROM daily_plans dp
       WHERE dp.user_id = $1
       ORDER BY dp.plan_date DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countRes = await db.query(
      `SELECT COUNT(*) as total FROM daily_plans WHERE user_id = $1`,
      [userId]
    );

    res.json({
      plans: plansRes.rows,
      total: parseInt(countRes.rows[0].total),
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /api/planner/weekly-review - Generate weekly review
// ============================================================
router.post('/weekly-review', authenticate, async (req, res, next) => {
  try {
    const model = getModel();
    if (!model) {
      return res.status(503).json({
        error: { message: 'AI features are not available. GEMINI_API_KEY not configured.' }
      });
    }

    const userId = req.user.id;

    // Calculate week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Check for existing review
    const existingReview = await db.query(
      `SELECT * FROM weekly_reviews WHERE user_id = $1 AND week_start = $2`,
      [userId, weekStartStr]
    );

    // Gather week's data
    const [plansRes, actionsCompletedRes, actionsCreatedRes] = await Promise.all([
      db.query(
        `SELECT dp.plan_date, dp.ai_summary,
          (SELECT COUNT(*) FROM daily_plan_steps s WHERE s.plan_id = dp.id) as total_steps,
          (SELECT COUNT(*) FROM daily_plan_steps s WHERE s.plan_id = dp.id AND s.completed = true) as completed_steps
         FROM daily_plans dp
         WHERE dp.user_id = $1 AND dp.plan_date >= $2 AND dp.plan_date < ($2::date + INTERVAL '7 days')
         ORDER BY dp.plan_date ASC`,
        [userId, weekStartStr]
      ),
      db.query(
        `SELECT ai.title, ai.updated_at, p.title as project_title
         FROM action_items ai
         JOIN projects p ON ai.project_id = p.id
         LEFT JOIN action_item_assignees aia ON ai.id = aia.action_item_id
         WHERE (ai.assigned_to = $1 OR aia.user_id = $1)
           AND ai.completed = true
           AND ai.updated_at >= $2::date AND ai.updated_at < ($2::date + INTERVAL '7 days')
         ORDER BY ai.updated_at DESC`,
        [userId, weekStartStr]
      ),
      db.query(
        `SELECT ai.title, ai.due_date, ai.completed, p.title as project_title
         FROM action_items ai
         JOIN projects p ON ai.project_id = p.id
         LEFT JOIN action_item_assignees aia ON ai.id = aia.action_item_id
         WHERE (ai.assigned_to = $1 OR aia.user_id = $1)
           AND ai.completed = false AND ai.deleted_at IS NULL
         ORDER BY ai.due_date ASC NULLS LAST
         LIMIT 20`,
        [userId]
      )
    ]);

    const plans = plansRes.rows;
    const completedActions = actionsCompletedRes.rows;
    const upcomingActions = actionsCreatedRes.rows;

    // Stats
    const totalSteps = plans.reduce((sum, p) => sum + parseInt(p.total_steps || 0), 0);
    const completedSteps = plans.reduce((sum, p) => sum + parseInt(p.completed_steps || 0), 0);
    const completionRate = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    const stats = {
      days_planned: plans.length,
      total_steps: totalSteps,
      completed_steps: completedSteps,
      completion_rate: completionRate,
      tasks_completed: completedActions.length,
      tasks_upcoming: upcomingActions.length
    };

    // Build context
    let contextText = `WEEKLY REVIEW for week of ${weekStartStr}\n`;
    contextText += `User: ${req.user.name}\n\n`;

    contextText += `DAILY PLANS:\n`;
    plans.forEach(p => {
      contextText += `- ${p.plan_date}: ${p.completed_steps}/${p.total_steps} steps completed. Summary: ${p.ai_summary || 'N/A'}\n`;
    });

    contextText += `\nTASKS COMPLETED THIS WEEK (${completedActions.length}):\n`;
    completedActions.forEach(a => {
      contextText += `- "${a.title}" in "${a.project_title}"\n`;
    });

    contextText += `\nUPCOMING TASKS (${upcomingActions.length}):\n`;
    upcomingActions.forEach(a => {
      contextText += `- "${a.title}" in "${a.project_title}"`;
      if (a.due_date) contextText += ` (due: ${new Date(a.due_date).toLocaleDateString()})`;
      contextText += '\n';
    });

    contextText += `\nSTATS: ${completionRate}% step completion rate, ${completedActions.length} tasks completed, ${plans.length} days planned`;

    const systemPrompt = `You are an AI weekly reviewer for a research lab project management tool. Generate an encouraging but honest weekly review.

Write in markdown format with these sections:
## What Got Done
Highlight accomplishments and completed tasks.

## What Slipped
Note incomplete items without being judgmental. Suggest how to tackle them.

## Coming Next Week
Preview upcoming deadlines and priorities.

## Insights
Brief observations about productivity patterns, with actionable suggestions.

Be supportive and concise. Use bullet points.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Generate my weekly review:\n\n${contextText}` }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] }
    });

    const summary = result.response.text() || 'Unable to generate review';
    const tokenUsage = {
      input_tokens: result.response.usageMetadata?.promptTokenCount,
      output_tokens: result.response.usageMetadata?.candidatesTokenCount
    };

    // Upsert weekly review
    let review;
    if (existingReview.rows.length > 0) {
      const updateRes = await db.query(
        `UPDATE weekly_reviews SET ai_summary = $1, stats = $2, token_usage = $3 WHERE id = $4 RETURNING *`,
        [summary, JSON.stringify(stats), JSON.stringify(tokenUsage), existingReview.rows[0].id]
      );
      review = updateRes.rows[0];
    } else {
      const insertRes = await db.query(
        `INSERT INTO weekly_reviews (user_id, week_start, ai_summary, stats, token_usage)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, weekStartStr, summary, JSON.stringify(stats), JSON.stringify(tokenUsage)]
      );
      review = insertRes.rows[0];
    }

    res.json({ review });
  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({ error: { message: 'AI rate limit exceeded. Please try again later.' } });
    }
    next(error);
  }
});

// ============================================================
// GET /api/planner/weekly-review - Fetch existing weekly review
// ============================================================
router.get('/weekly-review', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Calculate week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const reviewRes = await db.query(
      `SELECT * FROM weekly_reviews WHERE user_id = $1 AND week_start = $2`,
      [userId, weekStartStr]
    );

    res.json({ review: reviewRes.rows[0] || null });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
