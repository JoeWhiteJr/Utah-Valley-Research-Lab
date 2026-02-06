ALTER TABLE applications ADD COLUMN password_hash VARCHAR(255);
CREATE INDEX idx_applications_email_status ON applications(email, status);
