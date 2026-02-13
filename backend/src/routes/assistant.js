const express = require('express');
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, requireRole } = require('../middleware/auth');
const ragQueryService = require('../services/ragQueryService');
const { indexFile } = require('../services/ragIndexingService');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/assistant/status — Check Claude availability
router.get('/status', async (req, res, next) => {
  try {
    const claudeAvailable = !!ragQueryService.getClient();

    let dbAvailable = false;
    try {
      await db.query('SELECT 1');
      dbAvailable = true;
    } catch {
      // db not available
    }

    res.json({
      available: claudeAvailable && dbAvailable,
      claude: claudeAvailable,
      database: dbAvailable,
      message: !claudeAvailable
        ? 'Anthropic API key not configured'
        : !dbAvailable
          ? 'Database not available'
          : 'AI Assistant is ready'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/assistant/conversations — Create new conversation
router.post('/conversations', async (req, res, next) => {
  try {
    const { projectId, title } = req.body;

    const result = await db.query(
      `INSERT INTO ai_conversations (user_id, project_id, title)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, projectId || null, title || 'New Conversation']
    );

    res.status(201).json({ conversation: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/assistant/conversations — List user's conversations
router.get('/conversations', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT c.*, p.title as project_title,
              (SELECT content FROM ai_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM ai_conversations c
       LEFT JOIN projects p ON c.project_id = p.id
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC`,
      [req.user.id]
    );

    res.json({ conversations: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/assistant/conversations/:id — Get conversation with messages
router.get('/conversations/:id', async (req, res, next) => {
  try {
    const convResult = await db.query(
      `SELECT c.*, p.title as project_title
       FROM ai_conversations c
       LEFT JOIN projects p ON c.project_id = p.id
       WHERE c.id = $1 AND c.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Conversation not found' } });
    }

    const messagesResult = await db.query(
      'SELECT * FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json({
      conversation: convResult.rows[0],
      messages: messagesResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/assistant/conversations/:id — Delete conversation
router.delete('/conversations/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      'DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Conversation not found' } });
    }

    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    next(error);
  }
});

// POST /api/assistant/conversations/:id/messages — Send message → RAG → Claude → response
router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: { message: 'Message is required' } });
    }

    // Verify conversation ownership
    const convResult = await db.query(
      'SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Conversation not found' } });
    }

    const conversation = convResult.rows[0];

    // Save user message
    await db.query(
      'INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [req.params.id, 'user', message.trim()]
    );

    // Get conversation history
    const historyResult = await db.query(
      'SELECT role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    // Exclude the message we just inserted (it'll be passed as the question)
    const history = historyResult.rows.slice(0, -1);

    // RAG query
    const response = await ragQueryService.query(
      message.trim(),
      history,
      req.user.id,
      req.user.role,
      conversation.project_id
    );

    // Save assistant response
    const msgResult = await db.query(
      `INSERT INTO ai_messages (conversation_id, role, content, citations, token_usage)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, 'assistant', response.content, JSON.stringify(response.citations), JSON.stringify(response.usage)]
    );

    // Update conversation title if this is the first exchange
    if (history.length === 0) {
      const title = message.trim().substring(0, 100) + (message.length > 100 ? '...' : '');
      await db.query(
        'UPDATE ai_conversations SET title = $1, updated_at = NOW() WHERE id = $2',
        [title, req.params.id]
      );
    } else {
      await db.query(
        'UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1',
        [req.params.id]
      );
    }

    res.json({
      message: msgResult.rows[0],
      citations: response.citations,
      usage: response.usage
    });
  } catch (error) {
    logger.error({ err: error }, 'Assistant message failed');
    if (error.message === 'Anthropic API key not configured') {
      return res.status(503).json({ error: { message: 'AI Assistant is not configured. Please set ANTHROPIC_API_KEY.' } });
    }
    next(error);
  }
});

// GET /api/assistant/files/:fileId/status — Check file indexing status
router.get('/files/:fileId/status', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, indexing_status, indexing_error, indexed_at, chunk_count FROM files WHERE id = $1 AND deleted_at IS NULL',
      [req.params.fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'File not found' } });
    }

    res.json({ file: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/assistant/reindex/:fileId — Manually re-index a file (admin only)
router.post('/reindex/:fileId', requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id FROM files WHERE id = $1 AND deleted_at IS NULL',
      [req.params.fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'File not found' } });
    }

    // Fire-and-forget re-indexing
    indexFile(req.params.fileId).catch(err => {
      logger.error({ err, fileId: req.params.fileId }, 'Re-index failed');
    });

    res.json({ message: 'Re-indexing started' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
