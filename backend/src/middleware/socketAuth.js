const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../config/logger');

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');
}

/**
 * Socket.io authentication middleware
 * Verifies JWT token from handshake auth or query params
 * Attaches user object to socket
 */
const socketAuth = async (socket, next) => {
  try {
    // Get token from auth object or query params
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    // Verify JWT
    const decoded = jwt.verify(token, jwtSecret);

    // Check token blocklist
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const blocked = await db.query('SELECT 1 FROM token_blocklist WHERE token_hash = $1', [tokenHash]);
    if (blocked.rows.length > 0) {
      return next(new Error('Token has been revoked'));
    }

    // Fetch user from database
    const result = await db.query(
      'SELECT id, email, name, role, deleted_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return next(new Error('User not found'));
    }

    if (result.rows[0].deleted_at) {
      return next(new Error('ACCOUNT_DELETED'));
    }

    // Attach user to socket
    socket.user = result.rows[0];
    socket.userId = result.rows[0].id;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new Error('Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    logger.error({ err: error }, 'Socket auth error');
    return next(new Error('Authentication failed'));
  }
};

module.exports = socketAuth;
