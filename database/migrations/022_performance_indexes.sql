-- Performance indexes for common query patterns

-- Messages: pagination by room and timestamp
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at DESC);

-- Action items: queries by due date, assigned user, and project+completed status
CREATE INDEX IF NOT EXISTS idx_action_items_due_date ON action_items(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_assigned_to ON action_items(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_items_project_completed ON action_items(project_id, completed);

-- Notifications: unread notifications per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;

-- Activity log: user activity queries for streak tracking
CREATE INDEX IF NOT EXISTS idx_activity_log_user_date ON activity_log(user_id, activity_date, activity_type);

-- Chat members: membership lookups
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_room ON chat_members(room_id);

-- Action item assignees: lookups by user and action
CREATE INDEX IF NOT EXISTS idx_action_item_assignees_user ON action_item_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_action_item_assignees_action ON action_item_assignees(action_item_id);

-- Token blocklist: lookup by hash
CREATE INDEX IF NOT EXISTS idx_token_blocklist_hash ON token_blocklist(token_hash);

-- Password reset tokens: lookup by token hash
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
