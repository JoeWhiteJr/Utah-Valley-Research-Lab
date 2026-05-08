const fs = require('fs');
const crypto = require('crypto');
const logger = require('../config/logger');

/**
 * Compute SHA-256 checksum of a file by streaming it.
 * @param {string} filePath
 * @returns {Promise<string>} hex-encoded SHA-256 hash
 */
function computeChecksum(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Verify a file's checksum matches the expected value.
 * @param {string} filePath
 * @param {string} expected - hex-encoded SHA-256 hash
 * @returns {Promise<boolean>}
 */
async function verifyChecksum(filePath, expected) {
  if (!expected) return true;
  const actual = await computeChecksum(filePath);
  return actual === expected;
}

// MIME types that are text-based and have no magic bytes
const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/csv',
  'application/json',
  'text/markdown',
]);

// Office formats are ZIP-based containers — file-type detects them as application/zip
// so we allow them through when the declared MIME matches an Office type
const OFFICE_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
]);

/**
 * Validate that a file's magic bytes match its declared MIME type.
 * @param {string} filePath
 * @param {string} declaredMime - MIME type from the upload header
 * @returns {Promise<{valid: boolean, detectedMime: string|null}>}
 */
async function validateMagicBytes(filePath, declaredMime) {
  // Text-based formats have no magic bytes — allow through
  if (TEXT_MIME_TYPES.has(declaredMime)) {
    return { valid: true, detectedMime: declaredMime };
  }

  try {
    const { fileTypeFromFile } = await import('file-type');
    const result = await fileTypeFromFile(filePath);

    if (!result) {
      // file-type couldn't determine the type
      // For Office formats and text files this is acceptable
      if (OFFICE_MIME_TYPES.has(declaredMime) || declaredMime.startsWith('text/')) {
        return { valid: true, detectedMime: declaredMime };
      }
      logger.warn({ filePath, declaredMime }, 'Could not detect file type from magic bytes');
      return { valid: false, detectedMime: null };
    }

    const detectedMime = result.mime;

    // Exact match
    if (detectedMime === declaredMime) {
      return { valid: true, detectedMime };
    }

    // Office files detected as ZIP are valid
    if (OFFICE_MIME_TYPES.has(declaredMime) && detectedMime === 'application/zip') {
      return { valid: true, detectedMime: declaredMime };
    }

    // audio/mpeg covers .mp3 files
    if (declaredMime === 'audio/mpeg' && detectedMime === 'audio/mpeg') {
      return { valid: true, detectedMime };
    }

    // Allow same top-level type (e.g. audio/mp4 detected as audio/x-m4a)
    const declaredCategory = declaredMime.split('/')[0];
    const detectedCategory = detectedMime.split('/')[0];
    if (declaredCategory === detectedCategory) {
      return { valid: true, detectedMime };
    }

    logger.warn({ filePath, declaredMime, detectedMime }, 'MIME type mismatch detected');
    return { valid: false, detectedMime };
  } catch (error) {
    logger.error({ err: error, filePath }, 'Magic bytes validation error');
    // On error, allow through rather than blocking uploads
    return { valid: true, detectedMime: declaredMime };
  }
}

module.exports = { computeChecksum, verifyChecksum, validateMagicBytes };
