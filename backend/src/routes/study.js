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

// Pickers run inside the same transaction as the INSERT, gated by a Postgres
// advisory lock so concurrent /start calls can't all read the same counts and
// land in the same condition. The lock is held only for the picker + insert,
// not for the entire request. `xact_lock` auto-releases on COMMIT/ROLLBACK.
const BALANCE_LOCK_KEY = 'study_balance';

async function pickBalancedConditionTx(client, experiment) {
  const conditions = EXPERIMENTS[experiment];
  if (!conditions) throw new Error(`Unknown experiment: ${experiment}`);

  const result = await client.query(
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

async function pickBalancedExperimentTx(client) {
  const experiments = Object.keys(EXPERIMENTS);
  const result = await client.query(
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

// Window inside which we treat a same-IP completion as a duplicate attempt.
const DEDUP_WINDOW_HOURS = 24;

// Start a study session: assign experiment + condition, create participant row.
// Atomic under load via pg_advisory_xact_lock; rejects same-IP repeats within DEDUP_WINDOW_HOURS.
router.post('/start', startLimiter, async (req, res, next) => {
  const client = await db.getClient();
  try {
    const userAgent = req.get('User-Agent') || null;
    const ipHash = hashIp(req.ip);

    await client.query('BEGIN');
    // Serialize concurrent assignment picks so balance counts remain consistent.
    // The dedup check runs INSIDE the lock so two simultaneous /start calls from
    // the same IP can't both pass the check before either completes the insert.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [BALANCE_LOCK_KEY]);

    if (ipHash) {
      const recent = await client.query(
        `SELECT 1 FROM study_participants
         WHERE ip_hash = $1
           AND completed_at IS NOT NULL
           AND completed_at > NOW() - INTERVAL '${DEDUP_WINDOW_HOURS} hours'
         LIMIT 1`,
        [ipHash]
      );
      if (recent.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: { message: 'You have already completed this study recently. Thank you for your interest.' }
        });
      }
    }

    const experiment = await pickBalancedExperimentTx(client);
    const condition = await pickBalancedConditionTx(client, experiment);
    const code = generateParticipantCode(experiment);

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

// Streaming CSV export: writes the header, then iterates rows in batches and
// `res.write()`s each row. Avoids materializing the full result set in memory
// when datasets grow into the thousands.
router.get('/export/:experiment', authenticate, requireRole('admin'), [
  param('experiment').isIn(Object.keys(EXPERIMENTS))
], async (req, res, next) => {
  const PAGE_SIZE = 200;
  let client;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Invalid experiment' } });
    }
    const { experiment } = req.params;
    const columns = EXPORT_COLUMNS[experiment];

    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=${experiment}_responses.csv`,
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
         WHERE r.is_snapshot = false AND a.experiment = $1
         ORDER BY a.completed_at ASC NULLS LAST, p.participant_code ASC
         LIMIT $2 OFFSET $3`,
        [experiment, PAGE_SIZE, offset]
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

// Admin: list recent participants. Supports filtering by experiment and completion state,
// plus pagination. Validation is done manually below against the EXPERIMENTS whitelist —
// no express-validator middleware needed.
router.get('/participants', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const experiment = req.query.experiment;
    const completed = req.query.completed;

    if (experiment && !Object.keys(EXPERIMENTS).includes(experiment)) {
      return res.status(400).json({ error: { message: 'Invalid experiment filter' } });
    }
    if (completed && !['true', 'false', 'all'].includes(completed)) {
      return res.status(400).json({ error: { message: 'Invalid completed filter' } });
    }

    const where = [];
    const params = [];
    if (experiment) {
      params.push(experiment);
      where.push(`a.experiment = $${params.length}`);
    }
    if (completed === 'true') where.push(`a.completed_at IS NOT NULL`);
    if (completed === 'false') where.push(`a.completed_at IS NULL`);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

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
    res.json({ participants: result.rows });
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
              user_agent, ip_hash, completed_at, created_at, updated_at
       FROM study_participants WHERE participant_code = $1`,
      [code]
    );
    if (participant.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Participant not found' } });
    }
    const p = participant.rows[0];

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
      assignment: a,
      responses: responses.rows,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
