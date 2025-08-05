const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./utils/logger');
const { connectDB } = require('./database/connection');

// Route imports
const userRoutes = require('./routes/users');
const airdropRoutes = require('./routes/airdrops');
const ipRoutes = require('./routes/ips');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API versioning
const API_VERSION = '/api/v1';

// Routes
app.use(`${API_VERSION}/users`, userRoutes);
app.use(`${API_VERSION}/airdrops`, airdropRoutes);
app.use(`${API_VERSION}/ips`, ipRoutes);
app.use(`${API_VERSION}/analytics`, analyticsRoutes);

// API documentation endpoint
app.get(`${API_VERSION}/docs`, (req, res) => {
  res.json({
    title: 'SHAMBA LUV Backend API',
    version: '1.0.0',
    description: 'API for tracking user signups, airdrop claims, and anti-abuse protection',
    endpoints: {
      users: {
        'POST /users/register': 'Register new user/wallet',
        'GET /users/:walletAddress': 'Get user details',
        'PUT /users/:walletAddress/ip': 'Update user IP address'
      },
      airdrops: {
        'POST /airdrops/check-eligibility': 'Check if user can claim airdrop',
        'POST /airdrops/claim': 'Record airdrop claim attempt',
        'GET /airdrops/stats': 'Get airdrop statistics'
      },
      ips: {
        'GET /ips/:ipHash/claims': 'Get claim count for IP',
        'POST /ips/ban': 'Ban IP address',
        'GET /ips/suspicious': 'Get suspicious IP activity'
      },
      analytics: {
        'GET /analytics/dashboard': 'Get dashboard analytics',
        'GET /analytics/protection': 'Get protection system stats'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist.`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Global error handler:', err);
  
  // Don't expose error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal server error',
    stack: isDevelopment ? err.stack : undefined,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDB();
    logger.info('Database connected successfully');
    
    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`🚀 SHAMBA LUV Backend running on port ${PORT}`);
      logger.info(`📊 API Documentation: http://localhost:${PORT}${API_VERSION}/docs`);
      logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only start server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = app;