const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Lazy load Google Generative AI SDK
let GoogleGenerativeAI = null;
let genAI = null;

const getModel = (modelName = 'gemini-2.5-flash') => {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  if (!genAI) {
    try {
      if (!GoogleGenerativeAI) {
        ({ GoogleGenerativeAI } = require('@google/generative-ai'));
      }
      genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    } catch (error) {
      console.error('Failed to initialize Google AI client:', error.message);
      return null;
    }
  }

  return genAI.getGenerativeModel({ model: modelName });
};

// Check if AI is available
router.get('/status', authenticate, (req, res) => {
  const model = getModel();
  res.json({
    available: !!model,
    message: model ? 'AI features are available' : 'GEMINI_API_KEY not configured'
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

    const model = getModel();
    if (!model) {
      return res.status(503).json({
        error: { message: 'AI features are not available. GEMINI_API_KEY not configured.' }
      });
    }

    const { message, context } = req.body;

    const systemPrompt = context
      ? `You are a helpful AI assistant for Stats Lab Manager, a research project management system. Context: ${context}`
      : 'You are a helpful AI assistant for Stats Lab Manager, a research project management system. Help users with their questions about projects, research, and team collaboration.';

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: message }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] }
    });

    const aiMessage = result.response.text() || 'No response generated';

    res.json({
      response: aiMessage,
      usage: {
        input_tokens: result.response.usageMetadata?.promptTokenCount,
        output_tokens: result.response.usageMetadata?.candidatesTokenCount
      }
    });
  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({ error: { message: 'AI rate limit exceeded. Please try again later.' } });
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

    const model = getModel();
    if (!model) {
      return res.status(503).json({
        error: { message: 'AI features are not available. GEMINI_API_KEY not configured.' }
      });
    }

    const { applicationId } = req.body;

    const appResult = await db.query(
      'SELECT * FROM applications WHERE id = $1',
      [applicationId]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Application not found' } });
    }

    const application = appResult.rows[0];

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{
          text: `Please review this application:

Name: ${application.name}
Email: ${application.email}
Message/Statement:
${application.message}

Application submitted: ${new Date(application.created_at).toLocaleDateString()}`
        }]
      }],
      systemInstruction: {
        parts: [{
          text: `You are an AI assistant helping review team member applications for a research lab.
Analyze the application and provide:
1. A brief summary (2-3 sentences)
2. Key strengths identified
3. Any potential concerns or areas to clarify
4. A recommendation (Strong Yes / Yes / Maybe / No) with brief reasoning

Be objective and professional. Focus on the content provided.`
        }]
      }
    });

    const review = result.response.text() || 'Unable to generate review';

    res.json({
      applicationId,
      review,
      usage: {
        input_tokens: result.response.usageMetadata?.promptTokenCount,
        output_tokens: result.response.usageMetadata?.candidatesTokenCount
      }
    });
  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({ error: { message: 'AI rate limit exceeded. Please try again later.' } });
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

    const model = getModel();
    if (!model) {
      return res.status(503).json({
        error: { message: 'AI features are not available. GEMINI_API_KEY not configured.' }
      });
    }

    const { roomId, messageCount = 50 } = req.body;

    const membership = await db.query(
      'SELECT user_id FROM chat_members WHERE room_id = $1 AND user_id = $2',
      [roomId, req.user.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: { message: 'Not a member of this chat' } });
    }

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

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Summarize this conversation:\n\n${chatTranscript}` }] }],
      systemInstruction: {
        parts: [{
          text: 'You are a helpful assistant. Summarize the following chat conversation concisely, highlighting key topics discussed, decisions made, and any action items mentioned.'
        }]
      }
    });

    const summary = result.response.text() || 'Unable to generate summary';

    res.json({
      roomId,
      messageCount: messages.length,
      summary,
      usage: {
        input_tokens: result.response.usageMetadata?.promptTokenCount,
        output_tokens: result.response.usageMetadata?.candidatesTokenCount
      }
    });
  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({ error: { message: 'AI rate limit exceeded. Please try again later.' } });
    }
    next(error);
  }
});

// Summarize a single project
router.post('/summarize-project', authenticate, [
  body('projectId').isUUID().withMessage('Valid project ID is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const model = getModel();
    if (!model) {
      return res.status(503).json({
        error: { message: 'AI features are not available. GEMINI_API_KEY not configured.' }
      });
    }

    const { projectId } = req.body;

    // Fetch project details
    const projectRes = await db.query(`
      SELECT p.*, u.name as creator_name
      FROM projects p
      JOIN users u ON p.created_by = u.id
      WHERE p.id = $1
    `, [projectId]);

    if (projectRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Project not found' } });
    }

    const project = projectRes.rows[0];

    // Fetch related data in parallel
    const [actionsRes, notesRes, meetingsRes] = await Promise.all([
      db.query(
        'SELECT title, completed, due_date, assigned_to FROM action_items WHERE project_id = $1 ORDER BY sort_order ASC',
        [projectId]
      ),
      db.query(
        'SELECT title, content, created_at FROM notes WHERE project_id = $1 ORDER BY created_at DESC LIMIT 20',
        [projectId]
      ),
      db.query(
        'SELECT title, notes, recorded_at FROM meetings WHERE project_id = $1 ORDER BY recorded_at DESC NULLS LAST LIMIT 10',
        [projectId]
      )
    ]);

    const actions = actionsRes.rows;
    const projectNotes = notesRes.rows;
    const meetings = meetingsRes.rows;

    const completedActions = actions.filter(a => a.completed).length;
    const pendingActions = actions.filter(a => !a.completed).length;

    // Build context
    let contextText = `Project: "${project.title}"\n`;
    contextText += `Status: ${project.status}\n`;
    contextText += `Progress: ${project.progress || 0}%\n`;
    contextText += `Description: ${project.description || 'None'}\n`;
    contextText += `Created by: ${project.creator_name}\n\n`;

    contextText += `ACTION ITEMS (${actions.length} total, ${completedActions} completed, ${pendingActions} pending):\n`;
    actions.forEach(a => {
      contextText += `- [${a.completed ? 'DONE' : 'TODO'}] ${a.title}`;
      if (a.due_date) contextText += ` (due: ${new Date(a.due_date).toLocaleDateString()})`;
      contextText += '\n';
    });

    if (projectNotes.length > 0) {
      contextText += `\nNOTES (${projectNotes.length}):\n`;
      projectNotes.forEach(n => {
        contextText += `- "${n.title}": ${(n.content || '').substring(0, 200)}\n`;
      });
    }

    if (meetings.length > 0) {
      contextText += `\nMEETINGS (${meetings.length}):\n`;
      meetings.forEach(m => {
        contextText += `- "${m.title}"`;
        if (m.recorded_at) contextText += ` (${new Date(m.recorded_at).toLocaleDateString()})`;
        if (m.notes) contextText += `: ${m.notes.substring(0, 200)}`;
        contextText += '\n';
      });
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Please provide a summary of this project:\n\n${contextText}` }] }],
      systemInstruction: {
        parts: [{
          text: `You are an AI assistant for a research lab project management tool. Summarize the project status concisely. Include:
1. Overall status and progress assessment
2. Key accomplishments (completed tasks)
3. What still needs to be done (pending tasks, upcoming deadlines)
4. Any recommendations or observations

Be professional, concise, and use bullet points where helpful.`
        }]
      }
    });

    const summary = result.response.text() || 'Unable to generate summary';

    res.json({
      summary,
      stats: {
        totalActions: actions.length,
        completedActions,
        pendingActions,
        noteCount: projectNotes.length,
        meetingCount: meetings.length
      },
      generatedAt: new Date().toISOString(),
      usage: {
        input_tokens: result.response.usageMetadata?.promptTokenCount,
        output_tokens: result.response.usageMetadata?.candidatesTokenCount
      }
    });
  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({ error: { message: 'AI rate limit exceeded. Please try again later.' } });
    }
    next(error);
  }
});

// Summarize dashboard - weekly tasks/to-do overview
router.post('/summarize-dashboard', authenticate, async (req, res, next) => {
  try {
    const model = getModel();
    if (!model) {
      return res.status(503).json({
        error: { message: 'AI features are not available. GEMINI_API_KEY not configured.' }
      });
    }

    // Fetch all projects with action counts
    const [projectsRes, actionsRes, completedRecentRes, meetingsRes] = await Promise.all([
      db.query(`
        SELECT p.id, p.title, p.status, p.progress,
          (SELECT COUNT(*) FROM action_items ai WHERE ai.project_id = p.id) as total_actions,
          (SELECT COUNT(*) FROM action_items ai WHERE ai.project_id = p.id AND ai.completed = true) as completed_actions
        FROM projects p
        WHERE p.status IN ('active', 'inactive')
        ORDER BY p.updated_at DESC
      `),
      db.query(`
        SELECT a.title, a.completed, a.due_date, p.title as project_title, u.name as assigned_name
        FROM action_items a
        JOIN projects p ON a.project_id = p.id
        LEFT JOIN users u ON a.assigned_to = u.id
        WHERE a.completed = false AND p.status IN ('active', 'inactive')
        ORDER BY a.due_date ASC NULLS LAST
        LIMIT 50
      `),
      db.query(`
        SELECT a.title, a.updated_at, p.title as project_title
        FROM action_items a
        JOIN projects p ON a.project_id = p.id
        WHERE a.completed = true AND a.updated_at >= NOW() - INTERVAL '7 days'
        ORDER BY a.updated_at DESC
        LIMIT 30
      `),
      db.query(`
        SELECT m.title, m.recorded_at, p.title as project_title
        FROM meetings m
        JOIN projects p ON m.project_id = p.id
        WHERE m.created_at >= NOW() - INTERVAL '7 days'
        ORDER BY m.recorded_at DESC NULLS LAST
        LIMIT 10
      `)
    ]);

    const projects = projectsRes.rows;
    const pendingActions = actionsRes.rows;
    const completedRecent = completedRecentRes.rows;
    const recentMeetings = meetingsRes.rows;

    // Calculate stats
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const overdueTasks = pendingActions.filter(a => a.due_date && new Date(a.due_date) < now).length;
    const dueThisWeek = pendingActions.filter(a => a.due_date && new Date(a.due_date) >= now && new Date(a.due_date) <= weekFromNow).length;

    // Build context
    let contextText = 'WEEKLY DASHBOARD SUMMARY\n\n';

    contextText += `PROJECTS (${projects.length} active/inactive):\n`;
    projects.forEach(p => {
      contextText += `- "${p.title}" (${p.status}) - ${p.progress || 0}% complete, ${p.completed_actions}/${p.total_actions} tasks done\n`;
    });

    contextText += `\nPENDING TASKS (${pendingActions.length}):\n`;
    pendingActions.forEach(a => {
      contextText += `- "${a.title}" in "${a.project_title}"`;
      if (a.assigned_name) contextText += ` (assigned: ${a.assigned_name})`;
      if (a.due_date) {
        const dueDate = new Date(a.due_date);
        contextText += ` [due: ${dueDate.toLocaleDateString()}${dueDate < now ? ' - OVERDUE' : ''}]`;
      }
      contextText += '\n';
    });

    contextText += `\nCOMPLETED THIS WEEK (${completedRecent.length}):\n`;
    completedRecent.forEach(a => {
      contextText += `- "${a.title}" in "${a.project_title}" (completed: ${new Date(a.updated_at).toLocaleDateString()})\n`;
    });

    if (recentMeetings.length > 0) {
      contextText += `\nRECENT MEETINGS (${recentMeetings.length}):\n`;
      recentMeetings.forEach(m => {
        contextText += `- "${m.title}" for "${m.project_title}"`;
        if (m.recorded_at) contextText += ` (${new Date(m.recorded_at).toLocaleDateString()})`;
        contextText += '\n';
      });
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Please provide a weekly dashboard summary based on this data:\n\n${contextText}` }] }],
      systemInstruction: {
        parts: [{
          text: `You are an AI assistant for a research lab project management tool. Generate a concise weekly summary that helps team members understand:
1. What was accomplished this week
2. What is currently in progress and upcoming
3. What needs attention (overdue tasks, approaching deadlines)
4. Brief recommendations

Be professional and concise. Use bullet points for clarity. Focus on actionable insights.`
        }]
      }
    });

    const summary = result.response.text() || 'Unable to generate summary';

    res.json({
      summary,
      stats: {
        activeProjects: projects.filter(p => p.status === 'active').length,
        pendingTasks: pendingActions.length,
        overdueTasks,
        dueThisWeek,
        completedThisWeek: completedRecent.length
      },
      generatedAt: new Date().toISOString(),
      usage: {
        input_tokens: result.response.usageMetadata?.promptTokenCount,
        output_tokens: result.response.usageMetadata?.candidatesTokenCount
      }
    });
  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({ error: { message: 'AI rate limit exceeded. Please try again later.' } });
    }
    next(error);
  }
});

// Admin AI Summary - aggregated lab activity summary (admin only)
router.post('/admin-summary', authenticate, requireRole('admin'), [
  body('dateRange').optional().isIn(['week', 'month', 'all']).withMessage('dateRange must be week, month, or all')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const model = getModel();
    if (!model) {
      return res.status(503).json({
        error: { message: 'AI features are not available. GEMINI_API_KEY not configured.' }
      });
    }

    const dateRange = req.body.dateRange || 'week';

    let dateFilter = '';
    if (dateRange === 'week') {
      dateFilter = "AND a.updated_at >= NOW() - INTERVAL '7 days'";
    } else if (dateRange === 'month') {
      dateFilter = "AND a.updated_at >= NOW() - INTERVAL '30 days'";
    }

    const [projectsRes, completedRes, inProgressRes, pendingRes, teamRes, meetingsRes] = await Promise.all([
      db.query(`
        SELECT p.id, p.title, p.status, p.progress, p.description,
          u.name as creator_name,
          (SELECT COUNT(*) FROM action_items ai WHERE ai.project_id = p.id AND ai.completed = true) as completed_count,
          (SELECT COUNT(*) FROM action_items ai WHERE ai.project_id = p.id AND ai.completed = false) as pending_count
        FROM projects p
        JOIN users u ON p.created_by = u.id
        ORDER BY p.updated_at DESC
      `),
      db.query(`
        SELECT a.title, a.updated_at, p.title as project_title, u.name as assigned_name
        FROM action_items a
        JOIN projects p ON a.project_id = p.id
        LEFT JOIN users u ON a.assigned_to = u.id
        WHERE a.completed = true ${dateFilter}
        ORDER BY a.updated_at DESC
        LIMIT 50
      `),
      db.query(`
        SELECT a.title, a.due_date, p.title as project_title, u.name as assigned_name
        FROM action_items a
        JOIN projects p ON a.project_id = p.id
        LEFT JOIN users u ON a.assigned_to = u.id
        WHERE a.completed = false AND a.assigned_to IS NOT NULL
        ORDER BY a.due_date ASC NULLS LAST
        LIMIT 50
      `),
      db.query(`
        SELECT a.title, a.due_date, p.title as project_title
        FROM action_items a
        JOIN projects p ON a.project_id = p.id
        WHERE a.completed = false AND a.assigned_to IS NULL
        ORDER BY a.due_date ASC NULLS LAST
        LIMIT 50
      `),
      db.query(`
        SELECT u.name, u.role,
          (SELECT COUNT(*) FROM action_items a WHERE a.assigned_to = u.id AND a.completed = false) as pending_tasks
        FROM users u
        WHERE u.deleted_at IS NULL
        ORDER BY u.name
      `),
      db.query(`
        SELECT m.title, m.recorded_at, p.title as project_title, u.name as creator_name
        FROM meetings m
        JOIN projects p ON m.project_id = p.id
        JOIN users u ON m.created_by = u.id
        ORDER BY m.recorded_at DESC NULLS LAST
        LIMIT 10
      `)
    ]);

    const projects = projectsRes.rows;
    const completed = completedRes.rows;
    const inProgress = inProgressRes.rows;
    const pending = pendingRes.rows;
    const team = teamRes.rows;
    const meetings = meetingsRes.rows;

    let contextText = 'Lab Activity Summary (Date range: ' + dateRange + ')\n\n';

    contextText += 'PROJECTS OVERVIEW:\n';
    projects.forEach(p => {
      contextText += '- "' + p.title + '" (' + p.status + ') - ' + (p.progress || 0) + '% complete, ' + p.completed_count + ' done / ' + p.pending_count + ' pending tasks. Created by ' + p.creator_name + '\n';
    });

    contextText += '\nCOMPLETED TASKS (' + completed.length + '):\n';
    completed.forEach(a => {
      contextText += '- "' + a.title + '" in "' + a.project_title + '"';
      if (a.assigned_name) contextText += ' by ' + a.assigned_name;
      contextText += ' (completed: ' + new Date(a.updated_at).toLocaleDateString() + ')\n';
    });

    contextText += '\nIN-PROGRESS TASKS (' + inProgress.length + '):\n';
    inProgress.forEach(a => {
      contextText += '- "' + a.title + '" in "' + a.project_title + '"';
      if (a.assigned_name) contextText += ' - assigned to ' + a.assigned_name;
      if (a.due_date) contextText += ' (due: ' + new Date(a.due_date).toLocaleDateString() + ')';
      contextText += '\n';
    });

    contextText += '\nPENDING/UNASSIGNED TASKS (' + pending.length + '):\n';
    pending.forEach(a => {
      contextText += '- "' + a.title + '" in "' + a.project_title + '"';
      if (a.due_date) contextText += ' (due: ' + new Date(a.due_date).toLocaleDateString() + ')';
      contextText += '\n';
    });

    contextText += '\nTEAM MEMBERS:\n';
    team.forEach(t => {
      contextText += '- ' + t.name + ' (' + t.role + ') - ' + t.pending_tasks + ' pending tasks\n';
    });

    if (meetings.length > 0) {
      contextText += '\nRECENT MEETINGS:\n';
      meetings.forEach(m => {
        contextText += '- "' + m.title + '" for "' + m.project_title + '" by ' + m.creator_name;
        if (m.recorded_at) contextText += ' (' + new Date(m.recorded_at).toLocaleDateString() + ')';
        contextText += '\n';
      });
    }

    const systemText = 'You are an AI assistant for a research lab project management tool. Generate a structured lab activity summary with exactly these three sections using markdown headers:\n\n## What Has Been Done\nSummarize completed work, milestones achieved, and accomplishments. Include project names, task details, and who completed them.\n\n## What Is Currently Being Done\nSummarize active/in-progress work. Include who is working on what, upcoming deadlines, and current focus areas.\n\n## What Still Needs To Be Done\nSummarize pending tasks, unassigned work, overdue items, and recommendations. Include priorities and suggestions.\n\nUse bullet points for clarity. Include project names and team member names where relevant. Be professional and concise.';

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Please provide a comprehensive lab activity summary based on this data:\n\n' + contextText }] }],
      systemInstruction: {
        parts: [{ text: systemText }]
      }
    });

    const summary = result.response.text() || 'Unable to generate summary';

    res.json({
      summary,
      dateRange,
      generatedAt: new Date().toISOString(),
      usage: {
        input_tokens: result.response.usageMetadata?.promptTokenCount,
        output_tokens: result.response.usageMetadata?.candidatesTokenCount
      }
    });
  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({ error: { message: 'AI rate limit exceeded. Please try again later.' } });
    }
    next(error);
  }
});

module.exports = router;
