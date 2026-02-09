const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('Applications API', () => {
  let adminToken;
  let adminUserId;
  let researcherToken;
  let testApplicationId;

  beforeAll(async () => {
    // Clean up any leftover test data
    await db.query("DELETE FROM users WHERE email LIKE '%apptest%'");
    await db.query("DELETE FROM applications WHERE email LIKE '%apptest%'");

    // Create admin user
    const admin = await createTestUser({
      name: 'App Test Admin',
      email: 'apptest-admin@example.com',
      role: 'admin'
    });
    adminToken = admin.token;
    adminUserId = admin.id;

    // Create non-admin user
    const researcher = await createTestUser({
      name: 'App Test Researcher',
      email: 'apptest-researcher@example.com',
      role: 'researcher'
    });
    researcherToken = researcher.token;
  });

  afterAll(async () => {
    // Clean up created users from approved applications
    await db.query("DELETE FROM user_preferences WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%apptest%')");
    await db.query("DELETE FROM applications WHERE email LIKE '%apptest%'");
    await db.query("DELETE FROM users WHERE email LIKE '%apptest%'");
  });

  // ==========================================
  // POST /api/applications - Submit application
  // ==========================================
  describe('POST /api/applications', () => {
    it('should submit an application successfully', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({
          name: 'Test Applicant',
          email: 'apptest-applicant@example.com',
          message: 'I would like to join the lab'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('application');
      expect(res.body.application).toHaveProperty('id');
      expect(res.body.application.name).toBe('Test Applicant');
      expect(res.body.application.email).toBe('apptest-applicant@example.com');
      expect(res.body.application.status).toBe('pending');
      expect(res.body.message).toBe('Application submitted successfully');

      testApplicationId = res.body.application.id;
    });

    it('should reject duplicate pending application with same email', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({
          name: 'Test Applicant Dupe',
          email: 'apptest-applicant@example.com',
          message: 'Duplicate application attempt'
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('already pending');
    });

    it('should reject application when user already exists with that email', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({
          name: 'Existing User',
          email: 'apptest-admin@example.com',
          message: 'I already have an account'
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('already exists');
    });

    it('should reject application with missing name', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({
          email: 'apptest-noname@example.com',
          message: 'Missing name field'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('should reject application with missing email', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({
          name: 'No Email Applicant',
          message: 'Missing email field'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('should reject application with invalid email', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({
          name: 'Bad Email Applicant',
          email: 'not-an-email',
          message: 'Invalid email format'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });

    it('should reject application with missing message', async () => {
      const res = await request(app)
        .post('/api/applications')
        .send({
          name: 'No Message Applicant',
          email: 'apptest-nomsg@example.com'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
    });
  });

  // ==========================================
  // GET /api/applications - List applications
  // ==========================================
  describe('GET /api/applications', () => {
    it('should list applications for admin', async () => {
      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('applications');
      expect(Array.isArray(res.body.applications)).toBe(true);
      expect(res.body.applications.length).toBeGreaterThan(0);
    });

    it('should filter applications by status', async () => {
      const res = await request(app)
        .get('/api/applications?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.applications.length).toBeGreaterThan(0);
      res.body.applications.forEach(app => {
        expect(app.status).toBe('pending');
      });
    });

    it('should reject invalid status filter', async () => {
      const res = await request(app)
        .get('/api/applications?status=invalid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Invalid status filter');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .get('/api/applications');

      expect(res.status).toBe(401);
    });

    it('should return 403 for non-admin user', async () => {
      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // PUT /api/applications/:id/reject
  // ==========================================
  describe('PUT /api/applications/:id/reject', () => {
    let rejectAppId;

    beforeAll(async () => {
      // Create a fresh application to reject
      const appRes = await request(app)
        .post('/api/applications')
        .send({
          name: 'Reject Candidate',
          email: 'apptest-reject@example.com',
          message: 'Will be rejected'
        });
      rejectAppId = appRes.body.application.id;
    });

    it('should reject an application with a reason', async () => {
      const res = await request(app)
        .put(`/api/applications/${rejectAppId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Does not meet requirements' });

      expect(res.status).toBe(200);
      expect(res.body.application.status).toBe('rejected');
      expect(res.body.application.rejection_reason).toBe('Does not meet requirements');
      expect(res.body.application.reviewed_by).toBe(adminUserId);
      expect(res.body.message).toBe('Application rejected');
    });

    it('should not reject an already reviewed application', async () => {
      const res = await request(app)
        .put(`/api/applications/${rejectAppId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Try again' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Application has already been reviewed');
    });

    it('should return 404 for non-existent application', async () => {
      const res = await request(app)
        .put('/api/applications/00000000-0000-0000-0000-000000000000/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Ghost app' });

      expect(res.status).toBe(404);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .put(`/api/applications/${rejectAppId}/reject`)
        .send({ reason: 'No auth' });

      expect(res.status).toBe(401);
    });

    it('should return 403 for non-admin', async () => {
      const res = await request(app)
        .put(`/api/applications/${rejectAppId}/reject`)
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({ reason: 'Not an admin' });

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // PUT /api/applications/:id/approve
  // ==========================================
  describe('PUT /api/applications/:id/approve', () => {
    it('should approve an application and create a user', async () => {
      // Use the testApplicationId created in POST tests
      const res = await request(app)
        .put(`/api/applications/${testApplicationId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'researcher' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('apptest-applicant@example.com');
      expect(res.body.user.name).toBe('Test Applicant');
      expect(res.body.user.role).toBe('researcher');
      expect(res.body.message).toContain('Application approved');
    });

    it('should not approve an already reviewed application', async () => {
      const res = await request(app)
        .put(`/api/applications/${testApplicationId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'viewer' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Application has already been reviewed');
    });

    it('should return 404 for non-existent application', async () => {
      const res = await request(app)
        .put('/api/applications/00000000-0000-0000-0000-000000000000/approve')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should approve with default role (viewer) when no role specified', async () => {
      // Create a fresh application
      const appRes = await request(app)
        .post('/api/applications')
        .send({
          name: 'Default Role Applicant',
          email: 'apptest-defaultrole@example.com',
          message: 'No role specified'
        });

      const res = await request(app)
        .put(`/api/applications/${appRes.body.application.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('viewer');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .put(`/api/applications/${testApplicationId}/approve`);

      expect(res.status).toBe(401);
    });

    it('should return 403 for non-admin', async () => {
      const res = await request(app)
        .put(`/api/applications/${testApplicationId}/approve`)
        .set('Authorization', `Bearer ${researcherToken}`);

      expect(res.status).toBe(403);
    });
  });
});
