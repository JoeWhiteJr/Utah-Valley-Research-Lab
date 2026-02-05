const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');

describe('Users API', () => {
  let adminToken;
  let adminUserId;
  let regularToken;
  let regularUserId;

  beforeAll(async () => {
    // Clean up test data
    await db.query("DELETE FROM users WHERE email LIKE '%usertest%'");

    // Create admin user
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin User Test',
        email: 'usertest-admin@example.com',
        password: 'password123'
      });

    adminToken = adminRes.body.token;
    adminUserId = adminRes.body.user.id;
    await db.query("UPDATE users SET role = 'admin' WHERE id = $1", [adminUserId]);

    // Create regular user
    const regularRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Regular User Test',
        email: 'usertest-regular@example.com',
        password: 'password123'
      });

    regularToken = regularRes.body.token;
    regularUserId = regularRes.body.user.id;
  });

  afterAll(async () => {
    await db.query("DELETE FROM users WHERE email LIKE '%usertest%'");
  });

  describe('GET /api/users', () => {
    it('should list all users when admin', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users.length).toBeGreaterThan(0);
    });

    it('should not include password_hash in response', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.users.forEach(user => {
        expect(user).not.toHaveProperty('password_hash');
      });
    });

    it('should reject non-admin users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/users/team', () => {
    it('should list team members for any authenticated user', async () => {
      const res = await request(app)
        .get('/api/users/team')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    it('should include id, name, and role', async () => {
      const res = await request(app)
        .get('/api/users/team')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.users[0]).toHaveProperty('id');
      expect(res.body.users[0]).toHaveProperty('name');
      expect(res.body.users[0]).toHaveProperty('role');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .get('/api/users/team');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should get user by ID', async () => {
      const res = await request(app)
        .get(`/api/users/${regularUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(regularUserId);
      expect(res.body.user.name).toBe('Regular User Test');
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update user name', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Updated Name Test'
        });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Updated Name Test');
    });

    it('should update user email', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          email: 'usertest-updated@example.com'
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('usertest-updated@example.com');

      // Revert email for other tests
      await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ email: 'usertest-regular@example.com' });
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          email: 'usertest-admin@example.com'
        });

      expect(res.status).toBe(409);
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          email: 'invalid-email'
        });

      expect(res.status).toBe(400);
    });

    it('should reject empty name', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: '   '
        });

      expect(res.status).toBe(400);
    });

    it('should reject update with no fields', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/users/password', () => {
    it('should change password with correct current password', async () => {
      const res = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword456'
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Password updated successfully');

      // Verify new password works
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'usertest-regular@example.com',
          password: 'newpassword456'
        });

      expect(loginRes.status).toBe(200);
      regularToken = loginRes.body.token;
    });

    it('should reject wrong current password', async () => {
      const res = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword789'
        });

      expect(res.status).toBe(401);
    });

    it('should reject short new password', async () => {
      const res = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          currentPassword: 'newpassword456',
          newPassword: 'short'
        });

      expect(res.status).toBe(400);
    });

    it('should reject missing current password', async () => {
      const res = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          newPassword: 'newpassword789'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/users/:id/role', () => {
    it('should update user role when admin', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'project_lead'
        });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('project_lead');
    });

    it('should allow all valid roles', async () => {
      const roles = ['admin', 'project_lead', 'researcher', 'viewer'];

      for (const role of roles) {
        const res = await request(app)
          .put(`/api/users/${regularUserId}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role });

        expect(res.status).toBe(200);
        expect(res.body.user.role).toBe(role);
      }
    });

    it('should reject invalid role', async () => {
      const res = await request(app)
        .put(`/api/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'invalid_role'
        });

      expect(res.status).toBe(400);
    });

    it('should reject non-admin users', async () => {
      // Reset regular user to non-admin role
      await db.query("UPDATE users SET role = 'researcher' WHERE id = $1", [regularUserId]);

      const res = await request(app)
        .put(`/api/users/${adminUserId}/role`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          role: 'viewer'
        });

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .put('/api/users/00000000-0000-0000-0000-000000000000/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'researcher'
        });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/users/:id', () => {
    let userToDeleteId;
    let userToDeleteToken;

    beforeAll(async () => {
      // Create a user to delete
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'User To Delete',
          email: 'usertest-delete@example.com',
          password: 'password123'
        });
      userToDeleteId = res.body.user.id;
      userToDeleteToken = res.body.token;
    });

    it('should not allow self-deletion', async () => {
      const res = await request(app)
        .delete(`/api/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Cannot delete your own account');
    });

    it('should reject non-admin users', async () => {
      const res = await request(app)
        .delete(`/api/users/${userToDeleteId}`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
    });

    it('should delete user when admin', async () => {
      const res = await request(app)
        .delete(`/api/users/${userToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User deleted successfully');
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .delete('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should verify user is actually deleted', async () => {
      const res = await request(app)
        .get(`/api/users/${userToDeleteId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
