-- File integrity, S3 storage, and thumbnail support
-- Adds checksum verification, magic bytes detection, S3 storage metadata, and thumbnail paths

-- Files table additions
ALTER TABLE files ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64);
ALTER TABLE files ADD COLUMN IF NOT EXISTS detected_mime_type VARCHAR(100);
ALTER TABLE files ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500);
ALTER TABLE files ADD COLUMN IF NOT EXISTS s3_bucket VARCHAR(255);
ALTER TABLE files ADD COLUMN IF NOT EXISTS storage_backend VARCHAR(10) DEFAULT 'local';
ALTER TABLE files ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(500);

-- Meetings table additions (for audio files)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64);
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS detected_mime_type VARCHAR(100);
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500);
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS s3_bucket VARCHAR(255);
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS storage_backend VARCHAR(10) DEFAULT 'local';

-- Indexes for S3 lookups
CREATE INDEX IF NOT EXISTS idx_files_storage_backend ON files(storage_backend);
CREATE INDEX IF NOT EXISTS idx_files_s3_key ON files(s3_key) WHERE s3_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_storage_backend ON meetings(storage_backend);
