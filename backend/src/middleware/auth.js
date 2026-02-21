const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');
}

// In-memory token blocklist cache: Map<tokenHash, timestamp>
const blockedTokenCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Periodic cleanup of expired cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [hash, addedAt] of blockedTokenCache) {
    if (now - addedAt > CACHE_TTL_MS) {
      blockedTokenCache.delete(hash);
    }
  }
}, 10 * 60 * 1000).unref();

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: { message: 'No token provided' } });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);

    // Check token blocklist (cache-first, then DB)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const cachedAt = blockedTokenCache.get(tokenHash);
    if (cachedAt && (Date.now() - cachedAt < CACHE_TTL_MS)) {
      return res.status(401).json({ error: { message: 'Token has been revoked' } });
    }

    const blocked = await db.query('SELECT 1 FROM token_blocklist WHERE token_hash = $1', [tokenHash]);
    if (blocked.rows.length > 0) {
      blockedTokenCache.set(tokenHash, Date.now());
      return res.status(401).json({ error: { message: 'Token has been revoked' } });
    }

    const result = await db.query(
      'SELECT id, email, name, first_name, last_name, role, is_super_admin, deleted_at, avatar_url FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: { message: 'User not found' } });
    }

    if (result.rows[0].deleted_at) {
      return res.status(403).json({ error: { message: 'Your access has been revoked. Please contact an administrator.', code: 'ACCOUNT_DELETED' } });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: { message: 'Invalid token' } });
    }
    next(error);
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Not authenticated' } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { message: 'Insufficient permissions' } });
    }
    next();
  };
};

const requireProjectAccess = (paramName = 'projectId') => {
  return async (req, res, next) => {
    try {
      const projectId = req.params[paramName];
      if (!projectId) return next();

      // Admins have access to all projects
      if (req.user.role === 'admin') return next();

      const result = await db.query(
        'SELECT id FROM projects WHERE id = $1 AND created_by = $2',
        [projectId, req.user.id]
      );

      if (result.rows.length === 0) {
        // Check project_members table
        const memberResult = await db.query(
          'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2 LIMIT 1',
          [projectId, req.user.id]
        );

        if (memberResult.rows.length === 0) {
          // Also check if user is assigned to any action item in the project
          const assignedResult = await db.query(
            `SELECT 1 FROM action_items ai
             LEFT JOIN action_item_assignees aia ON ai.id = aia.action_item_id
             WHERE ai.project_id = $1 AND (ai.assigned_to = $2 OR aia.user_id = $2)
             LIMIT 1`,
            [projectId, req.user.id]
          );
          if (assignedResult.rows.length === 0) {
            return res.status(403).json({ error: { message: 'Access denied to this project' } });
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

const generateToken = (userId) => {
  return jwt.sign({ userId }, jwtSecret, { expiresIn: '7d' });
};

const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const cachedAt = blockedTokenCache.get(tokenHash);
    if (cachedAt && (Date.now() - cachedAt < CACHE_TTL_MS)) {
      return next();
    }

    const blocked = await db.query('SELECT 1 FROM token_blocklist WHERE token_hash = $1', [tokenHash]);
    if (blocked.rows.length > 0) {
      blockedTokenCache.set(tokenHash, Date.now());
      return next();
    }

    const result = await db.query(
      'SELECT id, email, name, first_name, last_name, role, is_super_admin, deleted_at, avatar_url FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length > 0 && !result.rows[0].deleted_at) {
      req.user = result.rows[0];
    }
    next();
  } catch {
    next();
  }
};

module.exports = { authenticate, optionalAuthenticate, requireRole, requireProjectAccess, generateToken };
