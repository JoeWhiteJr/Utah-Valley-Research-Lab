-- Multi-study foundation: a studies table that owns participants + assignments
-- via FK. Existing data is backfilled with slug='effort-justification'.
-- Per-study experiment registry stays in code (backend/src/research-studies/<slug>.js)
-- since each experiment is unique psychology code, not data.

CREATE TABLE studies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    blurb TEXT,
    estimated_minutes INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_studies_active_recent ON studies(created_at DESC) WHERE status = 'active';

CREATE TRIGGER update_studies_updated_at
    BEFORE UPDATE ON studies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed the existing study so backfill works.
INSERT INTO studies (slug, title, blurb, estimated_minutes, status)
VALUES (
    'effort-justification',
    'Effort Justification & Behavioral Persistence',
    'A short interactive study exploring how people respond to feedback during structured tasks. Anonymous — no name or email collected. About 10–15 minutes.',
    13,
    'active'
);

-- Add study_id to participants + assignments, backfill, then make NOT NULL.
ALTER TABLE study_participants ADD COLUMN study_id UUID REFERENCES studies(id);
ALTER TABLE study_assignments ADD COLUMN study_id UUID REFERENCES studies(id);

UPDATE study_participants
SET study_id = (SELECT id FROM studies WHERE slug = 'effort-justification')
WHERE study_id IS NULL;

UPDATE study_assignments
SET study_id = (SELECT id FROM studies WHERE slug = 'effort-justification')
WHERE study_id IS NULL;

ALTER TABLE study_participants ALTER COLUMN study_id SET NOT NULL;
ALTER TABLE study_assignments ALTER COLUMN study_id SET NOT NULL;

CREATE INDEX idx_study_participants_study ON study_participants(study_id);
CREATE INDEX idx_study_assignments_study ON study_assignments(study_id);

-- The original CHECK constraint hardcoded the three experiments. Future studies
-- bring their own experiment names, validated in code, so the DB-level whitelist
-- becomes restrictive. Drop it.
ALTER TABLE study_assignments DROP CONSTRAINT IF EXISTS study_assignments_experiment_check;
