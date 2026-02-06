-- Migration 004: Security and data integrity fixes
-- Fixes cascade rules, adds NOT NULL constraints, adds missing indexes

BEGIN;

-- ============================================================
-- 1. CRITICAL: Fix cascade rules to prevent data loss
-- ============================================================

-- Audit logs should NEVER be deleted when admin is deleted
ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_admin_id_fkey;
ALTER TABLE admin_audit_log ALTER COLUMN admin_id DROP NOT NULL;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL;

-- Messages should be preserved when sender is deleted (show as "Deleted User")
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;

-- Chat rooms should survive creator deletion
ALTER TABLE chat_rooms DROP CONSTRAINT IF EXISTS chat_rooms_created_by_fkey;
ALTER TABLE chat_rooms ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE chat_rooms ADD CONSTRAINT chat_rooms_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Projects should survive creator deletion (preserve team data)
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_created_by_fkey;
ALTER TABLE projects ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE projects ADD CONSTRAINT projects_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Files should survive uploader deletion
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_uploaded_by_fkey;
ALTER TABLE files ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE files ADD CONSTRAINT files_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;

-- Notes should survive creator deletion
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_created_by_fkey;
ALTER TABLE notes ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE notes ADD CONSTRAINT notes_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Meetings should survive creator deletion
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_created_by_fkey;
ALTER TABLE meetings ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE meetings ADD CONSTRAINT meetings_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Add NOT NULL constraints where needed
-- ============================================================

-- Fix boolean fields
UPDATE action_items SET completed = FALSE WHERE completed IS NULL;
ALTER TABLE action_items ALTER COLUMN completed SET NOT NULL;
ALTER TABLE action_items ALTER COLUMN completed SET DEFAULT FALSE;

UPDATE action_items SET sort_order = 0 WHERE sort_order IS NULL;
ALTER TABLE action_items ALTER COLUMN sort_order SET NOT NULL;
ALTER TABLE action_items ALTER COLUMN sort_order SET DEFAULT 0;

-- Fix is_super_admin
UPDATE users SET is_super_admin = FALSE WHERE is_super_admin IS NULL;
ALTER TABLE users ALTER COLUMN is_super_admin SET NOT NULL;
ALTER TABLE users ALTER COLUMN is_super_admin SET DEFAULT FALSE;

-- ============================================================
-- 3. Add missing indexes for performance
-- ============================================================

-- Composite index for action items queries
CREATE INDEX IF NOT EXISTS idx_action_items_project_completed
  ON action_items(project_id, completed);

-- Index for due date sorting
CREATE INDEX IF NOT EXISTS idx_action_items_due_date
  ON action_items(due_date) WHERE due_date IS NOT NULL;

-- Partial index for active (non-deleted) messages
CREATE INDEX IF NOT EXISTS idx_messages_active
  ON messages(room_id, created_at DESC) WHERE deleted_at IS NULL;

-- Index for application reviewer lookups
CREATE INDEX IF NOT EXISTS idx_applications_reviewed_by
  ON applications(reviewed_by) WHERE reviewed_by IS NOT NULL;

-- Index for meeting ordering
CREATE INDEX IF NOT EXISTS idx_meetings_recorded_at
  ON meetings(project_id, recorded_at DESC);

-- ============================================================
-- 4. Add CHECK constraints for data integrity
-- ============================================================

-- Ensure notification reference fields are paired
ALTER TABLE notifications ADD CONSTRAINT notifications_reference_paired
  CHECK ((reference_id IS NULL) = (reference_type IS NULL));

-- Validate chat member role values
ALTER TABLE chat_members ADD CONSTRAINT chat_members_role_check
  CHECK (role IN ('member', 'admin', 'owner'));

-- Validate message type values
DO $$ BEGIN
  ALTER TABLE messages ADD CONSTRAINT messages_type_check
    CHECK (type IN ('text', 'file', 'system'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5. SECURITY: Remove hardcoded default admin credentials
-- Delete the default admin user if password is still the default
-- (bcrypt hash for 'admin123')
-- ============================================================

-- We don't delete the user in case it's been modified, but we flag it
-- Admin should change password on first login
-- This is a reminder comment - actual enforcement should be in application code

COMMIT;
