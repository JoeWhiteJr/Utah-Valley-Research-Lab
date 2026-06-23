// In-memory per-day counter of /api/study 429s. Surfaced on the admin
// Research Studies page so we notice if a runaway client is bumping into the
// payload-too-big guard or the snapshot cap during launch week.
//
// Counts are NOT durable — a restart clears them. That's intentional for
// launch: the dashboard is meant for "what's happening right now" and any
// long-term capacity work will move to structured logs anyway.
//
// The Map is keyed by `${YYYY-MM-DD}:${study_id}` so we can prune anything not
// from today on every write. That keeps the Map bounded to "active studies"
// regardless of how long the process runs.

const limitHitsToday = new Map();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function recordLimitHit(studyId, kind) {
  if (!studyId || !kind) return;
  const day = todayKey();
  const key = `${day}:${studyId}`;
  const bucket = limitHitsToday.get(key) || { payload_too_big: 0, snapshot_cap: 0 };
  bucket[kind] = (bucket[kind] || 0) + 1;
  limitHitsToday.set(key, bucket);
  // Prune anything not from today so the Map stays bounded across a long-
  // running process.
  for (const k of limitHitsToday.keys()) {
    if (!k.startsWith(day + ':')) limitHitsToday.delete(k);
  }
}

// Returns the raw Map contents as a plain object keyed by `${day}:${studyId}`.
// Callers can filter by day / study as needed.
function getLimitHits() {
  return Object.fromEntries(limitHitsToday);
}

// Test-only reset. Not exported on the module surface used by routes.
function _resetForTests() {
  limitHitsToday.clear();
}

module.exports = { recordLimitHit, getLimitHits, _resetForTests };
