const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('Calendar API', () => {
  let adminToken;
  let _adminUserId;
  let researcherToken;
  let _researcherUserId;
  let viewerToken;
  let viewerUserId;
  let testEventId;

  beforeAll(async () => {
    // Clean up leftover test data
    await db.query("DELETE FROM users WHERE email LIKE '%caltest%'");

    // Create admin user (can create lab events)
    const admin = await createTestUser({
      name: 'Cal Test Admin',
      email: 'caltest-admin@example.com',
      role: 'admin'
    });
    adminToken = admin.token;
    _adminUserId = admin.id;

    // Create project_lead user (can create lab events)
    const researcher = await createTestUser({
      name: 'Cal Test Lead',
      email: 'caltest-lead@example.com',
      role: 'project_lead'
    });
    researcherToken = researcher.token;
    _researcherUserId = researcher.id;

    // Create viewer user (cannot create lab events)
    const viewer = await createTestUser({
      name: 'Cal Test Viewer',
      email: 'caltest-viewer@example.com',
      role: 'viewer'
    });
    viewerToken = viewer.token;
    viewerUserId = viewer.id;
  });

  afterAll(async () => {
    // Clean up events created by test users
    await db.query("DELETE FROM calendar_event_attendees WHERE event_id IN (SELECT id FROM calendar_events WHERE created_by IN (SELECT id FROM users WHERE email LIKE '%caltest%'))");
    await db.query("DELETE FROM calendar_events WHERE created_by IN (SELECT id FROM users WHERE email LIKE '%caltest%')");
    await db.query("DELETE FROM calendar_categories WHERE created_by IN (SELECT id FROM users WHERE email LIKE '%caltest%')");
    await db.query("DELETE FROM users WHERE email LIKE '%caltest%'");
  });

  // ==========================================
  // POST /api/calendar/events - Create event
  // ==========================================
  describe('POST /api/calendar/events', () => {
    it('should create a personal event', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Personal Study Session',
          start_time: '2026-03-15T10:00:00Z',
          end_time: '2026-03-15T12:00:00Z',
          scope: 'personal',
          description: 'Study for exam'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('event');
      expect(res.body.event.title).toBe('Personal Study Session');
      expect(res.body.event.scope).toBe('personal');
      expect(res.body.event.created_by).toBe(viewerUserId);
      expect(res.body.event).toHaveProperty('creator_name');

      testEventId = res.body.event.id;
    });

    it('should create a lab event as admin', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Lab Meeting',
          start_time: '2026-03-20T14:00:00Z',
          end_time: '2026-03-20T15:00:00Z',
          scope: 'lab',
          description: 'Weekly lab meeting'
        });

      expect(res.status).toBe(201);
      expect(res.body.event.title).toBe('Lab Meeting');
      expect(res.body.event.scope).toBe('lab');
    });

    it('should create a lab event as project_lead', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({
          title: 'Lead Lab Event',
          start_time: '2026-03-21T09:00:00Z',
          end_time: '2026-03-21T10:00:00Z',
          scope: 'lab'
        });

      expect(res.status).toBe(201);
      expect(res.body.event.scope).toBe('lab');
    });

    it('should reject lab event creation from viewer', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Viewer Lab Event',
          start_time: '2026-03-22T09:00:00Z',
          end_time: '2026-03-22T10:00:00Z',
          scope: 'lab'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Only admins and project leads');
    });

    it('should reject event without title', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          start_time: '2026-03-15T10:00:00Z',
          end_time: '2026-03-15T12:00:00Z',
          scope: 'personal'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('should reject event without start_time', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'No Start Time',
          end_time: '2026-03-15T12:00:00Z',
          scope: 'personal'
        });

      expect(res.status).toBe(400);
    });

    it('should reject event without scope', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'No Scope',
          start_time: '2026-03-15T10:00:00Z',
          end_time: '2026-03-15T12:00:00Z'
        });

      expect(res.status).toBe(400);
    });

    it('should create an all-day event', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'All Day Conference',
          start_time: '2026-04-01T00:00:00Z',
          end_time: '2026-04-01T23:59:59Z',
          scope: 'personal',
          all_day: true
        });

      expect(res.status).toBe(201);
      expect(res.body.event.all_day).toBe(true);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post('/api/calendar/events')
        .send({
          title: 'No Auth Event',
          start_time: '2026-03-15T10:00:00Z',
          end_time: '2026-03-15T12:00:00Z',
          scope: 'personal'
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // GET /api/calendar/events - List events
  // ==========================================
  describe('GET /api/calendar/events', () => {
    it('should list events within date range', async () => {
      const res = await request(app)
        .get('/api/calendar/events')
        .query({
          start: '2026-03-01T00:00:00Z',
          end: '2026-04-30T23:59:59Z'
        })
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('events');
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(res.body.events.length).toBeGreaterThan(0);
    });

    it('should filter by scope=personal', async () => {
      const res = await request(app)
        .get('/api/calendar/events')
        .query({
          start: '2026-03-01T00:00:00Z',
          end: '2026-04-30T23:59:59Z',
          scope: 'personal'
        })
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      res.body.events.forEach(event => {
        expect(event.scope).toBe('personal');
      });
    });

    it('should filter by scope=lab', async () => {
      const res = await request(app)
        .get('/api/calendar/events')
        .query({
          start: '2026-03-01T00:00:00Z',
          end: '2026-04-30T23:59:59Z',
          scope: 'lab'
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.events.forEach(event => {
        expect(event.scope).toBe('lab');
      });
    });

    it('should reject missing start/end dates', async () => {
      const res = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('should return empty array for date range with no events', async () => {
      const res = await request(app)
        .get('/api/calendar/events')
        .query({
          start: '2020-01-01T00:00:00Z',
          end: '2020-01-31T23:59:59Z'
        })
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.events).toEqual([]);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .get('/api/calendar/events')
        .query({
          start: '2026-03-01T00:00:00Z',
          end: '2026-04-30T23:59:59Z'
        });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // PUT /api/calendar/events/:id - Update event
  // ==========================================
  describe('PUT /api/calendar/events/:id', () => {
    it('should update own personal event', async () => {
      const res = await request(app)
        .put(`/api/calendar/events/${testEventId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Updated Study Session',
          description: 'Updated description'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('event');
      expect(res.body.event.title).toBe('Updated Study Session');
    });

    it('should update event times', async () => {
      const res = await request(app)
        .put(`/api/calendar/events/${testEventId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          start_time: '2026-03-16T11:00:00Z',
          end_time: '2026-03-16T13:00:00Z'
        });

      expect(res.status).toBe(200);
      expect(res.body.event).toHaveProperty('start_time');
    });

    it('should reject update of another user personal event', async () => {
      const res = await request(app)
        .put(`/api/calendar/events/${testEventId}`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({
          title: 'Hijacked event'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('your own personal events');
    });

    it('should return 404 for non-existent event', async () => {
      const res = await request(app)
        .put('/api/calendar/events/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Ghost event'
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Event not found');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .put(`/api/calendar/events/${testEventId}`)
        .send({ title: 'No auth' });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // DELETE /api/calendar/events/:id - Delete event
  // ==========================================
  describe('DELETE /api/calendar/events/:id', () => {
    let eventToDeleteId;

    beforeAll(async () => {
      // Create an event to delete
      const res = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Event to Delete',
          start_time: '2026-05-01T10:00:00Z',
          end_time: '2026-05-01T11:00:00Z',
          scope: 'personal'
        });
      eventToDeleteId = res.body.event.id;
    });

    it('should delete own personal event', async () => {
      const res = await request(app)
        .delete(`/api/calendar/events/${eventToDeleteId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Event deleted');
    });

    it('should return 404 for non-existent event', async () => {
      const res = await request(app)
        .delete('/api/calendar/events/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Event not found');
    });

    it('should reject deleting another user personal event', async () => {
      // Create an event as admin
      const createRes = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Admin Personal Event',
          start_time: '2026-05-05T10:00:00Z',
          end_time: '2026-05-05T11:00:00Z',
          scope: 'personal'
        });
      const adminEventId = createRes.body.event.id;

      // Try deleting as viewer
      const res = await request(app)
        .delete(`/api/calendar/events/${adminEventId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('your own personal events');
    });

    it('should reject viewer deleting a lab event', async () => {
      // Create a lab event as admin
      const createRes = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Lab Event No Delete',
          start_time: '2026-05-10T10:00:00Z',
          end_time: '2026-05-10T11:00:00Z',
          scope: 'lab'
        });
      const labEventId = createRes.body.event.id;

      const res = await request(app)
        .delete(`/api/calendar/events/${labEventId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Only admins and project leads');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .delete(`/api/calendar/events/${testEventId}`);

      expect(res.status).toBe(401);
    });
  });
});
