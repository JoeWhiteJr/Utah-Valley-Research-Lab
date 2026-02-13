/**
 * Split text into overlapping chunks suitable for embedding.
 *
 * Approximate token count: ~4 chars per token (English average).
 */

const CHUNK_SIZE = parseInt(process.env.RAG_CHUNK_SIZE) || 500;
const CHUNK_OVERLAP = parseInt(process.env.RAG_CHUNK_OVERLAP) || 50;
const CHARS_PER_TOKEN = 4;

/**
 * Estimate token count from text length.
 */
function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Split text into overlapping chunks.
 * Prefers splitting on paragraph boundaries, falls back to sentence/word boundaries.
 *
 * Returns [{ content, chunkIndex, tokenCount, metadata }]
 */
function chunkText(text, metadata = {}) {
  if (!text || !text.trim()) return [];

  const maxChars = CHUNK_SIZE * CHARS_PER_TOKEN;
  const overlapChars = CHUNK_OVERLAP * CHARS_PER_TOKEN;

  // Split into paragraphs
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());

  const chunks = [];
  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    // If adding this paragraph exceeds max, finalize current chunk
    if (currentChunk && (currentChunk.length + trimmed.length + 1) > maxChars) {
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex: chunkIndex++,
        tokenCount: estimateTokens(currentChunk.trim()),
        metadata
      });

      // Start new chunk with overlap from end of previous
      if (overlapChars > 0 && currentChunk.length > overlapChars) {
        currentChunk = currentChunk.slice(-overlapChars) + '\n\n' + trimmed;
      } else {
        currentChunk = trimmed;
      }
    } else if (trimmed.length > maxChars) {
      // Single paragraph exceeds max — split by sentences
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          chunkIndex: chunkIndex++,
          tokenCount: estimateTokens(currentChunk.trim()),
          metadata
        });
        currentChunk = '';
      }

      const sentences = trimmed.match(/[^.!?]+[.!?]+\s*/g) || [trimmed];
      for (const sentence of sentences) {
        if ((currentChunk.length + sentence.length) > maxChars && currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            chunkIndex: chunkIndex++,
            tokenCount: estimateTokens(currentChunk.trim()),
            metadata
          });
          if (overlapChars > 0 && currentChunk.length > overlapChars) {
            currentChunk = currentChunk.slice(-overlapChars) + ' ' + sentence;
          } else {
            currentChunk = sentence;
          }
        } else {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      chunkIndex: chunkIndex,
      tokenCount: estimateTokens(currentChunk.trim()),
      metadata
    });
  }

  return chunks;
}

module.exports = { chunkText, estimateTokens };
