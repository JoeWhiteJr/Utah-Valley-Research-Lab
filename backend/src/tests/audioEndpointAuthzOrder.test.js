const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

/**
 * Authorization-ordering tests for PUT /api/meetings/:id/audio.
 *
 * Regression: previously the route checked existence (404) → req.file (400)
 * → project access (403). For an outsider targeting a meeting in another
 * project this produced two distinguishable response codes for the same
 * underlying authorization state:
 *   - request with no body  → 400 (meeting exists)  vs 404 (meeting does not)
 *   - request with a body   → 403 (no access)
 *
 * That gap let an unauthorized user probe whether a meeting in another
 * project had an audio file attached just by toggling the request body.
 * Same probe-leak class fixed in Cycle 3 PR #89 for /transcribe.
 *
 * The route now performs the access check BEFORE the req.file check, so an
 * outsider always sees 403 regardless of body shape. Because multer writes
 * the upload to disk before this handler runs, the access-denied branch also
 * fs.unlinks the orphaned file (same cleanup pattern shipped in PR #83).
 */
describe('Audio upload authorization ordering (PUT /api/meetings/:id/audio)', () => {
  let memberUser;    // added via project_members
  let outsiderUser;  // no relationship to the project

  let projectId;
  let meetingId;
  let testAudioPath;

  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%audioauthzorder%'");

    memberUser = await createTestUser({
      name: 'AudioAuthzOrder Member',
      email: 'audioauthzorder-member@example.com',
      role: 'project_lead'
    });
    outsiderUser = await createTestUser({
      name: 'AudioAuthzOrder Outsider',
      email: 'audioauthzorder-outsider@example.com',
      role: 'researcher'
    });

    const projectRes = await db.query(
      'INSERT INTO projects (title, description, created_by) VALUES ($1, $2, $3) RETURNING id',
      ['AudioAuthzOrder Project', 'Project for audio authz ordering tests', memberUser.id]
    );
    projectId = projectRes.rows[0].id;

    const meetingRes = await db.query(
      'INSERT INTO meetings (project_id, title, created_by) VALUES ($1, $2, $3) RETURNING id',
      [projectId, 'AudioAuthzOrder Meeting', memberUser.id]
    );
    meetingId = meetingRes.rows[0].id;

    // Prepare a small fake-audio file used for upload attachments. The route's
    // multer fileFilter only inspects mimetype, and supertest's .attach lets
    // us set that explicitly, so the byte content is irrelevant.
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    testAudioPath = path.join(uploadDir, 'audioauthzorder-upload.webm');
    fs.writeFileSync(testAudioPath, 'fake-audio-bytes');
  });

  afterAll(async () => {
    // Clean up any audio files that successful uploads left behind.
    const meetingRows = await db.query(
      'SELECT audio_path FROM meetings WHERE project_id = $1',
      [projectId]
    );
    for (const row of meetingRows.rows) {
      if (row.audio_path && fs.existsSync(row.audio_path)) {
        fs.unlinkSync(row.audio_path);
      }
    }

    await db.query('DELETE FROM meetings WHERE project_id = $1', [projectId]);
    await db.query('DELETE FROM projects WHERE id = $1', [projectId]);
    await db.query("DELETE FROM users WHERE email LIKE '%audioauthzorder%'");

    if (testAudioPath && fs.existsSync(testAudioPath)) {
      fs.unlinkSync(testAudioPath);
    }
  });

  // Reset audio_path on the meeting between tests so each case starts from a
  // clean state and we can detect mutations on failure.
  async function resetAudioPath() {
    const before = await db.query('SELECT audio_path FROM meetings WHERE id = $1', [meetingId]);
    const oldPath = before.rows[0] && before.rows[0].audio_path;
    if (oldPath && fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
    await db.query('UPDATE meetings SET audio_path = NULL WHERE id = $1', [meetingId]);
  }

  describe('outsider receives identical 403 regardless of body', () => {
    beforeEach(resetAudioPath);

    it('rejects an outsider WITH an audio file attached (403, not 200)', async () => {
      const res = await request(app)
        .put(`/api/meetings/${meetingId}/audio`)
        .set('Authorization', `Bearer ${outsiderUser.token}`)
        .attach('audio', testAudioPath, { contentType: 'audio/webm' });

      expect(res.status).toBe(403);

      // Confirm audio_path was NOT mutated on the meeting row.
      const check = await db.query('SELECT audio_path FROM meetings WHERE id = $1', [meetingId]);
      expect(check.rows[0].audio_path).toBeNull();
    });

    it('rejects an outsider WITHOUT an audio file (403, not 400)', async () => {
      // The point of this test: prior to the fix, this returned 400 ("No
      // audio file provided") because the file check ran before the access
      // check — distinguishable from the with-body 403 above. Now both
      // shapes return the same 403 so an outsider cannot use the body
      // toggle to probe meeting-in-another-project state.
      const res = await request(app)
        .put(`/api/meetings/${meetingId}/audio`)
        .set('Authorization', `Bearer ${outsiderUser.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('member happy paths still work', () => {
    beforeEach(resetAudioPath);

    it('returns 400 for a member when no audio file is attached', async () => {
      const res = await request(app)
        .put(`/api/meetings/${meetingId}/audio`)
        .set('Authorization', `Bearer ${memberUser.token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/no audio file/i);
    });

    it('returns 200 for a member uploading an audio file', async () => {
      const res = await request(app)
        .put(`/api/meetings/${meetingId}/audio`)
        .set('Authorization', `Bearer ${memberUser.token}`)
        .attach('audio', testAudioPath, { contentType: 'audio/webm' });

      expect(res.status).toBe(200);
      expect(res.body.meeting.id).toBe(meetingId);
      expect(res.body.meeting.audio_path).toBeTruthy();

      // The uploaded file should actually exist on disk after a successful
      // upload (sanity: the access check did NOT incorrectly clean it up).
      expect(fs.existsSync(res.body.meeting.audio_path)).toBe(true);
    });
  });

  describe('not-found path still returns 404', () => {
    it('returns 404 when the meeting does not exist (with body)', async () => {
      const res = await request(app)
        .put('/api/meetings/00000000-0000-0000-0000-000000000000/audio')
        .set('Authorization', `Bearer ${memberUser.token}`)
        .attach('audio', testAudioPath, { contentType: 'audio/webm' });

      expect(res.status).toBe(404);
    });
  });
});
