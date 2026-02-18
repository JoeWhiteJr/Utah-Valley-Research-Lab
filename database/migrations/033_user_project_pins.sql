CREATE TABLE IF NOT EXISTS user_project_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_user_project_pins_user ON user_project_pins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_project_pins_project ON user_project_pins(project_id);
