const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('AI API', () => {
  let authToken;
  let testUserId;
  let testProjectId;

  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%aitest%'");

    const user = await createTestUser({
      name: 'AI Test User',
      email: 'aitest@example.com',
      role: 'admin'
    });

    authToken = user.token;
    testUserId = user.id;

    // Create a test project
    const projectRes = await db.query(
      'INSERT INTO projects (title, description, created_by) VALUES ($1, $2, $3) RETURNING id',
      ['AI Test Project', 'Project for AI testing', testUserId]
    );
    testProjectId = projectRes.rows[0].id;

    // Add some action items
    await db.query(
      'INSERT INTO action_items (title, project_id, completed) VALUES ($1, $2, $3)',
      ['Completed task', testProjectId, true]
    );
    await db.query(
      'INSERT INTO action_items (title, project_id, completed) VALUES ($1, $2, $3)',
      ['Pending task', testProjectId, false]
    );
  });

  afterAll(async () => {
    await db.query('DELETE FROM action_items WHERE project_id = $1', [testProjectId]);
    await db.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
    await db.query("DELETE FROM users WHERE email LIKE '%aitest%'");
  });

  describe('GET /api/ai/status', () => {
    it('should return AI availability status', async () => {
      const res = await request(app)
        .get('/api/ai/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('available');
      expect(res.body).toHaveProperty('message');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .get('/api/ai/status');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/ai/summarize-project', () => {
    it('should reject missing projectId', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-project')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should reject invalid projectId', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-project')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: 'not-a-uuid' });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent project', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-project')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: '00000000-0000-0000-0000-000000000000' });

      // Either 404 (project not found) or 503 (AI not configured)
      expect([404, 503]).toContain(res.status);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-project')
        .send({ projectId: testProjectId });

      expect(res.status).toBe(401);
    });

    it('should handle summarize-project request', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-project')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: testProjectId });

      // 200 if AI is configured, 503 if not
      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('summary');
        expect(res.body).toHaveProperty('stats');
        expect(res.body.stats).toHaveProperty('totalActions');
        expect(res.body.stats).toHaveProperty('completedActions');
        expect(res.body.stats).toHaveProperty('pendingActions');
      }
    });
  });

  describe('POST /api/ai/summarize-dashboard', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-dashboard');

      expect(res.status).toBe(401);
    });

    it('should handle summarize-dashboard request', async () => {
      const res = await request(app)
        .post('/api/ai/summarize-dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      // 200 if AI is configured, 503 if not
      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('summary');
        expect(res.body).toHaveProperty('stats');
        expect(res.body.stats).toHaveProperty('activeProjects');
        expect(res.body.stats).toHaveProperty('pendingTasks');
        expect(res.body.stats).toHaveProperty('overdueTasks');
      }
    });
  });
});
