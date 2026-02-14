const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('Chats API', () => {
  let adminUser, memberUser, roomId, messageId;

  beforeAll(async () => {
    await db.query('DELETE FROM users WHERE email LIKE $1', ['%chattest%']);

    adminUser = await createTestUser({
      name: 'Chat Admin',
      email: 'chattest-admin@example.com',
      password: 'password123',
      role: 'admin'
    });

    memberUser = await createTestUser({
      name: 'Chat Member',
      email: 'chattest-member@example.com',
      password: 'password123',
      role: 'researcher'
    });
  });

  afterAll(async () => {
    await db.query('DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE room_id IN (SELECT id FROM chat_rooms WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1)))', ['%chattest%']);
    await db.query('DELETE FROM messages WHERE room_id IN (SELECT id FROM chat_rooms WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1))', ['%chattest%']);
    await db.query('DELETE FROM chat_members WHERE room_id IN (SELECT id FROM chat_rooms WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1))', ['%chattest%']);
    await db.query('DELETE FROM chat_rooms WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1)', ['%chattest%']);
    await db.query('DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%chattest%']);
    await db.query('DELETE FROM users WHERE email LIKE $1', ['%chattest%']);
  });

  describe('POST /api/chats (create room)', () => {
    it('should create a group chat room as admin', async () => {
      const res = await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          type: 'group',
          name: 'Test Group Chat',
          memberIds: [memberUser.id]
        });

      expect(res.status).toBe(201);
      expect(res.body.room).toBeDefined();
      expect(res.body.room.name).toBe('Test Group Chat');
      expect(res.body.room.type).toBe('group');
      expect(res.body.room.members).toHaveLength(2);
      roomId = res.body.room.id;
    });

    it('should allow non-admin to create group chat', async () => {
      const res = await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${memberUser.token}`)
        .send({
          type: 'group',
          name: 'Member Created Chat',
          memberIds: [adminUser.id]
        });

      expect(res.status).toBe(201);
      expect(res.body.room).toBeDefined();
      expect(res.body.room.name).toBe('Member Created Chat');
      expect(res.body.room.type).toBe('group');
    });

    it('should reject invalid data', async () => {
      const res = await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          type: 'invalid',
          memberIds: []
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/chats (list rooms)', () => {
    it('should list rooms for admin', async () => {
      const res = await request(app)
        .get('/api/chats')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.rooms).toBeDefined();
      expect(Array.isArray(res.body.rooms)).toBe(true);
      const testRoom = res.body.rooms.find(r => r.id === roomId);
      expect(testRoom).toBeDefined();
    });

    it('should list rooms for member', async () => {
      const res = await request(app)
        .get('/api/chats')
        .set('Authorization', `Bearer ${memberUser.token}`);

      expect(res.status).toBe(200);
      const testRoom = res.body.rooms.find(r => r.id === roomId);
      expect(testRoom).toBeDefined();
    });
  });

  describe('GET /api/chats/:id (get room)', () => {
    it('should get room details', async () => {
      const res = await request(app)
        .get(`/api/chats/${roomId}`)
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.room.id).toBe(roomId);
      expect(res.body.room.members).toBeDefined();
    });
  });

  describe('POST /api/chats/:id/messages (send message)', () => {
    it('should send a text message', async () => {
      const res = await request(app)
        .post(`/api/chats/${roomId}/messages`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          content: 'Hello from test!',
          type: 'text'
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBeDefined();
      expect(res.body.message.content).toBe('Hello from test!');
      expect(res.body.message.type).toBe('text');
      expect(res.body.message.sender_name).toBe('Chat Admin');
      messageId = res.body.message.id;
    });

    it('should send a file message', async () => {
      const res = await request(app)
        .post(`/api/chats/${roomId}/messages`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          content: 'test-file.pdf',
          type: 'file',
          file_url: '/uploads/chat/test-uuid.pdf',
          file_name: 'test-file.pdf'
        });

      expect(res.status).toBe(201);
      expect(res.body.message.type).toBe('file');
      expect(res.body.message.file_url).toBe('/uploads/chat/test-uuid.pdf');
    });

    it('should reject empty content', async () => {
      const res = await request(app)
        .post(`/api/chats/${roomId}/messages`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({
          content: '',
          type: 'text'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/chats/:id/messages (get messages)', () => {
    it('should get messages with reactions', async () => {
      const res = await request(app)
        .get(`/api/chats/${roomId}/messages`)
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toBeDefined();
      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(res.body.messages.length).toBeGreaterThan(0);
      expect(res.body.messages[0]).toHaveProperty('reactions');
      expect(Array.isArray(res.body.messages[0].reactions)).toBe(true);
    });
  });

  describe('POST /api/chats/:id/messages/:messageId/reactions (toggle reaction)', () => {
    it('should add a reaction', async () => {
      const res = await request(app)
        .post(`/api/chats/${roomId}/messages/${messageId}/reactions`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ emoji: '\u{1F44D}' });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('added');
      expect(res.body.reactions).toBeDefined();
      expect(res.body.reactions.length).toBe(1);
      expect(res.body.reactions[0].emoji).toBe('\u{1F44D}');
    });

    it('should remove the reaction when toggled again', async () => {
      const res = await request(app)
        .post(`/api/chats/${roomId}/messages/${messageId}/reactions`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ emoji: '\u{1F44D}' });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('removed');
      expect(res.body.reactions).toHaveLength(0);
    });

    it('should allow different users to react', async () => {
      await request(app)
        .post(`/api/chats/${roomId}/messages/${messageId}/reactions`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({ emoji: '\u{2764}' });

      const res = await request(app)
        .post(`/api/chats/${roomId}/messages/${messageId}/reactions`)
        .set('Authorization', `Bearer ${memberUser.token}`)
        .send({ emoji: '\u{2764}' });

      expect(res.status).toBe(200);
      expect(res.body.reactions).toHaveLength(2);
    });
  });

  describe('GET /api/chats/:id/messages/:messageId/reactions', () => {
    it('should get reactions for a message', async () => {
      const res = await request(app)
        .get(`/api/chats/${roomId}/messages/${messageId}/reactions`)
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.reactions).toBeDefined();
      expect(Array.isArray(res.body.reactions)).toBe(true);
    });
  });

  describe('DELETE /api/chats/:id/messages/:messageId (delete message)', () => {
    it('should soft delete own message', async () => {
      const res = await request(app)
        .delete(`/api/chats/${roomId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent message', async () => {
      const res = await request(app)
        .delete(`/api/chats/${roomId}/messages/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/chats/:id/read (mark as read)', () => {
    it('should mark room as read', async () => {
      const res = await request(app)
        .put(`/api/chats/${roomId}/read`)
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Access control', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .get('/api/chats');

      expect(res.status).toBe(401);
    });
  });
});
