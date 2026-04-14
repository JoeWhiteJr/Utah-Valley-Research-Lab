const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('Auth API — Edge Cases', () => {
  beforeAll(async () => {
    await db.query('DELETE FROM applications WHERE email LIKE $1', ['%edgetest%']);
    await db.query('DELETE FROM users WHERE email LIKE $1', ['%edgetest%']);
  });

  afterAll(async () => {
    await db.query('DELETE FROM applications WHERE email LIKE $1', ['%edgetest%']);
    await db.query('DELETE FROM users WHERE email LIKE $1', ['%edgetest%']);
  });

  // ─── POST /api/auth/register ──────────────────────────────────────────────

  describe('POST /api/auth/register — edge cases', () => {
    it('should always return 403 even with SQL injection payload in email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Injector',
          email: "' OR 1=1 --",
          password: 'password123'
        });

      expect(res.status).toBe(403);
      expect(res.body).not.toHaveProperty('token');
    });

    it('should always return 403 even with XSS payload in name', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: "<script>alert('xss')</script>",
          email: 'edgetest-xss@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(403);
      expect(res.body).not.toHaveProperty('token');
    });

    it('should always return 403 even with empty body', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(res.status).toBe(403);
    });
  });

  // ─── POST /api/auth/login — input validation edge cases ───────────────────

  describe('POST /api/auth/login — input validation edge cases', () => {
    let edgeLoginUser;

    beforeAll(async () => {
      edgeLoginUser = await createTestUser({
        name: 'Edge Login User',
        email: 'edgetest-login@example.com',
        password: 'password123'
      });
    });

    it('should reject SQL injection in email field', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: "' OR 1=1 --",
          password: 'password123'
        });

      // express-validator rejects the malformed email as 400
      expect([400, 401]).toContain(res.status);
      expect(res.body).not.toHaveProperty('token');
    });

    it('should reject a very long email (> 255 chars)', async () => {
      const longEmail = `${'a'.repeat(250)}@example.com`;
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: longEmail, password: 'password123' });

      expect([400, 401]).toContain(res.status);
      expect(res.body).not.toHaveProperty('token');
    });

    it('should reject a very long password (> 1000 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'edgetest-login@example.com',
          password: 'A'.repeat(1001)
        });

      expect(res.status).toBe(401);
      expect(res.body).not.toHaveProperty('token');
    });

    it('should reject email with no @ symbol', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'notanemail', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body).not.toHaveProperty('token');
    });

    it('should reject email with double @ symbol', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@@example.com', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body).not.toHaveProperty('token');
    });

    it('should reject email with spaces', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user @example.com', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body).not.toHaveProperty('token');
    });

    it('should reject empty string for email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: '', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body).not.toHaveProperty('token');
    });

    it('should reject empty string for password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'edgetest-login@example.com', password: '' });

      expect(res.status).toBe(400);
      expect(res.body).not.toHaveProperty('token');
    });

    it('should reject whitespace-only password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'edgetest-login@example.com', password: '   ' });

      expect(res.status).toBe(401);
      expect(res.body).not.toHaveProperty('token');
    });

    it('should reject missing email field entirely', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body).not.toHaveProperty('token');
    });

    it('should reject missing password field entirely', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'edgetest-login@example.com' });

      expect(res.status).toBe(400);
      expect(res.body).not.toHaveProperty('token');
    });

    it('should handle malformed JSON body gracefully', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ bad json }');

      // Express should return 400 for malformed JSON
      expect(res.status).toBe(400);
    });

    it('should be case-insensitive for email (normalised at login)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'EDGETEST-LOGIN@EXAMPLE.COM',
          password: 'password123'
        });

      // express-validator normalizeEmail lowercases the input — should match
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    it('should not reveal whether the account exists on wrong password', async () => {
      const resKnown = await request(app)
        .post('/api/auth/login')
        .send({ email: 'edgetest-login@example.com', password: 'wrongpassword' });

      const resUnknown = await request(app)
        .post('/api/auth/login')
        .send({ email: 'edgetest-ghost@example.com', password: 'wrongpassword' });

      expect(resKnown.status).toBe(401);
      expect(resUnknown.status).toBe(401);
      // Both should return the same generic message
      expect(resKnown.body.error.message).toBe(resUnknown.body.error.message);
    });

    it('should reject login with unicode/emoji as password when it does not match', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'edgetest-login@example.com', password: '🔑🔑🔑emoji' });

      expect(res.status).toBe(401);
      expect(res.body).not.toHaveProperty('token');
    });
  });

  // ─── GET /api/auth/me — JWT edge cases ───────────────────────────────────

  describe('GET /api/auth/me — JWT edge cases', () => {
    let validUser;

    beforeAll(async () => {
      validUser = await createTestUser({
        name: 'Edge Me User',
        email: 'edgetest-me@example.com',
        password: 'password123'
      });
    });

    it('should reject an expired JWT token', async () => {
      const expiredToken = jwt.sign(
        { userId: validUser.id },
        process.env.JWT_SECRET,
        { expiresIn: '-1s' } // already expired
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it('should reject a JWT signed with the wrong secret', async () => {
      const badToken = jwt.sign(
        { userId: validUser.id },
        'totally-wrong-secret',
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${badToken}`);

      expect(res.status).toBe(401);
    });

    it('should reject a JWT with a tampered payload', async () => {
      const [header, , signature] = validUser.token.split('.');
      const tamperedPayload = Buffer.from(
        JSON.stringify({ userId: '00000000-0000-0000-0000-000000000000', role: 'admin' })
      ).toString('base64url');
      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
    });

    it('should reject a completely random string as token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer this-is-not-a-jwt-at-all');

      expect(res.status).toBe(401);
    });

    it('should reject an Authorization header missing the Bearer prefix', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', validUser.token); // no "Bearer " prefix

      expect(res.status).toBe(401);
    });

    it('should reject an empty Authorization header value', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', '');

      expect(res.status).toBe(401);
    });

    it('should reject a JWT whose userId points to a deleted/non-existent user', async () => {
      const ghostToken = jwt.sign(
        { userId: '00000000-0000-0000-0000-000000000000' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${ghostToken}`);

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/auth/logout ────────────────────────────────────────────────

  describe('POST /api/auth/logout — token blocklist edge cases', () => {
    it('should logout successfully and then reject the same token on /me', async () => {
      const user = await createTestUser({
        name: 'Edge Logout User',
        email: 'edgetest-logout@example.com',
        password: 'password123'
      });

      // Confirm the token works first
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.token}`);
      expect(meRes.status).toBe(200);

      // Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${user.token}`);
      expect(logoutRes.status).toBe(200);

      // Reusing the same token should now fail (blocklisted)
      const replayRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.token}`);
      expect(replayRes.status).toBe(401);
    });

    it('should reject logout without any token', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/auth/forgot-password ───────────────────────────────────────

  describe('POST /api/auth/forgot-password — edge cases', () => {
    it('should return 200 for a non-existent email (prevent enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'edgetest-ghost-user@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/if an account exists/i);
    });

    it('should return 400 for an invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when email field is missing', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 200 for a valid existing email (prevents enumeration even on success)', async () => {
      const user = await createTestUser({
        name: 'Edge Forgot User',
        email: 'edgetest-forgot@example.com',
        password: 'password123'
      });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: user.email });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/if an account exists/i);
    });
  });

  // ─── POST /api/auth/reset-password ────────────────────────────────────────

  describe('POST /api/auth/reset-password — edge cases', () => {
    it('should reject a password that is too short (< 8 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'sometoken', password: 'short' });

      expect(res.status).toBe(400);
    });

    it('should reject reset with an invalid/expired token even if password is valid', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'invalidtoken00000000', password: 'validpassword123' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/invalid or expired/i);
    });

    it('should reject reset when token field is missing', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ password: 'validpassword123' });

      expect(res.status).toBe(400);
    });

    it('should reject reset when password field is missing', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'sometoken' });

      expect(res.status).toBe(400);
    });
  });
});
