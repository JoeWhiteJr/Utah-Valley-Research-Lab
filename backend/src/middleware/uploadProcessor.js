const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');
const { computeChecksum, validateMagicBytes } = require('../services/fileIntegrityService');
const s3Storage = require('../services/s3StorageService');
const { generateThumbnail, isImageType } = require('../services/thumbnailService');

/**
 * Create a reusable upload processing middleware.
 * Applied after multer on all upload routes.
 *
 * @param {Object} options
 * @param {string} options.category - S3 prefix category: 'files', 'audio', 'chat', 'covers', 'avatars'
 * @param {boolean} options.generateThumbnail - whether to generate thumbnails for images
 * @param {string} [options.fileField] - multer field name (default: inferred from req.file)
 * @returns {Function} Express middleware
 */
function processUpload(options = {}) {
  const { category = 'files', generateThumbnail: genThumb = false } = options;

  return async (req, res, next) => {
    if (!req.file) return next();

    const filePath = req.file.path;
    const declaredMime = req.file.mimetype;

    try {
      // 1. Validate magic bytes
      const { valid, detectedMime } = await validateMagicBytes(filePath, declaredMime);
      if (!valid) {
        // Clean up the uploaded file
        fs.unlink(filePath, () => {});
        return res.status(400).json({
          error: { message: 'File content does not match declared type' }
        });
      }

      // 2. Compute SHA-256 checksum
      const checksum = await computeChecksum(filePath);

      // 3. Generate thumbnail (if enabled and file is an image)
      let thumbnailPath = null;
      if (genThumb && isImageType(declaredMime)) {
        const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
        const thumbDir = path.join(uploadDir, 'thumbnails');
        const baseName = path.basename(req.file.filename, path.extname(req.file.filename));
        thumbnailPath = await generateThumbnail(filePath, thumbDir, baseName);
      }

      // 4. Upload to S3 if enabled
      let s3Key = null;
      let s3Bucket = null;
      let storageBackend = 'local';

      if (s3Storage.isEnabled()) {
        // Build S3 key
        s3Key = `${category}/${req.file.filename}`;
        const result = await s3Storage.uploadFromPath(s3Key, filePath, declaredMime);
        s3Bucket = result.bucket;
        storageBackend = 's3';

        // Upload thumbnail to S3 if generated
        if (thumbnailPath) {
          const thumbKey = `thumbnails/${path.basename(thumbnailPath)}`;
          await s3Storage.uploadFromPath(thumbKey, thumbnailPath, 'image/jpeg');
          // Update thumbnail path to S3 key
          fs.unlink(thumbnailPath, () => {});
          thumbnailPath = thumbKey;
        }

        // Remove local file after successful S3 upload
        fs.unlink(filePath, () => {});
      }

      // 5. Attach metadata to req.file for route handlers
      req.file.checksum = checksum;
      req.file.detectedMimeType = detectedMime;
      req.file.s3Key = s3Key;
      req.file.s3Bucket = s3Bucket;
      req.file.storageBackend = storageBackend;
      req.file.thumbnailPath = thumbnailPath;

      next();
    } catch (error) {
      logger.error({ err: error, filePath }, 'Upload processing failed');
      // Clean up on error
      fs.unlink(filePath, () => {});
      next(error);
    }
  };
}

module.exports = { processUpload };
