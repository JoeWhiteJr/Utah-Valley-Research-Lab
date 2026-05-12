const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a configured multer instance backed by disk storage.
 *
 * Replaces the eight per-route multer configs that previously lived inline in
 * each upload route. Consolidating the config prevents drift (e.g. chats.js
 * used to enforce only a MIME allowlist, which let a renamed executable with a
 * spoofed `Content-Type: image/png` slip past the filter).
 *
 * The fileFilter requires BOTH the MIME type AND the file extension to be in
 * their respective allowlists. The MIME comparison strips codec parameters
 * so `audio/webm;codecs=opus` matches `audio/webm`. The extension comparison
 * is case-insensitive.
 *
 * Files are written to `${UPLOAD_DIR}/${subdir}` (or `${UPLOAD_DIR}` when
 * subdir is empty, matching the legacy behavior of `files.js`). Each file is
 * stored under a UUIDv4 basename plus the original extension.
 *
 * @param {object} opts
 * @param {string} [opts.subdir]           Destination subdirectory under
 *                                         UPLOAD_DIR. Empty string or omitted
 *                                         writes to UPLOAD_DIR itself.
 * @param {number} opts.maxBytes           Per-file size cap (bytes).
 * @param {string[]} opts.allowedMimes     MIME allowlist.
 * @param {string[]} opts.allowedExts      Extension allowlist (each entry must
 *                                         include the leading dot, lowercase).
 * @returns {import('multer').Multer}
 */
function createUploader({ subdir = '', maxBytes, allowedMimes, allowedExts }) {
  if (!Array.isArray(allowedMimes) || allowedMimes.length === 0) {
    throw new Error('createUploader: allowedMimes must be a non-empty array');
  }
  if (!Array.isArray(allowedExts) || allowedExts.length === 0) {
    throw new Error('createUploader: allowedExts must be a non-empty array');
  }
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new Error('createUploader: maxBytes must be a positive number');
  }

  const baseDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
  const destDir = subdir ? path.join(baseDir, subdir) : baseDir;
  const extSet = new Set(allowedExts.map((e) => e.toLowerCase()));
  const mimeSet = new Set(allowedMimes.map((m) => m.toLowerCase()));

  // Create the destination directory at instantiation rather than on first
  // upload. Some test fixtures (and the download endpoint) write directly to
  // UPLOAD_DIR before any multer request fires, and lazy-mkdir leaves them
  // racing against whichever upload happens to run first under jest's
  // parallel workers.
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    }
  });

  return multer({
    storage,
    limits: { fileSize: maxBytes },
    fileFilter: (req, file, cb) => {
      const baseMime = String(file.mimetype || '').split(';')[0].trim().toLowerCase();
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (mimeSet.has(baseMime) && extSet.has(ext)) {
        cb(null, true);
      } else {
        cb(new Error('File type not allowed'), false);
      }
    }
  });
}

module.exports = { createUploader };
