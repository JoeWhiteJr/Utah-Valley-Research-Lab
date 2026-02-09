const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('Search API', () => {
  let adminToken;
  let _adminUserId;
  let researcherToken;
  let _researcherUserId;
  let testProjectId;

  beforeAll(async () => {
    // Clean up leftover test data
    await db.query("DELETE FROM users WHERE email LIKE '%searchtest%'");

    // Create admin user (can see all projects)
    const admin = await createTestUser({
      name: 'Search Test Admin',
      email: 'searchtest-admin@example.com',
      role: 'admin'
    });
    adminToken = admin.token;
    _adminUserId = admin.id;

    // Create researcher user
    const researcher = await createTestUser({
      name: 'Search Test Researcher',
      email: 'searchtest-researcher@example.com',
      role: 'project_lead'
    });
    researcherToken = researcher.token;
    _researcherUserId = researcher.id;

    // Create a project with a searchable name
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({
        title: 'Searchable Quantum Computing Project',
        description: 'A project about quantum computing research'
      });
    testProjectId = projectRes.body.project.id;

    // Create an action item with a searchable name
    await request(app)
      .post(`/api/actions/project/${testProjectId}`)
      .set('Authorization', `Bearer ${researcherToken}`)
      .send({
        title: 'Quantum Algorithm Implementation Task'
      });
  });

  afterAll(async () => {
    await db.query("DELETE FROM action_items WHERE project_id = $1", [testProjectId]);
    await db.query("DELETE FROM projects WHERE id = $1", [testProjectId]);
    await db.query("DELETE FROM users WHERE email LIKE '%searchtest%'");
  });

  // ==========================================
  // GET /api/search?q=term
  // ==========================================
  describe('GET /api/search', () => {
    it('should return search results for matching query', async () => {
      const res = await request(app)
        .get('/api/search')
        .query({ q: 'Quantum' })
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);

      // Check result shape
      const result = res.body.results[0];
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('url');
    });

    it('should find projects by title', async () => {
      const res = await request(app)
        .get('/api/search')
        .query({ q: 'Searchable Quantum' })
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(200);
      const projectResults = res.body.results.filter(r => r.type === 'project');
      expect(projectResults.length).toBeGreaterThan(0);
      expect(projectResults[0].title).toContain('Quantum');
    });

    it('should find tasks by title', async () => {
      const res = await request(app)
        .get('/api/search')
        .query({ q: 'Quantum Algorithm' })
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(200);
      const taskResults = res.body.results.filter(r => r.type === 'task');
      expect(taskResults.length).toBeGreaterThan(0);
    });

    it('admin should see all projects in search results', async () => {
      const res = await request(app)
        .get('/api/search')
        .query({ q: 'Quantum' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const projectResults = res.body.results.filter(r => r.type === 'project');
      expect(projectResults.length).toBeGreaterThan(0);
    });

    it('should return empty results for no match', async () => {
      const res = await request(app)
        .get('/api/search')
        .query({ q: 'xyznonexistent999' })
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([]);
    });

    it('should return empty results when q is missing', async () => {
      const res = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([]);
    });

    it('should return empty results when q is too short (< 2 chars)', async () => {
      const res = await request(app)
        .get('/api/search')
        .query({ q: 'x' })
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([]);
    });

    it('should return empty results when q is empty string', async () => {
      const res = await request(app)
        .get('/api/search')
        .query({ q: '' })
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([]);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .get('/api/search')
        .query({ q: 'Quantum' });

      expect(res.status).toBe(401);
    });

    it('should not show projects user has no access to', async () => {
      // Create a viewer with no project access
      const viewer = await createTestUser({
        name: 'Search Outsider',
        email: 'searchtest-outsider@example.com',
        role: 'viewer'
      });

      const res = await request(app)
        .get('/api/search')
        .query({ q: 'Searchable Quantum' })
        .set('Authorization', `Bearer ${viewer.token}`);

      expect(res.status).toBe(200);
      // The viewer has no projects, so project results should be empty
      const projectResults = res.body.results.filter(r => r.type === 'project');
      expect(projectResults.length).toBe(0);

      await db.query("DELETE FROM users WHERE id = $1", [viewer.id]);
    });
  });
});
