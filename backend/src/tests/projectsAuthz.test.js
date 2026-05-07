const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

/**
 * Authorization tests for project edit endpoints.
 * Ensures project_leads can only edit projects they actually lead
 * (closes horizontal privilege escalation between project leads).
 */
describe('Projects edit authorization', () => {
  let adminUser;
  let leadOwner;       // project_lead who owns the project under test
  let leadOther;       // a different project_lead (should be denied)
  let researcher;      // a regular researcher (should be denied)

  let ownedProjectId;
  let testCoverPath;

  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%projauthz%'");

    adminUser = await createTestUser({
      name: 'ProjAuthz Admin',
      email: 'projauthz-admin@example.com',
      role: 'admin'
    });
    leadOwner = await createTestUser({
      name: 'ProjAuthz LeadOwner',
      email: 'projauthz-leadowner@example.com',
      role: 'project_lead'
    });
    leadOther = await createTestUser({
      name: 'ProjAuthz LeadOther',
      email: 'projauthz-leadother@example.com',
      role: 'project_lead'
    });
    researcher = await createTestUser({
      name: 'ProjAuthz Researcher',
      email: 'projauthz-researcher@example.com',
      role: 'researcher'
    });

    // Create a project explicitly led by leadOwner
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${leadOwner.token}`)
      .send({
        title: 'Owned Project',
        description: 'Original description',
        lead_id: leadOwner.id
      });
    ownedProjectId = projectRes.body.project.id;

    // Prepare a temp image file for cover-upload tests
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    testCoverPath = path.join(uploadDir, 'projauthz-cover.png');
    // Minimal valid 1x1 PNG
    const pngBytes = Buffer.from(
      '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA63F8FFFF3F0005FE02FEDCCCD8DA0000000049454E44AE426082',
      'hex'
    );
    fs.writeFileSync(testCoverPath, pngBytes);
  });

  afterAll(async () => {
    await db.query("DELETE FROM projects WHERE id = $1", [ownedProjectId]);
    await db.query("DELETE FROM users WHERE email LIKE '%projauthz%'");
    if (testCoverPath && fs.existsSync(testCoverPath)) {
      fs.unlinkSync(testCoverPath);
    }
  });

  describe('PUT /api/projects/:id', () => {
    it('allows admin to edit any project', async () => {
      const res = await request(app)
        .put(`/api/projects/${ownedProjectId}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ description: 'Edited by admin' });

      expect(res.status).toBe(200);
      expect(res.body.project.description).toBe('Edited by admin');
    });

    it('allows the assigned project_lead to edit their own project', async () => {
      const res = await request(app)
        .put(`/api/projects/${ownedProjectId}`)
        .set('Authorization', `Bearer ${leadOwner.token}`)
        .send({ description: 'Edited by owner' });

      expect(res.status).toBe(200);
      expect(res.body.project.description).toBe('Edited by owner');
    });

    it("denies a project_lead who is not this project's lead (403)", async () => {
      const res = await request(app)
        .put(`/api/projects/${ownedProjectId}`)
        .set('Authorization', `Bearer ${leadOther.token}`)
        .send({ description: 'Hijack attempt' });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/only edit projects you lead/i);

      // Confirm the description was NOT mutated
      const check = await db.query('SELECT description FROM projects WHERE id = $1', [ownedProjectId]);
      expect(check.rows[0].description).toBe('Edited by owner');
    });

    it('denies a regular researcher (403, role gate preserved)', async () => {
      const res = await request(app)
        .put(`/api/projects/${ownedProjectId}`)
        .set('Authorization', `Bearer ${researcher.token}`)
        .send({ description: 'Should not work' });

      expect(res.status).toBe(403);
    });

    it('returns 404 for non-existent project (before authz check)', async () => {
      const res = await request(app)
        .put('/api/projects/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${leadOwner.token}`)
        .send({ description: 'whatever' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/cover', () => {
    it('allows the assigned project_lead to upload a cover for their own project', async () => {
      const res = await request(app)
        .post(`/api/projects/${ownedProjectId}/cover`)
        .set('Authorization', `Bearer ${leadOwner.token}`)
        .attach('cover', testCoverPath);

      expect(res.status).toBe(200);
      expect(res.body.project.header_image).toMatch(/^\/uploads\/covers\//);
    });

    it("denies a project_lead who is not this project's lead (403)", async () => {
      const res = await request(app)
        .post(`/api/projects/${ownedProjectId}/cover`)
        .set('Authorization', `Bearer ${leadOther.token}`)
        .attach('cover', testCoverPath);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/only edit projects you lead/i);
    });

    it('denies a regular researcher (403, role gate preserved)', async () => {
      const res = await request(app)
        .post(`/api/projects/${ownedProjectId}/cover`)
        .set('Authorization', `Bearer ${researcher.token}`)
        .attach('cover', testCoverPath);

      expect(res.status).toBe(403);
    });
  });
});
