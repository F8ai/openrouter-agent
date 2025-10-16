/**
 * Supabase Service
 * Handles all database operations for user API keys and usage tracking
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

export class SupabaseService {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!this.supabaseUrl || !this.supabaseServiceKey) {
      throw new Error('Missing required Supabase environment variables');
    }
    
    this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey);
  }

  /**
   * Get user's active API key
   */
  async getUserApiKey(userId) {
    try {
      const { data, error } = await this.supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error fetching user API key:', error);
      throw error;
    }
  }

  /**
   * Create a new API key for a user
   */
  async createUserApiKey(userId, openrouterKeyId, keyName, monthlyLimit = null) {
    try {
      const { data, error } = await this.supabase
        .from('user_api_keys')
        .insert({
          user_id: userId,
          openrouter_key_id: openrouterKeyId,
          key_name: keyName,
          monthly_limit: monthlyLimit,
          status: 'active'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info(`User API key created for ${userId}: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Error creating user API key:', error);
      throw error;
    }
  }

  /**
   * Update user's API key
   */
  async updateUserApiKey(userId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('user_api_keys')
        .update(updates)
        .eq('user_id', userId)
        .eq('status', 'active')
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error updating user API key:', error);
      throw error;
    }
  }

  /**
   * Deactivate user's current API key
   */
  async deactivateUserApiKey(userId) {
    try {
      const { data, error } = await this.supabase
        .from('user_api_keys')
        .update({ status: 'inactive' })
        .eq('user_id', userId)
        .eq('status', 'active')
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info(`User API key deactivated for ${userId}: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Error deactivating user API key:', error);
      throw error;
    }
  }

  /**
   * Check if user has exceeded their monthly limit
   */
  async checkUserUsageLimit(userId) {
    try {
      const { data, error } = await this.supabase
        .rpc('check_usage_limit', { user_uuid: userId });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error checking usage limit:', error);
      throw error;
    }
  }

  /**
   * Get user's usage summary for current month
   */
  async getUserUsageSummary(userId, monthDate = null) {
    try {
      const { data, error } = await this.supabase
        .rpc('get_user_usage_summary', { 
          user_uuid: userId,
          month_date: monthDate || new Date().toISOString().split('T')[0]
        });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error fetching usage summary:', error);
      throw error;
    }
  }

  /**
   * Log API usage for a user
   */
  async logApiUsage(userId, apiKeyId, usageData) {
    try {
      const { data, error } = await this.supabase
        .from('api_usage_logs')
        .insert({
          user_id: userId,
          api_key_id: apiKeyId,
          model: usageData.model,
          request_tokens: usageData.requestTokens || 0,
          response_tokens: usageData.responseTokens || 0,
          total_tokens: usageData.totalTokens || 0,
          cost_usd: usageData.costUsd || 0,
          endpoint: usageData.endpoint,
          agent_name: usageData.agentName,
          request_duration_ms: usageData.durationMs
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error logging API usage:', error);
      throw error;
    }
  }

  /**
   * Get all users with API keys (admin function)
   */
  async getAllUsersWithKeys() {
    try {
      const { data, error } = await this.supabase
        .from('user_api_keys')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            email
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error fetching users with keys:', error);
      throw error;
    }
  }

  /**
   * Reset monthly usage for all users (run monthly)
   */
  async resetAllMonthlyUsage() {
    try {
      const { data, error } = await this.supabase
        .rpc('reset_monthly_usage');

      if (error) {
        throw error;
      }

      logger.info(`Monthly usage reset completed: ${data} users updated`);
      return data;
    } catch (error) {
      logger.error('Error resetting monthly usage:', error);
      throw error;
    }
  }

  /**
   * Get user's subscription tier for determining API limits
   */
  async getUserSubscriptionTier(userId) {
    try {
      const { data, error } = await this.supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error fetching user subscription:', error);
      throw error;
    }
  }

  /**
   * Get system-wide usage statistics
   */
  async getSystemUsageStats() {
    try {
      const { data, error } = await this.supabase
        .from('api_usage_logs')
        .select('cost_usd, total_tokens, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        throw error;
      }

      const totalCost = data.reduce((sum, log) => sum + (log.cost_usd || 0), 0);
      const totalTokens = data.reduce((sum, log) => sum + (log.total_tokens || 0), 0);
      const totalRequests = data.length;

      return {
        totalCost,
        totalTokens,
        totalRequests,
        averageCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0,
        averageTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0
      };
    } catch (error) {
      logger.error('Error fetching system usage stats:', error);
      throw error;
    }
  }

  /**
   * Health check for Supabase connection
   */
  async healthCheck() {
    try {
      const { data, error } = await this.supabase
        .from('user_api_keys')
        .select('count')
        .limit(1);

      if (error) {
        throw error;
      }

      return {
        status: 'healthy',
        message: 'Supabase connection is working'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Supabase connection error: ${error.message}`
      };
    }
  }
}

export default new SupabaseService();
