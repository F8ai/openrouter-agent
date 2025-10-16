/**
 * Rate Limiter Middleware
 * Implements rate limiting for API endpoints
 */

import { logger } from '../utils/logger.js';

// Simple in-memory rate limiter
// In production, use Redis for distributed rate limiting
const requestCounts = new Map();
const windowMs = parseInt(process.env.API_RATE_WINDOW) || 900000; // 15 minutes
const maxRequests = parseInt(process.env.API_RATE_LIMIT) || 100;

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.resetTime > windowMs) {
      requestCounts.delete(key);
    }
  }
}, windowMs);

export function rateLimiter(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  
  const requestData = requestCounts.get(key) || {
    count: 0,
    resetTime: now + windowMs
  };

  // Reset if window has passed
  if (now > requestData.resetTime) {
    requestData.count = 0;
    requestData.resetTime = now + windowMs;
  }

  // Check if limit exceeded
  if (requestData.count >= maxRequests) {
    logger.warn('Rate limit exceeded:', {
      ip: req.ip,
      count: requestData.count,
      limit: maxRequests,
      url: req.url
    });

    return res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      retryAfter: Math.ceil((requestData.resetTime - now) / 1000)
    });
  }

  // Increment counter
  requestData.count++;
  requestCounts.set(key, requestData);

  // Add rate limit headers
  res.set({
    'X-RateLimit-Limit': maxRequests,
    'X-RateLimit-Remaining': Math.max(0, maxRequests - requestData.count),
    'X-RateLimit-Reset': new Date(requestData.resetTime).toISOString()
  });

  next();
}

export default rateLimiter;
