-- Add edited_at column for message editing
DO $$ BEGIN
  ALTER TABLE messages ADD COLUMN edited_at TIMESTAMP WITH TIME ZONE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add reply_to_id for message threading
DO $$ BEGIN
  ALTER TABLE messages ADD COLUMN reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(reply_to_id);
