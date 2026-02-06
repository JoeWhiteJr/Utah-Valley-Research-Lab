const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, generateToken } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').trim().notEmpty()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', details: errors.array() } });
    }

    const { email, password, name } = req.body;

    // Check if email already exists in users table
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: { message: 'Email already registered' } });
    }

    // Check if email has a pending application
    const pendingApp = await db.query(
      'SELECT id FROM applications WHERE email = $1 AND status = $2',
      [email, 'pending']
    );
    if (pendingApp.rows.length > 0) {
      return res.status(409).json({ error: { message: 'An application with this email is already pending' } });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Super admin: create user directly, bypass approval
    const isSuperAdminEmail = email === '10947671@uvu.edu';
    if (isSuperAdminEmail) {
      const result = await db.query(
        'INSERT INTO users (email, password_hash, name, role, is_super_admin) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role, is_super_admin, created_at',
        [email, passwordHash, name, 'admin', true]
      );

      const user = result.rows[0];
      const token = generateToken(user.id);

      return res.status(201).json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, is_super_admin: user.is_super_admin },
        token
      });
    }

    // Everyone else: create a pending application
    await db.query(
      'INSERT INTO applications (name, email, password_hash, message, status) VALUES ($1, $2, $3, $4, $5)',
      [name, email, passwordHash, 'Account registration', 'pending']
    );

    res.status(201).json({
      message: 'Your registration has been submitted and is awaiting admin approval.',
      requiresApproval: true
    });
  } catch (error) {
    next(error);
  }
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
      'SELECT id, email, password_hash, name, role, is_super_admin FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      // Check if there's a pending application for this email
      const pendingApp = await db.query(
        'SELECT id, password_hash FROM applications WHERE email = $1 AND status = $2',
        [email, 'pending']
      );

      if (pendingApp.rows.length > 0 && pendingApp.rows[0].password_hash) {
        const appPasswordValid = await bcrypt.compare(password, pendingApp.rows[0].password_hash);
        if (appPasswordValid) {
          return res.status(403).json({
            error: {
              message: 'Your application is currently under review by the admins. Thank you for your patience.',
              code: 'PENDING_APPROVAL'
            }
          });
        }
      }

      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }

    const token = generateToken(user.id);

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, is_super_admin: user.is_super_admin },
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

// Logout (client-side token removal, but we can add token blacklisting later)
router.post('/logout', authenticate, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
