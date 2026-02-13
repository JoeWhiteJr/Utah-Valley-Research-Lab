-- Migration 027: Add priority to action_items and remove parent_task_id

-- Clean up existing parent task references
UPDATE action_items SET parent_task_id = NULL WHERE parent_task_id IS NOT NULL;

-- Drop the parent task index
DROP INDEX IF EXISTS idx_action_items_parent;

-- Remove parent_task_id column
ALTER TABLE action_items DROP COLUMN IF EXISTS parent_task_id;

-- Add priority column
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT NULL
  CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high', 'urgent'));

-- Index for priority filtering
CREATE INDEX IF NOT EXISTS idx_action_items_priority ON action_items(priority) WHERE priority IS NOT NULL;
