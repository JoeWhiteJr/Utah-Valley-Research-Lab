const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

/**
 * Authorization tests for two endpoints flagged by Cycle 2 QA as missing
 * project-access checks:
 *
 *   POST /api/notes/:id/pin       (in routes/notes.js)
 *   POST /api/meetings/:id/transcribe (in routes/meetings.js)
 *
 * Regression: previously both routes only required `authenticate`. Any
 * logged-in user could:
 *   - Personally pin a note belonging to a project they had no access to
 *     (leaking note existence and polluting their pin list).
 *   - Trigger transcription on a meeting in a project they had no access to
 *     (currently a placeholder, but a real authz bug once Whisper lands).
 *
 * Both routes now load the row by id, return 404 if missing, then call
 * `userHasProjectAccess(req.user.id, req.user.role, row.project_id)` and
 * return 403 on false. This mirrors the helper rollout shipped in PR #83
 * for the other 10 sites in these files.
 */
describe('Pin and Transcribe project-access checks', () => {
  let adminUser;
  let ownerUser;     // project creator
  let memberUser;    // added via project_members
  let outsiderUser;  // no relationship to the project

  let projectId;

  async function createNote() {
    const res = await db.query(
      'INSERT INTO notes (project_id, title, content, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
      [projectId, 'Pin authz note', 'body', ownerUser.id]
    );
    return res.rows[0].id;
  }

  async function createMeetingWithAudio() {
    const res = await db.query(
      'INSERT INTO meetings (project_id, title, audio_path, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
      [projectId, 'Transcribe authz meeting', '/tmp/pin-transcribe-not-real.webm', ownerUser.id]
    );
    return res.rows[0].id;
  }

  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%pintranscribeauthz%'");

    adminUser = await createTestUser({
      name: 'PinTranscribeAuthz Admin',
      email: 'pintranscribeauthz-admin@example.com',
      role: 'admin'
    });
    ownerUser = await createTestUser({
      name: 'PinTranscribeAuthz Owner',
      email: 'pintranscribeauthz-owner@example.com',
      role: 'project_lead'
    });
    memberUser = await createTestUser({
      name: 'PinTranscribeAuthz Member',
      email: 'pintranscribeauthz-member@example.com',
      role: 'researcher'
    });
    outsiderUser = await createTestUser({
      name: 'PinTranscribeAuthz Outsider',
      email: 'pintranscribeauthz-outsider@example.com',
      role: 'researcher'
    });

    const projectRes = await db.query(
      'INSERT INTO projects (title, description, created_by) VALUES ($1, $2, $3) RETURNING id',
      ['PinTranscribeAuthz Project', 'Project for pin/transcribe authz tests', ownerUser.id]
    );
    projectId = projectRes.rows[0].id;

    await db.query(
      "INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
      [projectId, memberUser.id]
    );
  });

  afterAll(async () => {
    await db.query('DELETE FROM note_pins WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%pintranscribeauthz%']);
    await db.query('DELETE FROM notes WHERE project_id = $1', [projectId]);
    await db.query('DELETE FROM meetings WHERE project_id = $1', [projectId]);
    await db.query('DELETE FROM project_members WHERE project_id = $1', [projectId]);
    await db.query('DELETE FROM projects WHERE id = $1', [projectId]);
    await db.query("DELETE FROM users WHERE email LIKE '%pintranscribeauthz%'");
  });

  describe('POST /api/notes/:id/pin', () => {
    let noteId;

    beforeEach(async () => {
      noteId = await createNote();
    });

    afterEach(async () => {
      await db.query('DELETE FROM note_pins WHERE note_id = $1', [noteId]);
    });

    it('allows a project member to personally-pin a note in their project (200)', async () => {
      const res = await request(app)
        .post(`/api/notes/${noteId}/pin`)
        .set('Authorization', `Bearer ${memberUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.pinned).toBe(true);

      const check = await db.query(
        'SELECT id FROM note_pins WHERE user_id = $1 AND note_id = $2',
        [memberUser.id, noteId]
      );
      expect(check.rows.length).toBe(1);
    });

    it('rejects an outsider with 403 and does not create a pin', async () => {
      const res = await request(app)
        .post(`/api/notes/${noteId}/pin`)
        .set('Authorization', `Bearer ${outsiderUser.token}`);

      expect(res.status).toBe(403);

      // Confirm no pin row was created for the outsider.
      const check = await db.query(
        'SELECT id FROM note_pins WHERE user_id = $1 AND note_id = $2',
        [outsiderUser.id, noteId]
      );
      expect(check.rows.length).toBe(0);
    });

    it('returns 404 when the note does not exist', async () => {
      const res = await request(app)
        .post('/api/notes/00000000-0000-0000-0000-000000000000/pin')
        .set('Authorization', `Bearer ${memberUser.token}`);

      expect(res.status).toBe(404);
    });

    it('allows admin to personally-pin any note (200)', async () => {
      const res = await request(app)
        .post(`/api/notes/${noteId}/pin`)
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.pinned).toBe(true);
    });
  });

  describe('POST /api/meetings/:id/transcribe', () => {
    let meetingId;

    beforeEach(async () => {
      meetingId = await createMeetingWithAudio();
    });

    afterEach(async () => {
      await db.query('DELETE FROM meetings WHERE id = $1', [meetingId]);
    });

    it('allows a project member to queue transcription (200)', async () => {
      const res = await request(app)
        .post(`/api/meetings/${meetingId}/transcribe`)
        .set('Authorization', `Bearer ${memberUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('pending');
      expect(res.body.meeting_id).toBe(meetingId);
    });

    it('rejects an outsider with 403', async () => {
      const res = await request(app)
        .post(`/api/meetings/${meetingId}/transcribe`)
        .set('Authorization', `Bearer ${outsiderUser.token}`);

      expect(res.status).toBe(403);
    });

    it('returns 404 when the meeting does not exist', async () => {
      const res = await request(app)
        .post('/api/meetings/00000000-0000-0000-0000-000000000000/transcribe')
        .set('Authorization', `Bearer ${memberUser.token}`);

      expect(res.status).toBe(404);
    });

    it('allows admin to queue transcription (200)', async () => {
      const res = await request(app)
        .post(`/api/meetings/${meetingId}/transcribe`)
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('pending');
    });
  });
});
