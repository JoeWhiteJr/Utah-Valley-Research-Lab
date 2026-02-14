-- 031_chat_features.sql
-- Chat system overhaul: Signal-inspired features

-- chat_rooms: add image + project link
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_chat_rooms_project ON chat_rooms(project_id);

-- chat_members: mute, pin, archive, mark-unread
ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS muted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS marked_unread BOOLEAN NOT NULL DEFAULT false;

-- user_blocks table (DMs only)
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

-- Full-text search on messages (trigram-based)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_messages_content_trgm ON messages USING gin (content gin_trgm_ops);

-- Backfill: create chat rooms for existing projects that don't have one yet
INSERT INTO chat_rooms (name, type, created_by, project_id, image_url)
SELECT p.title, 'group', p.created_by, p.id, p.header_image
FROM projects p
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM chat_rooms cr WHERE cr.project_id = p.id AND cr.deleted_at IS NULL
  );

-- Backfill: add all project members to their project's new chat room
INSERT INTO chat_members (room_id, user_id, role)
SELECT cr.id, pm.user_id,
  CASE WHEN pm.role = 'lead' THEN 'admin' ELSE 'member' END
FROM chat_rooms cr
JOIN project_members pm ON pm.project_id = cr.project_id
WHERE cr.project_id IS NOT NULL
  AND cr.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM chat_members cm WHERE cm.room_id = cr.id AND cm.user_id = pm.user_id
  );
