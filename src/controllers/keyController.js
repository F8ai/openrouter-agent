/**
 * Key Controller
 * Handles API key management operations
 */

import express from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger.js';
import openRouterService from '../services/OpenRouterService.js';
import supabaseService from '../services/SupabaseService.js';

const router = express.Router();

// Validation schemas
const createKeySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  limit: Joi.number().positive().optional(),
  label: Joi.string().max(50).optional()
});

const createUserKeySchema = Joi.object({
  userId: Joi.string().uuid().required(),
  monthlyLimit: Joi.number().positive().optional()
});

const rotateUserKeySchema = Joi.object({
  userId: Joi.string().uuid().required(),
  deleteOld: Joi.boolean().default(false)
});

/**
 * GET /api/keys
 * List all OpenRouter keys
 */
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const keys = await openRouterService.listKeys(limit);
    
    res.json({
      success: true,
      data: keys,
      count: keys.length
    });
  } catch (error) {
    logger.error('Error listing keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list keys',
      message: error.message
    });
  }
});

/**
 * POST /api/keys/create
 * Create a new OpenRouter key
 */
router.post('/create', async (req, res) => {
  try {
    const { error, value } = createKeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details
      });
    }

    const { name, limit, label } = value;
    const key = await openRouterService.createKey(name, limit, label);
    
    res.status(201).json({
      success: true,
      data: key,
      message: 'Key created successfully'
    });
  } catch (error) {
    logger.error('Error creating key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create key',
      message: error.message
    });
  }
});

/**
 * POST /api/keys/create-user
 * Create a key for a specific user
 */
router.post('/create-user', async (req, res) => {
  try {
    const { error, value } = createUserKeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details
      });
    }

    const { userId, monthlyLimit } = value;
    
    // Check if user already has an active key
    const existingKey = await supabaseService.getUserApiKey(userId);
    if (existingKey) {
      return res.status(409).json({
        success: false,
        error: 'User already has an active API key',
        data: existingKey
      });
    }

    // Get user's subscription tier for default limit
    const subscription = await supabaseService.getUserSubscriptionTier(userId);
    const defaultLimit = getDefaultMonthlyLimit(subscription?.plan || 'free');
    const finalLimit = monthlyLimit || defaultLimit;

    // Create OpenRouter key
    const openRouterKey = await openRouterService.createUserKey(userId, finalLimit);
    
    // Store in Supabase
    const userApiKey = await supabaseService.createUserApiKey(
      userId,
      openRouterKey.id,
      openRouterKey.name,
      finalLimit
    );
    
    res.status(201).json({
      success: true,
      data: {
        userApiKey,
        openRouterKey: {
          id: openRouterKey.id,
          name: openRouterKey.name,
          key: openRouterKey.key // Only returned once!
        }
      },
      message: 'User API key created successfully'
    });
  } catch (error) {
    logger.error('Error creating user key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user key',
      message: error.message
    });
  }
});

/**
 * GET /api/keys/user/:userId
 * Get user's API key information
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userApiKey = await supabaseService.getUserApiKey(userId);
    if (!userApiKey) {
      return res.status(404).json({
        success: false,
        error: 'No API key found for user'
      });
    }

    // Get additional info from OpenRouter
    const openRouterInfo = await openRouterService.getKeyInfo(userApiKey.openrouter_key_id);
    
    res.json({
      success: true,
      data: {
        userApiKey,
        openRouterInfo: {
          id: openRouterInfo.id,
          name: openRouterInfo.name,
          usage: openRouterInfo.usage,
          limit: openRouterInfo.limit,
          isFreeTier: openRouterInfo.is_free_tier,
          lastUsed: openRouterInfo.last_used
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching user key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user key',
      message: error.message
    });
  }
});

/**
 * POST /api/keys/rotate-user
 * Rotate a user's API key
 */
router.post('/rotate-user', async (req, res) => {
  try {
    const { error, value } = rotateUserKeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details
      });
    }

    const { userId, deleteOld } = value;
    
    // Get current user key
    const currentKey = await supabaseService.getUserApiKey(userId);
    if (!currentKey) {
      return res.status(404).json({
        success: false,
        error: 'No active API key found for user'
      });
    }

    // Deactivate current key
    await supabaseService.deactivateUserApiKey(userId);
    
    // Create new key
    const newOpenRouterKey = await openRouterService.createUserKey(userId, currentKey.monthly_limit);
    
    // Store new key in Supabase
    const newUserApiKey = await supabaseService.createUserApiKey(
      userId,
      newOpenRouterKey.id,
      newOpenRouterKey.name,
      currentKey.monthly_limit
    );
    
    // Optionally delete old key from OpenRouter
    if (deleteOld) {
      try {
        await openRouterService.deleteKey(currentKey.openrouter_key_id);
        logger.info(`Old key deleted for user ${userId}: ${currentKey.openrouter_key_id}`);
      } catch (error) {
        logger.warn(`Failed to delete old key for user ${userId}:`, error);
      }
    }
    
    res.json({
      success: true,
      data: {
        oldKey: currentKey,
        newKey: {
          userApiKey: newUserApiKey,
          openRouterKey: {
            id: newOpenRouterKey.id,
            name: newOpenRouterKey.name,
            key: newOpenRouterKey.key // Only returned once!
          }
        }
      },
      message: 'User API key rotated successfully'
    });
  } catch (error) {
    logger.error('Error rotating user key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rotate user key',
      message: error.message
    });
  }
});

/**
 * DELETE /api/keys/:keyId
 * Delete an OpenRouter key
 */
router.delete('/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;
    
    await openRouterService.deleteKey(keyId);
    
    res.json({
      success: true,
      message: 'Key deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete key',
      message: error.message
    });
  }
});

/**
 * GET /api/keys/:keyId/info
 * Get information about a specific key
 */
router.get('/:keyId/info', async (req, res) => {
  try {
    const { keyId } = req.params;
    
    const keyInfo = await openRouterService.getKeyInfo(keyId);
    
    res.json({
      success: true,
      data: keyInfo
    });
  } catch (error) {
    logger.error('Error fetching key info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch key info',
      message: error.message
    });
  }
});

/**
 * POST /api/keys/:keyId/test
 * Test if a key is valid
 */
router.post('/:keyId/test', async (req, res) => {
  try {
    const { keyId } = req.params;
    
    const testResult = await openRouterService.testKey(keyId);
    
    res.json({
      success: true,
      data: testResult
    });
  } catch (error) {
    logger.error('Error testing key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test key',
      message: error.message
    });
  }
});

/**
 * Helper function to get default monthly limit based on subscription tier
 */
function getDefaultMonthlyLimit(subscriptionPlan) {
  const limits = {
    'free': 10.00,
    'standard': 50.00,
    'micro': 100.00,
    'operator': 250.00,
    'enterprise': 500.00,
    'beta': 1000.00,
    'admin': null, // Unlimited
    'future4200': null // Unlimited
  };

  return limits[subscriptionPlan] || 10.00; // Default to free tier
}

export default router;

