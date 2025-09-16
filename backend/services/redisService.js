const { logger } = require('../middleware/logging');
const EventEmitter = require('events');

class RedisService {
  constructor() {
    this.client = null;
    this.publisher = null;
    this.subscriber = null;
    this.isConnected = false;
    this.fallbackMode = true; // Always use fallback for now
    
    // In-memory storage for fallback mode
    this.cache = new Map();
    this.eventEmitter = new EventEmitter();
    
    // Cache settings
    this.defaultTTL = 300; // 5 minutes
    this.syncTTL = 1800; // 30 minutes for sync data
    
    logger.info('🔄 Running in fallback mode (no Redis required)');
    this.isConnected = true; // Set as connected for fallback mode
  }

  // Cache operations using in-memory storage
  async set(key, value, ttl = this.defaultTTL) {
    try {
      const expirationTime = Date.now() + (ttl * 1000);
      this.cache.set(key, {
        value: JSON.stringify(value),
        expires: expirationTime
      });
      logger.info(`📦 Cached data in memory: ${key} (TTL: ${ttl}s)`);
      
      // Clean up expired entries periodically
      this.cleanupExpired();
      return true;
    } catch (error) {
      logger.error(`Failed to cache ${key}:`, error.message);
      return false;
    }
  }

  async get(key) {
    try {
      const item = this.cache.get(key);
      if (!item) {
        return null;
      }

      // Check if expired
      if (Date.now() > item.expires) {
        this.cache.delete(key);
        return null;
      }

      const value = JSON.parse(item.value);
      logger.info(`📤 Retrieved cached data from memory: ${key}`);
      return value;
    } catch (error) {
      logger.error(`Failed to get cached data ${key}:`, error.message);
      return null;
    }
  }

  async del(key) {
    try {
      const deleted = this.cache.delete(key);
      if (deleted) {
        logger.info(`🗑️ Deleted cached data from memory: ${key}`);
      }
      return deleted;
    } catch (error) {
      logger.error(`Failed to delete ${key}:`, error.message);
      return false;
    }
  }

  // Clean up expired cache entries
  cleanupExpired() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }

  // Publish/Subscribe operations using EventEmitter
  async publish(channel, message) {
    try {
      const messageData = {
        channel,
        message: typeof message === 'string' ? message : JSON.stringify(message),
        timestamp: Date.now()
      };
      
      // Emit the message to all subscribers
      this.eventEmitter.emit(channel, messageData);
      logger.info(`📢 Published message to channel: ${channel}`);
      return true;
    } catch (error) {
      logger.error(`Failed to publish to ${channel}:`, error.message);
      return false;
    }
  }

  async subscribe(channel, callback) {
    try {
      this.eventEmitter.on(channel, callback);
      logger.info(`📡 Subscribed to channel: ${channel}`);
      return true;
    } catch (error) {
      logger.error(`Failed to subscribe to ${channel}:`, error.message);
      return false;
    }
  }

  async unsubscribe(channel, callback) {
    try {
      if (callback) {
        this.eventEmitter.off(channel, callback);
      } else {
        this.eventEmitter.removeAllListeners(channel);
      }
      logger.info(`📡 Unsubscribed from channel: ${channel}`);
      return true;
    } catch (error) {
      logger.error(`Failed to unsubscribe from ${channel}:`, error.message);
      return false;
    }
  }

  // Analytics caching methods
  async cacheAnalytics(data) {
    return await this.set('analytics:dashboard', data, this.syncTTL);
  }

  async getCachedAnalytics() {
    return await this.get('analytics:dashboard');
  }

  async invalidateAnalytics() {
    return await this.del('analytics:dashboard');
  }

  // Sync event publishing
  async publishSyncEvent(eventType, data = {}) {
    const eventData = {
      type: eventType,
      data,
      timestamp: Date.now()
    };

    await this.publish('sync:events', eventData);
    logger.info(`🔄 Published sync event: ${eventType}`);
    return eventData;
  }

  // Subscribe to sync events
  async subscribeToSyncEvents(callback) {
    return await this.subscribe('sync:events', callback);
  }

  // Health check
  async ping() {
    return this.isConnected;
  }

  // Get service status
  getStatus() {
    return {
      connected: this.isConnected,
      fallbackMode: this.fallbackMode,
      cacheSize: this.cache.size,
      uptime: Date.now()
    };
  }

  // Cleanup method
  async cleanup() {
    try {
      this.cache.clear();
      this.eventEmitter.removeAllListeners();
      logger.info('🧹 Cleaned up Redis service');
      return true;
    } catch (error) {
      logger.error('Failed to cleanup Redis service:', error.message);
      return false;
    }
  }
}

// Create and export singleton instance
const redisService = new RedisService();
module.exports = redisService;