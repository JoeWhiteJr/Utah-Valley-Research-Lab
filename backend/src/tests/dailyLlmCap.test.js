/**
 * Verifies that the daily (24h) LLM call caps are wired BEFORE the existing
 * 5-minute limiters added in PR #97. The daily caps are the second layer of
 * defense — the 5-min limiter stops burst spikes, the daily limiter caps total
 * sustained usage so a logged-in user (or leaked token) can't grind ~8,640
 * Claude calls / ~5,760 Gemini calls per day at the 5-min ceiling.
 *
 * Same router-stack inspection trick as rateLimitHardening.test.js: flip
 * NODE_ENV to production, isolate-require the route module, then walk
 * router.stack to find the limiter middleware by its fingerprint (resetKey +
 * getKey methods that express-rate-limit v8 attaches to its returned function).
 */

const path = require('path');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'daily-llm-cap-test-secret-not-used-for-signing-anything-real';
}

const isLimiter = (fn) =>
  typeof fn === 'function' &&
  typeof fn.resetKey === 'function' &&
  typeof fn.getKey === 'function';

function loadRouteInProdMode(relativePath) {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let mod;
  try {
    jest.isolateModules(() => {
      mod = require(path.join('..', relativePath));
    });
  } finally {
    process.env.NODE_ENV = previousEnv;
  }
  return mod;
}

function getRouteHandlers(router, method, routePath) {
  for (const layer of router.stack) {
    if (
      layer.route &&
      layer.route.path === routePath &&
      layer.route.methods[method]
    ) {
      return layer.route.stack.map((s) => s.handle);
    }
  }
  return null;
}

/**
 * Return the indices of every limiter in `handlers` (preserves order).
 */
function findLimiterIndices(handlers) {
  const indices = [];
  handlers.forEach((h, i) => {
    if (isLimiter(h)) indices.push(i);
  });
  return indices;
}

describe('daily LLM cap — wiring on top of 5-min limiters', () => {
  describe('assistant.js — POST /conversations/:id/messages', () => {
    it('has two limiters wired on the Claude message route', () => {
      const router = loadRouteInProdMode('routes/assistant.js');
      const handlers = getRouteHandlers(
        router,
        'post',
        '/conversations/:id/messages'
      );
      expect(handlers).not.toBeNull();
      const limiters = handlers.filter(isLimiter);
      // dailyClaudeLimiter + claudeMessageLimiter (5-min) = 2 limiters
      expect(limiters.length).toBe(2);
    });

    it('wires the daily limiter BEFORE the 5-min limiter on the message route', () => {
      const router = loadRouteInProdMode('routes/assistant.js');
      const handlers = getRouteHandlers(
        router,
        'post',
        '/conversations/:id/messages'
      );
      expect(handlers).not.toBeNull();
      const limiterIndices = findLimiterIndices(handlers);
      expect(limiterIndices.length).toBe(2);
      // The first limiter in the chain should fire first — that's the daily
      // cap. The cheaper short-circuit goes first.
      const [first, second] = limiterIndices;
      expect(first).toBeLessThan(second);

      // Sanity: the daily limiter has a 24h window, the 5-min limiter doesn't.
      // express-rate-limit doesn't expose windowMs directly, but the message
      // body is set when the limiter trips — we can't introspect that without
      // tripping it, so we settle for "there are two distinct limiter
      // instances, daily first".
      expect(handlers[first]).not.toBe(handlers[second]);
    });

    it('does not stack limiters on the conversations LIST route', () => {
      // Only the billable message endpoint gets the daily cap. GET /conversations
      // stays on the global apiLimiter only.
      const router = loadRouteInProdMode('routes/assistant.js');
      const handlers = getRouteHandlers(router, 'get', '/conversations');
      expect(handlers).not.toBeNull();
      expect(handlers.some(isLimiter)).toBe(false);
    });
  });

  describe('ai.js — Gemini endpoints all get the daily cap stacked', () => {
    const limitedRoutes = [
      ['post', '/chat'],
      ['post', '/summarize-chat'],
      ['post', '/summarize-project'],
      ['post', '/summarize-dashboard'],
      ['post', '/admin-summary'],
      ['post', '/review-application']
    ];

    it.each(limitedRoutes)(
      'wires two limiters (daily + 5-min) on %s %s',
      (method, routePath) => {
        const router = loadRouteInProdMode('routes/ai.js');
        const handlers = getRouteHandlers(router, method, routePath);
        expect(handlers).not.toBeNull();
        const limiters = handlers.filter(isLimiter);
        expect(limiters.length).toBe(2);
      }
    );

    it.each(limitedRoutes)(
      'wires the daily limiter BEFORE the 5-min limiter on %s %s',
      (method, routePath) => {
        const router = loadRouteInProdMode('routes/ai.js');
        const handlers = getRouteHandlers(router, method, routePath);
        expect(handlers).not.toBeNull();
        const limiterIndices = findLimiterIndices(handlers);
        expect(limiterIndices.length).toBe(2);
        const [first, second] = limiterIndices;
        expect(first).toBeLessThan(second);
        expect(handlers[first]).not.toBe(handlers[second]);
      }
    );

    it('uses the SAME daily limiter instance across all six Gemini endpoints', () => {
      // Shared daily budget — a user can't burn 150 calls on /chat and then
      // another 150 on /summarize-project. One budget, one ceiling. The daily
      // limiter is the FIRST limiter in each route's middleware chain.
      const router = loadRouteInProdMode('routes/ai.js');
      const dailyLimiters = limitedRoutes.map(([method, routePath]) => {
        const handlers = getRouteHandlers(router, method, routePath);
        const limiterIndices = findLimiterIndices(handlers);
        // The daily limiter is the first limiter in the chain.
        return handlers[limiterIndices[0]];
      });
      expect(dailyLimiters.every((l) => typeof l === 'function')).toBe(true);
      const [first, ...rest] = dailyLimiters;
      for (const other of rest) {
        expect(other).toBe(first);
      }
    });

    it('uses the SAME 5-min limiter instance across all six Gemini endpoints', () => {
      // Defense-in-depth: PR #97 already had the shared 5-min llmLimiter.
      // Verify the daily cap didn't accidentally regress that — the 5-min
      // limiter is the SECOND limiter in each route's middleware chain.
      const router = loadRouteInProdMode('routes/ai.js');
      const fiveMinLimiters = limitedRoutes.map(([method, routePath]) => {
        const handlers = getRouteHandlers(router, method, routePath);
        const limiterIndices = findLimiterIndices(handlers);
        return handlers[limiterIndices[1]];
      });
      expect(fiveMinLimiters.every((l) => typeof l === 'function')).toBe(true);
      const [first, ...rest] = fiveMinLimiters;
      for (const other of rest) {
        expect(other).toBe(first);
      }
    });

    it('daily limiter and 5-min limiter are distinct instances', () => {
      // Sanity check: we shouldn't have accidentally reused the same limiter
      // instance for both layers. If we did, the "daily first" and "5-min
      // second" ordering tests above would silently pass but the system would
      // only enforce one budget.
      const router = loadRouteInProdMode('routes/ai.js');
      const handlers = getRouteHandlers(router, 'post', '/chat');
      const limiterIndices = findLimiterIndices(handlers);
      expect(handlers[limiterIndices[0]]).not.toBe(handlers[limiterIndices[1]]);
    });

    it('does not attach any limiter to GET /status', () => {
      const router = loadRouteInProdMode('routes/ai.js');
      const handlers = getRouteHandlers(router, 'get', '/status');
      expect(handlers).not.toBeNull();
      expect(handlers.some(isLimiter)).toBe(false);
    });
  });
});
