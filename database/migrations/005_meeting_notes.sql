-- Add notes column to meetings table for rich text meeting notes
-- Migration: 005_meeting_notes.sql

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for notes if needed for full-text search in the future
-- CREATE INDEX idx_meetings_notes ON meetings USING gin(to_tsvector('english', notes));

COMMENT ON COLUMN meetings.notes IS 'Rich text HTML content for meeting notes';
