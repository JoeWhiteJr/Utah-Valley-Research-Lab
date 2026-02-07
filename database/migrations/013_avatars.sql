-- Add avatar_url to users
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
