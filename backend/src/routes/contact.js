const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const logger = require('../config/logger');
const { sendContactNotification } = require('../services/email');

const router = express.Router();

const isTestEnv = process.env.NODE_ENV === 'test';

// Strict rate limit on the public contact form: each call sends an email, so
// abuse hurts SMTP relay quota and deliverability reputation.
const contactLimiter = isTestEnv
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { message: 'Too many contact form submissions. Please try again in an hour.' } }
    });

router.post('/', contactLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('subject').optional().trim(),
  body('organization').optional().trim()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: errors.array()[0].msg } });
    }

    const { name, email, message, subject, organization } = req.body;

    // Log the contact form submission
    logger.info({ name, email, subject, organization, messageLength: message.length }, 'Contact form submission received');

    // Send email notification (falls back to logging if SMTP not configured)
    await sendContactNotification({ name, email, subject, organization, message });

    res.json({ message: 'Thank you for your message. We will get back to you soon.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
