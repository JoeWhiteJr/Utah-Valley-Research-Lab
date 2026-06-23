-- Counter for /save and /snapshot 429 events, used by the admin
-- /limit-hits endpoint. Persisted so process restarts don't wipe it.
CREATE TABLE IF NOT EXISTS study_limit_hits (
  study_id UUID NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  payload_too_big INT NOT NULL DEFAULT 0,
  snapshot_cap INT NOT NULL DEFAULT 0,
  PRIMARY KEY (study_id, day)
);
CREATE INDEX IF NOT EXISTS idx_study_limit_hits_day ON study_limit_hits(day);
