-- Migration 024: Project Members & Join Requests
-- Adds formal project membership system with join request/approval flow

-- 1. Add lead_id column to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Project Members table
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'lead')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- 3. Project Join Requests table
CREATE TABLE IF NOT EXISTS project_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_join_requests_project ON project_join_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_project_join_requests_user ON project_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_project_join_requests_status ON project_join_requests(status);

-- 4. Backfill: existing project creators become 'lead' members and set lead_id
INSERT INTO project_members (project_id, user_id, role)
SELECT p.id, p.created_by, 'lead'
FROM projects p
WHERE p.created_by IS NOT NULL
ON CONFLICT (project_id, user_id) DO NOTHING;

UPDATE projects SET lead_id = created_by WHERE lead_id IS NULL AND created_by IS NOT NULL;
