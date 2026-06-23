// Persistent counter of /api/study 429 events, stored in Postgres so
// process restarts (PM2 reboot, container redeploy) don't wipe the numbers.
// Surfaced on the admin Research Studies page during launch week.
//
// recordLimitHit is fire-and-forget from callers on the hot path — errors
// are logged but never propagate to the response so observability failures
// cannot break participant-facing routes.
//
// getLimitHits returns the last 7 days of rows for a given study_id so the
// admin UI can show a short trend rather than a single today-only counter.

const db = require('../config/database');
const logger = require('../config/logger');

async function recordLimitHit(studyId, kind) {
  if (!studyId) return; // tolerate pre-lookup 429s where study_id is unknown
  if (kind !== 'payload_too_big' && kind !== 'snapshot_cap') return;
  // `kind` is narrowed to the two safe column names above — no injection risk.
  const col = kind;
  try {
    await db.query(
      `INSERT INTO study_limit_hits (study_id, day, ${col})
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (study_id, day)
       DO UPDATE SET ${col} = study_limit_hits.${col} + 1`,
      [studyId]
    );
  } catch (err) {
    logger.warn({ err, studyId, kind }, 'studyMetrics: failed to record limit hit');
  }
}

async function getLimitHits(studyId) {
  const res = await db.query(
    `SELECT day::text AS day, payload_too_big, snapshot_cap
     FROM study_limit_hits
     WHERE study_id = $1 AND day >= CURRENT_DATE - INTERVAL '7 days'
     ORDER BY day DESC`,
    [studyId]
  );
  return res.rows;
}

module.exports = { recordLimitHit, getLimitHits };
