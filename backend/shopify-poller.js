require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { logger } = require('./middleware/logging');
const prisma = new PrismaClient();

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

class ShopifyPoller {
  constructor() {
    this.isPolling = false;
    this.pollInterval = 30000; // 30 seconds
    this.lastOrderCheck = new Date();
    this.lastCustomerCheck = new Date();
  }

  async startPolling() {
    if (this.isPolling) {
      logger.warn('Polling already running');
      return;
    }

    this.isPolling = true;
    logger.info('Starting Shopify data polling');
    
    // Initial sync
    await this.checkForUpdates();
    
    // Set up interval
    this.intervalId = setInterval(() => {
      this.checkForUpdates();
    }, this.pollInterval);
    
    logger.info(`Polling started - checking every ${this.pollInterval/1000} seconds`);
  }

  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isPolling = false;
    logger.info('Polling stopped');
  }

  async checkForUpdates() {
    try {
      logger.info('Checking for new data');
      
      // Check for new orders
      const newOrders = await this.checkNewOrders();
      
      // Check for new customers  
      const newCustomers = await this.checkNewCustomers();
      
      if (newOrders > 0 || newCustomers > 0) {
        logger.info(`Found ${newOrders} new orders, ${newCustomers} new customers`);
        
        // Emit update event (you can add WebSocket here later)
        this.emitUpdate({
          type: 'data_updated',
          newOrders,
          newCustomers,
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      console.error('❌ Polling error:', error.message);
    }
  }

  async checkNewOrders() {
    try {
      const since = this.lastOrderCheck.toISOString();
      
      const response = await fetch(
        `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/orders.json?status=any&created_at_min=${since}&limit=250`,
        {
          headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const { orders } = await response.json();
      let newOrderCount = 0;

      for (const order of orders) {
        if (!order.customer || !order.customer.id) continue;

        // Check if order exists
        const existingOrder = await prisma.order.findUnique({
          where: { shopifyOrderId: order.id.toString() }
        });

        if (!existingOrder) {
          // Find customer
          const dbCustomer = await prisma.customer.findUnique({
            where: { shopifyCustomerId: order.customer.id.toString() }
          });

          if (dbCustomer) {
            // Get store
            const store = await prisma.store.findFirst();
            
            // Create new order
            await prisma.order.create({
              data: {
                shopifyOrderId: order.id.toString(),
                totalPrice: parseFloat(order.total_price),
                createdAt: new Date(order.created_at),
                storeId: store.id,
                customerId: dbCustomer.id,
              }
            });
            
            newOrderCount++;
            logger.info(`Added new order: ${order.id}`);
          }
        }
      }

      this.lastOrderCheck = new Date();
      return newOrderCount;
      
    } catch (error) {
      console.error('Error checking new orders:', error.message);
      return 0;
    }
  }

  async checkNewCustomers() {
    try {
      const since = this.lastCustomerCheck.toISOString();
      
      const response = await fetch(
        `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/customers.json?created_at_min=${since}&limit=250`,
        {
          headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const { customers } = await response.json();
      let newCustomerCount = 0;

      for (const customer of customers) {
        if (!customer.email) continue;

        // Check if customer exists
        const existingCustomer = await prisma.customer.findUnique({
          where: { shopifyCustomerId: customer.id.toString() }
        });

        if (!existingCustomer) {
          // Get store
          const store = await prisma.store.findFirst();
          
          // Create new customer
          await prisma.customer.create({
            data: {
              shopifyCustomerId: customer.id.toString(),
              email: customer.email,
              firstName: customer.first_name,
              lastName: customer.last_name,
              storeId: store.id,
            }
          });
          
          newCustomerCount++;
          logger.info(`Added new customer: ${customer.email}`);
        }
      }

      this.lastCustomerCheck = new Date();
      return newCustomerCount;
      
    } catch (error) {
      console.error('Error checking new customers:', error.message);
      return 0;
    }
  }

  emitUpdate(data) {
    // Placeholder for WebSocket or other real-time update mechanism
    logger.info('Update event:', data);
    
    // You can add WebSocket broadcast here later
    // io.emit('shopify-update', data);
  }

  getStats() {
    return {
      isPolling: this.isPolling,
      pollInterval: this.pollInterval,
      lastOrderCheck: this.lastOrderCheck,
      lastCustomerCheck: this.lastCustomerCheck
    };
  }
}

// Export singleton instance
const poller = new ShopifyPoller();

module.exports = poller;

// If running directly, start polling
if (require.main === module) {
  poller.startPolling();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down poller');
    poller.stopPolling();
    process.exit(0);
  });
}