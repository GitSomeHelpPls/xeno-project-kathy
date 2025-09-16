const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { logger } = require('./middleware/logging');
const { exec } = require('child_process');
const path = require('path');

const prisma = new PrismaClient();

/**
 * Data Sync Scheduler
 * Handles periodic synchronization of Shopify data
 */
class DataSyncScheduler {
  constructor() {
    this.isRunning = false;
    this.lastSyncTime = null;
    this.syncStats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      lastError: null
    };
  }

  /**
   * Start the scheduler with configurable intervals
   */
  start() {
    logger.info('Starting Data Sync Scheduler');
    
    // Run every 6 hours (customize based on your needs)
    cron.schedule('0 */6 * * *', () => {
      this.performSync('scheduled');
    });

    // Daily full sync at 2 AM
    cron.schedule('0 2 * * *', () => {
      this.performFullSync();
    });

    logger.info('Scheduler started successfully');
    logger.info('Scheduled syncs: Every 6 hours + Daily at 2 AM');
  }

  /**
   * Perform regular data sync
   */
  async performSync(trigger = 'manual') {
    if (this.isRunning) {
      logger.warn('Sync already in progress, skipping');
      return { status: 'skipped', reason: 'sync_in_progress' };
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Starting data sync (triggered by: ${trigger})...`);
      
      // Run the ingest script
      await this.executeIngestScript();
      
      const duration = Date.now() - startTime;
      this.lastSyncTime = new Date();
      this.syncStats.totalSyncs++;
      this.syncStats.successfulSyncs++;
      
      console.log(`✅ Data sync completed successfully in ${duration}ms`);
      
      // Log sync event to database (optional)
      await this.logSyncEvent('success', duration, trigger);
      
      return {
        status: 'success',
        duration,
        timestamp: this.lastSyncTime,
        trigger
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.syncStats.totalSyncs++;
      this.syncStats.failedSyncs++;
      this.syncStats.lastError = error.message;
      
      console.error('❌ Data sync failed:', error.message);
      
      // Log failed sync
      await this.logSyncEvent('failed', duration, trigger, error.message);
      
      return {
        status: 'failed',
        error: error.message,
        duration,
        trigger
      };
      
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Perform a full data sync (more comprehensive)
   */
  async performFullSync() {
    console.log('🔄 Starting FULL data sync...');
    
    try {
      // Could include additional operations like:
      // - Cleanup old data
      // - Validate data integrity
      // - Update analytics cache
      
      const result = await this.performSync('full_scheduled');
      
      if (result.status === 'success') {
        console.log('✅ Full sync completed successfully');
        // Additional full sync operations here
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Full sync failed:', error);
      throw error;
    }
  }

  /**
   * Execute the ingest script
   */
  executeIngestScript() {
    return new Promise((resolve, reject) => {
      const ingestPath = path.join(__dirname, 'ingest.js');
      
      exec(`node "${ingestPath}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('Ingest script error:', error);
          reject(error);
          return;
        }
        
        if (stderr) {
          console.warn('Ingest script warnings:', stderr);
        }
        
        console.log('Ingest script output:', stdout);
        resolve(stdout);
      });
    });
  }

  /**
   * Log sync events to database (optional feature)
   */
  async logSyncEvent(status, duration, trigger, errorMessage = null) {
    try {
      // You could extend your Prisma schema to include a SyncLog model
      // For now, we'll just log to console and could extend to database
      const logEntry = {
        timestamp: new Date(),
        status,
        duration,
        trigger,
        error: errorMessage
      };
      
      console.log('📊 Sync Event:', JSON.stringify(logEntry, null, 2));
      
      // Future: Save to database
      // await prisma.syncLog.create({ data: logEntry });
      
    } catch (error) {
      console.error('Failed to log sync event:', error);
    }
  }

  /**
   * Get scheduler statistics
   */
  getStats() {
    return {
      ...this.syncStats,
      lastSyncTime: this.lastSyncTime,
      isCurrentlyRunning: this.isRunning,
      uptime: process.uptime()
    };
  }

  /**
   * Stop the scheduler
   */
  stop() {
    // Note: node-cron doesn't provide a direct way to stop all tasks
    // In a production environment, you'd want to track task references
    console.log('🛑 Scheduler stopping...');
  }
}

// Create singleton instance
const scheduler = new DataSyncScheduler();

// Auto-start scheduler when module is imported (in production)
if (process.env.NODE_ENV === 'production') {
  scheduler.start();
}

module.exports = scheduler;