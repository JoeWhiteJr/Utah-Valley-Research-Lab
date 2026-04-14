const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('Users API — Edge Cases', () => {
  let adminToken;
  let adminUserId;
  let regularToken;
  let regularUserId;
  let otherUser;

  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%edgetest%'");

    // Admin user (super admin so role changes work)
    const admin = await createTestUser({
      name: 'Edge Admin User',
      email: 'edgetest-users-admin@example.com',
      role: 'admin'
    });
    adminToken = admin.token;
    adminUserId = admin.id;
    await db.query('UPDATE users SET is_super_admin = true WHERE id = $1', [adminUserId]);

    // Regular researcher
    const regular = await createTestUser({
      name: 'Edge Regular User',
      email: 'edgetest-users-regular@example.com',
      role: 'researcher',
      password: 'password123'
    });
    regularToken = regular.token;
    regularUserId = regular.id;

    // A second regular user to test cross-user access
    otherUser = await createTestUser({
      name: 'Edge Other User',
      email: 'edgetest-users-other@example.com',
      role: 'researcher'
    });
  });

  afterAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%edgetest%'");
  });

  // ─── GET /api/users — pagination edge cases ───────────────────────────────

  describe('GET /api/users — pagination edge cases', () => {
    it('should handle offset of 0 gracefully', async () => {
      const res = await request(app)
        .get('/api/users?offset=0&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    it('should handle a very large offset (returns empty array, not error)', async () => {
      const res = await request(app)
        .get('/api/users?offset=999999&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users.length).toBe(0);
    });

    it('should cap limit at the server maximum (200) rather than error', async () => {
      const res = await request(app)
        .get('/api/users?limit=99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.limit).toBeLessThanOrEqual(200);
    });

    it('should treat negative offset as 0 or return 400, not crash', async () => {
      const res = await request(app)
        .get('/api/users?offset=-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 400]).toContain(res.status);
    });

    it('should treat negative limit as default or return 400, not crash', async () => {
      const res = await request(app)
        .get('/api/users?limit=-5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 400]).toContain(res.status);
    });
  });

  // ─── GET /api/users/:id — ID format edge cases ───────────────────────────

  describe('GET /api/users/:id — ID format edge cases', () => {
    it('should return 404 (not 500) for a non-UUID string as user ID', async () => {
      const res = await request(app)
        .get('/api/users/not-a-valid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      // Must not crash — 400 or 404 both acceptable; never 500
      expect([400, 404]).toContain(res.status);
    });

    it('should return 404 for a numeric ID instead of UUID', async () => {
      const res = await request(app)
        .get('/api/users/12345')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([400, 404]).toContain(res.status);
    });

    it('should return 401 when fetching a user profile without auth', async () => {
      const res = await request(app)
        .get(`/api/users/${otherUser.id}`);

      expect(res.status).toBe(401);
    });

    it('should allow a regular user to fetch another user by ID (public team data)', async () => {
      // The route is authenticate-only (not admin-only)
      const res = await request(app)
        .get(`/api/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      // Must not expose password_hash
      expect(res.body.user).not.toHaveProperty('password_hash');
    });
  });

  // ─── PUT /api/users/profile — injection and XSS ───────────────────────────

  describe('PUT /api/users/profile — injection and XSS edge cases', () => {
    it('should sanitize or reject XSS payload in firstName', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ firstName: "<script>alert('xss')</script>" });

      // Either strip/store as-is (and never execute) or reject as invalid
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.user.name).not.toMatch(/<script>/i);
      }
    });

    it('should not treat SQL injection in firstName as a query error', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ firstName: "Robert'); DROP TABLE users; --" });

      // Parameterized queries prevent actual injection; must not 500
      expect(res.status).not.toBe(500);
    });

    it('should reject a very large request body gracefully', async () => {
      const hugePayload = { firstName: 'A'.repeat(100_000) };
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(hugePayload);

      // Should reject as too large or as validation failure; never 500
      expect([400, 413]).toContain(res.status);
    });

    it('should accept unicode and emoji in name fields', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ firstName: 'Jörg', lastName: 'Müller' });

      // Unicode names are valid — should succeed
      expect(res.status).toBe(200);
    });

    it('should reject whitespace-only firstName', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ firstName: '   ' });

      expect(res.status).toBe(400);
    });

    it('should reject an email with SQL injection characters', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ email: "' OR 1=1 --@example.com" });

      expect([400, 409]).toContain(res.status);
    });

    it('should reject update with XSS payload in lastName', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ lastName: '<img src=x onerror=alert(1)>' });

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.user.name).not.toMatch(/<img/i);
      }
    });
  });

  // ─── PUT /api/users/profile — duplicate email ─────────────────────────────

  describe('PUT /api/users/profile — duplicate email on update', () => {
    it('should return 409 when changing email to one owned by another user', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ email: 'edgetest-users-other@example.com' });

      expect(res.status).toBe(409);
    });

    it('should allow updating to the same email the user already owns', async () => {
      // Restore to known email first
      await db.query('UPDATE users SET email = $1 WHERE id = $2', [
        'edgetest-users-regular@example.com',
        regularUserId
      ]);

      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ email: 'edgetest-users-regular@example.com' });

      expect(res.status).toBe(200);
    });

    it('should reject an invalid email format on update', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ email: 'not@@valid' });

      expect(res.status).toBe(400);
    });
  });

  // ─── PUT /api/users/password — boundary values ────────────────────────────

  describe('PUT /api/users/password — boundary values', () => {
    it('should reject a new password of exactly 7 characters (below min)', async () => {
      const res = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ currentPassword: 'password123', newPassword: 'short12' });

      expect(res.status).toBe(400);
    });

    it('should accept a new password of exactly 8 characters (at min boundary)', async () => {
      const newPass = 'Exact8Ch';

      const res = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ currentPassword: 'password123', newPassword: newPass });

      expect(res.status).toBe(200);

      // Restore back to known password
      await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ currentPassword: newPass, newPassword: 'password123' });
    });

    it('should reject an empty string as new password', async () => {
      const res = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ currentPassword: 'password123', newPassword: '' });

      expect(res.status).toBe(400);
    });

    it('should reject missing newPassword field', async () => {
      const res = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ currentPassword: 'password123' });

      expect(res.status).toBe(400);
    });

    it('should reject a very long new password without crashing', async () => {
      // bcrypt truncates at 72 bytes; server should handle gracefully
      const res = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ currentPassword: 'password123', newPassword: 'A'.repeat(1001) });

      // Could succeed (stored truncated) or be rejected, but must never 500
      expect(res.status).not.toBe(500);
    });
  });

  // ─── PUT /api/users/:id/role — role escalation attempts ──────────────────

  describe('PUT /api/users/:id/role — role escalation edge cases', () => {
    it('should reject a non-admin attempting to promote themselves to admin', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(403);
    });

    it('should reject a non-admin attempting to change another user role', async () => {
      const res = await request(app)
        .put(`/api/users/${otherUser.id}/role`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ role: 'viewer' });

      expect(res.status).toBe(403);
    });

    it('should reject a completely unknown role string', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'superuser' });

      expect(res.status).toBe(400);
    });

    it('should reject a role that is a number instead of a string', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 1 });

      expect(res.status).toBe(400);
    });

    it('should return 404 for a non-UUID user ID in role update', async () => {
      const res = await request(app)
        .put('/api/users/not-a-uuid/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'researcher' });

      expect([400, 404]).toContain(res.status);
    });

    it('should reject role update when role field is missing from body', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE /api/users/:id — edge cases ──────────────────────────────────

  describe('DELETE /api/users/:id — edge cases', () => {
    it('should return 404 for a non-UUID user ID in delete', async () => {
      const res = await request(app)
        .delete('/api/users/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([400, 404]).toContain(res.status);
    });

    it('should reject unauthenticated delete attempt', async () => {
      const res = await request(app)
        .delete(`/api/users/${otherUser.id}`);

      expect(res.status).toBe(401);
    });

    it('should reject a non-admin trying to delete any user', async () => {
      const victim = await createTestUser({
        name: 'Edge Delete Victim',
        email: 'edgetest-users-victim@example.com',
        role: 'researcher'
      });

      const res = await request(app)
        .delete(`/api/users/${victim.id}`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
    });

    it('should perform soft delete (user not returned by GET after deletion)', async () => {
      const toDelete = await createTestUser({
        name: 'Edge Soft Delete User',
        email: 'edgetest-users-softdelete@example.com',
        role: 'researcher'
      });

      const delRes = await request(app)
        .delete(`/api/users/${toDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delRes.status).toBe(200);

      // Should no longer appear in user lookup
      const getRes = await request(app)
        .get(`/api/users/${toDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });

    it('should return 404 when deleting an already-deleted user', async () => {
      const toDelete = await createTestUser({
        name: 'Edge Double Delete User',
        email: 'edgetest-users-doubledelete@example.com',
        role: 'researcher'
      });

      // First delete
      await request(app)
        .delete(`/api/users/${toDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Second delete attempt
      const res = await request(app)
        .delete(`/api/users/${toDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/users/team — edge cases ────────────────────────────────────

  describe('GET /api/users/team — edge cases', () => {
    it('should never include password_hash in team list', async () => {
      const res = await request(app)
        .get('/api/users/team')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      res.body.users.forEach(u => {
        expect(u).not.toHaveProperty('password_hash');
      });
    });

    it('should handle a very large limit parameter without crashing', async () => {
      const res = await request(app)
        .get('/api/users/team?limit=10000')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.limit).toBeLessThanOrEqual(200);
    });

    it('should reject unauthenticated requests to team endpoint', async () => {
      const res = await request(app)
        .get('/api/users/team');

      expect(res.status).toBe(401);
    });
  });
});
