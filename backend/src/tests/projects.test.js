const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('Projects API', () => {
  let authToken;
  let testUserId;
  let testProjectId;

  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%projecttest%'");

    const user = await createTestUser({
      name: 'Project Test User',
      email: 'projecttest@example.com',
      role: 'project_lead'
    });

    authToken = user.token;
    testUserId = user.id;
  });

  afterAll(async () => {
    await db.query("DELETE FROM projects WHERE created_by = $1", [testUserId]);
    await db.query("DELETE FROM users WHERE email LIKE '%projecttest%'");
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Research Project',
          description: 'A test project for unit testing'
        });

      expect(res.status).toBe(201);
      expect(res.body.project).toHaveProperty('id');
      expect(res.body.project.title).toBe('Test Research Project');
      expect(res.body.project.status).toBe('active');
      expect(res.body.project.progress).toBe(0);

      testProjectId = res.body.project.id;
    });

    it('should reject project creation without title', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Missing title'
        });

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({
          title: 'Unauthorized Project'
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/projects', () => {
    it('should list all projects', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.projects)).toBe(true);
      expect(res.body.projects.length).toBeGreaterThan(0);
    });

    it('should filter projects by status', async () => {
      const res = await request(app)
        .get('/api/projects?status=active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      res.body.projects.forEach(project => {
        expect(project.status).toBe('active');
      });
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should get a single project', async () => {
      const res = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.project.id).toBe(testProjectId);
      expect(res.body.project.title).toBe('Test Research Project');
    });

    it('should return 404 for non-existent project', async () => {
      const res = await request(app)
        .get('/api/projects/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/projects/:id', () => {
    beforeAll(async () => {
      await db.query("UPDATE users SET role = 'admin' WHERE id = $1", [testUserId]);
    });

    afterAll(async () => {
      await db.query("UPDATE users SET role = 'project_lead' WHERE id = $1", [testUserId]);
    });

    it('should update a project', async () => {
      const res = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Project Title',
          progress: 50
        });

      expect(res.status).toBe(200);
      expect(res.body.project.title).toBe('Updated Project Title');
      expect(res.body.project.progress).toBe(50);
    });

    it('should update project status', async () => {
      const res = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'completed',
          progress: 100
        });

      expect(res.status).toBe(200);
      expect(res.body.project.status).toBe('completed');
    });

    it('should set project status to inactive', async () => {
      const res = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'inactive'
        });

      expect(res.status).toBe(200);
      expect(res.body.project.status).toBe('inactive');
    });

    it('should filter projects by inactive status', async () => {
      const res = await request(app)
        .get('/api/projects?status=inactive')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      res.body.projects.forEach(project => {
        expect(project.status).toBe('inactive');
      });
    });

    it('should set project status back to active from inactive', async () => {
      const res = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'active'
        });

      expect(res.status).toBe(200);
      expect(res.body.project.status).toBe('active');
    });

    it('should reject invalid status', async () => {
      const res = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'invalid_status'
        });

      expect(res.status).toBe(400);
    });

    it('should reject progress outside 0-100', async () => {
      const res = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          progress: 150
        });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should require admin role to delete', async () => {
      const res = await request(app)
        .delete(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(403);
    });

    it('should delete project when admin', async () => {
      await db.query("UPDATE users SET role = 'admin' WHERE id = $1", [testUserId]);

      const res = await request(app)
        .delete(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Project deleted successfully');
    });
  });
});
