-- Migration 028: Add soft delete columns to all entity tables
-- Notes already has deleted_at from migration 025

-- Projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_trashed ON projects(deleted_at) WHERE deleted_at IS NOT NULL;

-- Action items
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_active ON action_items(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_trashed ON action_items(deleted_at) WHERE deleted_at IS NOT NULL;

-- Meetings
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_active ON meetings(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_trashed ON meetings(deleted_at) WHERE deleted_at IS NOT NULL;

-- Files
ALTER TABLE files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_files_active ON files(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_files_trashed ON files(deleted_at) WHERE deleted_at IS NOT NULL;

-- Notes
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_active ON notes(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_trashed ON notes(deleted_at) WHERE deleted_at IS NOT NULL;
