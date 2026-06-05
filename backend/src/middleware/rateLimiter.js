const { rateLimit } = require('express-rate-limit');

const noop = (req, res, next) => next();

/**
 * Shared rate-limiter factory.
 *
 * Consolidates the `isTestEnv ? noop : rateLimit({...})` pattern that was
 * duplicated across every route file. In `NODE_ENV=test` the factory returns
 * a pass-through middleware so the bulk of the suite doesn't trip 429s during
 * normal request flow. Tests that want to assert real limiter wiring (see
 * rateLimitHardening.test.js / loginLimiter.test.js / dailyLlmCap.test.js)
 * flip NODE_ENV to 'production' and `jest.isolateModules` the route module —
 * because we read process.env at call time, the freshly-required route gets
 * the real limiter back.
 *
 * Mirrors the createUploader factory pattern in ./uploads.js.
 *
 * @param {Object} opts
 * @param {number} opts.windowMs        Window length in milliseconds.
 * @param {number} opts.max             Max requests per window per key.
 * @param {string} [opts.message]       User-facing message on hit. Wrapped as
 *                                      `{ error: { message } }` to match the
 *                                      project's error response shape.
 * @param {Function} [opts.keyGenerator] Optional custom key fn (IPv6-safe by
 *                                       default via express-rate-limit).
 * @returns {Function} An Express middleware (real limiter in prod, noop in tests).
 */
function createLimiter({ windowMs, max, message = 'Too many requests', keyGenerator } = {}) {
  if (typeof windowMs !== 'number' || typeof max !== 'number') {
    throw new Error('createLimiter: windowMs and max are required numbers');
  }
  if (process.env.NODE_ENV === 'test') return noop;
  return rateLimit({
    windowMs,
    max,
    message: { error: { message } },
    standardHeaders: true,
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
  });
}

module.exports = { createLimiter };
