const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, generateToken } = require('../middleware/auth');
const { logActivity } = require('./users');
const logger = require('../config/logger');
const { sendPasswordResetEmail } = require('../services/email');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Stricter rate limit for password reset to prevent email enumeration
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: { message: 'Too many password reset requests, please try again later' } },
  keyGenerator: (req) => req.body?.email || req.ip,
});

// Register - disabled, users must apply and be approved by an admin
// New accounts are created via the application approval flow (see routes/applications.js)
router.post('/register', (req, res) => {
  res.status(403).json({ error: { message: 'Registration is closed. Please submit an application at /apply.' } });
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { email, password } = req.body;

    const result = await db.query(
      'SELECT id, email, password_hash, name, first_name, last_name, role, is_super_admin, avatar_url FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }

    const token = generateToken(user.id);

    // Log login activity for streak tracking
    logActivity(user.id, 'login');

    res.json({
      user: { id: user.id, email: user.email, name: user.name, first_name: user.first_name, last_name: user.last_name, role: user.role, is_super_admin: user.is_super_admin, avatar_url: user.avatar_url },
      token
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Logout with token blocklist
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const decoded = jwt.decode(token);
      const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.query(
        'INSERT INTO token_blocklist (token_hash, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [tokenHash, expiresAt]
      );
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// Request password reset
router.post('/forgot-password', forgotPasswordLimiter, [
  body('email').isEmail().normalizeEmail()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Valid email is required' } });
    }

    const { email } = req.body;
    const user = await db.query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);

    // Always return success to prevent email enumeration
    if (user.rows.length === 0) {
      return res.json({ message: 'If an account exists with that email, a reset link has been generated.' });
    }

    // Generate token and store its hash (never store raw tokens)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.rows[0].id, hashedToken, expiresAt]
    );

    // Send password reset email (falls back to logging if SMTP not configured)
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    await sendPasswordResetEmail(email, rawToken, baseUrl);
    logger.info({ userId: user.rows[0].id }, 'Password reset token generated');

    res.json({ message: 'If an account exists with that email, a reset link has been generated.' });
  } catch (error) {
    next(error);
  }
});

// Reset password with token
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Token and password (min 8 chars) are required' } });
    }

    const { token, password } = req.body;

    // Hash the incoming token to compare against stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        'SELECT * FROM password_reset_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > NOW() FOR UPDATE',
        [hashedToken]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: { message: 'Invalid or expired reset token' } });
      }

      const resetToken = result.rows[0];
      const hashedPassword = await bcrypt.hash(password, 12);

      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, resetToken.user_id]);
      await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [resetToken.id]);

      await client.query('COMMIT');
      res.json({ message: 'Password has been reset successfully. You can now log in.' });
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
