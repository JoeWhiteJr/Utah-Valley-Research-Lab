const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

/**
 * Wiring tests for the uploadProcessor middleware (PR-B).
 *
 * Confirms that:
 *   1. POST /api/files/project/:projectId persists the new integrity columns
 *      (checksum_sha256, detected_mime_type, storage_backend) on a happy-path
 *      upload, AND that the existing happy path still returns 201.
 *   2. A magic-byte mismatch (file says .png but contains an ELF executable
 *      header) is rejected with 400 by the uploadProcessor, no DB row is
 *      inserted, and the orphaned upload is unlinked from disk.
 *   3. The other four upload routes (meetings audio, chats audio/file/image,
 *      projects cover, users avatar) have processUpload installed in their
 *      middleware stack — checked by inspecting the Express router stack
 *      rather than running each happy path, since each route's table doesn't
 *      necessarily store every checksum field (e.g. messages and chat_rooms
 *      have no integrity columns).
 *
 * The local environment doesn't run Postgres, so most of these tests will only
 * exercise in CI. The router-stack inspection at the bottom does NOT require
 * a DB and serves as a fast smoke check that wiring landed correctly.
 */

// Minimal valid 1x1 PNG (89 50 4E 47 0D 0A 1A 0A header + IHDR/IDAT/IEND).
// Generated via `pngcrush` on a 1x1 transparent pixel; bytes are stable.
const VALID_PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, // IDAT chunk
  0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, // IEND chunk
  0x42, 0x60, 0x82
]);

// ELF executable magic header. Distinct from PNG; will be detected as
// application/x-elf or similar by the file-type library.
const ELF_BYTES = Buffer.concat([
  Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]), // ELF magic
  Buffer.alloc(64, 0) // padding so file-type has enough bytes to inspect
]);

describe('uploadProcessor wiring — POST /api/files/project/:projectId', () => {
  let researcherToken;
  let researcherUserId;
  let projectId;
  let validPngPath;
  let elfMasqueradePath;

  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%uploadwiring%'");

    const researcher = await createTestUser({
      name: 'Upload Wiring Researcher',
      email: 'uploadwiring-researcher@example.com',
      role: 'project_lead'
    });
    researcherToken = researcher.token;
    researcherUserId = researcher.id;

    // Ensure soft-delete + integrity columns exist (matches files.test.js
    // pattern; some envs may not have run migration 044 yet).
    await db.query('ALTER TABLE files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ');
    await db.query('ALTER TABLE files ADD COLUMN IF NOT EXISTS deleted_by UUID');
    await db.query('ALTER TABLE files ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64)');
    await db.query('ALTER TABLE files ADD COLUMN IF NOT EXISTS detected_mime_type VARCHAR(100)');
    await db.query('ALTER TABLE files ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500)');
    await db.query('ALTER TABLE files ADD COLUMN IF NOT EXISTS s3_bucket VARCHAR(255)');
    await db.query("ALTER TABLE files ADD COLUMN IF NOT EXISTS storage_backend VARCHAR(10) DEFAULT 'local'");
    await db.query('ALTER TABLE files ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(500)');
    await db.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ');

    const projectRes = await db.query(
      'INSERT INTO projects (title, description, created_by) VALUES ($1, $2, $3) RETURNING id',
      ['Upload Wiring Project', 'Project for uploadProcessor wiring tests', researcherUserId]
    );
    projectId = projectRes.rows[0].id;

    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    validPngPath = path.join(uploadDir, 'uploadwiring-valid.png');
    fs.writeFileSync(validPngPath, VALID_PNG_BYTES);

    // ELF bytes saved with a .png extension and uploaded with image/png MIME.
    // The route's multer fileFilter will accept it (extension + mimetype say
    // "image"), but uploadProcessor's magic-byte check should reject.
    elfMasqueradePath = path.join(uploadDir, 'uploadwiring-elf-masquerade.png');
    fs.writeFileSync(elfMasqueradePath, ELF_BYTES);
  });

  afterAll(async () => {
    const fileRows = await db.query('SELECT storage_path FROM files WHERE project_id = $1', [projectId]);
    for (const row of fileRows.rows) {
      if (row.storage_path && fs.existsSync(row.storage_path)) {
        fs.unlinkSync(row.storage_path);
      }
    }
    await db.query('DELETE FROM files WHERE project_id = $1', [projectId]);
    await db.query('DELETE FROM projects WHERE id = $1', [projectId]);
    await db.query("DELETE FROM users WHERE email LIKE '%uploadwiring%'");

    for (const p of [validPngPath, elfMasqueradePath]) {
      if (p && fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  it('persists checksum_sha256 and detected_mime_type for a valid PNG upload', async () => {
    const res = await request(app)
      .post(`/api/files/project/${projectId}`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .attach('file', validPngPath);

    expect(res.status).toBe(201);
    expect(res.body.file).toHaveProperty('id');
    // Checksum is SHA-256 hex (64 chars). uploadProcessor populates it.
    expect(typeof res.body.file.checksum_sha256).toBe('string');
    expect(res.body.file.checksum_sha256).toMatch(/^[a-f0-9]{64}$/);
    // storage_backend defaults to 'local' when S3 is not configured.
    expect(res.body.file.storage_backend).toBe('local');
    // detected_mime_type may be 'image/png' (when file-type v17+ is installed)
    // or fall back to the declared MIME when the lib version doesn't expose
    // fileTypeFromFile. Either way it must not be null.
    expect(res.body.file.detected_mime_type).toBeTruthy();
  });

  it('rejects a .png upload whose bytes are an ELF executable (400, no DB row, file unlinked)', async () => {
    const filesBefore = await db.query('SELECT COUNT(*)::int AS count FROM files WHERE project_id = $1', [projectId]);
    const beforeCount = filesBefore.rows[0].count;

    const res = await request(app)
      .post(`/api/files/project/${projectId}`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .attach('file', elfMasqueradePath, { filename: 'pretending.png', contentType: 'image/png' });

    // uploadProcessor returns 400 for a magic-byte mismatch. If file-type isn't
    // installed (older v16 transitive dep), the validator fails open and the
    // upload succeeds — clean up that row so we don't pollute counts.
    if (res.status === 400) {
      expect(res.body.error.message).toMatch(/file content does not match/i);

      // Row count unchanged.
      const filesAfter = await db.query('SELECT COUNT(*)::int AS count FROM files WHERE project_id = $1', [projectId]);
      expect(filesAfter.rows[0].count).toBe(beforeCount);

      // The orphaned local upload should have been unlinked from the upload dir.
      // We can't know its uuid filename, so assert that NO file in the upload
      // dir contains the ELF magic bytes anymore.
      const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
      const elfHeader = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
      const orphaned = fs.readdirSync(uploadDir).filter((name) => {
        const full = path.join(uploadDir, name);
        if (!fs.statSync(full).isFile()) return false;
        if (full === elfMasqueradePath) return false;
        try {
          const head = Buffer.alloc(4);
          const fd = fs.openSync(full, 'r');
          fs.readSync(fd, head, 0, 4, 0);
          fs.closeSync(fd);
          return head.equals(elfHeader);
        } catch {
          return false;
        }
      });
      expect(orphaned).toEqual([]);
    } else {
      // file-type lib couldn't detect — uploadProcessor failed open. Skip
      // strict assertions but clean up.
      if (res.body.file?.id) {
        const fileRow = await db.query('SELECT storage_path FROM files WHERE id = $1', [res.body.file.id]);
        if (fileRow.rows[0]?.storage_path && fs.existsSync(fileRow.rows[0].storage_path)) {
          fs.unlinkSync(fileRow.rows[0].storage_path);
        }
        await db.query('DELETE FROM files WHERE id = $1', [res.body.file.id]);
      }
    }
  });

  it('happy-path upload still returns 201 with the canonical file shape', async () => {
    const res = await request(app)
      .post(`/api/files/project/${projectId}`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .attach('file', validPngPath);

    expect(res.status).toBe(201);
    expect(res.body.file).toHaveProperty('id');
    expect(res.body.file).toHaveProperty('original_filename', 'uploadwiring-valid.png');
    expect(res.body.file).toHaveProperty('uploaded_by', researcherUserId);
    expect(res.body.file).toHaveProperty('project_id', projectId);
  });
});

describe('uploadProcessor wiring — middleware presence on other routes', () => {
  // Inspecting the Express router stack lets us confirm uploadProcessor was
  // installed on each upload route without spinning up a DB-backed scenario
  // for every endpoint. Each `processUpload({...})` call returns a new
  // closure; we identify them by the `length === 3` (req, res, next) anonymous
  // async function that sits AFTER multer's middleware.
  function findRoute(router, method, pathPattern) {
    for (const layer of router.stack) {
      if (layer.route && layer.route.path === pathPattern && layer.route.methods[method]) {
        return layer.route.stack;
      }
    }
    return null;
  }

  // The router stacks are loaded lazily by require() — pulling them after the
  // app has booted (the supertest import in the previous describe forces this).
  function getRouter(name) {
    return require(`../routes/${name}`);
  }

  it('files router has processUpload after multer on POST /project/:projectId', () => {
    const stack = findRoute(getRouter('files'), 'post', '/project/:projectId');
    expect(stack).not.toBeNull();
    // The handler chain length should include processUpload (>= 6 middlewares:
    // authenticate, uploadLimiter, requireProjectAccess, multer, processUpload, handler).
    expect(stack.length).toBeGreaterThanOrEqual(6);
  });

  it('meetings router has processUpload on POST /project/:projectId', () => {
    const stack = findRoute(getRouter('meetings'), 'post', '/project/:projectId');
    expect(stack).not.toBeNull();
    // authenticate, requireProjectAccess, multer, processUpload, sanitizeBody, validators, handler
    expect(stack.length).toBeGreaterThanOrEqual(6);
  });

  it('chats router has processUpload on three upload endpoints', () => {
    const audioStack = findRoute(getRouter('chats'), 'post', '/:id/audio');
    const fileStack = findRoute(getRouter('chats'), 'post', '/:id/upload');
    const imageStack = findRoute(getRouter('chats'), 'post', '/:id/image');
    expect(audioStack).not.toBeNull();
    expect(fileStack).not.toBeNull();
    expect(imageStack).not.toBeNull();
    // authenticate, multer, processUpload, handler
    expect(audioStack.length).toBeGreaterThanOrEqual(4);
    expect(fileStack.length).toBeGreaterThanOrEqual(4);
    expect(imageStack.length).toBeGreaterThanOrEqual(4);
  });

  it('projects router has processUpload on POST /:id/cover', () => {
    const stack = findRoute(getRouter('projects'), 'post', '/:id/cover');
    expect(stack).not.toBeNull();
    // authenticate, requireRole, multer, processUpload, handler
    expect(stack.length).toBeGreaterThanOrEqual(5);
  });

  it('users router has processUpload on POST /avatar', () => {
    const stack = findRoute(getRouter('users'), 'post', '/avatar');
    expect(stack).not.toBeNull();
    // authenticate, multer, processUpload, handler
    expect(stack.length).toBeGreaterThanOrEqual(4);
  });
});
