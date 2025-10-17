/**
 * Key Rotation Service
 * Handles automated key rotation and management
 */

import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import openRouterService from './OpenRouterService.js';
import supabaseService from './SupabaseService.js';

export class KeyRotationService {
  constructor() {
    this.isRunning = false;
    this.rotationSchedule = process.env.ROTATION_SCHEDULE || '0 2 1 * *'; // Monthly at 2 AM on 1st
    this.autoRotationEnabled = process.env.AUTO_ROTATION_ENABLED === 'true';
  }

  async start() {
    if (!this.autoRotationEnabled) {
      logger.info('Key rotation service disabled via configuration');
      return;
    }

    try {
      // Schedule automatic rotation
      cron.schedule(this.rotationSchedule, async () => {
        logger.info('Starting scheduled key rotation...');
        await this.rotateAllUserKeys();
      });

      this.isRunning = true;
      logger.info(`Key rotation service started with schedule: ${this.rotationSchedule}`);
    } catch (error) {
      logger.error('Failed to start key rotation service:', error);
      throw error;
    }
  }

  async stop() {
    this.isRunning = false;
    logger.info('Key rotation service stopped');
  }

  /**
   * Rotate all user keys
   */
  async rotateAllUserKeys() {
    try {
      logger.info('Starting rotation of all user keys...');
      
      const usersWithKeys = await supabaseService.getAllUsersWithKeys();
      const results = [];

      for (const userKey of usersWithKeys) {
        try {
          await this.rotateUserKey(userKey.user_id, false); // Don't delete old keys automatically
          results.push({ userId: userKey.user_id, success: true });
        } catch (error) {
          logger.error(`Failed to rotate key for user ${userKey.user_id}:`, error);
          results.push({ userId: userKey.user_id, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      logger.info(`Key rotation completed: ${successCount} successful, ${failureCount} failed`);

      // Send notification if configured
      await this.sendRotationNotification(results);

      return results;
    } catch (error) {
      logger.error('Failed to rotate all user keys:', error);
      throw error;
    }
  }

  /**
   * Rotate a specific user's key
   */
  async rotateUserKey(userId, deleteOld = false) {
    try {
      logger.info(`Rotating key for user ${userId}...`);

      // Get current user key
      const currentKey = await supabaseService.getUserApiKey(userId);
      if (!currentKey) {
        throw new Error(`No active API key found for user ${userId}`);
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

      logger.info(`Key rotation completed for user ${userId}`);
      return {
        oldKey: currentKey,
        newKey: newUserApiKey
      };
    } catch (error) {
      logger.error(`Failed to rotate key for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Rotate system keys (for the main Formul8 system)
   */
  async rotateSystemKeys() {
    try {
      logger.info('Starting system key rotation...');
      
      // This would integrate with your existing system key rotation
      // For now, we'll just log that it should be done
      logger.info('System key rotation should be handled by the main Formul8 system');
      
      return { success: true, message: 'System key rotation delegated to main system' };
    } catch (error) {
      logger.error('Failed to rotate system keys:', error);
      throw error;
    }
  }

  /**
   * Send rotation notification
   */
  async sendRotationNotification(results) {
    const webhookUrl = process.env.ROTATION_NOTIFICATION_WEBHOOK;
    if (!webhookUrl) {
      return;
    }

    try {
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      const message = {
        text: `🔑 OpenRouter Key Rotation Report`,
        attachments: [
          {
            color: failureCount > 0 ? 'warning' : 'good',
            fields: [
              {
                title: 'Total Users',
                value: results.length,
                short: true
              },
              {
                title: 'Successful',
                value: successCount,
                short: true
              },
              {
                title: 'Failed',
                value: failureCount,
                short: true
              }
            ],
            footer: 'OpenRouter Agent',
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      };

      // Send to webhook (Slack, Discord, etc.)
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }

      logger.info('Rotation notification sent successfully');
    } catch (error) {
      logger.error('Failed to send rotation notification:', error);
    }
  }

  /**
   * Get rotation status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      autoRotationEnabled: this.autoRotationEnabled,
      rotationSchedule: this.rotationSchedule
    };
  }
}

