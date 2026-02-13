const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('Notes API', () => {
  let authToken;
  let testUserId;
  let testProjectId;
  let testNoteId;

  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%notetest%'");

    const user = await createTestUser({
      name: 'Note Test User',
      email: 'notetest@example.com',
      role: 'project_lead'
    });

    authToken = user.token;
    testUserId = user.id;

    // Ensure soft-delete columns exist
    await db.query(`ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
    await db.query(`ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_by UUID`);
    await db.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
    await db.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_by UUID`);

    // Create a test project
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Project for Notes',
        description: 'A project to test notes'
      });

    testProjectId = projectRes.body.project.id;
  });

  afterAll(async () => {
    await db.query("DELETE FROM notes WHERE project_id = $1", [testProjectId]);
    await db.query("DELETE FROM projects WHERE created_by = $1", [testUserId]);
    await db.query("DELETE FROM users WHERE email LIKE '%notetest%'");
  });

  describe('POST /api/notes/project/:projectId', () => {
    it('should create a new note', async () => {
      const res = await request(app)
        .post(`/api/notes/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Note',
          content: 'This is a test note content.'
        });

      expect(res.status).toBe(201);
      expect(res.body.note).toHaveProperty('id');
      expect(res.body.note.title).toBe('Test Note');
      expect(res.body.note.content).toBe('This is a test note content.');
      expect(res.body.note.created_by).toBe(testUserId);

      testNoteId = res.body.note.id;
    });

    it('should create note without content', async () => {
      const res = await request(app)
        .post(`/api/notes/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Note Without Content'
        });

      expect(res.status).toBe(201);
      expect(res.body.note.title).toBe('Note Without Content');
      expect(res.body.note.content).toBeNull();
    });

    it('should reject note without title', async () => {
      const res = await request(app)
        .post(`/api/notes/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Content without title'
        });

      expect(res.status).toBe(400);
    });

    it('should reject empty title', async () => {
      const res = await request(app)
        .post(`/api/notes/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '   ',
          content: 'Some content'
        });

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post(`/api/notes/project/${testProjectId}`)
        .send({
          title: 'Unauthorized Note'
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/notes/project/:projectId', () => {
    it('should list all notes for a project', async () => {
      const res = await request(app)
        .get(`/api/notes/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.notes)).toBe(true);
      expect(res.body.notes.length).toBeGreaterThan(0);
    });

    it('should include creator name in notes', async () => {
      const res = await request(app)
        .get(`/api/notes/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notes[0]).toHaveProperty('creator_name');
    });

    it('should order notes by updated_at descending', async () => {
      await request(app)
        .post(`/api/notes/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Newest Note' });

      const res = await request(app)
        .get(`/api/notes/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notes[0].title).toBe('Newest Note');
    });
  });

  describe('GET /api/notes/:id', () => {
    it('should get a single note', async () => {
      const res = await request(app)
        .get(`/api/notes/${testNoteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.note.id).toBe(testNoteId);
      expect(res.body.note.title).toBe('Test Note');
      expect(res.body.note).toHaveProperty('creator_name');
    });

    it('should return 404 for non-existent note', async () => {
      const res = await request(app)
        .get('/api/notes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/notes/:id', () => {
    it('should update note title', async () => {
      const res = await request(app)
        .put(`/api/notes/${testNoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Note Title'
        });

      expect(res.status).toBe(200);
      expect(res.body.note.title).toBe('Updated Note Title');
    });

    it('should update note content', async () => {
      const res = await request(app)
        .put(`/api/notes/${testNoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Updated content for the note.'
        });

      expect(res.status).toBe(200);
      expect(res.body.note.content).toBe('Updated content for the note.');
    });

    it('should update both title and content', async () => {
      const res = await request(app)
        .put(`/api/notes/${testNoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Fully Updated Note',
          content: 'Completely new content.'
        });

      expect(res.status).toBe(200);
      expect(res.body.note.title).toBe('Fully Updated Note');
      expect(res.body.note.content).toBe('Completely new content.');
    });

    it('should reject update with no fields', async () => {
      const res = await request(app)
        .put(`/api/notes/${testNoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should reject empty title update', async () => {
      const res = await request(app)
        .put(`/api/notes/${testNoteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '   '
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent note', async () => {
      const res = await request(app)
        .put('/api/notes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Ghost Note'
        });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/notes/:id', () => {
    let noteToDeleteId;

    beforeAll(async () => {
      const res = await request(app)
        .post(`/api/notes/project/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Note to delete' });
      noteToDeleteId = res.body.note.id;
    });

    it('should delete a note', async () => {
      const res = await request(app)
        .delete(`/api/notes/${noteToDeleteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Note deleted successfully');
    });

    it('should return 404 for non-existent note', async () => {
      const res = await request(app)
        .delete('/api/notes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should verify note is actually deleted', async () => {
      const res = await request(app)
        .get(`/api/notes/${noteToDeleteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });
});
