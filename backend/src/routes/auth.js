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

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: { message: 'Email already registered' } });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const isSuperAdminEmail = email === '10947671@uvu.edu';
    const role = isSuperAdminEmail ? 'admin' : 'researcher';

    const result = await db.query(
      'INSERT INTO users (email, password_hash, name, role, is_super_admin) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role, is_super_admin, created_at',
      [email, passwordHash, name, role, isSuperAdminEmail]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, is_super_admin: user.is_super_admin },
      token
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
