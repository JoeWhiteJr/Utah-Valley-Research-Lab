-- Migration 025: Add important_info to projects and description to action_items

-- 1. Project "Important Information" free-form field
ALTER TABLE projects ADD COLUMN IF NOT EXISTS important_info TEXT;

-- 2. Task description field
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS description TEXT;
