/**
 * Verifies that the dedicated rate limiters added in fix/rate-limit-hardening
 * are wired onto the right routes.
 *
 * The route files use `isTestEnv = process.env.NODE_ENV === 'test'` to swap the
 * real `express-rate-limit` middleware for a no-op pass-through during the rest
 * of the suite — that's the established pattern in study.js and we follow it
 * for the new limiters too. To assert the wiring is correct in production, we
 * temporarily flip NODE_ENV, re-require the module in isolation, and inspect
 * the resulting Express router stack.
 *
 * express-rate-limit v8 returns a function with `resetKey` + `getKey` methods
 * attached. We use those properties as a fingerprint to identify the limiter
 * inside the route's middleware chain (the function itself is anonymous).
 */

const path = require('path');

// Some route modules transitively require ../middleware/auth, which throws at
// require-time unless JWT_SECRET is set. Provide a harmless value so the test
// file stays self-contained — auth.js only uses the secret to sign/verify
// tokens, neither of which we exercise here.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'rate-limit-hardening-test-secret-not-used-for-signing-anything-real';
}

const isLimiter = (fn) =>
  typeof fn === 'function' &&
  typeof fn.resetKey === 'function' &&
  typeof fn.getKey === 'function';

/**
 * Reload a route module under NODE_ENV=production so the real rate limiter is
 * installed instead of the test-env no-op. Restores NODE_ENV after.
 */
function loadRouteInProdMode(relativePath) {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let mod;
  try {
    jest.isolateModules(() => {
      // require the module fresh so the top-level isTestEnv check picks up
      // the new NODE_ENV value
      mod = require(path.join('..', relativePath));
    });
  } finally {
    process.env.NODE_ENV = previousEnv;
  }
  return mod;
}

/**
 * Find the route layer in `router.stack` that matches `(method, path)` and
 * return its middleware stack.
 */
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

describe('rate limit hardening — limiter wiring', () => {
  describe('applications.js — POST /', () => {
    it('attaches a dedicated rate limiter to the public submission route', () => {
      const router = loadRouteInProdMode('routes/applications.js');
      const handlers = getRouteHandlers(router, 'post', '/');
      expect(handlers).not.toBeNull();
      expect(handlers.some(isLimiter)).toBe(true);
    });
  });

  describe('contact.js — POST /', () => {
    it('attaches a dedicated rate limiter to the public contact form route', () => {
      const router = loadRouteInProdMode('routes/contact.js');
      const handlers = getRouteHandlers(router, 'post', '/');
      expect(handlers).not.toBeNull();
      expect(handlers.some(isLimiter)).toBe(true);
    });
  });

  describe('assistant.js — POST /conversations/:id/messages', () => {
    it('attaches a dedicated rate limiter to the Claude message route', () => {
      const router = loadRouteInProdMode('routes/assistant.js');
      const handlers = getRouteHandlers(
        router,
        'post',
        '/conversations/:id/messages'
      );
      expect(handlers).not.toBeNull();
      expect(handlers.some(isLimiter)).toBe(true);
    });

    it('does not attach a rate limiter to the conversations list route', () => {
      // GET /conversations should stay on the global apiLimiter only — the
      // dedicated limiter is reserved for the billable Claude endpoint.
      const router = loadRouteInProdMode('routes/assistant.js');
      const handlers = getRouteHandlers(router, 'get', '/conversations');
      expect(handlers).not.toBeNull();
      expect(handlers.some(isLimiter)).toBe(false);
    });
  });

  describe('ai.js — Gemini endpoints share one llmLimiter', () => {
    const limitedRoutes = [
      ['post', '/chat'],
      ['post', '/summarize-chat'],
      ['post', '/summarize-project'],
      ['post', '/summarize-dashboard'],
      ['post', '/admin-summary'],
      ['post', '/review-application']
    ];

    it.each(limitedRoutes)(
      'attaches a rate limiter to %s %s',
      (method, routePath) => {
        const router = loadRouteInProdMode('routes/ai.js');
        const handlers = getRouteHandlers(router, method, routePath);
        expect(handlers).not.toBeNull();
        expect(handlers.some(isLimiter)).toBe(true);
      }
    );

    it('uses the same limiter instance across all six Gemini endpoints', () => {
      // The spec calls for ONE shared llmLimiter — sharing the budget across
      // chat/summarize/admin-summary/review prevents per-route cost amplification.
      const router = loadRouteInProdMode('routes/ai.js');
      const limiters = limitedRoutes.map(([method, routePath]) => {
        const handlers = getRouteHandlers(router, method, routePath);
        return handlers.find(isLimiter);
      });
      // Every route should have found a limiter
      expect(limiters.every((l) => typeof l === 'function')).toBe(true);
      // ...and they should all be the same function reference
      const [first, ...rest] = limiters;
      for (const other of rest) {
        expect(other).toBe(first);
      }
    });

    it('does not attach a rate limiter to GET /status', () => {
      const router = loadRouteInProdMode('routes/ai.js');
      const handlers = getRouteHandlers(router, 'get', '/status');
      expect(handlers).not.toBeNull();
      expect(handlers.some(isLimiter)).toBe(false);
    });
  });

  describe('files.js — POST /project/:projectId', () => {
    it('attaches a dedicated rate limiter to the upload route', () => {
      const router = loadRouteInProdMode('routes/files.js');
      const handlers = getRouteHandlers(router, 'post', '/project/:projectId');
      expect(handlers).not.toBeNull();
      expect(handlers.some(isLimiter)).toBe(true);
    });

    it('does not attach a rate limiter to the GET list route', () => {
      const router = loadRouteInProdMode('routes/files.js');
      const handlers = getRouteHandlers(router, 'get', '/project/:projectId');
      expect(handlers).not.toBeNull();
      expect(handlers.some(isLimiter)).toBe(false);
    });
  });
});

describe('rate limit hardening — limiter behavior in production mode', () => {
  // Smoke-tests that the limiters actually rate-limit when NODE_ENV !== 'test'.
  // Each test re-loads the route module fresh under production env, mounts it
  // on a tiny Express app, and hammers it with supertest. The handlers are
  // stubbed at the limiter layer (limiter runs first, returns 429 on overflow)
  // so we never reach the real handlers — no DB, no LLM, no SMTP needed.

  const express = require('express');
  const request = require('supertest');

  function buildAppWithRouter(relativePath) {
    const router = loadRouteInProdMode(relativePath);
    const app = express();
    app.set('trust proxy', false);
    app.use(express.json());
    // Trap any handlers downstream of the limiter so we don't hit DB / LLM.
    // We replace each route's terminal handlers with a stub that 200s.
    for (const layer of router.stack) {
      if (!layer.route) continue;
      const stack = layer.route.stack;
      // Find the limiter; everything AFTER it gets stubbed.
      const limiterIdx = stack.findIndex((s) => isLimiter(s.handle));
      if (limiterIdx === -1) continue;
      for (let i = limiterIdx + 1; i < stack.length; i++) {
        stack[i].handle = (req, res) => res.status(200).json({ ok: true });
      }
    }
    app.use(router);
    return app;
  }

  it('applications POST /: 3 submissions for same email succeed, 4th gets 429', async () => {
    const app = buildAppWithRouter('routes/applications.js');
    const email = 'ratelimit-applicant@example.com';
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/').send({ email });
      expect(res.status).toBe(200);
    }
    const fourth = await request(app).post('/').send({ email });
    expect(fourth.status).toBe(429);
  });

  it('applications POST /: different emails get separate buckets', async () => {
    // The limiter is keyed by email, so distinct applicants from the same IP
    // don't penalize each other. Verifies the keyGenerator wiring.
    const app = buildAppWithRouter('routes/applications.js');
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/')
        .send({ email: `ratelimit-distinct-${i}@example.com` });
      expect(res.status).toBe(200);
    }
    // A fourth, different email should still succeed even though we've sent
    // 4 requests from the same source IP.
    const fourthDistinct = await request(app)
      .post('/')
      .send({ email: 'ratelimit-distinct-other@example.com' });
    expect(fourthDistinct.status).toBe(200);
  });

  it('contact POST /: 5 from same IP succeed, 6th gets 429', async () => {
    const app = buildAppWithRouter('routes/contact.js');
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/').send({ message: `hi ${i}` });
      expect(res.status).toBe(200);
    }
    const sixth = await request(app).post('/').send({ message: 'sixth' });
    expect(sixth.status).toBe(429);
  });

  it('contact limiter response includes a clear error message', async () => {
    const app = buildAppWithRouter('routes/contact.js');
    for (let i = 0; i < 5; i++) {
      await request(app).post('/').send({ message: `hi ${i}` });
    }
    const blocked = await request(app).post('/').send({ message: 'blocked' });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toHaveProperty('error');
    expect(typeof blocked.body.error.message).toBe('string');
    expect(blocked.body.error.message.length).toBeGreaterThan(0);
  });
});
