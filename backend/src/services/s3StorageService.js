const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

let s3Client = null;
let S3_BUCKET = null;

/**
 * Lazily initialize the S3 client only when needed.
 */
function getClient() {
  if (s3Client) return s3Client;

  const { S3Client } = require('@aws-sdk/client-s3');
  const region = process.env.AWS_REGION || 'us-west-2';

  s3Client = new S3Client({ region });
  S3_BUCKET = process.env.S3_UPLOAD_BUCKET;

  return s3Client;
}

function getBucket() {
  if (!S3_BUCKET) S3_BUCKET = process.env.S3_UPLOAD_BUCKET;
  return S3_BUCKET;
}

/**
 * Check if S3 storage is enabled.
 */
function isEnabled() {
  return !!process.env.S3_UPLOAD_BUCKET;
}

/**
 * Upload a buffer or stream to S3.
 * @param {string} key - S3 object key
 * @param {Buffer|ReadableStream} body - file content
 * @param {string} contentType - MIME type
 * @returns {Promise<{bucket: string, key: string}>}
 */
async function upload(key, body, contentType) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const client = getClient();
  const bucket = getBucket();

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));

  logger.info({ bucket, key }, 'File uploaded to S3');
  return { bucket, key };
}

/**
 * Upload a file from the local filesystem to S3.
 * @param {string} key - S3 object key
 * @param {string} filePath - local file path
 * @param {string} contentType - MIME type
 * @returns {Promise<{bucket: string, key: string}>}
 */
async function uploadFromPath(key, filePath, contentType) {
  const body = fs.createReadStream(filePath);
  return upload(key, body, contentType);
}

/**
 * Generate a presigned URL for downloading a file.
 * @param {string} key - S3 object key
 * @param {number} expiresIn - seconds until expiry (default 3600)
 * @param {string} [downloadFilename] - suggested filename for download
 * @returns {Promise<string>} presigned URL
 */
async function getPresignedUrl(key, expiresIn = 3600, downloadFilename) {
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

  const client = getClient();
  const params = {
    Bucket: getBucket(),
    Key: key,
  };

  if (downloadFilename) {
    params.ResponseContentDisposition = `attachment; filename="${downloadFilename}"`;
  }

  return getSignedUrl(client, new GetObjectCommand(params), { expiresIn });
}

/**
 * Generate a presigned URL for inline viewing (Content-Disposition: inline).
 * @param {string} key - S3 object key
 * @param {string} contentType - MIME type for Content-Type header
 * @param {number} expiresIn - seconds until expiry (default 3600)
 * @returns {Promise<string>} presigned URL
 */
async function getPresignedViewUrl(key, contentType, expiresIn = 3600) {
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

  const client = getClient();
  const params = {
    Bucket: getBucket(),
    Key: key,
    ResponseContentDisposition: 'inline',
    ResponseContentType: contentType,
  };

  return getSignedUrl(client, new GetObjectCommand(params), { expiresIn });
}

/**
 * Get a readable stream for an S3 object.
 * @param {string} key - S3 object key
 * @returns {Promise<ReadableStream>}
 */
async function getStream(key) {
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const client = getClient();

  const response = await client.send(new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  }));

  return response.Body;
}

/**
 * Delete an S3 object.
 * @param {string} key - S3 object key
 */
async function deleteObject(key) {
  const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const client = getClient();

  await client.send(new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: key,
  }));

  logger.info({ key }, 'File deleted from S3');
}

/**
 * Check if an S3 object exists.
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>}
 */
async function exists(key) {
  const { HeadObjectCommand } = require('@aws-sdk/client-s3');
  const client = getClient();

  try {
    await client.send(new HeadObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }));
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
}

/**
 * Download an S3 object to a temporary file.
 * @param {string} key - S3 object key
 * @param {string} tmpDir - directory for temp file
 * @returns {Promise<string>} path to temp file
 */
async function downloadToTemp(key, tmpDir) {
  const os = require('os');
  const dir = tmpDir || os.tmpdir();
  const ext = path.extname(key);
  const tmpPath = path.join(dir, `s3-download-${Date.now()}${ext}`);

  const stream = await getStream(key);
  const writeStream = fs.createWriteStream(tmpPath);

  await new Promise((resolve, reject) => {
    stream.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  return tmpPath;
}

module.exports = {
  isEnabled,
  upload,
  uploadFromPath,
  getPresignedUrl,
  getPresignedViewUrl,
  getStream,
  delete: deleteObject,
  exists,
  downloadToTemp,
};
