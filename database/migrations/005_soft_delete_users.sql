-- Soft delete support for users
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Partial index for efficient active-user queries
CREATE INDEX idx_users_active ON users (id) WHERE deleted_at IS NULL;
