const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_HEIGHT = 300;

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

/**
 * Check if a MIME type is a supported image for thumbnail generation.
 */
function isImageType(mimeType) {
  return IMAGE_MIME_TYPES.has(mimeType);
}

/**
 * Generate a JPEG thumbnail for an image file.
 * @param {string} inputPath - path to the original image
 * @param {string} outputDir - directory where thumbnail will be saved
 * @param {string} filename - base filename (without extension) for the thumbnail
 * @returns {Promise<string|null>} path to the generated thumbnail, or null if not an image
 */
async function generateThumbnail(inputPath, outputDir, filename) {
  try {
    const sharp = require('sharp');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const thumbnailFilename = `${filename}_thumb.jpg`;
    const outputPath = path.join(outputDir, thumbnailFilename);

    await sharp(inputPath)
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
        fit: 'cover',
        position: 'centre',
      })
      .jpeg({ quality: 80 })
      .toFile(outputPath);

    logger.info({ inputPath, outputPath }, 'Thumbnail generated');
    return outputPath;
  } catch (error) {
    logger.error({ err: error, inputPath }, 'Thumbnail generation failed');
    return null;
  }
}

/**
 * Generate a thumbnail from a buffer.
 * @param {Buffer} buffer - image buffer
 * @param {string} outputDir - directory where thumbnail will be saved
 * @param {string} filename - base filename for the thumbnail
 * @returns {Promise<string|null>} path to the generated thumbnail
 */
async function generateThumbnailFromBuffer(buffer, outputDir, filename) {
  try {
    const sharp = require('sharp');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const thumbnailFilename = `${filename}_thumb.jpg`;
    const outputPath = path.join(outputDir, thumbnailFilename);

    await sharp(buffer)
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
        fit: 'cover',
        position: 'centre',
      })
      .jpeg({ quality: 80 })
      .toFile(outputPath);

    return outputPath;
  } catch (error) {
    logger.error({ err: error }, 'Thumbnail generation from buffer failed');
    return null;
  }
}

module.exports = { generateThumbnail, generateThumbnailFromBuffer, isImageType };
