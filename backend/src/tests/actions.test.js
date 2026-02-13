const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('Actions API', () => {
  let authToken;
  let testUserId;
  let testProjectId;
  let testActionId;
  let secondUserId;
  let _secondUserToken;

  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%actiontest%'");

    const user = await createTestUser({
      name: 'Action Test User',
      email: 'actiontest@example.com',
      role: 'project_lead'
    });

    authToken = user.token;
    testUserId = user.id;

    // Create second test user for multi-assignee tests
    const user2 = await createTestUser({
      name: 'Action Test User 2',
      email: 'actiontest2@example.com',
      role: 'researcher'
    });
    secondUserId = user2.id;
    _secondUserToken = user2.token;

    // Ensure action_item_assignees table exists (migration may not have run in test)
    await db.query(`
      CREATE TABLE IF NOT EXISTS action_item_assignees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action_item_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(action_item_id, user_id)
      )
    `);

    // Ensure priority and soft-delete columns exist
    await db.query(`ALTER TABLE action_items ADD COLUMN IF NOT EXISTS priority VARCHAR(10)`);
    await db.query(`ALTER TABLE action_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
    await db.query(`ALTER TABLE action_items ADD COLUMN IF NOT EXISTS deleted_by UUID`);
    await db.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
    await db.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_by UUID`);

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
    await db.query("DELETE FROM action_item_assignees WHERE action_item_id IN (SELECT id FROM action_items WHERE project_id = $1)", [testProjectId]);
    await db.query("DELETE FROM action_items WHERE project_id = $1", [testProjectId]);
    // Hard delete projects for cleanup (bypassing soft delete)
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

    it('should create action item with multiple assignees', async () => {
      const res = await request(app)
        .post(`/api/actions/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Multi-assigned action',
          assignee_ids: [testUserId, secondUserId]
        });

      expect(res.status).toBe(201);
      expect(res.body.action.assignees).toHaveLength(2);
      const assigneeIds = res.body.action.assignees.map(a => a.user_id);
      expect(assigneeIds).toContain(testUserId);
      expect(assigneeIds).toContain(secondUserId);
    });

    it('should create action item with priority', async () => {
      const res = await request(app)
        .post(`/api/actions/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'High priority action',
          priority: 'high'
        });

      expect(res.status).toBe(201);
      expect(res.body.action.priority).toBe('high');
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

    it('should include assignees array on action items', async () => {
      const res = await request(app)
        .get(`/api/actions/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const multiAssigned = res.body.actions.find(a => a.title === 'Multi-assigned action');
      if (multiAssigned) {
        expect(multiAssigned.assignees).toBeDefined();
        expect(Array.isArray(multiAssigned.assignees)).toBe(true);
        expect(multiAssigned.assignees.length).toBe(2);
      }
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

  describe('GET /api/actions/project/:projectId/progress', () => {
    it('should return auto-calculated progress', async () => {
      const res = await request(app)
        .get(`/api/actions/project/${testProjectId}/progress`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('progress');
      expect(res.body).toHaveProperty('total_tasks');
      expect(res.body).toHaveProperty('completed_tasks');
      expect(typeof res.body.progress).toBe('number');
      expect(res.body.progress).toBeGreaterThanOrEqual(0);
      expect(res.body.progress).toBeLessThanOrEqual(100);
    });

    it('should return 0% for project with no completed tasks', async () => {
      // Create a fresh project with only incomplete tasks
      const projectRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Progress Test Project' });

      const newProjectId = projectRes.body.project.id;

      await request(app)
        .post(`/api/actions/project/${newProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Incomplete task 1' });

      await request(app)
        .post(`/api/actions/project/${newProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Incomplete task 2' });

      const res = await request(app)
        .get(`/api/actions/project/${newProjectId}/progress`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.progress).toBe(0);
      expect(res.body.total_tasks).toBe(2);
      expect(res.body.completed_tasks).toBe(0);

      // Cleanup
      await db.query("DELETE FROM action_items WHERE project_id = $1", [newProjectId]);
      await db.query("UPDATE users SET role = 'admin' WHERE id = $1", [testUserId]);
      await request(app)
        .delete(`/api/projects/${newProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);
      await db.query("UPDATE users SET role = 'project_lead' WHERE id = $1", [testUserId]);
    });

    it('should return 0% for project with no tasks', async () => {
      const projectRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Empty Progress Project' });

      const res = await request(app)
        .get(`/api/actions/project/${projectRes.body.project.id}/progress`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.progress).toBe(0);
      expect(res.body.total_tasks).toBe(0);

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

    it('should update assignees via assignee_ids', async () => {
      const res = await request(app)
        .put(`/api/actions/${testActionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          assignee_ids: [testUserId, secondUserId]
        });

      expect(res.status).toBe(200);
      expect(res.body.action.assignees).toHaveLength(2);
    });

    it('should clear assignees when empty array provided', async () => {
      const res = await request(app)
        .put(`/api/actions/${testActionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          assignee_ids: []
        });

      expect(res.status).toBe(200);
      expect(res.body.action.assignees).toHaveLength(0);
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

    it('should soft delete an action (set deleted_at)', async () => {
      const createRes = await request(app)
        .post(`/api/actions/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Soft delete test' });
      const softDeleteId = createRes.body.action.id;

      await request(app)
        .delete(`/api/actions/${softDeleteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Row still exists but has deleted_at set
      const check = await db.query('SELECT id, deleted_at FROM action_items WHERE id = $1', [softDeleteId]);
      expect(check.rows.length).toBe(1);
      expect(check.rows[0].deleted_at).not.toBeNull();
    });
  });
});
