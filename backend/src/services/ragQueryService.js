const db = require('../config/database');
const logger = require('../config/logger');
const { embedText } = require('./embeddingService');
const pgvector = require('pgvector');

const TOP_K = parseInt(process.env.RAG_TOP_K) || 8;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

let Anthropic = null;
let anthropicClient = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (anthropicClient) return anthropicClient;

  if (!Anthropic) {
    Anthropic = require('@anthropic-ai/sdk').default;
  }
  anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

/**
 * Search for relevant document chunks using vector similarity.
 * Permission-aware: filters by user access (admin sees all, others see own projects).
 */
async function searchChunks(queryEmbedding, userId, userRole, projectId = null) {
  const embeddingStr = pgvector.toSql(queryEmbedding);

  let query;
  let params;

  if (userRole === 'admin') {
    if (projectId) {
      query = `
        SELECT dc.id, dc.content, dc.chunk_index, dc.metadata, dc.file_id,
               f.original_filename, f.file_type, dc.project_id,
               p.title as project_title,
               1 - (dc.embedding <=> $1) as similarity
        FROM document_chunks dc
        JOIN files f ON dc.file_id = f.id
        JOIN projects p ON dc.project_id = p.id
        WHERE dc.project_id = $2 AND f.deleted_at IS NULL
        ORDER BY dc.embedding <=> $1
        LIMIT $3
      `;
      params = [embeddingStr, projectId, TOP_K];
    } else {
      query = `
        SELECT dc.id, dc.content, dc.chunk_index, dc.metadata, dc.file_id,
               f.original_filename, f.file_type, dc.project_id,
               p.title as project_title,
               1 - (dc.embedding <=> $1) as similarity
        FROM document_chunks dc
        JOIN files f ON dc.file_id = f.id
        JOIN projects p ON dc.project_id = p.id
        WHERE f.deleted_at IS NULL
        ORDER BY dc.embedding <=> $1
        LIMIT $2
      `;
      params = [embeddingStr, TOP_K];
    }
  } else {
    // Non-admin: only search accessible projects
    const accessSubquery = `
      SELECT id FROM projects WHERE created_by = $2 AND deleted_at IS NULL
      UNION
      SELECT project_id FROM project_members WHERE user_id = $2
      UNION
      SELECT DISTINCT ai2.project_id FROM action_items ai2
      LEFT JOIN action_item_assignees aia ON ai2.id = aia.action_item_id
      WHERE ai2.deleted_at IS NULL AND (ai2.assigned_to = $2 OR aia.user_id = $2)
    `;

    if (projectId) {
      query = `
        SELECT dc.id, dc.content, dc.chunk_index, dc.metadata, dc.file_id,
               f.original_filename, f.file_type, dc.project_id,
               p.title as project_title,
               1 - (dc.embedding <=> $1) as similarity
        FROM document_chunks dc
        JOIN files f ON dc.file_id = f.id
        JOIN projects p ON dc.project_id = p.id
        WHERE dc.project_id = $3 AND f.deleted_at IS NULL
          AND dc.project_id IN (${accessSubquery})
        ORDER BY dc.embedding <=> $1
        LIMIT $4
      `;
      params = [embeddingStr, userId, projectId, TOP_K];
    } else {
      query = `
        SELECT dc.id, dc.content, dc.chunk_index, dc.metadata, dc.file_id,
               f.original_filename, f.file_type, dc.project_id,
               p.title as project_title,
               1 - (dc.embedding <=> $1) as similarity
        FROM document_chunks dc
        JOIN files f ON dc.file_id = f.id
        JOIN projects p ON dc.project_id = p.id
        WHERE f.deleted_at IS NULL
          AND dc.project_id IN (${accessSubquery})
        ORDER BY dc.embedding <=> $1
        LIMIT $3
      `;
      params = [embeddingStr, userId, TOP_K];
    }
  }

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Build system prompt with retrieved context chunks.
 */
function buildSystemPrompt(chunks) {
  if (chunks.length === 0) {
    return `You are a helpful research assistant for the Stats Lab. You help users understand and analyze research documents.

No relevant documents were found for this query. Let the user know you couldn't find matching content in the indexed documents, but still try to help if you can based on the question alone.`;
  }

  let sources = '';
  chunks.forEach((chunk, i) => {
    sources += `\n[Source ${i + 1}] File: "${chunk.original_filename}" (Project: ${chunk.project_title})\n${chunk.content}\n`;
  });

  return `You are a helpful research assistant for the Stats Lab. You help users understand and analyze research documents uploaded to their projects.

Answer the user's question based on the following document excerpts. Cite your sources using [Source N] notation. If the documents don't contain enough information, say so clearly.

RETRIEVED DOCUMENTS:
${sources}

GUIDELINES:
- Be accurate and cite specific sources
- If multiple sources support a point, cite all of them
- If information is not in the sources, clearly state that
- Use markdown formatting for readability
- Be concise but thorough`;
}

/**
 * Query the RAG pipeline: embed question → search → Claude → response.
 */
async function query(question, conversationHistory, userId, userRole, projectId = null) {
  const client = getClient();
  if (!client) {
    throw new Error('Anthropic API key not configured');
  }

  // Embed the question
  const queryEmbedding = await embedText(question);

  // Search for relevant chunks
  const chunks = await searchChunks(queryEmbedding, userId, userRole, projectId);

  // Build messages array with conversation history (last 10 messages)
  const recentHistory = conversationHistory.slice(-10);
  const messages = recentHistory.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
  messages.push({ role: 'user', content: question });

  // Call Claude
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    system: buildSystemPrompt(chunks),
    messages
  });

  const content = response.content[0]?.text || '';

  // Extract citations from the response
  const citationPattern = /\[Source (\d+)\]/g;
  const citedIndices = new Set();
  let match;
  while ((match = citationPattern.exec(content)) !== null) {
    const idx = parseInt(match[1]) - 1;
    if (idx >= 0 && idx < chunks.length) {
      citedIndices.add(idx);
    }
  }

  const citations = Array.from(citedIndices).map(idx => ({
    sourceIndex: idx + 1,
    fileId: chunks[idx].file_id,
    fileName: chunks[idx].original_filename,
    projectTitle: chunks[idx].project_title,
    chunkPreview: chunks[idx].content.substring(0, 150) + '...',
    similarity: parseFloat(chunks[idx].similarity)
  }));

  return {
    content,
    citations,
    usage: {
      input_tokens: response.usage?.input_tokens || 0,
      output_tokens: response.usage?.output_tokens || 0
    }
  };
}

module.exports = { query, getClient };
