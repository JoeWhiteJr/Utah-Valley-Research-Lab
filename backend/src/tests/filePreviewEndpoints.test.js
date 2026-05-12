const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

/**
 * Tests for the inline-view and HTML-preview endpoints added in PR-C of the
 * file-integrity series:
 *
 *   GET /api/files/:id/view-url  - returns a presigned (S3) or local URL for
 *                                  inline rendering of media files.
 *   GET /api/files/:id/preview   - returns server-rendered HTML for documents
 *                                  and text files.
 *
 * Both endpoints share the access check pattern from /download: 404 if the
 * file row is missing, 403 if the caller can't reach the project, otherwise
 * the resource. We exercise the three branches that matter for security:
 * member success, outsider 403, missing 404.
 *
 * Local-only env: these run against the test Postgres in CI. The local
 * machine doesn't have Postgres up, so most assertions will only execute in
 * the CI job that hosts the DB.
 */
describe('File preview endpoints (view-url + preview)', () => {
  let memberToken;
  let memberUserId;
  let outsiderToken;
  let projectId;
  let txtFileId;
  let imageFileId;
  let testTxtPath;
  let testPngPath;

  // Minimal valid 1x1 PNG so multer's image filter accepts it.
  const VALID_PNG_BYTES = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82
  ]);

  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%filepreviewendpoints%'");

    const member = await createTestUser({
      name: 'FilePreviewEndpoints Member',
      email: 'filepreviewendpoints-member@example.com',
      role: 'project_lead'
    });
    memberToken = member.token;
    memberUserId = member.id;

    const outsider = await createTestUser({
      name: 'FilePreviewEndpoints Outsider',
      email: 'filepreviewendpoints-outsider@example.com',
      role: 'researcher'
    });
    outsiderToken = outsider.token;

    // Ensure soft-delete + integrity columns exist (some envs may lag migrations).
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
      ['File Preview Endpoints Project', 'view-url + preview tests', memberUserId]
    );
    projectId = projectRes.rows[0].id;

    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    // TXT for preview tests
    testTxtPath = path.join(uploadDir, 'filepreviewendpoints-sample.txt');
    fs.writeFileSync(testTxtPath, 'Hello from preview test\nLine two with <special> & chars');

    const txtUpload = await request(app)
      .post(`/api/files/project/${projectId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .attach('file', testTxtPath);
    txtFileId = txtUpload.body.file?.id;

    // PNG for view-url tests
    testPngPath = path.join(uploadDir, 'filepreviewendpoints-sample.png');
    fs.writeFileSync(testPngPath, VALID_PNG_BYTES);

    const pngUpload = await request(app)
      .post(`/api/files/project/${projectId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .attach('file', testPngPath);
    imageFileId = pngUpload.body.file?.id;
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
    await db.query("DELETE FROM users WHERE email LIKE '%filepreviewendpoints%'");

    for (const p of [testTxtPath, testPngPath]) {
      if (p && fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  describe('GET /api/files/:id/view-url', () => {
    it('returns a url for a project member (200)', async () => {
      const res = await request(app)
        .get(`/api/files/${imageFileId}/view-url`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('url');
      expect(typeof res.body.url).toBe('string');
      expect(res.body.url.length).toBeGreaterThan(0);
    });

    it('rejects an outsider with 403', async () => {
      const res = await request(app)
        .get(`/api/files/${imageFileId}/view-url`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 404 for a missing file id', async () => {
      // Random UUID that won't match any row.
      const missingId = '00000000-0000-0000-0000-000000000099';
      const res = await request(app)
        .get(`/api/files/${missingId}/view-url`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/files/:id/preview', () => {
    it('returns rendered HTML containing the TXT file content for a project member (200)', async () => {
      const res = await request(app)
        .get(`/api/files/${txtFileId}/preview`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('Hello from preview test');
      // The literal content has <special> which must be escaped, not raw.
      expect(res.text).toContain('&lt;special&gt;');
      expect(res.text).not.toContain('<special>');
    });

    it('rejects an outsider with 403', async () => {
      const res = await request(app)
        .get(`/api/files/${txtFileId}/preview`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });
  });
});
