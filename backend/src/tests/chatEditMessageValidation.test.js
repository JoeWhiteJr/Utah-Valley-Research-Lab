const request = require('supertest');
const { app } = require('../index');
const db = require('../config/database');
const { createTestUser } = require('./testHelper');

describe('PUT /api/chats/:roomId/messages/:messageId — edit validation & sanitization', () => {
  let authorUser, otherUser, roomId, messageId;

  beforeAll(async () => {
    await db.query('DELETE FROM users WHERE email LIKE $1', ['%chateditval%']);

    authorUser = await createTestUser({
      name: 'Edit Author',
      email: 'chateditval-author@example.com',
      password: 'password123',
      role: 'researcher'
    });

    otherUser = await createTestUser({
      name: 'Edit Other',
      email: 'chateditval-other@example.com',
      password: 'password123',
      role: 'researcher'
    });

    // Create a group room with both users so the author can post a message
    const roomRes = await request(app)
      .post('/api/chats')
      .set('Authorization', `Bearer ${authorUser.token}`)
      .send({
        type: 'group',
        name: 'Edit Validation Room',
        memberIds: [otherUser.id]
      });
    roomId = roomRes.body.room.id;

    // Author posts the message that will be edited across the suite
    const msgRes = await request(app)
      .post(`/api/chats/${roomId}/messages`)
      .set('Authorization', `Bearer ${authorUser.token}`)
      .send({ content: 'original message', type: 'text' });
    messageId = msgRes.body.message.id;
  });

  afterAll(async () => {
    await db.query('DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE room_id IN (SELECT id FROM chat_rooms WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1)))', ['%chateditval%']);
    await db.query('DELETE FROM messages WHERE room_id IN (SELECT id FROM chat_rooms WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1))', ['%chateditval%']);
    await db.query('DELETE FROM chat_members WHERE room_id IN (SELECT id FROM chat_rooms WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1))', ['%chateditval%']);
    await db.query('DELETE FROM chat_rooms WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1)', ['%chateditval%']);
    await db.query('DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%chateditval%']);
    await db.query('DELETE FROM users WHERE email LIKE $1', ['%chateditval%']);
  });

  it('rejects empty content with 400', async () => {
    const res = await request(app)
      .put(`/api/chats/${roomId}/messages/${messageId}`)
      .set('Authorization', `Bearer ${authorUser.token}`)
      .send({ content: '' });

    expect(res.status).toBe(400);
  });

  it('rejects whitespace-only content with 400', async () => {
    const res = await request(app)
      .put(`/api/chats/${roomId}/messages/${messageId}`)
      .set('Authorization', `Bearer ${authorUser.token}`)
      .send({ content: '   \n\t  ' });

    expect(res.status).toBe(400);
  });

  it('rejects content longer than 5000 chars with 400 (DoS guard)', async () => {
    const huge = 'a'.repeat(5001);
    const res = await request(app)
      .put(`/api/chats/${roomId}/messages/${messageId}`)
      .set('Authorization', `Bearer ${authorUser.token}`)
      .send({ content: huge });

    expect(res.status).toBe(400);
  });

  it('strips <script> tags from edited content (XSS bypass guard)', async () => {
    const dirty = 'safe text <script>alert("xss")</script> tail';
    const res = await request(app)
      .put(`/api/chats/${roomId}/messages/${messageId}`)
      .set('Authorization', `Bearer ${authorUser.token}`)
      .send({ content: dirty });

    expect(res.status).toBe(200);
    expect(res.body.message.content).not.toMatch(/<script>/i);
    expect(res.body.message.content).not.toMatch(/alert\("xss"\)/);

    // Confirm the persisted DB row is also sanitized
    const dbRow = await db.query('SELECT content FROM messages WHERE id = $1', [messageId]);
    expect(dbRow.rows[0].content).not.toMatch(/<script>/i);
  });

  it('accepts normal content with 200 and updates the message', async () => {
    const res = await request(app)
      .put(`/api/chats/${roomId}/messages/${messageId}`)
      .set('Authorization', `Bearer ${authorUser.token}`)
      .send({ content: 'edited cleanly' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(res.body.message.content).toBe('edited cleanly');
    expect(res.body.message.edited_at).not.toBeNull();
  });

  it('rejects edit by non-author with 403 (existing behavior preserved)', async () => {
    const res = await request(app)
      .put(`/api/chats/${roomId}/messages/${messageId}`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({ content: 'hijacked edit attempt' });

    expect(res.status).toBe(403);
  });
});
