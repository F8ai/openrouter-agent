#!/usr/bin/env node

/**
 * OpenRouter Agent Server
 * Main server for managing OpenRouter API keys
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cron from 'node-cron';

import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimiter } from './middleware/rateLimiter.js';

// Import controllers
import keyController from './controllers/keyController.js';
import usageController from './controllers/usageController.js';
import adminController from './controllers/adminController.js';
import healthController from './controllers/healthController.js';

// Import services
import { KeyRotationService } from './services/KeyRotationService.js';
import { UsageMonitoringService } from './services/UsageMonitoringService.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// ========================================
// MIDDLEWARE SETUP
// ========================================

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://formul8.ai', 'https://f8.syzygyx.com']
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID']
}));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(rateLimiter);

// ========================================
// HEALTH CHECK ENDPOINTS
// ========================================

app.get('/health', healthController.health);
app.get('/health/keys', healthController.keysHealth);
app.get('/health/database', healthController.databaseHealth);
app.get('/health/usage', healthController.usageHealth);

// ========================================
// API ROUTES
// ========================================

// Key management routes
app.use('/api/keys', authMiddleware, keyController);

// Usage monitoring routes
app.use('/api/usage', authMiddleware, usageController);

// Admin routes (require admin role)
app.use('/api/admin', authMiddleware, adminController);

// ========================================
// ERROR HANDLING
// ========================================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use(errorHandler);

// ========================================
// BACKGROUND SERVICES
// ========================================

// Initialize services
const keyRotationService = new KeyRotationService();
const usageMonitoringService = new UsageMonitoringService();

// Start background services
async function startBackgroundServices() {
  try {
    logger.info('Starting background services...');
    
    // Start usage monitoring
    await usageMonitoringService.start();
    logger.info('Usage monitoring service started');
    
    // Start key rotation service
    await keyRotationService.start();
    logger.info('Key rotation service started');
    
    // Schedule monthly usage reset
    cron.schedule('0 0 1 * *', async () => {
      logger.info('Running monthly usage reset...');
      try {
        await usageMonitoringService.resetMonthlyUsage();
        logger.info('Monthly usage reset completed');
      } catch (error) {
        logger.error('Monthly usage reset failed:', error);
      }
    });
    
    logger.info('Background services started successfully');
  } catch (error) {
    logger.error('Failed to start background services:', error);
    process.exit(1);
  }
}

// ========================================
// GRACEFUL SHUTDOWN
// ========================================

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Stop background services
    await keyRotationService.stop();
    await usageMonitoringService.stop();
    
    // Close server
    server.close(() => {
      logger.info('Server closed successfully');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// ========================================
// START SERVER
// ========================================

const server = app.listen(PORT, HOST, async () => {
  logger.info(`🚀 OpenRouter Agent server running on ${HOST}:${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🔑 Provisioning key configured: ${process.env.OPENROUTER_PROVISIONING_KEY ? 'Yes' : 'No'}`);
  logger.info(`🗄️  Supabase configured: ${process.env.SUPABASE_URL ? 'Yes' : 'No'}`);
  
  // Start background services
  await startBackgroundServices();
});

// Export for testing
export default app;
