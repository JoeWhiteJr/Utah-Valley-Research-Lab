-- Fix: Drop overly restrictive messages_type_check constraint
-- The constraint only allowed ('text', 'file', 'system') but the enum
-- also includes 'audio' and 'ai'. The enum type itself enforces valid values.
DO $$ BEGIN
  ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Fix: Add 'chat_message' to notification_type enum for chat notifications
DO $$ BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'chat_message';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
