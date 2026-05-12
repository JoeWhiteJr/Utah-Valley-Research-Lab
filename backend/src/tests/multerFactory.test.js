const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const request = require('supertest');

const { createUploader } = require('../middleware/uploads');

/**
 * Unit tests for the shared multer factory (PR: refactor/multer-uploader-factory).
 *
 * Verifies:
 *   1. Files matching BOTH the MIME allowlist and the extension allowlist are
 *      accepted and written to the configured subdirectory under a UUID name.
 *   2. Mime-only match (extension NOT in allowlist) is rejected.
 *      This is the security gap closed for chats.js — a file renamed `.exe`
 *      but sent with `Content-Type: image/png` would have slipped past the
 *      old chats filter.
 *   3. Extension-only match (MIME NOT in allowlist) is rejected.
 *   4. Files over maxBytes are rejected by multer's limits.
 *   5. Codec parameters (`audio/webm;codecs=opus`) are stripped before the
 *      MIME comparison, preserving the legacy behavior of audio routes.
 */

describe('createUploader (multer factory)', () => {
  let uploadDir;
  let originalUploadDir;

  beforeAll(() => {
    originalUploadDir = process.env.UPLOAD_DIR;
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uvrl-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
  });

  afterAll(() => {
    if (originalUploadDir === undefined) {
      delete process.env.UPLOAD_DIR;
    } else {
      process.env.UPLOAD_DIR = originalUploadDir;
    }
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  // Build a tiny Express app that mounts the uploader at POST /upload and
  // returns either the multer error or the parsed file metadata. The error
  // path matches how the route files surface multer errors.
  function makeApp(uploader, field = 'file') {
    const app = express();
    app.post('/upload', (req, res) => {
      uploader.single(field)(req, res, (err) => {
        if (err) {
          return res.status(400).json({ error: { code: err.code, message: err.message } });
        }
        if (!req.file) return res.status(400).json({ error: { message: 'no file' } });
        return res.status(200).json({
          file: {
            filename: req.file.filename,
            destination: req.file.destination,
            size: req.file.size,
            mimetype: req.file.mimetype,
            originalname: req.file.originalname
          }
        });
      });
    });
    return app;
  }

  it('accepts a file whose MIME and extension both match the allowlists', async () => {
    const uploader = createUploader({
      subdir: 'covers',
      maxBytes: 1024 * 1024,
      allowedMimes: ['image/png'],
      allowedExts: ['.png']
    });
    const app = makeApp(uploader);

    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'photo.png',
        contentType: 'image/png'
      });

    expect(res.status).toBe(200);
    expect(res.body.file.destination).toBe(path.join(uploadDir, 'covers'));
    // Filename: <uuid>.png — UUIDv4 is 8-4-4-4-12 hex chars.
    expect(res.body.file.filename).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/
    );
    // File actually exists on disk where multer said it did.
    const onDisk = path.join(res.body.file.destination, res.body.file.filename);
    expect(fs.existsSync(onDisk)).toBe(true);
    fs.unlinkSync(onDisk);
  });

  it('rejects a file with allowed MIME but disallowed extension (chats spoofing gap)', async () => {
    const uploader = createUploader({
      subdir: 'chat',
      maxBytes: 1024 * 1024,
      allowedMimes: ['image/png'],
      allowedExts: ['.png']
    });
    const app = makeApp(uploader);

    // Attacker scenario: executable bytes saved as `.exe`, but Content-Type
    // header lies as `image/png`. Old chats.js (MIME-only) would have let
    // this through. New filter rejects on extension mismatch.
    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.from([0x4d, 0x5a]), {
        filename: 'malware.exe',
        contentType: 'image/png'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/file type not allowed/i);
  });

  it('rejects a file with allowed extension but disallowed MIME', async () => {
    const uploader = createUploader({
      subdir: 'chat',
      maxBytes: 1024 * 1024,
      allowedMimes: ['image/png'],
      allowedExts: ['.png']
    });
    const app = makeApp(uploader);

    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.from([0x00, 0x01]), {
        filename: 'sneaky.png',
        contentType: 'application/x-msdownload'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/file type not allowed/i);
  });

  it('rejects a file larger than maxBytes', async () => {
    const uploader = createUploader({
      subdir: 'small',
      maxBytes: 1024, // 1 KB
      allowedMimes: ['image/png'],
      allowedExts: ['.png']
    });
    const app = makeApp(uploader);

    const oversized = Buffer.alloc(2 * 1024, 0xaa); // 2 KB
    const res = await request(app)
      .post('/upload')
      .attach('file', oversized, { filename: 'big.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LIMIT_FILE_SIZE');
  });

  it('strips codec parameters from the MIME before allowlist check', async () => {
    // Mirrors the legacy audio routes which accepted `audio/webm;codecs=opus`
    // as `audio/webm`.
    const uploader = createUploader({
      subdir: 'audio',
      maxBytes: 1024 * 1024,
      allowedMimes: ['audio/webm'],
      allowedExts: ['.webm']
    });
    const app = makeApp(uploader, 'audio');

    const res = await request(app)
      .post('/upload')
      .attach('audio', Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), {
        filename: 'voicenote.webm',
        contentType: 'audio/webm;codecs=opus'
      });

    expect(res.status).toBe(200);
    expect(res.body.file.filename).toMatch(/\.webm$/);
    const onDisk = path.join(res.body.file.destination, res.body.file.filename);
    if (fs.existsSync(onDisk)) fs.unlinkSync(onDisk);
  });

  it('writes to UPLOAD_DIR itself when subdir is omitted (files.js behavior)', async () => {
    const uploader = createUploader({
      maxBytes: 1024 * 1024,
      allowedMimes: ['text/plain'],
      allowedExts: ['.txt']
    });
    const app = makeApp(uploader);

    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.from('hello world'), {
        filename: 'note.txt',
        contentType: 'text/plain'
      });

    expect(res.status).toBe(200);
    expect(res.body.file.destination).toBe(uploadDir);
    const onDisk = path.join(res.body.file.destination, res.body.file.filename);
    if (fs.existsSync(onDisk)) fs.unlinkSync(onDisk);
  });

  it('throws on invalid configuration', () => {
    expect(() => createUploader({ maxBytes: 100, allowedExts: ['.png'] })).toThrow(/allowedMimes/);
    expect(() => createUploader({ maxBytes: 100, allowedMimes: ['image/png'] })).toThrow(/allowedExts/);
    expect(() => createUploader({ allowedMimes: ['image/png'], allowedExts: ['.png'] })).toThrow(/maxBytes/);
  });
});
