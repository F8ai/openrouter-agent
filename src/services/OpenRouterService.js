/**
 * OpenRouter Service
 * Handles all interactions with OpenRouter Provisioning API
 */

import https from 'https';
import { logger } from '../utils/logger.js';

export class OpenRouterService {
  constructor() {
    this.provisioningKey = process.env.OPENROUTER_PROVISIONING_KEY;
    this.baseUrl = 'openrouter.ai';
    this.apiPath = '/api/v1/keys';
    
    if (!this.provisioningKey) {
      throw new Error('OPENROUTER_PROVISIONING_KEY environment variable is required');
    }
  }

  /**
   * Make HTTPS request to OpenRouter API
   */
  async makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        port: 443,
        path: path,
        method: method,
        headers: {
          'Authorization': `Bearer ${this.provisioningKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'OpenRouter-Agent/1.0.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = data ? JSON.parse(data) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ statusCode: res.statusCode, data: response });
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(response)}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * List all API keys
   */
  async listKeys(limit = 100) {
    try {
      logger.info(`Fetching OpenRouter keys (limit: ${limit})`);
      const response = await this.makeRequest('GET', `${this.apiPath}?limit=${limit}`);
      return response.data.data || [];
    } catch (error) {
      logger.error('Failed to list OpenRouter keys:', error);
      throw error;
    }
  }

  /**
   * Create a new API key
   */
  async createKey(name, limit = null, label = null) {
    try {
      logger.info(`Creating OpenRouter key: ${name}`);
      
      const body = {
        name: name
      };
      
      if (limit) body.limit = limit;
      if (label) body.label = label;
      
      const response = await this.makeRequest('POST', this.apiPath, body);
      const key = response.data;
      
      logger.info(`OpenRouter key created successfully: ${key.id}`);
      return key;
    } catch (error) {
      logger.error('Failed to create OpenRouter key:', error);
      throw error;
    }
  }

  /**
   * Get information about a specific key
   */
  async getKeyInfo(keyId) {
    try {
      logger.info(`Fetching OpenRouter key info: ${keyId}`);
      const response = await this.makeRequest('GET', `${this.apiPath}/${keyId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get OpenRouter key info for ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Delete an API key
   */
  async deleteKey(keyId) {
    try {
      logger.info(`Deleting OpenRouter key: ${keyId}`);
      await this.makeRequest('DELETE', `${this.apiPath}/${keyId}`);
      logger.info(`OpenRouter key deleted successfully: ${keyId}`);
    } catch (error) {
      logger.error(`Failed to delete OpenRouter key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Create a key for a specific user
   */
  async createUserKey(userId, monthlyLimit = null) {
    const keyName = `Formul8 User ${userId}`;
    const keyLabel = `user-${userId}`;
    
    try {
      const key = await this.createKey(keyName, monthlyLimit, keyLabel);
      logger.info(`User key created for ${userId}: ${key.id}`);
      return {
        ...key,
        userId,
        monthlyLimit
      };
    } catch (error) {
      logger.error(`Failed to create user key for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Test API key validity
   */
  async testKey(keyId) {
    try {
      const keyInfo = await this.getKeyInfo(keyId);
      return {
        valid: true,
        keyInfo
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get key usage statistics
   */
  async getKeyUsage(keyId) {
    try {
      const keyInfo = await this.getKeyInfo(keyId);
      return {
        usage: keyInfo.usage || 0,
        limit: keyInfo.limit,
        isFreeTier: keyInfo.is_free_tier,
        lastUsed: keyInfo.last_used
      };
    } catch (error) {
      logger.error(`Failed to get usage for key ${keyId}:`, error);
      throw error;
    }
  }

  /**
   * Batch operations for multiple keys
   */
  async batchOperation(operation, keyIds) {
    const results = [];
    
    for (const keyId of keyIds) {
      try {
        let result;
        switch (operation) {
          case 'delete':
            await this.deleteKey(keyId);
            result = { keyId, success: true };
            break;
          case 'info':
            result = { keyId, success: true, data: await this.getKeyInfo(keyId) };
            break;
          case 'test':
            result = { keyId, success: true, data: await this.testKey(keyId) };
            break;
          default:
            result = { keyId, success: false, error: 'Unknown operation' };
        }
        results.push(result);
      } catch (error) {
        results.push({ keyId, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Health check for OpenRouter API
   */
  async healthCheck() {
    try {
      await this.listKeys(1);
      return {
        status: 'healthy',
        message: 'OpenRouter API is accessible'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `OpenRouter API error: ${error.message}`
      };
    }
  }
}

export default new OpenRouterService();

