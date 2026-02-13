const db = require('../config/database');
const logger = require('../config/logger');
const { extractText } = require('./textExtractorService');
const { chunkText } = require('./chunkingService');
const { embedBatch } = require('./embeddingService');
const pgvector = require('pgvector');

/**
 * Index a file: extract text → chunk → embed → store in document_chunks.
 * Idempotent: deletes existing chunks before re-indexing.
 */
async function indexFile(fileId) {
  const client = await db.getClient();

  try {
    // Fetch file record
    const fileResult = await client.query(
      'SELECT id, project_id, storage_path, file_type, original_filename FROM files WHERE id = $1 AND deleted_at IS NULL',
      [fileId]
    );

    if (fileResult.rows.length === 0) {
      logger.warn({ fileId }, 'File not found for indexing');
      return;
    }

    const file = fileResult.rows[0];

    // Mark as processing
    await client.query(
      'UPDATE files SET indexing_status = $1, indexing_error = NULL WHERE id = $2',
      ['processing', fileId]
    );

    // Extract text
    const text = await extractText(file.storage_path, file.file_type);

    if (text === null) {
      // Non-text file (image, audio, video)
      await client.query(
        'UPDATE files SET indexing_status = $1, indexed_at = NOW(), chunk_count = 0 WHERE id = $2',
        ['skipped', fileId]
      );
      logger.info({ fileId, mimeType: file.file_type }, 'File skipped for indexing (non-text)');
      return;
    }

    if (!text.trim()) {
      await client.query(
        'UPDATE files SET indexing_status = $1, indexed_at = NOW(), chunk_count = 0 WHERE id = $2',
        ['completed', fileId]
      );
      logger.info({ fileId }, 'File indexed with 0 chunks (empty text)');
      return;
    }

    // Chunk the text
    const chunks = chunkText(text, {
      filename: file.original_filename,
      fileType: file.file_type
    });

    if (chunks.length === 0) {
      await client.query(
        'UPDATE files SET indexing_status = $1, indexed_at = NOW(), chunk_count = 0 WHERE id = $2',
        ['completed', fileId]
      );
      return;
    }

    // Generate embeddings
    const embeddings = await embedBatch(chunks.map(c => c.content));

    // Delete existing chunks (idempotent re-index)
    await client.query('DELETE FROM document_chunks WHERE file_id = $1', [fileId]);

    // Insert chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];

      await client.query(
        `INSERT INTO document_chunks (file_id, project_id, chunk_index, content, token_count, embedding, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          fileId,
          file.project_id,
          chunk.chunkIndex,
          chunk.content,
          chunk.tokenCount,
          pgvector.toSql(embedding),
          JSON.stringify(chunk.metadata)
        ]
      );
    }

    // Mark as completed
    await client.query(
      'UPDATE files SET indexing_status = $1, indexed_at = NOW(), chunk_count = $2, indexing_error = NULL WHERE id = $3',
      ['completed', chunks.length, fileId]
    );

    logger.info({ fileId, chunkCount: chunks.length }, 'File indexed successfully');
  } catch (error) {
    // Mark as failed
    try {
      await client.query(
        'UPDATE files SET indexing_status = $1, indexing_error = $2 WHERE id = $3',
        ['failed', error.message, fileId]
      );
    } catch (updateErr) {
      logger.error({ err: updateErr, fileId }, 'Failed to update indexing_status to failed');
    }
    logger.error({ err: error, fileId }, 'File indexing failed');
  } finally {
    client.release();
  }
}

/**
 * Re-index all files that haven't been indexed yet.
 */
async function indexPendingFiles() {
  const result = await db.query(
    "SELECT id FROM files WHERE (indexing_status = 'pending' OR indexing_status IS NULL) AND deleted_at IS NULL"
  );

  logger.info({ count: result.rows.length }, 'Re-indexing pending files');

  for (const row of result.rows) {
    await indexFile(row.id);
  }
}

module.exports = { indexFile, indexPendingFiles };
