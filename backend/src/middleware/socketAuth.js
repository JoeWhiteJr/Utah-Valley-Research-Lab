const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

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
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch user from database
    const result = await db.query(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return next(new Error('User not found'));
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
    console.error('Socket auth error:', error);
    return next(new Error('Authentication failed'));
  }
};

module.exports = socketAuth;
