-- Migration 006: Task System Improvements
-- 1. Multiple assignees per task (junction table)
-- 2. Subtasks (parent_task_id self-referencing FK)

CREATE TABLE IF NOT EXISTS action_item_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_item_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(action_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_action_item_assignees_action ON action_item_assignees(action_item_id);
CREATE INDEX IF NOT EXISTS idx_action_item_assignees_user ON action_item_assignees(user_id);

INSERT INTO action_item_assignees (action_item_id, user_id)
SELECT id, assigned_to FROM action_items
WHERE assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE action_items
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES action_items(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_action_items_parent ON action_items(parent_task_id);
