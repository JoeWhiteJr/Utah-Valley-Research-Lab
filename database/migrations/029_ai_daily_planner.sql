-- AI Daily Planner tables
-- Stores AI-generated daily plans, steps, check-ins, and weekly reviews

-- Daily plans: one plan per user per day
CREATE TABLE IF NOT EXISTS daily_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  ai_summary TEXT,
  ai_prompt_context JSONB,
  token_usage JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_date)
);

-- Daily plan steps: AI-generated actionable steps
CREATE TABLE IF NOT EXISTS daily_plan_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  estimated_minutes INTEGER,
  priority_score INTEGER CHECK (priority_score >= 0 AND priority_score <= 10),
  priority_label VARCHAR(20) CHECK (priority_label IN ('critical', 'high', 'medium', 'low')),
  completed BOOLEAN DEFAULT FALSE,
  source_type VARCHAR(50),
  source_id UUID,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily plan check-ins: follow-up Q&A for incomplete steps
CREATE TABLE IF NOT EXISTS daily_plan_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ai_message TEXT,
  questions JSONB,
  responses JSONB,
  responded_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly reviews: end-of-week AI summary with stats
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  ai_summary TEXT,
  stats JSONB,
  token_usage JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date ON daily_plans(user_id, plan_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_plan_steps_plan ON daily_plan_steps(plan_id);
CREATE INDEX IF NOT EXISTS idx_daily_plan_steps_completed ON daily_plan_steps(plan_id, completed);
CREATE INDEX IF NOT EXISTS idx_daily_plan_checkins_plan ON daily_plan_checkins(plan_id);
CREATE INDEX IF NOT EXISTS idx_daily_plan_checkins_user ON daily_plan_checkins(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user ON weekly_reviews(user_id, week_start DESC);

-- Updated-at triggers
CREATE TRIGGER update_daily_plans_updated_at BEFORE UPDATE ON daily_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_plan_steps_updated_at BEFORE UPDATE ON daily_plan_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_plan_checkins_updated_at BEFORE UPDATE ON daily_plan_checkins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_reviews_updated_at BEFORE UPDATE ON weekly_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
