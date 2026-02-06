const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
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

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (behind Nginx)
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve cover images statically (these are public project images, not sensitive files)
// Other file uploads remain behind authenticated /api/files/:id/download endpoint
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
app.use('/uploads/covers', express.static(path.join(uploadDir, 'covers')));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: { message: 'Too many requests, please try again later' } }
});

// API Routes
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
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
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
socketService.initialize(server, CORS_ORIGIN);

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Stats Lab API running on port ${PORT}`);
    console.log(`Socket.io ready for connections`);
  });
}

module.exports = { app, server };
