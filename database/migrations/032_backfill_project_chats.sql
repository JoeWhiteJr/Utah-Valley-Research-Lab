-- 032_backfill_project_chats.sql
-- Create chat rooms for existing projects that don't have one yet

INSERT INTO chat_rooms (name, type, created_by, project_id, image_url)
SELECT p.title, 'group', p.created_by, p.id, p.header_image
FROM projects p
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM chat_rooms cr WHERE cr.project_id = p.id AND cr.deleted_at IS NULL
  );

-- Add all project members to their project's new chat room
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
