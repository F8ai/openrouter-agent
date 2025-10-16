/**
 * Health Controller
 * Handles health check endpoints
 */

import express from 'express';
import openRouterService from '../services/OpenRouterService.js';
import supabaseService from '../services/SupabaseService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /health
 * Basic health check
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'openrouter-agent',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

/**
 * GET /health/keys
 * Check OpenRouter API connectivity
 */
router.get('/keys', async (req, res) => {
  try {
    const health = await openRouterService.healthCheck();
    res.json({
      status: health.status,
      timestamp: new Date().toISOString(),
      service: 'openrouter-api',
      message: health.message
    });
  } catch (error) {
    logger.error('Health check failed for OpenRouter API:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'openrouter-api',
      error: error.message
    });
  }
});

/**
 * GET /health/database
 * Check Supabase connectivity
 */
router.get('/database', async (req, res) => {
  try {
    const health = await supabaseService.healthCheck();
    res.json({
      status: health.status,
      timestamp: new Date().toISOString(),
      service: 'supabase',
      message: health.message
    });
  } catch (error) {
    logger.error('Health check failed for Supabase:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'supabase',
      error: error.message
    });
  }
});

/**
 * GET /health/usage
 * Check usage monitoring service
 */
router.get('/usage', async (req, res) => {
  try {
    // Get basic usage stats to verify service is working
    const stats = await supabaseService.getSystemUsageStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'usage-monitoring',
      message: 'Usage monitoring is operational',
      stats: {
        totalRequests: stats.totalRequests,
        totalCost: stats.totalCost,
        totalTokens: stats.totalTokens
      }
    });
  } catch (error) {
    logger.error('Health check failed for usage monitoring:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'usage-monitoring',
      error: error.message
    });
  }
});

export default router;
