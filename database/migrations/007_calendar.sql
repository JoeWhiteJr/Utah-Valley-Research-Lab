-- Calendar feature tables for UVRL
-- Migration 007: Calendar events, categories, and attendees

-- Calendar event categories (lab-wide, managed by admins)
CREATE TABLE IF NOT EXISTS calendar_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  scope VARCHAR(20) NOT NULL DEFAULT 'lab',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, scope)
);

-- Calendar events (the core table)
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT false,

  -- Ownership & scope
  scope VARCHAR(20) NOT NULL DEFAULT 'personal',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Category
  category_id UUID REFERENCES calendar_categories(id) ON DELETE SET NULL,

  -- Link to existing UVRL entities
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,

  -- Recurrence (JSON, nullable)
  repeat_rule JSONB,

  -- Reminders (JSON array)
  reminders JSONB DEFAULT '[]',

  -- Notes (rich text / markdown)
  notes TEXT DEFAULT '',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event attendees (for lab events)
CREATE TABLE IF NOT EXISTS calendar_event_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  UNIQUE(event_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_scope ON calendar_events(scope);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_project ON calendar_events(project_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON calendar_events(category_id);
CREATE INDEX IF NOT EXISTS idx_calendar_attendees_user ON calendar_event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_attendees_event ON calendar_event_attendees(event_id);

-- Auto-update trigger for updated_at
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
