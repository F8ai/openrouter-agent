/**
 * Usage Monitoring Service
 * Handles usage tracking and monitoring
 */

import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import supabaseService from './SupabaseService.js';

export class UsageMonitoringService {
  constructor() {
    this.isRunning = false;
    this.monitoringInterval = parseInt(process.env.USAGE_REPORT_INTERVAL) || 3600000; // 1 hour
    this.alertThresholds = {
      usageWarning: 0.8, // 80% of limit
      usageCritical: 0.95 // 95% of limit
    };
  }

  async start() {
    try {
      // Schedule usage monitoring
      cron.schedule('*/15 * * * *', async () => { // Every 15 minutes
        await this.checkUsageLimits();
      });

      // Schedule daily usage reports
      cron.schedule('0 9 * * *', async () => { // Daily at 9 AM
        await this.generateDailyReport();
      });

      // Schedule monthly usage reset
      cron.schedule('0 0 1 * *', async () => { // Monthly on 1st at midnight
        await this.resetMonthlyUsage();
      });

      this.isRunning = true;
      logger.info('Usage monitoring service started');
    } catch (error) {
      logger.error('Failed to start usage monitoring service:', error);
      throw error;
    }
  }

  async stop() {
    this.isRunning = false;
    logger.info('Usage monitoring service stopped');
  }

  /**
   * Check usage limits for all users
   */
  async checkUsageLimits() {
    try {
      const usersWithKeys = await supabaseService.getAllUsersWithKeys();
      const alerts = [];

      for (const userKey of usersWithKeys) {
        try {
          const usage = userKey.current_usage || 0;
          const limit = userKey.monthly_limit;

          if (!limit) continue; // Skip unlimited users

          const usagePercentage = usage / limit;

          if (usagePercentage >= this.alertThresholds.usageCritical) {
            alerts.push({
              type: 'critical',
              userId: userKey.user_id,
              usage,
              limit,
              percentage: usagePercentage
            });
          } else if (usagePercentage >= this.alertThresholds.usageWarning) {
            alerts.push({
              type: 'warning',
              userId: userKey.user_id,
              usage,
              limit,
              percentage: usagePercentage
            });
          }
        } catch (error) {
          logger.error(`Error checking usage for user ${userKey.user_id}:`, error);
        }
      }

      if (alerts.length > 0) {
        await this.sendUsageAlerts(alerts);
      }

      return alerts;
    } catch (error) {
      logger.error('Failed to check usage limits:', error);
      throw error;
    }
  }

  /**
   * Generate daily usage report
   */
  async generateDailyReport() {
    try {
      logger.info('Generating daily usage report...');

      const systemStats = await supabaseService.getSystemUsageStats();
      const usersWithKeys = await supabaseService.getAllUsersWithKeys();

      const report = {
        date: new Date().toISOString().split('T')[0],
        systemStats,
        userCount: usersWithKeys.length,
        topUsers: usersWithKeys
          .sort((a, b) => (b.current_usage || 0) - (a.current_usage || 0))
          .slice(0, 10)
          .map(user => ({
            userId: user.user_id,
            username: user.profiles?.username,
            usage: user.current_usage,
            limit: user.monthly_limit
          }))
      };

      logger.info('Daily usage report generated:', report);
      await this.sendDailyReport(report);

      return report;
    } catch (error) {
      logger.error('Failed to generate daily report:', error);
      throw error;
    }
  }

  /**
   * Reset monthly usage for all users
   */
  async resetMonthlyUsage() {
    try {
      logger.info('Resetting monthly usage for all users...');
      const resetCount = await supabaseService.resetAllMonthlyUsage();
      logger.info(`Monthly usage reset completed: ${resetCount} users updated`);
      return resetCount;
    } catch (error) {
      logger.error('Failed to reset monthly usage:', error);
      throw error;
    }
  }

  /**
   * Send usage alerts
   */
  async sendUsageAlerts(alerts) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return;
    }

    try {
      const criticalAlerts = alerts.filter(a => a.type === 'critical');
      const warningAlerts = alerts.filter(a => a.type === 'warning');

      const message = {
        text: `⚠️ OpenRouter Usage Alerts`,
        attachments: [
          {
            color: criticalAlerts.length > 0 ? 'danger' : 'warning',
            fields: [
              {
                title: 'Critical Alerts',
                value: criticalAlerts.length,
                short: true
              },
              {
                title: 'Warning Alerts',
                value: warningAlerts.length,
                short: true
              }
            ],
            footer: 'OpenRouter Agent',
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      };

      // Add details for critical alerts
      if (criticalAlerts.length > 0) {
        message.attachments.push({
          color: 'danger',
          title: 'Critical Usage Alerts',
          text: criticalAlerts.map(alert => 
            `User ${alert.userId}: ${alert.usage.toFixed(2)}/${alert.limit} (${(alert.percentage * 100).toFixed(1)}%)`
          ).join('\n')
        });
      }

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

      logger.info(`Usage alerts sent: ${alerts.length} alerts`);
    } catch (error) {
      logger.error('Failed to send usage alerts:', error);
    }
  }

  /**
   * Send daily report
   */
  async sendDailyReport(report) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return;
    }

    try {
      const message = {
        text: `📊 Daily OpenRouter Usage Report - ${report.date}`,
        attachments: [
          {
            color: 'good',
            fields: [
              {
                title: 'Total Users',
                value: report.userCount,
                short: true
              },
              {
                title: 'Total Cost (30 days)',
                value: `$${report.systemStats.totalCost.toFixed(2)}`,
                short: true
              },
              {
                title: 'Total Requests (30 days)',
                value: report.systemStats.totalRequests.toLocaleString(),
                short: true
              },
              {
                title: 'Total Tokens (30 days)',
                value: report.systemStats.totalTokens.toLocaleString(),
                short: true
              }
            ],
            footer: 'OpenRouter Agent',
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      };

      // Add top users if any
      if (report.topUsers.length > 0) {
        message.attachments.push({
          color: 'good',
          title: 'Top Users by Usage',
          text: report.topUsers.slice(0, 5).map(user => 
            `${user.username || user.userId}: $${user.usage.toFixed(2)}/${user.limit || 'unlimited'}`
          ).join('\n')
        });
      }

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

      logger.info('Daily report sent successfully');
    } catch (error) {
      logger.error('Failed to send daily report:', error);
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      monitoringInterval: this.monitoringInterval,
      alertThresholds: this.alertThresholds
    };
  }
}
