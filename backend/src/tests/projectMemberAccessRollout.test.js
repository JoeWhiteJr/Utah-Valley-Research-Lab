const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

/**
 * Regression tests for the project-access helper rollout across notes, actions,
 * meetings, and files routes.
 *
 * Bug being fixed:
 *   The inline access subqueries in routes/notes.js, routes/actions.js,
 *   routes/meetings.js, and routes/files.js only considered the project's
 *   `created_by` (and sometimes the action_item assignee join). They did NOT
 *   consider `project_members`, so a user added to a project via
 *   POST /api/projects/:id/members (or via an accepted join request) could
 *   read notes/files/meetings (the LIST endpoints worked) but received 403
 *   when trying to UPDATE or DELETE them.
 *
 * Consolidation:
 *   All affected sites now route through `userHasProjectAccess(userId, role,
 *   projectId)` from services/ragQueryService.js, which honors admin, creator,
 *   project_members, and assignee paths uniformly.
 *
 * These tests cover the four behaviors that matter:
 *   1) project_members (non-creator, non-admin, non-assignee) can UPDATE.
 *   2) project_members can DELETE.
 *   3) Admins (always allowed) still succeed.
 *   4) Outsiders (no membership, not creator, not assignee) still get 403.
 */
describe('Project member access rollout (notes/actions/meetings/files)', () => {
  let adminUser;
  let ownerUser;     // project creator
  let memberUser;    // added via project_members (the bug-affected role)
  let outsiderUser;  // no relationship to the project

  let projectId;
  let noteId;
  let actionId;
  let meetingId;
  let fileId;
  let testFilePath;

  // Create a fresh note row owned by ownerUser; returns the new id.
  async function createNote() {
    const res = await db.query(
      'INSERT INTO notes (project_id, title, content, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
      [projectId, 'Member rollout note', 'body', ownerUser.id]
    );
    return res.rows[0].id;
  }

  async function createActionItem() {
    const res = await db.query(
      'INSERT INTO action_items (project_id, title) VALUES ($1, $2) RETURNING id',
      [projectId, 'Member rollout task']
    );
    return res.rows[0].id;
  }

  async function createMeeting() {
    const res = await db.query(
      'INSERT INTO meetings (project_id, title, created_by) VALUES ($1, $2, $3) RETURNING id',
      [projectId, 'Member rollout meeting', ownerUser.id]
    );
    return res.rows[0].id;
  }

  async function createFileRow() {
    // Storage path is required because the download endpoint streams from it.
    const storagePath = path.join(
      process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
      'projmemberaccess-payload.txt'
    );
    if (!fs.existsSync(storagePath)) {
      fs.writeFileSync(storagePath, 'rollout test payload');
    }
    const res = await db.query(
      `INSERT INTO files (project_id, filename, original_filename, storage_path, file_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        projectId,
        'projmemberaccess-payload.txt',
        'projmemberaccess-payload.txt',
        storagePath,
        'text/plain',
        20,
        ownerUser.id
      ]
    );
    return { id: res.rows[0].id, storagePath };
  }

  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%projmemberaccess%'");

    adminUser = await createTestUser({
      name: 'ProjMemberAccess Admin',
      email: 'projmemberaccess-admin@example.com',
      role: 'admin'
    });
    ownerUser = await createTestUser({
      name: 'ProjMemberAccess Owner',
      email: 'projmemberaccess-owner@example.com',
      role: 'project_lead'
    });
    memberUser = await createTestUser({
      name: 'ProjMemberAccess Member',
      email: 'projmemberaccess-member@example.com',
      role: 'researcher'
    });
    outsiderUser = await createTestUser({
      name: 'ProjMemberAccess Outsider',
      email: 'projmemberaccess-outsider@example.com',
      role: 'researcher'
    });

    const projectRes = await db.query(
      'INSERT INTO projects (title, description, created_by) VALUES ($1, $2, $3) RETURNING id',
      ['ProjMemberAccess Project', 'Project for member-access rollout tests', ownerUser.id]
    );
    projectId = projectRes.rows[0].id;

    // Add memberUser as a plain project_member. They are NOT the creator, NOT
    // an action_item assignee, and NOT an admin — exactly the role that the
    // pre-fix code rejected at UPDATE/DELETE.
    await db.query(
      "INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
      [projectId, memberUser.id]
    );
  });

  afterAll(async () => {
    // Wipe rows we created. Soft-deleted rows must also be cleared so reruns
    // don't trip on duplicates.
    await db.query('DELETE FROM action_items WHERE project_id = $1', [projectId]);
    await db.query('DELETE FROM notes WHERE project_id = $1', [projectId]);
    await db.query('DELETE FROM meetings WHERE project_id = $1', [projectId]);

    const fileRows = await db.query(
      'SELECT storage_path FROM files WHERE project_id = $1',
      [projectId]
    );
    for (const row of fileRows.rows) {
      if (row.storage_path && fs.existsSync(row.storage_path)) {
        fs.unlinkSync(row.storage_path);
      }
    }
    await db.query('DELETE FROM files WHERE project_id = $1', [projectId]);

    await db.query('DELETE FROM project_members WHERE project_id = $1', [projectId]);
    await db.query('DELETE FROM projects WHERE id = $1', [projectId]);
    await db.query("DELETE FROM users WHERE email LIKE '%projmemberaccess%'");

    if (testFilePath && fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  describe('Notes — project_member can UPDATE/DELETE (the original bug)', () => {
    beforeEach(async () => {
      noteId = await createNote();
    });

    it('allows a project_member to UPDATE a note (was 403 before fix)', async () => {
      const res = await request(app)
        .put(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${memberUser.token}`)
        .send({ title: 'Member-updated title' });

      expect(res.status).toBe(200);
      expect(res.body.note.title).toBe('Member-updated title');
    });

    it('allows a project_member to DELETE a note (was 403 before fix)', async () => {
      const res = await request(app)
        .delete(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${memberUser.token}`);

      expect(res.status).toBe(200);
    });

    it('still rejects an outsider with 403 on UPDATE', async () => {
      const res = await request(app)
        .put(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${outsiderUser.token}`)
        .send({ title: 'Should not work' });

      expect(res.status).toBe(403);

      // Confirm the title was NOT mutated.
      const check = await db.query('SELECT title FROM notes WHERE id = $1', [noteId]);
      expect(check.rows[0].title).toBe('Member rollout note');
    });

    it('still rejects an outsider with 403 on DELETE', async () => {
      const res = await request(app)
        .delete(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${outsiderUser.token}`);

      expect(res.status).toBe(403);

      // Confirm the row was NOT soft-deleted.
      const check = await db.query('SELECT deleted_at FROM notes WHERE id = $1', [noteId]);
      expect(check.rows[0].deleted_at).toBeNull();
    });

    it('still allows admin to UPDATE', async () => {
      const res = await request(app)
        .put(`/api/notes/${noteId}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ title: 'Admin-updated title' });

      expect(res.status).toBe(200);
      expect(res.body.note.title).toBe('Admin-updated title');
    });

    it('returns 404 (not 403) when the note does not exist', async () => {
      const res = await request(app)
        .put('/api/notes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${memberUser.token}`)
        .send({ title: 'whatever' });

      expect(res.status).toBe(404);
    });
  });

  describe('Action items — project_member can UPDATE/DELETE', () => {
    beforeEach(async () => {
      actionId = await createActionItem();
    });

    it('allows a project_member to UPDATE an action item (was 403 before fix)', async () => {
      const res = await request(app)
        .put(`/api/actions/${actionId}`)
        .set('Authorization', `Bearer ${memberUser.token}`)
        .send({ title: 'Member-updated task' });

      expect(res.status).toBe(200);
      expect(res.body.action.title).toBe('Member-updated task');
    });

    it('allows a project_member to DELETE an action item (was 403 before fix)', async () => {
      const res = await request(app)
        .delete(`/api/actions/${actionId}`)
        .set('Authorization', `Bearer ${memberUser.token}`);

      expect(res.status).toBe(200);
    });

    it('still rejects an outsider with 403 on UPDATE', async () => {
      const res = await request(app)
        .put(`/api/actions/${actionId}`)
        .set('Authorization', `Bearer ${outsiderUser.token}`)
        .send({ title: 'Hijack' });

      expect(res.status).toBe(403);
    });

    it('still rejects an outsider with 403 on DELETE', async () => {
      const res = await request(app)
        .delete(`/api/actions/${actionId}`)
        .set('Authorization', `Bearer ${outsiderUser.token}`);

      expect(res.status).toBe(403);
    });

    it('still allows admin to DELETE', async () => {
      const res = await request(app)
        .delete(`/api/actions/${actionId}`)
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Meetings — project_member can UPDATE/DELETE', () => {
    beforeEach(async () => {
      meetingId = await createMeeting();
    });

    it('allows a project_member to UPDATE a meeting (was 403 before fix)', async () => {
      const res = await request(app)
        .put(`/api/meetings/${meetingId}`)
        .set('Authorization', `Bearer ${memberUser.token}`)
        .send({ title: 'Member-updated meeting' });

      expect(res.status).toBe(200);
      expect(res.body.meeting.title).toBe('Member-updated meeting');
    });

    it('allows a project_member to DELETE a meeting (was 403 before fix)', async () => {
      const res = await request(app)
        .delete(`/api/meetings/${meetingId}`)
        .set('Authorization', `Bearer ${memberUser.token}`);

      expect(res.status).toBe(200);
    });

    it('still rejects an outsider with 403 on UPDATE', async () => {
      const res = await request(app)
        .put(`/api/meetings/${meetingId}`)
        .set('Authorization', `Bearer ${outsiderUser.token}`)
        .send({ title: 'Hijack' });

      expect(res.status).toBe(403);
    });

    it('still rejects an outsider with 403 on DELETE', async () => {
      const res = await request(app)
        .delete(`/api/meetings/${meetingId}`)
        .set('Authorization', `Bearer ${outsiderUser.token}`);

      expect(res.status).toBe(403);
    });

    it('still allows admin to UPDATE', async () => {
      const res = await request(app)
        .put(`/api/meetings/${meetingId}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ title: 'Admin-updated meeting' });

      expect(res.status).toBe(200);
    });
  });

  describe('Files — project_member can DELETE', () => {
    let createdStoragePath;

    beforeEach(async () => {
      const created = await createFileRow();
      fileId = created.id;
      createdStoragePath = created.storagePath;
    });

    it('allows a project_member to DELETE a file (was 403 before fix)', async () => {
      const res = await request(app)
        .delete(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${memberUser.token}`);

      expect(res.status).toBe(200);
    });

    it('still rejects an outsider with 403 on DELETE', async () => {
      const res = await request(app)
        .delete(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${outsiderUser.token}`);

      expect(res.status).toBe(403);

      const check = await db.query('SELECT deleted_at FROM files WHERE id = $1', [fileId]);
      expect(check.rows[0].deleted_at).toBeNull();
    });

    it('still allows admin to DELETE', async () => {
      const res = await request(app)
        .delete(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
    });

    it('allows a project_member to download (the GET path is also routed through userHasProjectAccess)', async () => {
      // Make sure the storage file actually exists for the download.
      if (!fs.existsSync(createdStoragePath)) {
        fs.writeFileSync(createdStoragePath, 'rollout test payload');
      }
      const res = await request(app)
        .get(`/api/files/${fileId}/download`)
        .set('Authorization', `Bearer ${memberUser.token}`);

      expect(res.status).toBe(200);
    });
  });
});
