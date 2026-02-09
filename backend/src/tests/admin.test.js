const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('Admin API', () => {
  let adminToken;
  let adminUserId;
  let researcherToken;
  let viewerToken;
  let testProjectId;
  let publishedProjectId;

  beforeAll(async () => {
    // Clean up leftover test data
    await db.query("DELETE FROM users WHERE email LIKE '%admintest%'");

    // Create admin user
    const admin = await createTestUser({
      name: 'Admin Test Admin',
      email: 'admintest-admin@example.com',
      role: 'admin'
    });
    adminToken = admin.token;
    adminUserId = admin.id;

    // Create researcher user (non-admin)
    const researcher = await createTestUser({
      name: 'Admin Test Researcher',
      email: 'admintest-researcher@example.com',
      role: 'researcher'
    });
    researcherToken = researcher.token;

    // Create viewer user (non-admin)
    const viewer = await createTestUser({
      name: 'Admin Test Viewer',
      email: 'admintest-viewer@example.com',
      role: 'viewer'
    });
    viewerToken = viewer.token;

    // Create a test project for publish tests
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Admin Test Project',
        description: 'A project for admin publish tests'
      });
    testProjectId = projectRes.body.project.id;
  });

  afterAll(async () => {
    // Clean up published projects
    if (publishedProjectId) {
      await db.query("DELETE FROM published_projects WHERE id = $1", [publishedProjectId]);
    }
    await db.query("DELETE FROM published_projects WHERE project_id = $1", [testProjectId]);
    await db.query("DELETE FROM projects WHERE id = $1", [testProjectId]);
    await db.query("DELETE FROM users WHERE email LIKE '%admintest%'");
  });

  // ==========================================
  // GET /api/admin/stats
  // ==========================================
  describe('GET /api/admin/stats', () => {
    it('should return dashboard stats for admin', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('stats');
      expect(res.body.stats).toHaveProperty('users');
      expect(res.body.stats).toHaveProperty('applications');
      expect(res.body.stats).toHaveProperty('projects');
      expect(res.body.stats).toHaveProperty('chats');

      // Verify user stats shape
      expect(res.body.stats.users).toHaveProperty('total_users');
      expect(res.body.stats.users).toHaveProperty('admin_count');
      expect(res.body.stats.users).toHaveProperty('project_lead_count');
      expect(res.body.stats.users).toHaveProperty('researcher_count');
      expect(res.body.stats.users).toHaveProperty('viewer_count');
      expect(res.body.stats.users).toHaveProperty('new_this_week');
      expect(res.body.stats.users).toHaveProperty('new_this_month');

      // Verify application stats shape
      expect(res.body.stats.applications).toHaveProperty('total_applications');
      expect(res.body.stats.applications).toHaveProperty('pending');
      expect(res.body.stats.applications).toHaveProperty('approved');
      expect(res.body.stats.applications).toHaveProperty('rejected');

      // Verify project stats shape
      expect(res.body.stats.projects).toHaveProperty('total_projects');
      expect(res.body.stats.projects).toHaveProperty('active');

      // Verify recent applications
      expect(res.body).toHaveProperty('recentApplications');
      expect(Array.isArray(res.body.recentApplications)).toBe(true);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .get('/api/admin/stats');

      expect(res.status).toBe(401);
    });

    it('should return 403 for researcher', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 403 for viewer', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // GET /api/admin/published-projects
  // ==========================================
  describe('GET /api/admin/published-projects', () => {
    it('should return list of published projects for admin', async () => {
      const res = await request(app)
        .get('/api/admin/published-projects')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('publishedProjects');
      expect(Array.isArray(res.body.publishedProjects)).toBe(true);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .get('/api/admin/published-projects');

      expect(res.status).toBe(401);
    });

    it('should return 403 for non-admin', async () => {
      const res = await request(app)
        .get('/api/admin/published-projects')
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // POST /api/admin/publish-project
  // ==========================================
  describe('POST /api/admin/publish-project', () => {
    it('should publish a project', async () => {
      const res = await request(app)
        .post('/api/admin/publish-project')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project_id: testProjectId,
          title: 'Published Admin Test Project',
          description: 'A publicly visible project',
          status: 'ongoing'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('publishedProject');
      expect(res.body.publishedProject.project_id).toBe(testProjectId);
      expect(res.body.publishedProject.published_title).toBe('Published Admin Test Project');
      expect(res.body.publishedProject.published_description).toBe('A publicly visible project');
      expect(res.body.publishedProject.published_by).toBe(adminUserId);

      publishedProjectId = res.body.publishedProject.id;
    });

    it('should reject publishing an already published project', async () => {
      const res = await request(app)
        .post('/api/admin/publish-project')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project_id: testProjectId,
          title: 'Duplicate publish',
          description: 'Should fail'
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe('Project is already published');
    });

    it('should return 404 for non-existent project', async () => {
      const res = await request(app)
        .post('/api/admin/publish-project')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          project_id: '00000000-0000-0000-0000-000000000000',
          title: 'Ghost project',
          description: 'Does not exist'
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Project not found');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post('/api/admin/publish-project')
        .send({
          project_id: testProjectId,
          title: 'No auth',
          description: 'Should fail'
        });

      expect(res.status).toBe(401);
    });

    it('should return 403 for non-admin', async () => {
      const res = await request(app)
        .post('/api/admin/publish-project')
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({
          project_id: testProjectId,
          title: 'Not admin',
          description: 'Should fail'
        });

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // GET /api/admin/audit-log
  // ==========================================
  describe('GET /api/admin/audit-log', () => {
    it('should return audit log for admin', async () => {
      const res = await request(app)
        .get('/api/admin/audit-log')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('auditLog');
      expect(Array.isArray(res.body.auditLog)).toBe(true);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('offset');
    });

    it('should return 403 for non-admin', async () => {
      const res = await request(app)
        .get('/api/admin/audit-log')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // GET /api/admin/users/search
  // ==========================================
  describe('GET /api/admin/users/search', () => {
    it('should search users for admin', async () => {
      const res = await request(app)
        .get('/api/admin/users/search?q=admintest')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users.length).toBeGreaterThan(0);
    });

    it('should filter users by role', async () => {
      const res = await request(app)
        .get('/api/admin/users/search?role=admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.users.forEach(user => {
        expect(user.role).toBe('admin');
      });
    });

    it('should return 403 for non-admin', async () => {
      const res = await request(app)
        .get('/api/admin/users/search?q=test')
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(403);
    });
  });
});
