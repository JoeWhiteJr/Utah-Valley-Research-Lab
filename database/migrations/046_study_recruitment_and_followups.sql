-- Recruitment-goal targets + anonymous follow-up signups.
-- Targets let admins see at-a-glance which conditions are near or over goal.
-- Follow-up signups are a SEPARATE mailing list: emails are NEVER linked back
-- to a participant_code or response, so the anonymous guarantee in the consent
-- form remains intact.

ALTER TABLE studies
    ADD COLUMN IF NOT EXISTS recruitment_target_per_condition INTEGER;

-- Seed the existing effort-justification study with the per-condition target
-- baked into the original Research_Games config (80 for treasure_hunt, 240
-- total for career_choice, 120 for pattern_memory). The smallest is 80, which
-- is also what the current screening assumes — set the platform-wide default
-- to that. Admins can override per study via the studies table.
UPDATE studies SET recruitment_target_per_condition = 80
WHERE slug = 'effort-justification' AND recruitment_target_per_condition IS NULL;

-- Anonymous follow-up signups: when a participant opts in on the debrief page
-- to be notified of published results. study_id is recorded so emails can be
-- segmented per study if multiple are run, but there is NO column that ties a
-- signup back to a participant_code or response. Email is the unique key per
-- (study_id, email) so re-submissions are idempotent.
CREATE TABLE IF NOT EXISTS study_follow_up_signups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_id UUID NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(study_id, email)
);

CREATE INDEX IF NOT EXISTS idx_study_follow_up_signups_study ON study_follow_up_signups(study_id);
