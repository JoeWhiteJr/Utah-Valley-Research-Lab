const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

/**
 * Verifies that POST /api/assistant/conversations enforces project access.
 *
 * Regression: previously the route accepted any projectId from the request
 * body and inserted it without verification, letting a user create a row that
 * referenced a project they did not belong to. The conversation listing
 * endpoint then JOINed on `projects` and leaked that project's title.
 */
describe('Assistant API — project access on conversation create', () => {
  let ownerToken;
  let ownerId;
  let outsiderToken;
  let outsiderId;
  let memberToken;
  let memberId;
  let adminToken;
  let adminId;
  let projectId;

  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%assistantaccess%'");

    const owner = await createTestUser({
      name: 'Assistant Access Owner',
      email: 'assistantaccess-owner@example.com',
      role: 'researcher'
    });
    ownerToken = owner.token;
    ownerId = owner.id;

    const outsider = await createTestUser({
      name: 'Assistant Access Outsider',
      email: 'assistantaccess-outsider@example.com',
      role: 'researcher'
    });
    outsiderToken = outsider.token;
    outsiderId = outsider.id;

    const member = await createTestUser({
      name: 'Assistant Access Member',
      email: 'assistantaccess-member@example.com',
      role: 'researcher'
    });
    memberToken = member.token;
    memberId = member.id;

    const admin = await createTestUser({
      name: 'Assistant Access Admin',
      email: 'assistantaccess-admin@example.com',
      role: 'admin'
    });
    adminToken = admin.token;
    adminId = admin.id;

    const projectRes = await db.query(
      'INSERT INTO projects (title, description, created_by) VALUES ($1, $2, $3) RETURNING id',
      ['Assistant Access Test Project', 'For testing assistant access checks', ownerId]
    );
    projectId = projectRes.rows[0].id;

    // Add the member user (not the outsider) to the project
    await db.query(
      "INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
      [projectId, memberId]
    );
  });

  afterAll(async () => {
    await db.query(
      "DELETE FROM ai_conversations WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%assistantaccess%')"
    );
    await db.query('DELETE FROM project_members WHERE project_id = $1', [projectId]);
    await db.query('DELETE FROM projects WHERE id = $1', [projectId]);
    await db.query("DELETE FROM users WHERE email LIKE '%assistantaccess%'");
  });

  describe('POST /api/assistant/conversations', () => {
    it('should allow the project creator (owner) to create a conversation', async () => {
      const res = await request(app)
        .post('/api/assistant/conversations')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ projectId, title: 'Owner conversation' });

      expect(res.status).toBe(201);
      expect(res.body.conversation).toHaveProperty('id');
      expect(res.body.conversation.project_id).toBe(projectId);
      expect(res.body.conversation.user_id).toBe(ownerId);
    });

    it('should allow a project member to create a conversation', async () => {
      const res = await request(app)
        .post('/api/assistant/conversations')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ projectId, title: 'Member conversation' });

      expect(res.status).toBe(201);
      expect(res.body.conversation.project_id).toBe(projectId);
      expect(res.body.conversation.user_id).toBe(memberId);
    });

    it('should reject a user with no access with 403 and not insert a row', async () => {
      const before = await db.query(
        'SELECT COUNT(*)::int AS count FROM ai_conversations WHERE user_id = $1',
        [outsiderId]
      );
      const beforeCount = before.rows[0].count;

      const res = await request(app)
        .post('/api/assistant/conversations')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ projectId, title: 'Should be blocked' });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.message).toMatch(/do not have access/i);

      const after = await db.query(
        'SELECT COUNT(*)::int AS count FROM ai_conversations WHERE user_id = $1',
        [outsiderId]
      );
      expect(after.rows[0].count).toBe(beforeCount);
    });

    it('should allow an admin to create a conversation even without explicit membership', async () => {
      const res = await request(app)
        .post('/api/assistant/conversations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ projectId, title: 'Admin conversation' });

      expect(res.status).toBe(201);
      expect(res.body.conversation.project_id).toBe(projectId);
      expect(res.body.conversation.user_id).toBe(adminId);
    });

    it('should reject an unknown projectId with 403 (no project-existence leak)', async () => {
      const res = await request(app)
        .post('/api/assistant/conversations')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          projectId: '00000000-0000-0000-0000-000000000000',
          title: 'Bogus project'
        });

      expect(res.status).toBe(403);
    });

    it('should allow conversation creation with no projectId (preserves existing behavior)', async () => {
      const res = await request(app)
        .post('/api/assistant/conversations')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ title: 'Project-less conversation' });

      expect(res.status).toBe(201);
      expect(res.body.conversation).toHaveProperty('id');
      expect(res.body.conversation.project_id).toBeNull();
      expect(res.body.conversation.user_id).toBe(outsiderId);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/assistant/conversations')
        .send({ projectId, title: 'Unauthed' });

      expect(res.status).toBe(401);
    });
  });
});
