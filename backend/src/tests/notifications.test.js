const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('Notifications API', () => {
  let userToken;
  let userId;
  let otherUserToken;
  let otherUserId;
  let notificationId;
  let notificationId2;
  let notificationId3;

  beforeAll(async () => {
    // Clean up leftover test data
    await db.query("DELETE FROM users WHERE email LIKE '%notiftest%'");

    // Create test user
    const user = await createTestUser({
      name: 'Notif Test User',
      email: 'notiftest-user@example.com',
      role: 'researcher'
    });
    userToken = user.token;
    userId = user.id;

    // Create another user (to test isolation)
    const otherUser = await createTestUser({
      name: 'Notif Other User',
      email: 'notiftest-other@example.com',
      role: 'researcher'
    });
    otherUserToken = otherUser.token;
    otherUserId = otherUser.id;

    // Seed some notifications for the test user
    const n1 = await db.query(
      `INSERT INTO notifications (user_id, type, title, body)
       VALUES ($1, 'info', 'Test Notification 1', 'First notification body')
       RETURNING id`,
      [userId]
    );
    notificationId = n1.rows[0].id;

    const n2 = await db.query(
      `INSERT INTO notifications (user_id, type, title, body)
       VALUES ($1, 'info', 'Test Notification 2', 'Second notification body')
       RETURNING id`,
      [userId]
    );
    notificationId2 = n2.rows[0].id;

    const n3 = await db.query(
      `INSERT INTO notifications (user_id, type, title, body)
       VALUES ($1, 'info', 'Test Notification 3', 'Third notification body')
       RETURNING id`,
      [userId]
    );
    notificationId3 = n3.rows[0].id;

    // Seed a notification for the other user
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body)
       VALUES ($1, 'info', 'Other User Notification', 'Should not be visible to test user')`,
      [otherUserId]
    );
  });

  afterAll(async () => {
    await db.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%notiftest%')");
    await db.query("DELETE FROM users WHERE email LIKE '%notiftest%'");
  });

  // ==========================================
  // GET /api/notifications - List notifications
  // ==========================================
  describe('GET /api/notifications', () => {
    it('should list user notifications', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('notifications');
      expect(Array.isArray(res.body.notifications)).toBe(true);
      expect(res.body.notifications.length).toBeGreaterThanOrEqual(3);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('offset');

      // Verify the notifications belong to the user
      res.body.notifications.forEach(n => {
        expect(n.user_id).toBe(userId);
      });
    });

    it('should not show other user notifications', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      const titles = res.body.notifications.map(n => n.title);
      expect(titles).not.toContain('Other User Notification');
    });

    it('should support pagination with limit and offset', async () => {
      const res = await request(app)
        .get('/api/notifications?limit=1&offset=0')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications.length).toBe(1);
      expect(res.body.limit).toBe(1);
      expect(res.body.offset).toBe(0);
    });

    it('should filter unread only', async () => {
      // First, mark one as read
      await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${userToken}`);

      const res = await request(app)
        .get('/api/notifications?unread_only=true')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      res.body.notifications.forEach(n => {
        expect(n.read_at).toBeNull();
      });
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .get('/api/notifications');

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // GET /api/notifications/unread-count
  // ==========================================
  describe('GET /api/notifications/unread-count', () => {
    it('should return unread count', async () => {
      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('count');
      expect(typeof res.body.count).toBe('number');
      expect(res.body.count).toBeGreaterThanOrEqual(0);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .get('/api/notifications/unread-count');

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // PUT /api/notifications/:id/read - Mark as read
  // ==========================================
  describe('PUT /api/notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      const res = await request(app)
        .put(`/api/notifications/${notificationId2}/read`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('notification');
      expect(res.body.notification.id).toBe(notificationId2);
      expect(res.body.notification.read_at).not.toBeNull();
    });

    it('should return 404 for non-existent notification', async () => {
      const res = await request(app)
        .put('/api/notifications/00000000-0000-0000-0000-000000000000/read')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Notification not found');
    });

    it('should return 404 when trying to mark another user notification', async () => {
      // notificationId belongs to userId; try with otherUserToken
      // The query filters by user_id, so it appears as "not found"
      const otherNotif = await db.query(
        `SELECT id FROM notifications WHERE user_id = $1 LIMIT 1`,
        [otherUserId]
      );
      const otherNotifId = otherNotif.rows[0].id;

      const res = await request(app)
        .put(`/api/notifications/${otherNotifId}/read`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .put(`/api/notifications/${notificationId2}/read`);

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // PUT /api/notifications/read-all - Mark all read
  // ==========================================
  describe('PUT /api/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('All notifications marked as read');
      expect(res.body).toHaveProperty('count');
      expect(typeof res.body.count).toBe('number');

      // Verify all are read
      const unreadRes = await request(app)
        .get('/api/notifications?unread_only=true')
        .set('Authorization', `Bearer ${userToken}`);

      expect(unreadRes.body.notifications.length).toBe(0);
    });

    it('should return count of 0 if all already read', async () => {
      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });

    it('should not affect other user notifications', async () => {
      // Verify other user still has unread notifications
      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThan(0);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .put('/api/notifications/read-all');

      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // DELETE /api/notifications/:id
  // ==========================================
  describe('DELETE /api/notifications/:id', () => {
    it('should delete a notification', async () => {
      const res = await request(app)
        .delete(`/api/notifications/${notificationId3}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Notification deleted');
    });

    it('should return 404 for non-existent notification', async () => {
      const res = await request(app)
        .delete('/api/notifications/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Notification not found');
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .delete(`/api/notifications/${notificationId}`);

      expect(res.status).toBe(401);
    });
  });
});
