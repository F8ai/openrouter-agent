/**
 * Authentication Middleware
 * Handles authentication and authorization for the OpenRouter Agent
 */

import { logger } from '../utils/logger.js';

export function authMiddleware(req, res, next) {
  // For now, we'll implement a simple API key authentication
  // In production, you'd want to integrate with your main auth system
  
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'API key required'
    });
  }

  // Simple validation - in production, validate against your auth system
  if (apiKey !== process.env.OPENROUTER_AGENT_API_KEY) {
    logger.warn('Invalid API key attempt:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url
    });
    
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  // Extract user ID from headers if provided
  const userId = req.headers['x-user-id'];
  if (userId) {
    req.user = { id: userId };
  }

  next();
}

export function requireAdmin(req, res, next) {
  // Check if user has admin role
  const userRole = req.headers['x-user-role'];
  
  if (!userRole || !['admin', 'superadmin'].includes(userRole)) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }

  next();
}

export function requireUser(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'User authentication required'
    });
  }

  next();
}

export default {
  authMiddleware,
  requireAdmin,
  requireUser
};
