const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

/**
 * Authorization tests for GET /api/assistant/files/:fileId/status.
 *
 * Regression: previously the route only required `authenticate`. Any logged-in
 * user could read indexing metadata (status, error, timestamps, chunk count)
 * for any file UUID by guessing/scraping ids — leaking file existence and
 * indexing state across project boundaries.
 *
 * The route now calls `userHasProjectAccess` against the file's project_id,
 * mirroring the fix shipped in PR #78 for assistant conversation creation.
 */
describe('Assistant API — project access on file status endpoint', () => {
  let ownerToken;
  let ownerId;
  let memberToken;
  let memberId;
  let outsiderToken;
  let outsiderId;
  let adminToken;
  let projectId;
  let fileId;

  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%assistantfilestatus%'");

    const owner = await createTestUser({
      name: 'AssistantFileStatus Owner',
      email: 'assistantfilestatus-owner@example.com',
      role: 'researcher'
    });
    ownerToken = owner.token;
    ownerId = owner.id;

    const member = await createTestUser({
      name: 'AssistantFileStatus Member',
      email: 'assistantfilestatus-member@example.com',
      role: 'researcher'
    });
    memberToken = member.token;
    memberId = member.id;

    const outsider = await createTestUser({
      name: 'AssistantFileStatus Outsider',
      email: 'assistantfilestatus-outsider@example.com',
      role: 'researcher'
    });
    outsiderToken = outsider.token;
    outsiderId = outsider.id;

    const admin = await createTestUser({
      name: 'AssistantFileStatus Admin',
      email: 'assistantfilestatus-admin@example.com',
      role: 'admin'
    });
    adminToken = admin.token;

    const projectRes = await db.query(
      'INSERT INTO projects (title, description, created_by) VALUES ($1, $2, $3) RETURNING id',
      ['AssistantFileStatus Test Project', 'For testing file-status access', ownerId]
    );
    projectId = projectRes.rows[0].id;

    // Add the member user (not the outsider) to the project
    await db.query(
      "INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
      [projectId, memberId]
    );

    // Insert a file row directly (bypass upload) — indexing fields default
    // via migration 027 (indexing_status='pending', chunk_count=0).
    const fileRes = await db.query(
      `INSERT INTO files (project_id, filename, original_filename, storage_path, file_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [projectId, 'status.txt', 'status.txt', '/tmp/assistantfilestatus-not-real.txt', 'text/plain', 42, ownerId]
    );
    fileId = fileRes.rows[0].id;
  });

  afterAll(async () => {
    await db.query('DELETE FROM files WHERE project_id = $1', [projectId]);
    await db.query('DELETE FROM project_members WHERE project_id = $1', [projectId]);
    await db.query('DELETE FROM projects WHERE id = $1', [projectId]);
    await db.query("DELETE FROM users WHERE email LIKE '%assistantfilestatus%'");
  });

  describe('GET /api/assistant/files/:fileId/status', () => {
    it('allows the project creator to read file status (200)', async () => {
      const res = await request(app)
        .get(`/api/assistant/files/${fileId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.file).toHaveProperty('id', fileId);
      expect(res.body.file).toHaveProperty('indexing_status');
      expect(res.body.file).toHaveProperty('chunk_count');
      // Existing payload shape — project_id should not leak through.
      expect(res.body.file).not.toHaveProperty('project_id');
    });

    it('allows a project member to read file status (200)', async () => {
      const res = await request(app)
        .get(`/api/assistant/files/${fileId}/status`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.file).toHaveProperty('id', fileId);
      expect(res.body.file).toHaveProperty('indexing_status');
    });

    it('rejects a non-member with 403 and does not leak the payload', async () => {
      const res = await request(app)
        .get(`/api/assistant/files/${fileId}/status`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
      expect(res.body).not.toHaveProperty('file');
      expect(res.body).toHaveProperty('error');
      // Sanity check: outsiderId is referenced (suppresses unused-var lint)
      // and could be expanded later for audit-log assertions.
      expect(typeof outsiderId).toBe('string');
    });

    it('allows an admin to read file status even without explicit membership (200)', async () => {
      const res = await request(app)
        .get(`/api/assistant/files/${fileId}/status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.file).toHaveProperty('id', fileId);
    });

    it('returns 404 when the file does not exist', async () => {
      const res = await request(app)
        .get('/api/assistant/files/00000000-0000-0000-0000-000000000000/status')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found/i);
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .get(`/api/assistant/files/${fileId}/status`);

      expect(res.status).toBe(401);
    });
  });
});
