const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const socketService = require('./services/socketService');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const actionRoutes = require('./routes/actions');
const fileRoutes = require('./routes/files');
const noteRoutes = require('./routes/notes');
const meetingRoutes = require('./routes/meetings');
const userRoutes = require('./routes/users');
const applicationRoutes = require('./routes/applications');
const chatRoutes = require('./routes/chats');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
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
