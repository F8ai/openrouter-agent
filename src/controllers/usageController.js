/**
 * Usage Controller
 * Handles usage monitoring and analytics
 */

import express from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger.js';
import supabaseService from '../services/SupabaseService.js';

const router = express.Router();

// Validation schemas
const logUsageSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  apiKeyId: Joi.string().uuid().required(),
  model: Joi.string().required(),
  requestTokens: Joi.number().min(0).default(0),
  responseTokens: Joi.number().min(0).default(0),
  totalTokens: Joi.number().min(0).default(0),
  costUsd: Joi.number().min(0).default(0),
  endpoint: Joi.string().optional(),
  agentName: Joi.string().optional(),
  durationMs: Joi.number().min(0).optional()
});

/**
 * POST /api/usage/log
 * Log API usage for a user
 */
router.post('/log', async (req, res) => {
  try {
    const { error, value } = logUsageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details
      });
    }

    const usageLog = await supabaseService.logApiUsage(value.userId, value.apiKeyId, value);
    
    res.status(201).json({
      success: true,
      data: usageLog,
      message: 'Usage logged successfully'
    });
  } catch (error) {
    logger.error('Error logging usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log usage',
      message: error.message
    });
  }
});

/**
 * GET /api/usage/:userId
 * Get user's usage summary
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const monthDate = req.query.month || null;
    
    const usageSummary = await supabaseService.getUserUsageSummary(userId, monthDate);
    
    res.json({
      success: true,
      data: usageSummary
    });
  } catch (error) {
    logger.error('Error fetching usage summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage summary',
      message: error.message
    });
  }
});

/**
 * GET /api/usage/:userId/monthly
 * Get user's monthly usage breakdown
 */
router.get('/:userId/monthly', async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, month } = req.query;
    
    let targetDate;
    if (year && month) {
      targetDate = `${year}-${month.padStart(2, '0')}-01`;
    } else {
      targetDate = new Date().toISOString().split('T')[0];
    }
    
    const usageSummary = await supabaseService.getUserUsageSummary(userId, targetDate);
    
    res.json({
      success: true,
      data: {
        ...usageSummary,
        period: targetDate,
        userId
      }
    });
  } catch (error) {
    logger.error('Error fetching monthly usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monthly usage',
      message: error.message
    });
  }
});

/**
 * GET /api/usage/:userId/limit
 * Check if user has exceeded their usage limit
 */
router.get('/:userId/limit', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const withinLimit = await supabaseService.checkUserUsageLimit(userId);
    const userApiKey = await supabaseService.getUserApiKey(userId);
    
    res.json({
      success: true,
      data: {
        withinLimit,
        monthlyLimit: userApiKey?.monthly_limit,
        currentUsage: userApiKey?.current_usage,
        usageResetDate: userApiKey?.usage_reset_date
      }
    });
  } catch (error) {
    logger.error('Error checking usage limit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check usage limit',
      message: error.message
    });
  }
});

export default router;
