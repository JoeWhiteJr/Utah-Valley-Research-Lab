const jwt = require('jsonwebtoken');
const db = require('../config/database');

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');
}

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: { message: 'No token provided' } });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret);

    const result = await db.query(
      'SELECT id, email, name, role, is_super_admin, deleted_at, avatar_url FROM users WHERE id = $1',
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

const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: { message: 'Not authenticated' } });
  }
  if (!req.user.is_super_admin) {
    return res.status(403).json({ error: { message: 'Super admin access required' } });
  }
  next();
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

      // Also check if user is assigned to any action item in the project
      if (result.rows.length === 0) {
        const assignedResult = await db.query(
          'SELECT id FROM action_items WHERE project_id = $1 AND assigned_to = $2 LIMIT 1',
          [projectId, req.user.id]
        );
        if (assignedResult.rows.length === 0) {
          return res.status(403).json({ error: { message: 'Access denied to this project' } });
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

module.exports = { authenticate, requireRole, requireSuperAdmin, requireProjectAccess, generateToken };
