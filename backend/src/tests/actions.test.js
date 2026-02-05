const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');

describe('Actions API', () => {
  let authToken;
  let testUserId;
  let testProjectId;
  let testActionId;

  beforeAll(async () => {
    // Clean up test data
    await db.query("DELETE FROM users WHERE email LIKE '%actiontest%'");

    // Register and get token
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Action Test User',
        email: 'actiontest@example.com',
        password: 'password123'
      });

    authToken = res.body.token;
    testUserId = res.body.user.id;

    // Make user a project_lead so they can create projects
    await db.query("UPDATE users SET role = 'project_lead' WHERE id = $1", [testUserId]);

    // Create a test project
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Project for Actions',
        description: 'A project to test action items'
      });

    testProjectId = projectRes.body.project.id;
  });

  afterAll(async () => {
    await db.query("DELETE FROM action_items WHERE project_id = $1", [testProjectId]);
    await db.query("DELETE FROM projects WHERE created_by = $1", [testUserId]);
    await db.query("DELETE FROM users WHERE email LIKE '%actiontest%'");
  });

  describe('POST /api/actions/project/:projectId', () => {
    it('should create a new action item', async () => {
      const res = await request(app)
        .post(`/api/actions/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Action Item'
        });

      expect(res.status).toBe(201);
      expect(res.body.action).toHaveProperty('id');
      expect(res.body.action.title).toBe('Test Action Item');
      expect(res.body.action.completed).toBe(false);
      expect(res.body.action.sort_order).toBe(0);

      testActionId = res.body.action.id;
    });

    it('should create action item with due date', async () => {
      const dueDate = '2025-12-31';
      const res = await request(app)
        .post(`/api/actions/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Action with due date',
          due_date: dueDate
        });

      expect(res.status).toBe(201);
      expect(res.body.action.due_date).toContain('2025-12-31');
    });

    it('should create action item with assignee', async () => {
      const res = await request(app)
        .post(`/api/actions/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Assigned action',
          assigned_to: testUserId
        });

      expect(res.status).toBe(201);
      expect(res.body.action.assigned_to).toBe(testUserId);
    });

    it('should reject action without title', async () => {
      const res = await request(app)
        .post(`/api/actions/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          due_date: '2025-12-31'
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid due date format', async () => {
      const res = await request(app)
        .post(`/api/actions/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Bad date action',
          due_date: 'invalid-date'
        });

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post(`/api/actions/project/${testProjectId}`)
        .send({
          title: 'Unauthorized action'
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/actions/project/:projectId', () => {
    it('should list all action items for a project', async () => {
      const res = await request(app)
        .get(`/api/actions/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.actions)).toBe(true);
      expect(res.body.actions.length).toBeGreaterThan(0);
    });

    it('should return empty array for project with no actions', async () => {
      // Create a new project without actions
      const projectRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Empty Project' });

      const res = await request(app)
        .get(`/api/actions/project/${projectRes.body.project.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.actions).toEqual([]);

      // Cleanup
      await db.query("UPDATE users SET role = 'admin' WHERE id = $1", [testUserId]);
      await request(app)
        .delete(`/api/projects/${projectRes.body.project.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      await db.query("UPDATE users SET role = 'project_lead' WHERE id = $1", [testUserId]);
    });
  });

  describe('PUT /api/actions/:id', () => {
    it('should update action title', async () => {
      const res = await request(app)
        .put(`/api/actions/${testActionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Action Title'
        });

      expect(res.status).toBe(200);
      expect(res.body.action.title).toBe('Updated Action Title');
    });

    it('should toggle action completed status', async () => {
      const res = await request(app)
        .put(`/api/actions/${testActionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          completed: true
        });

      expect(res.status).toBe(200);
      expect(res.body.action.completed).toBe(true);

      // Toggle back
      const res2 = await request(app)
        .put(`/api/actions/${testActionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          completed: false
        });

      expect(res2.status).toBe(200);
      expect(res2.body.action.completed).toBe(false);
    });

    it('should update due date', async () => {
      const res = await request(app)
        .put(`/api/actions/${testActionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          due_date: '2025-06-15'
        });

      expect(res.status).toBe(200);
      expect(res.body.action.due_date).toContain('2025-06-15');
    });

    it('should reject update with no fields', async () => {
      const res = await request(app)
        .put(`/api/actions/${testActionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent action', async () => {
      const res = await request(app)
        .put('/api/actions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Ghost action'
        });

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/actions/reorder', () => {
    let action1Id, action2Id, action3Id;

    beforeAll(async () => {
      // Create three actions for reordering tests
      const res1 = await request(app)
        .post(`/api/actions/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Reorder Test 1' });
      action1Id = res1.body.action.id;

      const res2 = await request(app)
        .post(`/api/actions/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Reorder Test 2' });
      action2Id = res2.body.action.id;

      const res3 = await request(app)
        .post(`/api/actions/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Reorder Test 3' });
      action3Id = res3.body.action.id;
    });

    it('should reorder action items', async () => {
      const res = await request(app)
        .put('/api/actions/reorder')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            { id: action3Id, sort_order: 0 },
            { id: action1Id, sort_order: 1 },
            { id: action2Id, sort_order: 2 }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Reorder successful');

      // Verify the new order
      const listRes = await request(app)
        .get(`/api/actions/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const orderedActions = listRes.body.actions.filter(a =>
        [action1Id, action2Id, action3Id].includes(a.id)
      );
      expect(orderedActions[0].id).toBe(action3Id);
    });

    it('should reject invalid reorder payload', async () => {
      const res = await request(app)
        .put('/api/actions/reorder')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: 'not-an-array'
        });

      expect(res.status).toBe(400);
    });

    it('should reject reorder with invalid sort_order', async () => {
      const res = await request(app)
        .put('/api/actions/reorder')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            { id: action1Id, sort_order: -1 }
          ]
        });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/actions/:id', () => {
    let actionToDeleteId;

    beforeAll(async () => {
      const res = await request(app)
        .post(`/api/actions/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Action to delete' });
      actionToDeleteId = res.body.action.id;
    });

    it('should delete an action item', async () => {
      const res = await request(app)
        .delete(`/api/actions/${actionToDeleteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Action item deleted successfully');
    });

    it('should return 404 for non-existent action', async () => {
      const res = await request(app)
        .delete('/api/actions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });
});
