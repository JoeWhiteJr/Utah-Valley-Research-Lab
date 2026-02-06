-- Migration 004: Categories for Action Items and Inactive Project Status
-- Terminal 3: Feature 5 (Categories) and Feature 6 (Inactive Projects)

-- Create categories table for organizing action items
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- Add category_id to action_items table
ALTER TABLE action_items
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_categories_project ON categories(project_id);
CREATE INDEX IF NOT EXISTS idx_actions_category ON action_items(category_id);

-- Add 'inactive' to project_status enum
-- First, we need to add the new value to the enum type
DO $$
BEGIN
  -- Check if 'inactive' value exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'inactive'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'project_status')
  ) THEN
    ALTER TYPE project_status ADD VALUE 'inactive';
  END IF;
END $$;
