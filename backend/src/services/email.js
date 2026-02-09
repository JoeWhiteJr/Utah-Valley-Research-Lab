const nodemailer = require('nodemailer');
const logger = require('../config/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST) {
    logger.warn('SMTP not configured - emails will be logged only');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  const from = process.env.SMTP_FROM || 'noreply@utahvalleyresearchlab.com';
  const transport = getTransporter();

  if (!transport) {
    logger.info({ to, subject }, 'Email not sent (SMTP not configured)');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  try {
    const result = await transport.sendMail({ from, to, subject, html, text });
    logger.info({ to, subject, messageId: result.messageId }, 'Email sent');
    return { sent: true, messageId: result.messageId };
  } catch (error) {
    logger.error({ err: error, to, subject }, 'Failed to send email');
    return { sent: false, reason: error.message };
  }
}

async function sendPasswordResetEmail(email, resetToken, baseUrl) {
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  return sendEmail({
    to: email,
    subject: 'Password Reset - Stats Lab',
    html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Click here to reset your password</a></p><p>This link expires in 1 hour.</p><p>If you didn't request this, please ignore this email.</p>`,
    text: `You requested a password reset. Visit this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, please ignore this email.`,
  });
}

async function sendContactNotification({ name, email, subject, organization, message }) {
  const adminEmail = process.env.CONTACT_EMAIL || process.env.SMTP_FROM || 'admin@utahvalleyresearchlab.com';
  return sendEmail({
    to: adminEmail,
    subject: `Contact Form: ${subject || 'New Message'} from ${name}`,
    html: `<h3>New Contact Form Submission</h3><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Organization:</strong> ${organization || 'N/A'}</p><p><strong>Subject:</strong> ${subject || 'N/A'}</p><p><strong>Message:</strong></p><p>${message}</p>`,
    text: `New Contact Form Submission\n\nName: ${name}\nEmail: ${email}\nOrganization: ${organization || 'N/A'}\nSubject: ${subject || 'N/A'}\n\nMessage:\n${message}`,
  });
}

module.exports = { sendEmail, sendPasswordResetEmail, sendContactNotification };
