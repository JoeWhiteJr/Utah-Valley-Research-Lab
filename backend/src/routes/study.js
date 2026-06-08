const express = require('express');
const crypto = require('crypto');
const { body, param, validationResult } = require('express-validator');
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, requireRole } = require('../middleware/auth');
const { createLimiter } = require('../middleware/rateLimiter');
const { getStudyConfig } = require('../research-studies');

const router = express.Router();

// Resolve a study by slug, or fall back to the most recently created active
// study when no slug is provided (the common case for /study root traffic).
// Returns { dbRow, config } or null when nothing matches.
async function resolveStudy(slug) {
  let dbRow;
  if (slug) {
    const result = await db.query(
      `SELECT id, slug, title, blurb, estimated_minutes, status, recruitment_target_per_condition
       FROM studies WHERE slug = $1`,
      [slug]
    );
    dbRow = result.rows[0];
  } else {
    const result = await db.query(
      `SELECT id, slug, title, blurb, estimated_minutes, status, recruitment_target_per_condition
       FROM studies WHERE status = 'active'
       ORDER BY created_at DESC LIMIT 1`
    );
    dbRow = result.rows[0];
  }
  if (!dbRow) return null;
  const config = getStudyConfig(dbRow.slug);
  if (!config) return null;
  return { dbRow, config };
}

const startLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many study sessions started, please try again later'
});

const saveLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many save requests, please slow down'
});

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(`uvrl-study:${ip}`).digest('hex').slice(0, 32);
}

function generateParticipantCode(studyConfig, experiment) {
  const prefix = studyConfig.experiments[experiment]?.prefix || 'XX';
  const random = crypto.randomBytes(12).toString('hex');
  return `${prefix}_${Date.now()}_${random}`;
}

// Pickers run inside the same transaction as the INSERT, gated by a Postgres
// advisory lock so concurrent /start calls can't all read the same counts and
// land in the same condition. The lock is held only for the picker + insert,
// not for the entire request. `xact_lock` auto-releases on COMMIT/ROLLBACK.
// The lock key is scoped per-study so concurrent /start calls on different
// studies don't serialize against each other.

async function pickBalancedConditionTx(client, studyId, studyConfig, experiment) {
  const experimentConfig = studyConfig.experiments[experiment];
  const conditions = experimentConfig?.conditions;
  if (!conditions) throw new Error(`Unknown experiment: ${experiment}`);

  const result = await client.query(
    `SELECT condition, COUNT(*)::int AS n
     FROM study_assignments
     WHERE study_id = $1 AND experiment = $2
     GROUP BY condition`,
    [studyId, experiment]
  );

  const counts = Object.fromEntries(conditions.map(c => [c, 0]));
  for (const row of result.rows) {
    if (row.condition in counts) counts[row.condition] = row.n;
  }

  // Drop any condition that has already hit its per-condition recruitment
  // target so the picker can't keep adding to a full bucket. When every
  // condition is at quota, signal exhaustion with null so the caller can
  // 410 the request instead of overshooting.
  const target = experimentConfig.recruitment_target_per_condition;
  const open = typeof target === 'number'
    ? conditions.filter(c => counts[c] < target)
    : conditions;
  if (open.length === 0) return null;

  const minCount = Math.min(...open.map(c => counts[c]));
  const candidates = open.filter(c => counts[c] === minCount);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

async function pickBalancedExperimentTx(client, studyId, studyConfig) {
  const experiments = Object.keys(studyConfig.experiments);
  const result = await client.query(
    `SELECT experiment, COUNT(*)::int AS n
     FROM study_assignments
     WHERE study_id = $1
     GROUP BY experiment`,
    [studyId]
  );
  const counts = Object.fromEntries(experiments.map(e => [e, 0]));
  for (const row of result.rows) {
    if (row.experiment in counts) counts[row.experiment] = row.n;
  }

  // Drop any experiment whose total assigned has reached its full capacity
  // (target_per_condition × number_of_conditions). When every experiment is
  // full, return null and let the caller respond with 410.
  const open = experiments.filter(e => {
    const cfg = studyConfig.experiments[e];
    const target = cfg.recruitment_target_per_condition;
    if (typeof target !== 'number') return true;
    const capacity = target * cfg.conditions.length;
    return counts[e] < capacity;
  });
  if (open.length === 0) return null;

  const minCount = Math.min(...open.map(e => counts[e]));
  const candidates = open.filter(e => counts[e] === minCount);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Window inside which we treat a same-IP completion as a duplicate attempt.
const DEDUP_WINDOW_HOURS = 24;

// Start a study session: assign experiment + condition, create participant row.
// Atomic under load via pg_advisory_xact_lock; rejects same-IP repeats within DEDUP_WINDOW_HOURS.
// Resolves study by ?slug=... or falls back to the most recently created active study.
router.post('/start', startLimiter, async (req, res, next) => {
  const client = await db.getClient();
  try {
    const requestedSlug = (req.query.slug || req.body?.slug || '').trim() || null;
    const resolved = await resolveStudy(requestedSlug);
    if (!resolved) {
      return res.status(404).json({
        error: { message: requestedSlug
          ? `Study "${requestedSlug}" not found.`
          : 'No active study available right now. Please check back later.'
        }
      });
    }
    const { dbRow: study, config: studyConfig } = resolved;
    if (study.status !== 'active') {
      return res.status(403).json({
        error: { message: 'This study is not currently recruiting participants.' }
      });
    }

    const userAgent = req.get('User-Agent') || null;
    const ipHash = hashIp(req.ip);

    await client.query('BEGIN');
    // Serialize concurrent assignment picks so balance counts remain consistent.
    // The dedup check runs INSIDE the lock so two simultaneous /start calls from
    // the same IP can't both pass the check before either completes the insert.
    // Scoping the key per-study lets /start calls on different studies run in
    // parallel instead of serializing through a single global lock.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, ['study_balance:' + study.id]);

    if (ipHash) {
      const recent = await client.query(
        `SELECT 1 FROM study_participants
         WHERE ip_hash = $1
           AND study_id = $2
           AND completed_at IS NOT NULL
           AND completed_at > NOW() - INTERVAL '${DEDUP_WINDOW_HOURS} hours'
         LIMIT 1`,
        [ipHash, study.id]
      );
      if (recent.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: { message: 'You have already completed this study recently. Thank you for your interest.' }
        });
      }
    }

    const experiment = await pickBalancedExperimentTx(client, study.id, studyConfig);
    const condition = experiment
      ? await pickBalancedConditionTx(client, study.id, studyConfig, experiment)
      : null;
    // Picker returns null when every experiment / condition is at its
    // recruitment target. Roll back without creating participant or
    // assignment rows so we never overshoot the quota.
    if (!experiment || !condition) {
      await client.query('ROLLBACK');
      return res.status(410).json({
        error: { message: 'This study is no longer recruiting participants.' }
      });
    }
    const code = generateParticipantCode(studyConfig, experiment);

    const participant = await client.query(
      `INSERT INTO study_participants (participant_code, user_agent, ip_hash, study_id)
       VALUES ($1, $2, $3, $4) RETURNING id, participant_code`,
      [code, userAgent, ipHash, study.id]
    );
    const assignment = await client.query(
      `INSERT INTO study_assignments (participant_id, experiment, condition, study_id)
       VALUES ($1, $2, $3, $4) RETURNING id, experiment, condition, assigned_at`,
      [participant.rows[0].id, experiment, condition, study.id]
    );
    await client.query('COMMIT');

    res.status(201).json({
      participant_code: participant.rows[0].participant_code,
      assignment_id: assignment.rows[0].id,
      study_slug: study.slug,
      study_title: study.title,
      experiment: assignment.rows[0].experiment,
      condition: assignment.rows[0].condition,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

// Public list of active studies for the homepage card and /participate page.
// Returns only metadata that's safe to expose unauthenticated.
router.get('/list', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT slug, title, blurb, estimated_minutes, created_at
       FROM studies WHERE status = 'active'
       ORDER BY created_at DESC`
    );
    res.json({ studies: result.rows });
  } catch (error) {
    next(error);
  }
});

// Record consent + demographics. Idempotent: subsequent calls update.
router.post('/consent', [
  body('participant_code').isString().trim().isLength({ min: 6, max: 64 }),
  body('demographics').optional().isObject()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }
    const { participant_code, demographics } = req.body;

    // Merge-on-write: a second /consent call (e.g. browser-back from debrief
    // re-submitting the demographics form) must not wipe earlier-submitted
    // fields. Postgres JSONB || concat with RHS winning on key collision keeps
    // the union and the latest values for shared keys.
    const result = await db.query(
      `UPDATE study_participants
       SET consent_given_at = COALESCE(consent_given_at, CURRENT_TIMESTAMP),
           demographics = COALESCE(demographics, '{}'::jsonb) || $2::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE participant_code = $1
       RETURNING id, consent_given_at`,
      [participant_code, demographics || {}]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Participant not found' } });
    }

    res.json({ ok: true, consent_given_at: result.rows[0].consent_given_at });
  } catch (error) {
    next(error);
  }
});

// Mid-game snapshot. Fire-and-forget from the iframe; failures shouldn't block the game.
router.post('/snapshot', saveLimiter, [
  body('participant_code').isString().trim().isLength({ min: 6, max: 64 }),
  body('payload').isObject().withMessage('payload must be a JSON object'),
  body('payload').custom(p => {
    const size = Buffer.byteLength(JSON.stringify(p));
    if (size > 64000) throw new Error('payload exceeds 64KB');
    return true;
  }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }
    const { participant_code, payload } = req.body;

    const assignment = await db.query(
      `SELECT a.id
       FROM study_assignments a
       JOIN study_participants p ON p.id = a.participant_id
       WHERE p.participant_code = $1
       ORDER BY a.assigned_at DESC LIMIT 1`,
      [participant_code]
    );

    if (assignment.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Assignment not found' } });
    }

    // Cap snapshot rows per assignment so a runaway iframe can't fill the
    // table. Single COUNT before insert keeps the check cheap.
    const cnt = await db.query(
      'SELECT COUNT(*)::int AS n FROM study_responses WHERE assignment_id = $1 AND is_snapshot = true',
      [assignment.rows[0].id]
    );
    if (cnt.rows[0].n >= 200) {
      return res.status(429).json({ error: { message: 'Snapshot limit reached for this session' } });
    }

    await db.query(
      `INSERT INTO study_responses (assignment_id, payload, is_snapshot)
       VALUES ($1, $2, true)`,
      [assignment.rows[0].id, payload]
    );

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Final save. Persists the final JSONB payload only. `completed_at` is set by
// the separate /finish endpoint after the participant clicks Finish on the
// Debrief page — without that split, anyone who closes the tab on the
// Demographics page (which is rendered AFTER /save) leaves a "completed" row
// with empty demographics.
router.post('/save', saveLimiter, [
  body('participant_code').isString().trim().isLength({ min: 6, max: 64 }),
  body('payload').isObject().withMessage('payload must be a JSON object'),
  body('payload').custom(p => {
    const size = Buffer.byteLength(JSON.stringify(p));
    if (size > 64000) throw new Error('payload exceeds 64KB');
    return true;
  }),
], async (req, res, next) => {
  const client = await db.getClient();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }
    const { participant_code, payload } = req.body;

    await client.query('BEGIN');

    const assignment = await client.query(
      `SELECT a.id AS assignment_id, p.id AS participant_id
       FROM study_assignments a
       JOIN study_participants p ON p.id = a.participant_id
       WHERE p.participant_code = $1
       ORDER BY a.assigned_at DESC LIMIT 1`,
      [participant_code]
    );

    if (assignment.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: { message: 'Assignment not found' } });
    }

    const { assignment_id } = assignment.rows[0];

    // Idempotent: a partial unique index on (assignment_id) WHERE is_snapshot = false
    // allows ON CONFLICT to merge retries / double-submits into a single final row
    // instead of inflating the export.
    await client.query(
      `INSERT INTO study_responses (assignment_id, payload, is_snapshot)
       VALUES ($1, $2, false)
       ON CONFLICT (assignment_id) WHERE is_snapshot = false
       DO UPDATE SET payload = EXCLUDED.payload, submitted_at = CURRENT_TIMESTAMP`,
      [assignment_id, payload]
    );

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

// Mark assignment + participant as completed. Called from the Debrief page's
// final "Finish" button — NOT from Demographics — so a participant who closes
// the tab between /save and Debrief is correctly counted as in-progress
// rather than as a finished session with missing demographics.
router.post('/finish', saveLimiter, [
  body('participant_code').isString().trim().isLength({ min: 6, max: 64 }),
], async (req, res, next) => {
  const client = await db.getClient();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }
    const { participant_code } = req.body;

    await client.query('BEGIN');

    const assignment = await client.query(
      `SELECT a.id AS assignment_id, p.id AS participant_id
       FROM study_assignments a
       JOIN study_participants p ON p.id = a.participant_id
       WHERE p.participant_code = $1
       ORDER BY a.assigned_at DESC LIMIT 1`,
      [participant_code]
    );

    if (assignment.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: { message: 'Assignment not found' } });
    }

    const { assignment_id, participant_id } = assignment.rows[0];

    await client.query(
      `UPDATE study_assignments SET completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [assignment_id]
    );
    await client.query(
      `UPDATE study_participants SET completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [participant_id]
    );

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

// Admin: per-experiment recruitment counts for one study. ?slug= optional;
// defaults to the most recently created active study.
router.get('/stats', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const requestedSlug = (req.query.slug || '').trim() || null;
    const resolved = await resolveStudy(requestedSlug);
    if (!resolved) {
      return res.status(404).json({ error: { message: 'Study not found' } });
    }
    const { dbRow: study, config: studyConfig } = resolved;

    const result = await db.query(
      `SELECT experiment, condition,
              COUNT(*)::int AS assigned,
              COUNT(completed_at)::int AS completed
       FROM study_assignments
       WHERE study_id = $1
       GROUP BY experiment, condition
       ORDER BY experiment, condition`,
      [study.id]
    );

    const target = study.recruitment_target_per_condition || null;

    const stats = {};
    for (const exp of Object.keys(studyConfig.experiments)) {
      stats[exp] = { conditions: {}, total_assigned: 0, total_completed: 0 };
      for (const cond of studyConfig.experiments[exp].conditions) {
        stats[exp].conditions[cond] = { assigned: 0, completed: 0 };
      }
    }
    for (const row of result.rows) {
      if (!stats[row.experiment]) continue;
      stats[row.experiment].conditions[row.condition] = {
        assigned: row.assigned,
        completed: row.completed
      };
      stats[row.experiment].total_assigned += row.assigned;
      stats[row.experiment].total_completed += row.completed;
    }

    // Decorate each condition with target + status when a target is set on the
    // study. Status: 'on_track' (<90%) | 'near_complete' (90-99%) | 'met' (100%) |
    // 'over' (>100%). Lets the admin UI surface "stop recruiting" without
    // computing in the browser.
    if (target) {
      for (const exp of Object.keys(stats)) {
        for (const cond of Object.keys(stats[exp].conditions)) {
          const c = stats[exp].conditions[cond];
          c.target = target;
          const pct = target > 0 ? (c.completed / target) * 100 : 0;
          c.progress_pct = Math.round(pct);
          c.status = pct >= 100 ? (pct > 100 ? 'over' : 'met')
                  : pct >= 90 ? 'near_complete'
                  : 'on_track';
        }
      }
    }

    res.json({
      study: {
        slug: study.slug,
        title: study.title,
        recruitment_target_per_condition: target,
      },
      stats,
    });
  } catch (error) {
    next(error);
  }
});

// Public: anonymous follow-up signup. Email is stored in a SEPARATE table from
// participant data — no foreign key, no participant_code, no way to relink to
// a specific response. Keeps the consent form's anonymity promise intact.
// Idempotent: same email + same study collapses on the unique constraint.
router.post('/follow-up', saveLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('study_slug').optional().isString().trim().isLength({ min: 1, max: 64 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }
    const { email } = req.body;
    const requestedSlug = (req.body.study_slug || '').trim() || null;
    const resolved = await resolveStudy(requestedSlug);
    if (!resolved) {
      return res.status(404).json({ error: { message: 'Study not found' } });
    }
    const { dbRow: study } = resolved;

    await db.query(
      `INSERT INTO study_follow_up_signups (study_id, email)
       VALUES ($1, $2)
       ON CONFLICT (study_id, email) DO NOTHING`,
      [study.id, email]
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Defends against CSV formula injection (OWASP). Participant payload is
// fully attacker-controlled (jsPsych fetch body), and admins open these CSVs
// in Excel/Sheets/Numbers — values starting with =, +, -, @ would otherwise
// execute as formulas. Prefix a single quote and force-quote so the prefix
// survives a round-trip.
function csvField(value) {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const needsFormulaEscape = /^[=+\-@\t\r]/.test(s);
  if (needsFormulaEscape) s = "'" + s;
  if (needsFormulaEscape || /[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
function csvRow(values) {
  return values.map(csvField).join(',') + '\n';
}

// Streaming CSV export for one experiment within one study. ?slug= optional;
// defaults to the most recently created active study. Export columns come from
// the per-study config so each study can ship its own DV layout.
router.get('/export/:experiment', authenticate, requireRole('admin'), async (req, res, next) => {
  const PAGE_SIZE = 200;
  let client;
  try {
    const requestedSlug = (req.query.slug || '').trim() || null;
    const resolved = await resolveStudy(requestedSlug);
    if (!resolved) {
      return res.status(404).json({ error: { message: 'Study not found' } });
    }
    const { dbRow: study, config: studyConfig } = resolved;
    const { experiment } = req.params;
    const experimentConfig = studyConfig.experiments[experiment];
    if (!experimentConfig) {
      return res.status(400).json({ error: { message: 'Invalid experiment for this study' } });
    }
    const columns = experimentConfig.exportColumns;
    if (!columns) {
      return res.status(500).json({ error: { message: 'Export columns not defined for this experiment' } });
    }

    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=${study.slug}_${experiment}_responses.csv`,
    });
    res.write(csvRow(columns.map(c => c[0])));

    client = await db.getClient();
    // REPEATABLE READ snapshot pins the result set so all paged queries see the
    // same data — without it, /save calls landing mid-export can shift the
    // ORDER BY position of in-progress assignments and skip or duplicate rows.
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    let offset = 0;
    let more = true;
    while (more) {
      const result = await client.query(
        `SELECT p.participant_code, a.condition, a.assigned_at, a.completed_at, r.payload
         FROM study_responses r
         JOIN study_assignments a ON a.id = r.assignment_id
         JOIN study_participants p ON p.id = a.participant_id
         WHERE r.is_snapshot = false
           AND a.study_id = $1
           AND a.experiment = $2
         ORDER BY a.completed_at ASC NULLS LAST, p.participant_code ASC
         LIMIT $3 OFFSET $4`,
        [study.id, experiment, PAGE_SIZE, offset]
      );
      for (const row of result.rows) {
        res.write(csvRow(columns.map(c => c[1](row))));
      }
      more = result.rows.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }
    await client.query('COMMIT');
    res.end();
  } catch (error) {
    logger.error({ err: error }, 'Failed to export study responses');
    if (!res.headersSent) return next(error);
    res.end();
  } finally {
    if (client) client.release();
  }
});

// Admin: list recent participants for one study. ?slug= optional; defaults to
// the most recently created active study. Filter by experiment + completion state,
// paginate via limit + offset. Validation is manual against per-study config.
router.get('/participants', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const requestedSlug = (req.query.slug || '').trim() || null;
    const resolved = await resolveStudy(requestedSlug);
    if (!resolved) {
      return res.status(404).json({ error: { message: 'Study not found' } });
    }
    const { dbRow: study, config: studyConfig } = resolved;

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const experiment = req.query.experiment;
    const completed = req.query.completed;

    if (experiment && !Object.keys(studyConfig.experiments).includes(experiment)) {
      return res.status(400).json({ error: { message: 'Invalid experiment filter for this study' } });
    }
    if (completed && !['true', 'false', 'all'].includes(completed)) {
      return res.status(400).json({ error: { message: 'Invalid completed filter' } });
    }

    const where = [`a.study_id = $1`];
    const params = [study.id];
    if (experiment) {
      params.push(experiment);
      where.push(`a.experiment = $${params.length}`);
    }
    if (completed === 'true') where.push(`a.completed_at IS NOT NULL`);
    if (completed === 'false') where.push(`a.completed_at IS NULL`);
    const whereSql = `WHERE ${where.join(' AND ')}`;

    params.push(limit, offset);
    const result = await db.query(
      `SELECT p.participant_code, a.experiment, a.condition,
              p.created_at, a.completed_at,
              (p.consent_given_at IS NOT NULL) AS consented
       FROM study_assignments a
       JOIN study_participants p ON p.id = a.participant_id
       ${whereSql}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ study: { slug: study.slug, title: study.title }, participants: result.rows });
  } catch (error) {
    next(error);
  }
});

// Admin: full detail for one participant — assignment + every response payload.
router.get('/participants/:code', authenticate, requireRole('admin'), [
  param('code').isString().trim().isLength({ min: 6, max: 64 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Invalid participant code' } });
    }
    const { code } = req.params;

    const participant = await db.query(
      `SELECT id, participant_code, consent_given_at, demographics,
              user_agent, ip_hash, completed_at, created_at, updated_at, study_id
       FROM study_participants WHERE participant_code = $1`,
      [code]
    );
    if (participant.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Participant not found' } });
    }
    const p = participant.rows[0];

    const studyRow = await db.query(
      `SELECT slug, title FROM studies WHERE id = $1`,
      [p.study_id]
    );

    const assignment = await db.query(
      `SELECT id, experiment, condition, assigned_at, completed_at
       FROM study_assignments WHERE participant_id = $1
       ORDER BY assigned_at DESC LIMIT 1`,
      [p.id]
    );
    const a = assignment.rows[0] || null;

    const responses = a
      ? await db.query(
          `SELECT id, payload, is_snapshot, submitted_at
           FROM study_responses WHERE assignment_id = $1
           ORDER BY submitted_at ASC`,
          [a.id]
        )
      : { rows: [] };

    res.json({
      participant: p,
      study: studyRow.rows[0] || null,
      assignment: a,
      responses: responses.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Exposed for unit testing — the route handler is the contract for production
// callers, these helpers let tests exercise the quota logic without seeding
// hundreds of rows through HTTP.
router._test = {
  pickBalancedConditionTx,
  pickBalancedExperimentTx,
  generateParticipantCode,
};

module.exports = router;
