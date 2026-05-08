#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * One-time migration script to move existing local files to S3.
 *
 * For each file/meeting/chat upload stored locally:
 *   1. Compute SHA-256 checksum
 *   2. Generate thumbnail (for images)
 *   3. Upload to S3
 *   4. Update database record with S3 metadata
 *
 * Does NOT delete local files (safety net for 30 days).
 *
 * Usage:
 *   node src/scripts/migrateToS3.js
 *   node src/scripts/migrateToS3.js --dry-run   (preview only, no changes)
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { computeChecksum } = require('../services/fileIntegrityService');
const { generateThumbnail, isImageType } = require('../services/thumbnailService');
const s3Storage = require('../services/s3StorageService');

const DRY_RUN = process.argv.includes('--dry-run');

async function migrateFiles() {
  if (!s3Storage.isEnabled()) {
    console.error('S3_UPLOAD_BUCKET is not set. Cannot migrate.');
    process.exit(1);
  }

  console.log(DRY_RUN ? '=== DRY RUN MODE ===' : '=== MIGRATING FILES TO S3 ===');

  // 1. Migrate project files
  console.log('\n--- Project Files ---');
  const files = await db.query(
    "SELECT id, filename, original_filename, storage_path, file_type, file_size FROM files WHERE storage_backend = 'local' AND deleted_at IS NULL"
  );
  console.log(`Found ${files.rows.length} local files to migrate`);

  for (const file of files.rows) {
    await migrateFile(file, 'files', 'files');
  }

  // 2. Migrate meeting audio
  console.log('\n--- Meeting Audio ---');
  const meetings = await db.query(
    "SELECT id, audio_path FROM meetings WHERE storage_backend = 'local' AND audio_path IS NOT NULL AND deleted_at IS NULL"
  );
  console.log(`Found ${meetings.rows.length} local audio files to migrate`);

  for (const meeting of meetings.rows) {
    await migrateMeetingAudio(meeting);
  }

  // 3. Migrate chat uploads
  console.log('\n--- Chat Uploads ---');
  const chatMessages = await db.query(
    "SELECT id, file_url, audio_url FROM messages WHERE (file_url LIKE '/uploads/chat/%' OR audio_url LIKE '/uploads/chat/%') AND deleted_at IS NULL"
  );
  console.log(`Found ${chatMessages.rows.length} chat messages with local files`);

  for (const msg of chatMessages.rows) {
    await migrateChatFile(msg);
  }

  // 4. Migrate cover images
  console.log('\n--- Cover Images ---');
  const covers = await db.query(
    "SELECT id, header_image FROM projects WHERE header_image LIKE '/uploads/covers/%' AND deleted_at IS NULL"
  );
  console.log(`Found ${covers.rows.length} local cover images to migrate`);

  for (const project of covers.rows) {
    await migrateCoverImage(project);
  }

  // 5. Migrate avatars
  console.log('\n--- Avatars ---');
  const avatars = await db.query(
    "SELECT id, avatar_url FROM users WHERE avatar_url LIKE '/uploads/avatars/%' AND deleted_at IS NULL"
  );
  console.log(`Found ${avatars.rows.length} local avatars to migrate`);

  for (const user of avatars.rows) {
    await migrateAvatar(user);
  }

  console.log('\n=== Migration complete ===');
  process.exit(0);
}

async function migrateFile(file, category, _table) {
  const filePath = file.storage_path;
  if (!filePath || !fs.existsSync(filePath)) {
    console.log(`  SKIP ${file.id}: file not found at ${filePath}`);
    return;
  }

  try {
    const checksum = await computeChecksum(filePath);
    const s3Key = `${category}/${file.filename}`;

    // Generate thumbnail for images
    let thumbnailPath = null;
    if (isImageType(file.file_type)) {
      const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
      const thumbDir = path.join(uploadDir, 'thumbnails');
      const baseName = path.basename(file.filename, path.extname(file.filename));
      thumbnailPath = await generateThumbnail(filePath, thumbDir, baseName);

      if (thumbnailPath) {
        const thumbKey = `thumbnails/${path.basename(thumbnailPath)}`;
        if (!DRY_RUN) {
          await s3Storage.uploadFromPath(thumbKey, thumbnailPath, 'image/jpeg');
        }
        thumbnailPath = thumbKey;
      }
    }

    if (!DRY_RUN) {
      await s3Storage.uploadFromPath(s3Key, filePath, file.file_type);
      await db.query(
        `UPDATE files SET checksum_sha256 = $1, s3_key = $2, s3_bucket = $3, storage_backend = 's3', thumbnail_path = $4 WHERE id = $5`,
        [checksum, s3Key, process.env.S3_UPLOAD_BUCKET, thumbnailPath, file.id]
      );
    }

    console.log(`  OK ${file.id}: ${file.original_filename} -> s3://${s3Key}`);
  } catch (err) {
    console.error(`  ERROR ${file.id}: ${err.message}`);
  }
}

async function migrateMeetingAudio(meeting) {
  const filePath = meeting.audio_path;
  if (!filePath || !fs.existsSync(filePath)) {
    console.log(`  SKIP meeting ${meeting.id}: file not found at ${filePath}`);
    return;
  }

  try {
    const checksum = await computeChecksum(filePath);
    const filename = path.basename(filePath);
    const s3Key = `audio/${filename}`;

    if (!DRY_RUN) {
      await s3Storage.uploadFromPath(s3Key, filePath, 'audio/mpeg');
      await db.query(
        `UPDATE meetings SET checksum_sha256 = $1, s3_key = $2, s3_bucket = $3, storage_backend = 's3' WHERE id = $4`,
        [checksum, s3Key, process.env.S3_UPLOAD_BUCKET, meeting.id]
      );
    }

    console.log(`  OK meeting ${meeting.id}: ${filename} -> s3://${s3Key}`);
  } catch (err) {
    console.error(`  ERROR meeting ${meeting.id}: ${err.message}`);
  }
}

async function migrateChatFile(msg) {
  const fileUrl = msg.file_url || msg.audio_url;
  if (!fileUrl) return;

  const filename = path.basename(fileUrl);
  const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
  const filePath = path.join(uploadDir, 'chat', filename);

  if (!fs.existsSync(filePath)) {
    console.log(`  SKIP msg ${msg.id}: file not found at ${filePath}`);
    return;
  }

  try {
    const s3Key = `chat/${filename}`;

    if (!DRY_RUN) {
      await s3Storage.uploadFromPath(s3Key, filePath, 'application/octet-stream');

      // Update the message to use S3 key
      if (msg.file_url) {
        await db.query('UPDATE messages SET file_url = $1 WHERE id = $2', [s3Key, msg.id]);
      }
      if (msg.audio_url) {
        await db.query('UPDATE messages SET audio_url = $1 WHERE id = $2', [s3Key, msg.id]);
      }
    }

    console.log(`  OK msg ${msg.id}: ${filename} -> s3://${s3Key}`);
  } catch (err) {
    console.error(`  ERROR msg ${msg.id}: ${err.message}`);
  }
}

async function migrateCoverImage(project) {
  const filename = path.basename(project.header_image);
  const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
  const filePath = path.join(uploadDir, 'covers', filename);

  if (!fs.existsSync(filePath)) {
    console.log(`  SKIP project ${project.id}: cover not found at ${filePath}`);
    return;
  }

  try {
    const s3Key = `covers/${filename}`;

    if (!DRY_RUN) {
      await s3Storage.uploadFromPath(s3Key, filePath, 'image/jpeg');
      await db.query('UPDATE projects SET header_image = $1 WHERE id = $2', [s3Key, project.id]);
    }

    console.log(`  OK project ${project.id}: ${filename} -> s3://${s3Key}`);
  } catch (err) {
    console.error(`  ERROR project ${project.id}: ${err.message}`);
  }
}

async function migrateAvatar(user) {
  const filename = path.basename(user.avatar_url);
  const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
  const filePath = path.join(uploadDir, 'avatars', filename);

  if (!fs.existsSync(filePath)) {
    console.log(`  SKIP user ${user.id}: avatar not found at ${filePath}`);
    return;
  }

  try {
    const s3Key = `avatars/${filename}`;

    if (!DRY_RUN) {
      await s3Storage.uploadFromPath(s3Key, filePath, 'image/jpeg');
      await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [s3Key, user.id]);
    }

    console.log(`  OK user ${user.id}: ${filename} -> s3://${s3Key}`);
  } catch (err) {
    console.error(`  ERROR user ${user.id}: ${err.message}`);
  }
}

migrateFiles().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
