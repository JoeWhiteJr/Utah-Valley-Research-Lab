/**
 * Verifies the dedicated loginLimiter added in fix/split-auth-limiter is wired
 * onto POST /login (and only POST /login) inside routes/auth.js, and that the
 * router-level authLimiter in index.js still covers all /api/auth/* routes.
 *
 * Background: the old setup wired a single authLimiter (20/15min/IP) across
 * every /api/auth/* endpoint. That was simultaneously too loose for /login
 * (credential guessing) and too strict for /me + /logout (refresh-heavy SPA).
 * The fix is two-tier:
 *   - authLimiter stays at the router level but with a generous cap (60/15min/IP)
 *   - loginLimiter (5/15min/email-or-IP) attaches to POST /login only
 *
 * Same isolated-require + router-stack inspection pattern as
 * rateLimitHardening.test.js (PR #97).
 */

const path = require('path');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'login-limiter-test-secret-not-used-for-signing-anything-real';
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

describe('split authLimiter — loginLimiter wiring on routes/auth.js', () => {
  it('attaches loginLimiter to POST /login', () => {
    const router = loadRouteInProdMode('routes/auth.js');
    const handlers = getRouteHandlers(router, 'post', '/login');
    expect(handlers).not.toBeNull();
    expect(handlers.some(isLimiter)).toBe(true);
  });

  it('places the limiter BEFORE the express-validator middleware', () => {
    // Validators run body() checks which are inexpensive but the limiter is the
    // cheapest possible gate — putting it first means an attacker can't even
    // pay for validation past the cap.
    const router = loadRouteInProdMode('routes/auth.js');
    const handlers = getRouteHandlers(router, 'post', '/login');
    expect(handlers).not.toBeNull();
    const limiterIdx = handlers.findIndex(isLimiter);
    expect(limiterIdx).toBeGreaterThanOrEqual(0);
    // The terminal route handler is the async (req, res, next) => {...} fn.
    // Everything between the limiter and the handler is validator middleware.
    // We just need limiter to come before the LAST handler (the actual login
    // handler), and ideally before any other middleware too.
    expect(limiterIdx).toBe(0);
  });

  it('does NOT attach a rate limiter to GET /me', () => {
    // /me is hit on every page load + visibility-change in the SPA. Any
    // dedicated route-level limiter here would defeat the purpose of the
    // split.
    const router = loadRouteInProdMode('routes/auth.js');
    const handlers = getRouteHandlers(router, 'get', '/me');
    expect(handlers).not.toBeNull();
    expect(handlers.some(isLimiter)).toBe(false);
  });

  it('does NOT attach a rate limiter to POST /logout', () => {
    const router = loadRouteInProdMode('routes/auth.js');
    const handlers = getRouteHandlers(router, 'post', '/logout');
    expect(handlers).not.toBeNull();
    expect(handlers.some(isLimiter)).toBe(false);
  });

  it('does NOT attach a rate limiter to POST /reset-password', () => {
    // /reset-password is one-shot per token; the token itself is the rate gate
    // (single-use, 1h TTL, hashed). No need for a dedicated limiter.
    const router = loadRouteInProdMode('routes/auth.js');
    const handlers = getRouteHandlers(router, 'post', '/reset-password');
    expect(handlers).not.toBeNull();
    expect(handlers.some(isLimiter)).toBe(false);
  });

  it('still attaches forgotPasswordLimiter to POST /forgot-password', () => {
    // Regression guard — this PR must not disturb the existing
    // forgotPasswordLimiter wiring (5/15min/email-or-IP).
    const router = loadRouteInProdMode('routes/auth.js');
    const handlers = getRouteHandlers(router, 'post', '/forgot-password');
    expect(handlers).not.toBeNull();
    expect(handlers.some(isLimiter)).toBe(true);
  });

  it('login limiter and forgot-password limiter are distinct instances', () => {
    // Sanity check: the two strict per-email buckets should be separate so
    // login attempts don't burn the password-reset budget and vice versa.
    const router = loadRouteInProdMode('routes/auth.js');
    const loginHandlers = getRouteHandlers(router, 'post', '/login');
    const forgotHandlers = getRouteHandlers(router, 'post', '/forgot-password');
    const loginL = loginHandlers.find(isLimiter);
    const forgotL = forgotHandlers.find(isLimiter);
    expect(loginL).toBeDefined();
    expect(forgotL).toBeDefined();
    expect(loginL).not.toBe(forgotL);
  });
});

describe('split authLimiter — router-level authLimiter still wired in index.js', () => {
  // The router-level authLimiter is installed via app.use('/api/auth', authLimiter, authRoutes)
  // in index.js. We don't import index.js directly here (it boots the whole
  // server, opens DB pools, etc.) — instead we read the source and assert the
  // wiring is intact. This is a smoke check, not a behavioral test.
  const fs = require('fs');
  const indexSource = fs.readFileSync(
    path.join(__dirname, '..', 'index.js'),
    'utf8'
  );

  it('defines an authLimiter', () => {
    // Accepts either the legacy `rateLimit(...)` call or the consolidated
    // `createLimiter(...)` factory introduced in refactor/rate-limiter-factory.
    expect(indexSource).toMatch(/const\s+authLimiter\s*=\s*(?:rateLimit|createLimiter)\(/);
  });

  it('applies authLimiter to /api/auth at the router level', () => {
    // The argument order matters: authLimiter must come BEFORE authRoutes so
    // every request to /api/auth/* passes through the IP backstop first.
    expect(indexSource).toMatch(
      /app\.use\(\s*['"]\/api\/auth['"]\s*,\s*authLimiter\s*,\s*authRoutes\s*\)/
    );
  });

  it('uses the loosened 60-request cap (not the old 20)', () => {
    // Regression guard — the looser cap is the whole point of the split. If
    // someone reverts to 20 the SPA self-lock returns.
    const match = indexSource.match(
      /const\s+authLimiter\s*=\s*(?:rateLimit|createLimiter)\(\s*\{([\s\S]*?)\}\s*\)/
    );
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/max:\s*60\b/);
    expect(match[1]).not.toMatch(/max:\s*20\b/);
  });
});

describe('split authLimiter — loginLimiter behavior in production mode', () => {
  // Smoke-test that the limiter actually rate-limits when NODE_ENV !== 'test'.
  // We mount the router on a fresh Express app, stub the terminal handler so
  // we never hit the DB, and verify the 6th attempt for the same email gets
  // 429. Same approach as rateLimitHardening.test.js.
  const express = require('express');
  const request = require('supertest');

  function buildAppWithRouter(relativePath) {
    const router = loadRouteInProdMode(relativePath);
    const app = express();
    app.set('trust proxy', false);
    app.use(express.json());
    for (const layer of router.stack) {
      if (!layer.route) continue;
      const stack = layer.route.stack;
      const limiterIdx = stack.findIndex((s) => isLimiter(s.handle));
      if (limiterIdx === -1) continue;
      for (let i = limiterIdx + 1; i < stack.length; i++) {
        stack[i].handle = (req, res) => res.status(200).json({ ok: true });
      }
    }
    app.use(router);
    return app;
  }

  it('POST /login: 5 attempts for same email succeed, 6th gets 429', async () => {
    const app = buildAppWithRouter('routes/auth.js');
    const email = 'ratelimit-login@example.com';
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/login')
        .send({ email, password: 'wrong-password' });
      expect(res.status).toBe(200);
    }
    const sixth = await request(app)
      .post('/login')
      .send({ email, password: 'wrong-password' });
    expect(sixth.status).toBe(429);
  });

  it('POST /login: different emails get separate buckets', async () => {
    // The limiter is keyed by email, so distinct accounts from the same source
    // don't penalize each other. Verifies the keyGenerator wiring.
    const app = buildAppWithRouter('routes/auth.js');
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/login')
        .send({ email: `ratelimit-distinct-${i}@example.com`, password: 'x' });
      expect(res.status).toBe(200);
    }
    const otherEmail = await request(app)
      .post('/login')
      .send({ email: 'ratelimit-distinct-other@example.com', password: 'x' });
    expect(otherEmail.status).toBe(200);
  });
});
