/**
 * Admin Controller
 * Handles admin-only operations
 */

import express from 'express';
import { logger } from '../utils/logger.js';
import { requireAdmin } from '../middleware/auth.js';
import openRouterService from '../services/OpenRouterService.js';
import supabaseService from '../services/SupabaseService.js';

const router = express.Router();

// Apply admin middleware to all routes
router.use(requireAdmin);

/**
 * GET /api/admin/keys
 * List all users with API keys
 */
router.get('/keys', async (req, res) => {
  try {
    const usersWithKeys = await supabaseService.getAllUsersWithKeys();
    
    res.json({
      success: true,
      data: usersWithKeys,
      count: usersWithKeys.length
    });
  } catch (error) {
    logger.error('Error fetching users with keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users with keys',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/usage
 * Get system-wide usage statistics
 */
router.get('/usage', async (req, res) => {
  try {
    const systemStats = await supabaseService.getSystemUsageStats();
    
    res.json({
      success: true,
      data: systemStats
    });
  } catch (error) {
    logger.error('Error fetching system usage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system usage stats',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/reset-usage
 * Reset monthly usage for all users
 */
router.post('/reset-usage', async (req, res) => {
  try {
    const resetCount = await supabaseService.resetAllMonthlyUsage();
    
    logger.info(`Admin reset monthly usage: ${resetCount} users updated`);
    
    res.json({
      success: true,
      data: {
        usersUpdated: resetCount
      },
      message: 'Monthly usage reset completed'
    });
  } catch (error) {
    logger.error('Error resetting monthly usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset monthly usage',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/keys/openrouter
 * List all OpenRouter keys
 */
router.get('/keys/openrouter', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const keys = await openRouterService.listKeys(limit);
    
    res.json({
      success: true,
      data: keys,
      count: keys.length
    });
  } catch (error) {
    logger.error('Error listing OpenRouter keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list OpenRouter keys',
      message: error.message
    });
  }
});

/**
 * DELETE /api/admin/keys/openrouter/:keyId
 * Delete an OpenRouter key
 */
router.delete('/keys/openrouter/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;
    
    await openRouterService.deleteKey(keyId);
    
    logger.info(`Admin deleted OpenRouter key: ${keyId}`);
    
    res.json({
      success: true,
      message: 'OpenRouter key deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting OpenRouter key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete OpenRouter key',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/keys/batch-delete
 * Delete multiple OpenRouter keys
 */
router.post('/keys/batch-delete', async (req, res) => {
  try {
    const { keyIds } = req.body;
    
    if (!Array.isArray(keyIds) || keyIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid key IDs provided'
      });
    }
    
    const results = await openRouterService.batchOperation('delete', keyIds);
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    logger.info(`Admin batch delete: ${successCount} successful, ${failureCount} failed`);
    
    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: keyIds.length,
          successful: successCount,
          failed: failureCount
        }
      },
      message: 'Batch delete operation completed'
    });
  } catch (error) {
    logger.error('Error in batch delete operation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform batch delete',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/health
 * Comprehensive health check for admin
 */
router.get('/health', async (req, res) => {
  try {
    const [openRouterHealth, supabaseHealth, systemStats] = await Promise.all([
      openRouterService.healthCheck(),
      supabaseService.healthCheck(),
      supabaseService.getSystemUsageStats()
    ]);
    
    const overallHealth = openRouterHealth.status === 'healthy' && 
                         supabaseHealth.status === 'healthy' ? 'healthy' : 'unhealthy';
    
    res.json({
      success: true,
      data: {
        overall: overallHealth,
        services: {
          openRouter: openRouterHealth,
          supabase: supabaseHealth
        },
        systemStats
      }
    });
  } catch (error) {
    logger.error('Error in admin health check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform health check',
      message: error.message
    });
  }
});

export default router;

