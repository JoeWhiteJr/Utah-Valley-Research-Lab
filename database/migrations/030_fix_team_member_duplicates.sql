-- Fix duplicate team members and add unique constraint
-- The public_team_members table lacked a unique constraint, so seed data
-- was re-inserted as duplicates on every migration run.

-- Delete duplicates, keeping only the oldest row per (name, category)
DELETE FROM public_team_members
WHERE id NOT IN (
  SELECT DISTINCT ON (name, category) id
  FROM public_team_members
  ORDER BY name, category, created_at ASC
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE public_team_members
  ADD CONSTRAINT uq_team_member_name_category UNIQUE (name, category);
