const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('Study API', () => {
  let adminToken;
  let researcherToken;

  beforeAll(async () => {
    // Clean up any leftover test data from prior runs.
    await db.query("DELETE FROM study_responses WHERE assignment_id IN (SELECT id FROM study_assignments WHERE participant_id IN (SELECT id FROM study_participants WHERE participant_code LIKE 'TH_%' OR participant_code LIKE 'CC_%' OR participant_code LIKE 'PM_%'))");
    await db.query("DELETE FROM study_assignments WHERE participant_id IN (SELECT id FROM study_participants WHERE participant_code LIKE 'TH_%' OR participant_code LIKE 'CC_%' OR participant_code LIKE 'PM_%')");
    await db.query("DELETE FROM study_participants WHERE participant_code LIKE 'TH_%' OR participant_code LIKE 'CC_%' OR participant_code LIKE 'PM_%'");
    await db.query("DELETE FROM users WHERE email LIKE '%studytest%'");

    const admin = await createTestUser({
      name: 'Study Test Admin',
      email: 'studytest-admin@example.com',
      role: 'admin',
    });
    adminToken = admin.token;

    const researcher = await createTestUser({
      name: 'Study Test Researcher',
      email: 'studytest-researcher@example.com',
      role: 'researcher',
    });
    researcherToken = researcher.token;
  });

  afterAll(async () => {
    await db.query("DELETE FROM study_responses WHERE assignment_id IN (SELECT id FROM study_assignments WHERE participant_id IN (SELECT id FROM study_participants WHERE participant_code LIKE 'TH_%' OR participant_code LIKE 'CC_%' OR participant_code LIKE 'PM_%'))");
    await db.query("DELETE FROM study_assignments WHERE participant_id IN (SELECT id FROM study_participants WHERE participant_code LIKE 'TH_%' OR participant_code LIKE 'CC_%' OR participant_code LIKE 'PM_%')");
    await db.query("DELETE FROM study_participants WHERE participant_code LIKE 'TH_%' OR participant_code LIKE 'CC_%' OR participant_code LIKE 'PM_%'");
    await db.query("DELETE FROM users WHERE email LIKE '%studytest%'");
  });

  describe('POST /api/study/start', () => {
    it('creates a participant + assignment with a known experiment + condition', async () => {
      const res = await request(app).post('/api/study/start');
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('participant_code');
      expect(res.body).toHaveProperty('assignment_id');
      expect(['treasure_hunt', 'career_choice', 'pattern_memory']).toContain(res.body.experiment);
      expect(res.body.condition).toBeDefined();
      expect(typeof res.body.condition).toBe('string');
    });

    it('balances assignments approximately evenly across experiments', async () => {
      const N = 12;
      const counts = { treasure_hunt: 0, career_choice: 0, pattern_memory: 0 };
      for (let i = 0; i < N; i++) {
        const res = await request(app).post('/api/study/start');
        expect(res.status).toBe(201);
        counts[res.body.experiment]++;
      }
      const max = Math.max(...Object.values(counts));
      const min = Math.min(...Object.values(counts));
      // Spread should be small with the balanced picker.
      expect(max - min).toBeLessThanOrEqual(2);
    });
  });

  describe('POST /api/study/consent + /api/study/save', () => {
    it('records consent and a final save, marking the participant complete', async () => {
      const start = await request(app).post('/api/study/start');
      const code = start.body.participant_code;

      const consent = await request(app)
        .post('/api/study/consent')
        .send({ participant_code: code, demographics: { age: 30, gender: 'Female' } });
      expect(consent.status).toBe(200);
      expect(consent.body.ok).toBe(true);
      expect(consent.body.consent_given_at).toBeTruthy();

      const save = await request(app)
        .post('/api/study/save')
        .send({ participant_code: code, payload: { total_coins: 42, end_time: '2026-05-06T12:00:00Z' } });
      expect(save.status).toBe(200);
      expect(save.body.ok).toBe(true);

      const row = await db.query(
        'SELECT completed_at FROM study_participants WHERE participant_code = $1',
        [code]
      );
      expect(row.rows[0].completed_at).not.toBeNull();
    });

    it('rejects save with unknown participant_code', async () => {
      const res = await request(app)
        .post('/api/study/save')
        .send({ participant_code: 'TH_does_not_exist_xxx', payload: {} });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/study/stats', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/study/stats');
      expect(res.status).toBe(401);
    });
    it('rejects non-admin users', async () => {
      const res = await request(app)
        .get('/api/study/stats')
        .set('Authorization', `Bearer ${researcherToken}`);
      expect(res.status).toBe(403);
    });
    it('returns per-experiment + per-condition counts to admins', async () => {
      const res = await request(app)
        .get('/api/study/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.stats).toHaveProperty('treasure_hunt');
      expect(res.body.stats).toHaveProperty('career_choice');
      expect(res.body.stats).toHaveProperty('pattern_memory');
      expect(res.body.stats.treasure_hunt).toHaveProperty('conditions');
      expect(res.body.stats.treasure_hunt).toHaveProperty('total_assigned');
    });
  });

  describe('GET /api/study/export/:experiment', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/study/export/treasure_hunt');
      expect(res.status).toBe(401);
    });
    it('returns CSV for admins', async () => {
      const res = await request(app)
        .get('/api/study/export/treasure_hunt')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      // Header row should exist.
      expect(res.text.split('\n')[0]).toContain('participant_code');
    });
    it('rejects unknown experiment names', async () => {
      const res = await request(app)
        .get('/api/study/export/not_a_real_experiment')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });
});
