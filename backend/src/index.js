const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const logger = require('./config/logger');
const db = require('./config/database');
const socketService = require('./services/socketService');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const actionRoutes = require('./routes/actions');
const categoryRoutes = require('./routes/categories');
const fileRoutes = require('./routes/files');
const noteRoutes = require('./routes/notes');
const meetingRoutes = require('./routes/meetings');
const userRoutes = require('./routes/users');
const applicationRoutes = require('./routes/applications');
const chatRoutes = require('./routes/chats');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const aiRoutes = require('./routes/ai');
const publicRoutes = require('./routes/public');
const calendarRoutes = require('./routes/calendar');
const contactRoutes = require('./routes/contact');
const searchRoutes = require('./routes/search');
const commentRoutes = require('./routes/comments');
const activityRoutes = require('./routes/activity');
const trashRoutes = require('./routes/trash');
const folderRoutes = require('./routes/folders');
const plannerRoutes = require('./routes/planner');
const assistantRoutes = require('./routes/assistant');
const { publicRouter: siteContentPublicRoutes, adminRouter: siteContentAdminRoutes } = require('./routes/siteContent');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (behind Nginx)
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// Structured HTTP request logging
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    const allowed = process.env.CORS_ORIGIN;
    if (!allowed || allowed === '*') {
      if (process.env.NODE_ENV === 'production') {
        // In production, reject wildcard/unset CORS -- require explicit origins
        logger.warn('CORS_ORIGIN is wildcard or unset in production. Rejecting unknown origin: ' + origin);
        return callback(null, false);
      }
      // In non-production, allow any origin but mirror it back
      // (credentials: true requires a specific origin, not '*')
      return callback(null, origin);
    }
    // Support comma-separated origins
    const origins = allowed.split(',').map(o => o.trim());
    if (origins.includes(origin)) {
      return callback(null, origin);
    }
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve cover images statically (these are public project images, not sensitive files)
// Other file uploads remain behind authenticated /api/files/:id/download endpoint
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
app.use('/uploads/covers', express.static(path.join(uploadDir, 'covers'), { maxAge: '1d' }));
app.use('/uploads/avatars', express.static(path.join(uploadDir, 'avatars'), { maxAge: '1d' }));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: { message: 'Too many requests, please try again later' } }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: { message: 'Too many requests, please try again later' } }
});

// API Routes
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/trash', trashRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/public', siteContentPublicRoutes);
app.use('/api/admin', siteContentAdminRoutes);

// Health check with DB connectivity verification
app.get('/api/health', async (req, res) => {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('DB health check timeout')), 2000)
    );
    await Promise.race([db.query('SELECT 1'), timeoutPromise]);
    res.json({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'error', timestamp: new Date().toISOString() });
  }
});

// Error handling middleware
app.use((err, req, res, _next) => {
  logger.error({ err }, 'Unhandled error');
  res.status(err.status || 500).json({
    error: {
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Not found' } });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const SOCKET_CORS = process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*'
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : '*';
socketService.initialize(server, SOCKET_CORS);

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info({ signal }, 'Graceful shutdown initiated');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT }, 'Stats Lab API running');
    logger.info('Socket.io ready');
  });
}

module.exports = { app, server };
