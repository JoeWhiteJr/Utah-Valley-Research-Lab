const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('Files API', () => {
  let adminToken;
  let adminUserId;
  let researcherToken;
  let researcherUserId;
  let testProjectId;
  let uploadedFileId;
  let testFilePath;

  beforeAll(async () => {
    // Clean up leftover test data
    await db.query("DELETE FROM users WHERE email LIKE '%filetest%'");

    // Create admin user
    const admin = await createTestUser({
      name: 'File Test Admin',
      email: 'filetest-admin@example.com',
      role: 'admin'
    });
    adminToken = admin.token;
    adminUserId = admin.id;

    // Create researcher (project owner)
    const researcher = await createTestUser({
      name: 'File Test Researcher',
      email: 'filetest-researcher@example.com',
      role: 'project_lead'
    });
    researcherToken = researcher.token;
    researcherUserId = researcher.id;

    // Ensure soft-delete columns exist
    await db.query(`ALTER TABLE files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
    await db.query(`ALTER TABLE files ADD COLUMN IF NOT EXISTS deleted_by UUID`);
    await db.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
    await db.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_by UUID`);

    // Create a test project owned by the researcher
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({
        title: 'File Test Project',
        description: 'A project for file upload tests'
      });
    testProjectId = projectRes.body.project.id;

    // Create a temp test file for uploads
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    testFilePath = path.join(uploadDir, 'test-upload.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for upload testing.');
  });

  afterAll(async () => {
    // Clean up uploaded files from DB
    if (uploadedFileId) {
      const fileRecord = await db.query('SELECT storage_path FROM files WHERE id = $1', [uploadedFileId]);
      if (fileRecord.rows.length > 0 && fs.existsSync(fileRecord.rows[0].storage_path)) {
        fs.unlinkSync(fileRecord.rows[0].storage_path);
      }
    }
    await db.query("DELETE FROM files WHERE project_id = $1", [testProjectId]);
    await db.query("DELETE FROM projects WHERE id = $1", [testProjectId]);
    await db.query("DELETE FROM users WHERE email LIKE '%filetest%'");

    // Clean up temp test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  // ==========================================
  // POST /api/files/project/:projectId - Upload
  // ==========================================
  describe('POST /api/files/project/:projectId', () => {
    it('should upload a file to a project', async () => {
      const res = await request(app)
        .post(`/api/files/project/${testProjectId}`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .attach('file', testFilePath);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('file');
      expect(res.body.file).toHaveProperty('id');
      expect(res.body.file.project_id).toBe(testProjectId);
      expect(res.body.file.original_filename).toBe('test-upload.txt');
      expect(res.body.file.file_type).toBe('text/plain');
      expect(res.body.file.uploaded_by).toBe(researcherUserId);

      uploadedFileId = res.body.file.id;
    });

    it('should allow admin to upload file to any project', async () => {
      const res = await request(app)
        .post(`/api/files/project/${testProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', testFilePath);

      expect(res.status).toBe(201);
      expect(res.body.file.uploaded_by).toBe(adminUserId);

      // Clean up this extra file
      const fileId = res.body.file.id;
      const fileRecord = await db.query('SELECT storage_path FROM files WHERE id = $1', [fileId]);
      if (fileRecord.rows.length > 0 && fs.existsSync(fileRecord.rows[0].storage_path)) {
        fs.unlinkSync(fileRecord.rows[0].storage_path);
      }
      await db.query('DELETE FROM files WHERE id = $1', [fileId]);
    });

    it('should reject upload without a file', async () => {
      const res = await request(app)
        .post(`/api/files/project/${testProjectId}`)
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('No file uploaded');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post(`/api/files/project/${testProjectId}`)
        .attach('file', testFilePath);

      expect(res.status).toBe(401);
    });

    it('should return 403 for user without project access', async () => {
      // Create a user with no project access
      const outsider = await createTestUser({
        name: 'File Test Outsider',
        email: 'filetest-outsider@example.com',
        role: 'viewer'
      });

      const res = await request(app)
        .post(`/api/files/project/${testProjectId}`)
        .set('Authorization', `Bearer ${outsider.token}`)
        .attach('file', testFilePath);

      expect(res.status).toBe(403);

      // Clean up outsider
      await db.query("DELETE FROM users WHERE id = $1", [outsider.id]);
    });
  });

  // ==========================================
  // GET /api/files/project/:projectId - List files
  // ==========================================
  describe('GET /api/files/project/:projectId', () => {
    it('should list files for a project', async () => {
      const res = await request(app)
        .get(`/api/files/project/${testProjectId}`)
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('files');
      expect(Array.isArray(res.body.files)).toBe(true);
      expect(res.body.files.length).toBeGreaterThan(0);

      const file = res.body.files[0];
      expect(file).toHaveProperty('id');
      expect(file).toHaveProperty('filename');
      expect(file).toHaveProperty('original_filename');
      expect(file).toHaveProperty('file_type');
      expect(file).toHaveProperty('file_size');
      expect(file).toHaveProperty('uploader_name');
    });

    it('should allow admin to list files for any project', async () => {
      const res = await request(app)
        .get(`/api/files/project/${testProjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.files.length).toBeGreaterThan(0);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .get(`/api/files/project/${testProjectId}`);

      expect(res.status).toBe(401);
    });

    it('should return 403 for user without project access', async () => {
      const outsider = await createTestUser({
        name: 'File List Outsider',
        email: 'filetest-listoutsider@example.com',
        role: 'viewer'
      });

      const res = await request(app)
        .get(`/api/files/project/${testProjectId}`)
        .set('Authorization', `Bearer ${outsider.token}`);

      expect(res.status).toBe(403);

      await db.query("DELETE FROM users WHERE id = $1", [outsider.id]);
    });
  });

  // ==========================================
  // DELETE /api/files/:id - Delete file
  // ==========================================
  describe('DELETE /api/files/:id', () => {
    let fileToDeleteId;

    beforeAll(async () => {
      // Upload a file specifically for deletion
      const res = await request(app)
        .post(`/api/files/project/${testProjectId}`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .attach('file', testFilePath);
      fileToDeleteId = res.body.file.id;
    });

    it('should delete a file with project access', async () => {
      const res = await request(app)
        .delete(`/api/files/${fileToDeleteId}`)
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('File deleted successfully');

      // Verify file is soft-deleted (row exists but deleted_at is set)
      const check = await db.query('SELECT id, deleted_at FROM files WHERE id = $1', [fileToDeleteId]);
      expect(check.rows.length).toBe(1);
      expect(check.rows[0].deleted_at).not.toBeNull();
    });

    it('should return 404 for non-existent file', async () => {
      const res = await request(app)
        .delete('/api/files/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('File not found');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .delete(`/api/files/${uploadedFileId}`);

      expect(res.status).toBe(401);
    });

    it('should allow admin to delete any file', async () => {
      // Upload a file as researcher, delete as admin
      const uploadRes = await request(app)
        .post(`/api/files/project/${testProjectId}`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .attach('file', testFilePath);
      const adminDeleteFileId = uploadRes.body.file.id;

      const res = await request(app)
        .delete(`/api/files/${adminDeleteFileId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('File deleted successfully');
    });
  });
});
