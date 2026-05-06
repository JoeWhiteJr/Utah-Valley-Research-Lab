const express = require('express');
const crypto = require('crypto');
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const EXPERIMENTS = {
  treasure_hunt: ['BASELINE', 'HIGH_EFFORT', 'NR_PATTERN', 'RN_PATTERN'],
  career_choice: ['WITHIN_SUBJECTS'],
  pattern_memory: ['NR_PATTERN', 'RANDOM']
};

const EXPERIMENT_PREFIX = {
  treasure_hunt: 'TH',
  career_choice: 'CC',
  pattern_memory: 'PM'
};

const isTestEnv = process.env.NODE_ENV === 'test';

const startLimiter = isTestEnv
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 60 * 1000,
      max: 10,
      message: { error: { message: 'Too many study sessions started, please try again later' } }
    });

const saveLimiter = isTestEnv
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      message: { error: { message: 'Too many save requests, please slow down' } }
    });

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(`uvrl-study:${ip}`).digest('hex').slice(0, 32);
}

function generateParticipantCode(experiment) {
  const prefix = EXPERIMENT_PREFIX[experiment] || 'XX';
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${Date.now()}_${random}`;
}

async function pickBalancedCondition(experiment) {
  const conditions = EXPERIMENTS[experiment];
  if (!conditions) throw new Error(`Unknown experiment: ${experiment}`);

  const result = await db.query(
    `SELECT condition, COUNT(*)::int AS n
     FROM study_assignments
     WHERE experiment = $1
     GROUP BY condition`,
    [experiment]
  );

  const counts = Object.fromEntries(conditions.map(c => [c, 0]));
  for (const row of result.rows) {
    if (row.condition in counts) counts[row.condition] = row.n;
  }

  const minCount = Math.min(...conditions.map(c => counts[c]));
  const candidates = conditions.filter(c => counts[c] === minCount);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

async function pickBalancedExperiment() {
  const experiments = Object.keys(EXPERIMENTS);
  const result = await db.query(
    `SELECT experiment, COUNT(*)::int AS n
     FROM study_assignments
     GROUP BY experiment`
  );
  const counts = Object.fromEntries(experiments.map(e => [e, 0]));
  for (const row of result.rows) {
    if (row.experiment in counts) counts[row.experiment] = row.n;
  }
  const minCount = Math.min(...experiments.map(e => counts[e]));
  const candidates = experiments.filter(e => counts[e] === minCount);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Start a study session: assign experiment + condition, create participant row.
router.post('/start', startLimiter, async (req, res, next) => {
  const client = await db.getClient();
  try {
    const experiment = await pickBalancedExperiment();
    const condition = await pickBalancedCondition(experiment);
    const code = generateParticipantCode(experiment);
    const userAgent = req.get('User-Agent') || null;
    const ipHash = hashIp(req.ip);

    await client.query('BEGIN');
    const participant = await client.query(
      `INSERT INTO study_participants (participant_code, user_agent, ip_hash)
       VALUES ($1, $2, $3) RETURNING id, participant_code`,
      [code, userAgent, ipHash]
    );
    const assignment = await client.query(
      `INSERT INTO study_assignments (participant_id, experiment, condition)
       VALUES ($1, $2, $3) RETURNING id, experiment, condition, assigned_at`,
      [participant.rows[0].id, experiment, condition]
    );
    await client.query('COMMIT');

    res.status(201).json({
      participant_code: participant.rows[0].participant_code,
      assignment_id: assignment.rows[0].id,
      experiment: assignment.rows[0].experiment,
      condition: assignment.rows[0].condition
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
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

    const result = await db.query(
      `UPDATE study_participants
       SET consent_given_at = COALESCE(consent_given_at, CURRENT_TIMESTAMP),
           demographics = $2,
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
  body('payload').exists()
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

// Final save. Marks assignment + participant as completed.
router.post('/save', saveLimiter, [
  body('participant_code').isString().trim().isLength({ min: 6, max: 64 }),
  body('payload').exists()
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

    const { assignment_id, participant_id } = assignment.rows[0];

    await client.query(
      `INSERT INTO study_responses (assignment_id, payload, is_snapshot)
       VALUES ($1, $2, false)`,
      [assignment_id, payload]
    );

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

// Admin: per-experiment recruitment counts.
router.get('/stats', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT experiment, condition,
              COUNT(*)::int AS assigned,
              COUNT(completed_at)::int AS completed
       FROM study_assignments
       GROUP BY experiment, condition
       ORDER BY experiment, condition`
    );

    const stats = {};
    for (const exp of Object.keys(EXPERIMENTS)) {
      stats[exp] = { conditions: {}, total_assigned: 0, total_completed: 0 };
      for (const cond of EXPERIMENTS[exp]) {
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

    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

function csvField(value) {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function csvRow(values) {
  return values.map(csvField).join(',') + '\n';
}

const EXPORT_COLUMNS = {
  treasure_hunt: [
    ['participant_code', d => d.participant_code],
    ['condition', d => d.condition],
    ['assigned_at', d => d.assigned_at],
    ['completed_at', d => d.completed_at],
    ['total_coins', d => d.payload?.total_coins],
    ['extinction_chests_opened', d => d.payload?.extinction_chests_opened ?? 0],
    ['extinction_quit_pressed', d => d.payload?.extinction_quit_pressed ?? false],
    ['start_time', d => d.payload?.start_time],
    ['end_time', d => d.payload?.end_time]
  ],
  career_choice: [
    ['participant_code', d => d.participant_code],
    ['condition', d => d.condition],
    ['assigned_at', d => d.assigned_at],
    ['completed_at', d => d.completed_at],
    ['tenure_A', d => d.payload?.scenario_responses?.A?.tenure],
    ['tenure_B', d => d.payload?.scenario_responses?.B?.tenure],
    ['tenure_C', d => d.payload?.scenario_responses?.C?.tenure],
    ['value_A', d => d.payload?.scenario_responses?.A?.value],
    ['value_B', d => d.payload?.scenario_responses?.B?.value],
    ['value_C', d => d.payload?.scenario_responses?.C?.value]
  ],
  pattern_memory: [
    ['participant_code', d => d.participant_code],
    ['condition', d => d.condition],
    ['assigned_at', d => d.assigned_at],
    ['completed_at', d => d.completed_at],
    ['expectation_rating', d => d.payload?.expectation?.rating],
    ['pct_bet_ace', d => d.payload?.betting?.summary?.pct_bet_ace_after_blank],
    ['pattern_detected', d => d.payload?.memory_test?.pattern_detected]
  ]
};

router.get('/export/:experiment', authenticate, requireRole('admin'), [
  param('experiment').isIn(Object.keys(EXPERIMENTS))
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Invalid experiment' } });
    }
    const { experiment } = req.params;

    const result = await db.query(
      `SELECT p.participant_code, a.condition, a.assigned_at, a.completed_at, r.payload
       FROM study_responses r
       JOIN study_assignments a ON a.id = r.assignment_id
       JOIN study_participants p ON p.id = a.participant_id
       WHERE r.is_snapshot = false AND a.experiment = $1
       ORDER BY a.completed_at ASC NULLS LAST, p.participant_code ASC`,
      [experiment]
    );

    const columns = EXPORT_COLUMNS[experiment];
    let csv = csvRow(columns.map(c => c[0]));
    for (const row of result.rows) {
      csv += csvRow(columns.map(c => c[1](row)));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${experiment}_responses.csv`);
    res.send(csv);
  } catch (error) {
    logger.error({ err: error }, 'Failed to export study responses');
    next(error);
  }
});

module.exports = router;
