-- Add super admin column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Set super admin for the designated user
UPDATE users SET is_super_admin = TRUE WHERE email = '10947671@uvu.edu';
