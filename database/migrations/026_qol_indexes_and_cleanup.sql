-- Quality-of-life indexes and cleanup functions
-- Adds missing composite, timestamp, partial, and full-text search indexes
-- Adds cleanup functions for notifications and token blocklist

-- ============================================================
-- Composite indexes for common query patterns
-- ============================================================

-- Calendar events: filtered by scope + creator + time range
CREATE INDEX IF NOT EXISTS idx_calendar_events_scope_creator_start
  ON calendar_events(scope, created_by, start_time);

-- Messages: paginated non-deleted messages per room
CREATE INDEX IF NOT EXISTS idx_messages_room_active_created
  ON messages(room_id, created_at DESC) WHERE deleted_at IS NULL;

-- Action items: sorted by due date within a project
CREATE INDEX IF NOT EXISTS idx_action_items_project_due
  ON action_items(project_id, due_date);

-- Action items: completed status filter within project
CREATE INDEX IF NOT EXISTS idx_action_items_project_completed
  ON action_items(project_id, completed);

-- Notifications: user + created_at for paginated lists
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- ============================================================
-- Foreign key composite indexes for access control lookups
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_project_members_project_user
  ON project_members(project_id, user_id);

CREATE INDEX IF NOT EXISTS idx_action_item_assignees_action_user
  ON action_item_assignees(action_item_id, user_id);

CREATE INDEX IF NOT EXISTS idx_chat_members_room_user
  ON chat_members(room_id, user_id);

-- ============================================================
-- Timestamp DESC indexes for common sort operations
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_projects_updated_at
  ON projects(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_project_updated
  ON notes(project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_files_project_uploaded
  ON files(project_id, uploaded_at DESC);

-- ============================================================
-- Partial indexes for soft-deleted records
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_active
  ON users(id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_rooms_active
  ON chat_rooms(id) WHERE deleted_at IS NULL;

-- ============================================================
-- Full-text search indexes (GIN)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_projects_search
  ON projects USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));

CREATE INDEX IF NOT EXISTS idx_action_items_search
  ON action_items USING gin(to_tsvector('english', coalesce(title, '')));

-- ============================================================
-- Cleanup: old read notifications (> 90 days)
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_old_notifications() RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND read_at IS NOT NULL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Cleanup: expired tokens from blocklist
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_tokens() RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM token_blocklist
  WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
