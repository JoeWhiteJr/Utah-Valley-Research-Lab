-- Personal notes (private to each user, not tied to any project)
CREATE TABLE personal_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES users(id)
);

CREATE INDEX idx_personal_notes_user ON personal_notes(created_by) WHERE deleted_at IS NULL;

-- Reuse the existing updated_at trigger function
CREATE TRIGGER update_personal_notes_updated_at
    BEFORE UPDATE ON personal_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
