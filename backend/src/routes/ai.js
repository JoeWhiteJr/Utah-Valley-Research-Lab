const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Lazy load Anthropic SDK to avoid errors if not installed
let Anthropic = null;
let anthropicClient = null;

const getAnthropicClient = () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  if (!anthropicClient) {
    try {
      if (!Anthropic) {
        Anthropic = require('@anthropic-ai/sdk');
      }
      anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    } catch (error) {
      console.error('Failed to initialize Anthropic client:', error.message);
      return null;
    }
  }

  return anthropicClient;
};

// Check if AI is available
router.get('/status', authenticate, (req, res) => {
  const client = getAnthropicClient();
  res.json({
    available: !!client,
    message: client ? 'AI features are available' : 'ANTHROPIC_API_KEY not configured'
  });
});

// General AI chat
router.post('/chat', authenticate, [
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('context').optional().trim()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const client = getAnthropicClient();
    if (!client) {
      return res.status(503).json({
        error: { message: 'AI features are not available. ANTHROPIC_API_KEY not configured.' }
      });
    }

    const { message, context } = req.body;

    const systemPrompt = context
      ? `You are a helpful AI assistant for Stats Lab Manager, a research project management system. Context: ${context}`
      : 'You are a helpful AI assistant for Stats Lab Manager, a research project management system. Help users with their questions about projects, research, and team collaboration.';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: message }
      ]
    });

    const aiMessage = response.content[0]?.text || 'No response generated';

    res.json({
      response: aiMessage,
      usage: {
        input_tokens: response.usage?.input_tokens,
        output_tokens: response.usage?.output_tokens
      }
    });
  } catch (error) {
    if (error.status === 401) {
      return res.status(503).json({ error: { message: 'Invalid Anthropic API key' } });
    }
    next(error);
  }
});

// AI-powered application review (admin only)
router.post('/review-application', authenticate, requireRole('admin'), [
  body('applicationId').isUUID().withMessage('Valid application ID is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const client = getAnthropicClient();
    if (!client) {
      return res.status(503).json({
        error: { message: 'AI features are not available. ANTHROPIC_API_KEY not configured.' }
      });
    }

    const { applicationId } = req.body;

    // Fetch the application
    const appResult = await db.query(
      'SELECT * FROM applications WHERE id = $1',
      [applicationId]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Application not found' } });
    }

    const application = appResult.rows[0];

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are an AI assistant helping review team member applications for a research lab.
Analyze the application and provide:
1. A brief summary (2-3 sentences)
2. Key strengths identified
3. Any potential concerns or areas to clarify
4. A recommendation (Strong Yes / Yes / Maybe / No) with brief reasoning

Be objective and professional. Focus on the content provided.`,
      messages: [
        {
          role: 'user',
          content: `Please review this application:

Name: ${application.name}
Email: ${application.email}
Message/Statement:
${application.message}

Application submitted: ${new Date(application.created_at).toLocaleDateString()}`
        }
      ]
    });

    const review = response.content[0]?.text || 'Unable to generate review';

    res.json({
      applicationId,
      review,
      usage: {
        input_tokens: response.usage?.input_tokens,
        output_tokens: response.usage?.output_tokens
      }
    });
  } catch (error) {
    if (error.status === 401) {
      return res.status(503).json({ error: { message: 'Invalid Anthropic API key' } });
    }
    next(error);
  }
});

// Summarize chat conversation (for long threads)
router.post('/summarize-chat', authenticate, [
  body('roomId').isUUID().withMessage('Valid room ID is required'),
  body('messageCount').optional().isInt({ min: 10, max: 100 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const client = getAnthropicClient();
    if (!client) {
      return res.status(503).json({
        error: { message: 'AI features are not available. ANTHROPIC_API_KEY not configured.' }
      });
    }

    const { roomId, messageCount = 50 } = req.body;

    // Check if user is a member of the room
    const membership = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [roomId, req.user.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: { message: 'Not a member of this chat' } });
    }

    // Fetch recent messages
    const messagesResult = await db.query(`
      SELECT m.content, u.name as sender_name, m.created_at
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.room_id = $1 AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT $2
    `, [roomId, messageCount]);

    if (messagesResult.rows.length < 5) {
      return res.status(400).json({ error: { message: 'Not enough messages to summarize' } });
    }

    const messages = messagesResult.rows.reverse();
    const chatTranscript = messages.map(m =>
      `[${new Date(m.created_at).toLocaleString()}] ${m.sender_name}: ${m.content}`
    ).join('\n');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: 'You are a helpful assistant. Summarize the following chat conversation concisely, highlighting key topics discussed, decisions made, and any action items mentioned.',
      messages: [
        { role: 'user', content: `Summarize this conversation:\n\n${chatTranscript}` }
      ]
    });

    const summary = response.content[0]?.text || 'Unable to generate summary';

    res.json({
      roomId,
      messageCount: messages.length,
      summary,
      usage: {
        input_tokens: response.usage?.input_tokens,
        output_tokens: response.usage?.output_tokens
      }
    });
  } catch (error) {
    if (error.status === 401) {
      return res.status(503).json({ error: { message: 'Invalid Anthropic API key' } });
    }
    next(error);
  }
});

module.exports = router;
