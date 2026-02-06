-- Published Projects table
-- Stores independently editable snapshots of team projects for the public site

CREATE TABLE published_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    published_title VARCHAR(255) NOT NULL,
    published_description TEXT,
    published_image VARCHAR(500),
    published_status VARCHAR(20) CHECK (published_status IN ('ongoing', 'completed')),
    published_by UUID REFERENCES users(id),
    published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_published_projects_project_id ON published_projects(project_id);
CREATE INDEX idx_published_projects_status ON published_projects(published_status);
CREATE INDEX idx_published_projects_published_at ON published_projects(published_at);

-- Reuse existing trigger function for updated_at
CREATE TRIGGER update_published_projects_updated_at BEFORE UPDATE ON published_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
