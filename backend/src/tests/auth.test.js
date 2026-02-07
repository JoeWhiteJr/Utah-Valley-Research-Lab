const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('Auth API', () => {
  beforeAll(async () => {
    await db.query('DELETE FROM applications WHERE email LIKE $1', ['%authtest%']);
    await db.query('DELETE FROM users WHERE email LIKE $1', ['%authtest%']);
  });

  afterAll(async () => {
    await db.query('DELETE FROM applications WHERE email LIKE $1', ['%authtest%']);
    await db.query('DELETE FROM users WHERE email LIKE $1', ['%authtest%']);
  });

  describe('POST /api/auth/register', () => {
    it('should return 403 because registration is disabled', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'authtest@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(403);
      expect(res.body).not.toHaveProperty('token');
    });
  });

  describe('POST /api/auth/login', () => {
    let _loginUser;

    beforeAll(async () => {
      _loginUser = await createTestUser({
        name: 'Auth Login User',
        email: 'authtest-login@example.com',
        password: 'password123'
      });
    });

    it('should login existing user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'authtest-login@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('authtest-login@example.com');
      expect(res.body).toHaveProperty('token');
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'authtest-login@example.com',
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(401);
    });

  });

  describe('GET /api/auth/me', () => {
    let token;

    beforeAll(async () => {
      const user = await createTestUser({
        name: 'Auth Me User',
        email: 'authtest-me@example.com',
        password: 'password123'
      });
      token = user.token;
    });

    it('should return current user', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('authtest-me@example.com');
    });

    it('should reject without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });
});
