-- Effort-justification research studies (jsPsych games served at /study).
-- Anonymous public flow: participant_code is the only identifier.

-- One row per participant. demographics + ip_hash + user_agent stored for
-- screening/duplicate detection. No PII (email/name) is collected.
CREATE TABLE study_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_code VARCHAR(64) NOT NULL UNIQUE,
    consent_given_at TIMESTAMPTZ,
    demographics JSONB DEFAULT '{}'::jsonb,
    user_agent TEXT,
    ip_hash VARCHAR(64),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_study_participants_created ON study_participants(created_at DESC);
CREATE INDEX idx_study_participants_completed ON study_participants(completed_at) WHERE completed_at IS NOT NULL;

CREATE TRIGGER update_study_participants_updated_at
    BEFORE UPDATE ON study_participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Condition assignment per participant. Targets per experiment match the
-- original Research_Games config (treasure_hunt: 4 conditions × 80;
-- career_choice: 1 within-subjects condition × 240; pattern_memory: 2 × 120).
CREATE TABLE study_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID NOT NULL REFERENCES study_participants(id) ON DELETE CASCADE,
    experiment VARCHAR(32) NOT NULL CHECK (experiment IN ('treasure_hunt', 'career_choice', 'pattern_memory')),
    condition VARCHAR(32) NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_study_assignments_participant ON study_assignments(participant_id);
CREATE INDEX idx_study_assignments_balance ON study_assignments(experiment, condition);
CREATE INDEX idx_study_assignments_completed ON study_assignments(experiment, completed_at) WHERE completed_at IS NOT NULL;

-- Final and snapshot responses. payload holds the full jsPsych trial dump
-- verbatim, so we can flatten any DV during export without committing to a
-- schema while the experiment design is still settling.
CREATE TABLE study_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES study_assignments(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    is_snapshot BOOLEAN NOT NULL DEFAULT false,
    submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_study_responses_assignment ON study_responses(assignment_id);
CREATE INDEX idx_study_responses_final ON study_responses(assignment_id) WHERE is_snapshot = false;
