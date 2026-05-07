const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

/**
 * Authorization tests for PUT /api/files/:id/move.
 *
 * Regression: previously the route only verified that the file and target
 * folder rows existed. Any authenticated user could move any file (including
 * ones they could not read) into any folder in any project — corrupting other
 * projects' file organization and leaking file existence by enumeration.
 *
 * The route now performs a dual project-access check (file project AND folder
 * project) via userHasProjectAccess, and rejects cross-project moves with 400.
 */
describe('Files move authorization (PUT /api/files/:id/move)', () => {
  let adminUser;
  let ownerUser;       // owns projectA — file lives here
  let outsiderUser;    // no access to projectA or projectB
  let dualAccessUser;  // member of projectA only (NOT projectB)

  let projectA;
  let projectB;
  let folderA;         // folder in projectA
  let folderB;         // folder in projectB
  let fileInA;         // file in projectA, initially folder_id = null
  let testFilePath;

  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%filemoveauthz%'");

    adminUser = await createTestUser({
      name: 'FileMoveAuthz Admin',
      email: 'filemoveauthz-admin@example.com',
      role: 'admin'
    });
    ownerUser = await createTestUser({
      name: 'FileMoveAuthz Owner',
      email: 'filemoveauthz-owner@example.com',
      role: 'project_lead'
    });
    outsiderUser = await createTestUser({
      name: 'FileMoveAuthz Outsider',
      email: 'filemoveauthz-outsider@example.com',
      role: 'researcher'
    });
    dualAccessUser = await createTestUser({
      name: 'FileMoveAuthz DualAccess',
      email: 'filemoveauthz-dual@example.com',
      role: 'researcher'
    });

    // Two distinct projects, both owned by ownerUser
    const projectARes = await db.query(
      'INSERT INTO projects (title, description, created_by) VALUES ($1, $2, $3) RETURNING id',
      ['FileMoveAuthz Project A', 'Project A', ownerUser.id]
    );
    projectA = projectARes.rows[0].id;

    const projectBRes = await db.query(
      'INSERT INTO projects (title, description, created_by) VALUES ($1, $2, $3) RETURNING id',
      ['FileMoveAuthz Project B', 'Project B', ownerUser.id]
    );
    projectB = projectBRes.rows[0].id;

    // dualAccessUser is a member of projectA only (so they can read files in
    // projectA but NOT folders in projectB — exercises the dual-check path).
    await db.query(
      "INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
      [projectA, dualAccessUser.id]
    );

    // One folder per project.
    const folderARes = await db.query(
      'INSERT INTO folders (project_id, name, created_by) VALUES ($1, $2, $3) RETURNING id',
      [projectA, 'Folder A', ownerUser.id]
    );
    folderA = folderARes.rows[0].id;

    const folderBRes = await db.query(
      'INSERT INTO folders (project_id, name, created_by) VALUES ($1, $2, $3) RETURNING id',
      [projectB, 'Folder B', ownerUser.id]
    );
    folderB = folderBRes.rows[0].id;

    // Prepare a temp file used for upload.
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    testFilePath = path.join(uploadDir, 'filemoveauthz-upload.txt');
    fs.writeFileSync(testFilePath, 'move-authz test content');

    // Upload one file into projectA (folder_id = null initially).
    const uploadRes = await request(app)
      .post(`/api/files/project/${projectA}`)
      .set('Authorization', `Bearer ${ownerUser.token}`)
      .attach('file', testFilePath);
    fileInA = uploadRes.body.file.id;
  });

  afterAll(async () => {
    // Clean up file rows + storage
    const fileRows = await db.query(
      'SELECT storage_path FROM files WHERE project_id IN ($1, $2)',
      [projectA, projectB]
    );
    for (const row of fileRows.rows) {
      if (row.storage_path && fs.existsSync(row.storage_path)) {
        fs.unlinkSync(row.storage_path);
      }
    }

    await db.query('DELETE FROM files WHERE project_id IN ($1, $2)', [projectA, projectB]);
    await db.query('DELETE FROM folders WHERE project_id IN ($1, $2)', [projectA, projectB]);
    await db.query('DELETE FROM project_members WHERE project_id IN ($1, $2)', [projectA, projectB]);
    await db.query('DELETE FROM projects WHERE id IN ($1, $2)', [projectA, projectB]);
    await db.query("DELETE FROM users WHERE email LIKE '%filemoveauthz%'");

    if (testFilePath && fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  // Helper to reset the test file's folder_id between tests so each case
  // exercises a clean starting state and we can detect mutations on failure.
  async function resetFileFolder() {
    await db.query('UPDATE files SET folder_id = NULL WHERE id = $1', [fileInA]);
  }

  describe('happy path', () => {
    beforeEach(resetFileFolder);

    it('allows admin to move a file within a project (200)', async () => {
      const res = await request(app)
        .put(`/api/files/${fileInA}/move`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ folder_id: folderA });

      expect(res.status).toBe(200);
      expect(res.body.file.folder_id).toBe(folderA);
    });

    it('allows a project member to move a file within their own project (200)', async () => {
      const res = await request(app)
        .put(`/api/files/${fileInA}/move`)
        .set('Authorization', `Bearer ${dualAccessUser.token}`)
        .send({ folder_id: folderA });

      expect(res.status).toBe(200);
      expect(res.body.file.folder_id).toBe(folderA);
    });

    it('allows clearing folder_id to null when caller has access', async () => {
      // Pre-position the file inside folderA so we can verify it gets cleared.
      await db.query('UPDATE files SET folder_id = $1 WHERE id = $2', [folderA, fileInA]);

      const res = await request(app)
        .put(`/api/files/${fileInA}/move`)
        .set('Authorization', `Bearer ${ownerUser.token}`)
        .send({ folder_id: null });

      expect(res.status).toBe(200);
      expect(res.body.file.folder_id).toBeNull();
    });
  });

  describe('authorization failures', () => {
    beforeEach(resetFileFolder);

    it("rejects a non-member of the file's project with 403 and does not move the file", async () => {
      const res = await request(app)
        .put(`/api/files/${fileInA}/move`)
        .set('Authorization', `Bearer ${outsiderUser.token}`)
        .send({ folder_id: folderA });

      expect(res.status).toBe(403);

      // Confirm folder_id was NOT mutated.
      const check = await db.query('SELECT folder_id FROM files WHERE id = $1', [fileInA]);
      expect(check.rows[0].folder_id).toBeNull();
    });

    it("rejects a user with file-project access but not folder-project access (403, dual check)", async () => {
      // dualAccessUser is a member of projectA (file's project) but NOT of
      // projectB (folder's project). The cross-project-move guard would also
      // catch this with a 400, so we sanity-check that authorization runs
      // first by sending the request and verifying 403.
      //
      // (Implementation order is: file-access check → folder-access check →
      // cross-project check. This user fails the folder-access check.)
      const res = await request(app)
        .put(`/api/files/${fileInA}/move`)
        .set('Authorization', `Bearer ${dualAccessUser.token}`)
        .send({ folder_id: folderB });

      expect(res.status).toBe(403);

      const check = await db.query('SELECT folder_id FROM files WHERE id = $1', [fileInA]);
      expect(check.rows[0].folder_id).toBeNull();
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .put(`/api/files/${fileInA}/move`)
        .send({ folder_id: folderA });

      expect(res.status).toBe(401);
    });
  });

  describe('cross-project move rejection', () => {
    beforeEach(resetFileFolder);

    it('returns 400 when admin tries to move a file into a folder in a different project', async () => {
      // Admin has access to BOTH projects, so the dual access check passes.
      // The cross-project-move guard should still reject this with 400.
      const res = await request(app)
        .put(`/api/files/${fileInA}/move`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ folder_id: folderB });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/cannot move files between projects/i);

      const check = await db.query('SELECT folder_id FROM files WHERE id = $1', [fileInA]);
      expect(check.rows[0].folder_id).toBeNull();
    });
  });

  describe('not-found responses', () => {
    beforeEach(resetFileFolder);

    it('returns 404 when the file does not exist', async () => {
      const res = await request(app)
        .put('/api/files/00000000-0000-0000-0000-000000000000/move')
        .set('Authorization', `Bearer ${ownerUser.token}`)
        .send({ folder_id: folderA });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('File not found');
    });

    it('returns 404 when the target folder does not exist', async () => {
      const res = await request(app)
        .put(`/api/files/${fileInA}/move`)
        .set('Authorization', `Bearer ${ownerUser.token}`)
        .send({ folder_id: '00000000-0000-0000-0000-000000000000' });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Folder not found');
    });
  });
});
