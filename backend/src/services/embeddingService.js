const logger = require('../config/logger');

let pipeline = null;
let embedder = null;

/**
 * Lazy-load the all-MiniLM-L6-v2 embedding model.
 * Downloads ~90MB on first call, cached after.
 */
async function getEmbedder() {
  if (embedder) return embedder;

  if (!pipeline) {
    const { pipeline: transformersPipeline } = await import('@xenova/transformers');
    pipeline = transformersPipeline;
  }

  logger.info('Loading embedding model all-MiniLM-L6-v2...');
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  logger.info('Embedding model loaded');
  return embedder;
}

/**
 * Embed a single text string into a 384-dim float array.
 */
async function embedText(text) {
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Embed a batch of texts, processing in groups of 32.
 */
async function embedBatch(texts) {
  const model = await getEmbedder();
  const batchSize = 32;
  const results = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const outputs = await Promise.all(
      batch.map(async (text) => {
        const output = await model(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
      })
    );
    results.push(...outputs);
  }

  return results;
}

module.exports = { embedText, embedBatch };
