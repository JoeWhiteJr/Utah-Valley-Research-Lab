const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Register pgvector type with pg (non-blocking, won't crash if extension isn't available)
try {
  const pgvector = require('pgvector/pg');
  pgvector.registerType(pool).catch(() => {
    logger.warn('pgvector extension not available — RAG features disabled');
  });
} catch {
  logger.warn('pgvector module not loaded — RAG features disabled');
}

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database pool error');
  // Attempt to recover by letting the pool create new connections on next request
  // The pool itself handles reconnection; we just log and continue
});

/**
 * Get a client from the pool with retry logic.
 * Retries up to 3 times with exponential backoff (200ms, 400ms, 800ms).
 */
const getClient = async () => {
  const MAX_RETRIES = 3;
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = await pool.connect();
      return client;
    } catch (err) {
      lastError = err;
      logger.warn({ err, attempt, maxRetries: MAX_RETRIES }, 'Database connection attempt failed');
      if (attempt < MAX_RETRIES) {
        const delay = 200 * Math.pow(2, attempt - 1); // 200ms, 400ms, 800ms
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  logger.error({ err: lastError }, 'All database connection attempts failed');
  throw lastError;
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient,
  pool
};
