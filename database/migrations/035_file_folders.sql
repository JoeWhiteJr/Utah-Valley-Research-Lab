CREATE TABLE IF NOT EXISTS folders (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    parent_id   UUID REFERENCES folders(id) ON DELETE CASCADE,
    created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMPTZ,
    deleted_by  UUID REFERENCES users(id)
);

ALTER TABLE files ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_folders_project ON folders(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id) WHERE deleted_at IS NULL;
