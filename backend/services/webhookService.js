const { PrismaClient } = require('@prisma/client');
const { logger } = require('../middleware/logging');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Shopify Webhook Service
 * Handles real-time data synchronization from Shopify webhooks
 */
class ShopifyWebhookService {
  constructor(io = null) {
    this.io = io; // Socket.io instance for real-time updates
    this.supportedTopics = [
      'orders/create',
      'orders/updated', 
      'orders/cancelled',
      'orders/fulfilled',
      'orders/paid',
      'customers/create',
      'customers/update',
      'customers/delete',
      'products/create',
      'products/update',
      'app/uninstalled'
    ];
  }

  /**
   * Set the Socket.io instance for real-time updates
   */
  setSocketIO(io) {
    this.io = io;
  }

  /**
   * Verify webhook authenticity using HMAC
   */
  verifyWebhook(data, hmacHeader, secret) {
    if (!hmacHeader || !secret) {
      return false;
    }

    const calculatedHmac = crypto
      .createHmac('sha256', secret)
      .update(data, 'utf8')
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(hmacHeader, 'base64'),
      Buffer.from(calculatedHmac, 'base64')
    );
  }

  /**
   * Get store by shop domain
   */
  async getStoreByShop(shopDomain) {
    try {
      const store = await prisma.store.findFirst({
        where: {
          shopName: {
            contains: shopDomain.replace('.myshopify.com', '')
          }
        }
      });
      
      if (!store) {
        logger.warn('Store not found for webhook', { shopDomain });
        throw new Error(`Store not found for shop: ${shopDomain}`);
      }
      
      return store;
    } catch (error) {
      logger.error('Error finding store for webhook', { shopDomain, error: error.message });
      throw error;
    }
  }

  /**
   * Process webhook based on topic
   */
  async processWebhook(topic, data, shopDomain) {
    try {
      const store = await this.getStoreByShop(shopDomain);
      
      logger.info('Processing webhook', { 
        topic, 
        shopDomain, 
        storeId: store.id,
        dataId: data.id 
      });

      switch (topic) {
        case 'orders/create':
        case 'orders/updated':
        case 'orders/paid':
          return await this.handleOrderWebhook(data, store, topic);
          
        case 'orders/cancelled':
          return await this.handleOrderCancellation(data, store);
          
        case 'orders/fulfilled':
          return await this.handleOrderFulfillment(data, store);
          
        case 'customers/create':
        case 'customers/update':
          return await this.handleCustomerWebhook(data, store, topic);
          
        case 'customers/delete':
          return await this.handleCustomerDeletion(data, store);
          
        case 'products/create':
        case 'products/update':
          return await this.handleProductWebhook(data, store, topic);
          
        case 'app/uninstalled':
          return await this.handleAppUninstall(data, store);
          
        default:
          logger.warn('Unhandled webhook topic', { topic, shopDomain });
          return { status: 'ignored', reason: 'unsupported_topic' };
      }
    } catch (error) {
      logger.error('Webhook processing failed', {
        topic,
        shopDomain,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle order webhooks (create/update)
   */
  async handleOrderWebhook(orderData, store, topic) {
    try {
      // First, ensure customer exists
      let customer = null;
      if (orderData.customer && orderData.customer.id) {
        customer = await this.upsertCustomerFromOrder(orderData.customer, store);
      }

      // Upsert the order
      const orderResult = await prisma.order.upsert({
        where: { shopifyOrderId: orderData.id.toString() },
        update: {
          totalPrice: parseFloat(orderData.total_price || orderData.current_total_price),
          createdAt: new Date(orderData.created_at),
        },
        create: {
          shopifyOrderId: orderData.id.toString(),
          totalPrice: parseFloat(orderData.total_price || orderData.current_total_price),
          createdAt: new Date(orderData.created_at),
          storeId: store.id,
          customerId: customer?.id || null
        }
      });

      // Handle line items if present
      if (orderData.line_items && orderData.line_items.length > 0) {
        await this.handleOrderLineItems(orderData.line_items, orderResult.id, store);
      }

      logger.info('Order webhook processed successfully', {
        topic,
        orderId: orderData.id,
        storeId: store.id,
        totalPrice: orderData.total_price
      });

      // 🔥 NEW: Emit real-time events for different order types
      if (this.io) {
        const orderNotification = {
          order_id: orderData.id,
          order_number: orderData.order_number || orderData.name,
          total_price: orderData.total_price || orderData.current_total_price,
          customer_name: orderData.customer ? 
            `${orderData.customer.first_name || ''} ${orderData.customer.last_name || ''}`.trim() : 
            'Guest',
          customer_email: orderData.customer?.email,
          created_at: orderData.created_at,
          financial_status: orderData.financial_status,
          fulfillment_status: orderData.fulfillment_status,
          items_count: orderData.line_items ? orderData.line_items.length : 0,
          store_name: store.name,
          webhook_type: topic
        };

        // Emit specific events based on webhook type
        switch (topic) {
          case 'orders/create':
            this.io.emit('new-order', orderNotification);
            logger.info('🛒 New order notification sent', {
              orderId: orderData.id,
              orderNumber: orderData.order_number,
              totalPrice: orderData.total_price
            });
            break;
            
          case 'orders/paid':
            this.io.emit('order-paid', orderNotification);
            logger.info('💳 Order payment notification sent', {
              orderId: orderData.id,
              orderNumber: orderData.order_number,
              totalPrice: orderData.total_price,
              status: orderData.financial_status
            });
            break;
            
          case 'orders/updated':
            this.io.emit('order-updated', orderNotification);
            logger.info('� Order update notification sent', {
              orderId: orderData.id,
              orderNumber: orderData.order_number
            });
            break;
        }
        
        // Also emit general data change event
        this.io.emit('data-changed', {
          type: `order_${topic.split('/')[1]}`,
          timestamp: new Date(),
          data: orderNotification
        });
      }

      return {
        status: 'success',
        action: topic === 'orders/create' ? 'created' : 'updated',
        orderId: orderResult.id,
        shopifyOrderId: orderData.id
      };
    } catch (error) {
      logger.error('Order webhook processing failed', {
        topic,
        orderId: orderData.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle order cancellation
   */
  async handleOrderCancellation(orderData, store) {
    try {
      // You could add a status field to orders to track cancellations
      // For now, we'll just log it and potentially delete or mark as cancelled
      
      const existingOrder = await prisma.order.findUnique({
        where: { shopifyOrderId: orderData.id.toString() }
      });

      if (existingOrder) {
        // Option 1: Delete the order
        // await prisma.order.delete({
        //   where: { shopifyOrderId: orderData.id.toString() }
        // });

        // Option 2: Add a cancelled field to your schema and mark it
        // For now, we'll just log the cancellation
        logger.info('Order cancelled via webhook', {
          orderId: orderData.id,
          storeId: store.id
        });

        // 🔥 Emit real-time cancellation event
        if (this.io) {
          this.io.emit('order-cancelled', {
            order_id: orderData.id,
            order_number: orderData.order_number || orderData.name,
            total_price: orderData.total_price || orderData.current_total_price,
            cancelled_at: orderData.cancelled_at || new Date(),
            reason: orderData.cancel_reason
          });
          
          this.io.emit('data-changed', {
            type: 'order_cancelled',
            timestamp: new Date(),
            data: { orderId: orderData.id, action: 'cancelled' }
          });
        }

        return {
          status: 'success',
          action: 'cancelled',
          orderId: existingOrder.id,
          shopifyOrderId: orderData.id
        };
      } else {
        logger.warn('Cancelled order not found in database', {
          shopifyOrderId: orderData.id,
          storeId: store.id
        });
        
        return {
          status: 'ignored',
          reason: 'order_not_found'
        };
      }
    } catch (error) {
      logger.error('Order cancellation webhook failed', {
        orderId: orderData.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle order fulfillment
   */
  async handleOrderFulfillment(orderData, store) {
    try {
      const existingOrder = await prisma.order.findUnique({
        where: { shopifyOrderId: orderData.id.toString() }
      });

      if (existingOrder) {
        logger.info('Order fulfilled via webhook', {
          orderId: orderData.id,
          storeId: store.id,
          fulfillmentStatus: orderData.fulfillment_status
        });

        // 🔥 Emit real-time fulfillment event
        if (this.io) {
          this.io.emit('order-fulfilled', {
            order_id: orderData.id,
            order_number: orderData.order_number || orderData.name,
            fulfillment_status: orderData.fulfillment_status,
            fulfilled_at: new Date(),
            tracking_number: orderData.tracking_number,
            tracking_url: orderData.tracking_url
          });
          
          this.io.emit('data-changed', {
            type: 'order_fulfilled',
            timestamp: new Date(),
            data: { orderId: orderData.id, action: 'fulfilled' }
          });
        }

        return {
          status: 'success',
          action: 'fulfilled',
          orderId: existingOrder.id,
          shopifyOrderId: orderData.id
        };
      } else {
        logger.warn('Fulfilled order not found in database', {
          shopifyOrderId: orderData.id,
          storeId: store.id
        });
        
        return {
          status: 'ignored',
          reason: 'order_not_found'
        };
      }
    } catch (error) {
      logger.error('Order fulfillment webhook failed', {
        orderId: orderData.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle customer deletion
   */
  async handleCustomerDeletion(customerData, store) {
    try {
      const existingCustomer = await prisma.customer.findUnique({
        where: { shopifyCustomerId: customerData.id.toString() }
      });

      if (existingCustomer) {
        // Delete the customer from database
        await prisma.customer.delete({
          where: { shopifyCustomerId: customerData.id.toString() }
        });

        logger.info('Customer deleted via webhook', {
          customerId: customerData.id,
          storeId: store.id
        });

        // 🔥 Emit real-time customer deletion event
        if (this.io) {
          this.io.emit('customer-deleted', {
            customer_id: customerData.id,
            email: customerData.email,
            deleted_at: new Date()
          });
          
          this.io.emit('data-changed', {
            type: 'customer_deleted',
            timestamp: new Date(),
            data: { customerId: customerData.id, action: 'deleted' }
          });
        }

        return {
          status: 'success',
          action: 'deleted',
          customerId: existingCustomer.id,
          shopifyCustomerId: customerData.id
        };
      } else {
        return {
          status: 'ignored',
          reason: 'customer_not_found'
        };
      }
    } catch (error) {
      logger.error('Customer deletion webhook failed', {
        customerId: customerData.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle customer webhooks
   */
  async handleCustomerWebhook(customerData, store, topic) {
    try {
      const customerResult = await prisma.customer.upsert({
        where: { shopifyCustomerId: customerData.id.toString() },
        update: {
          email: customerData.email,
          firstName: customerData.first_name,
          lastName: customerData.last_name
        },
        create: {
          shopifyCustomerId: customerData.id.toString(),
          email: customerData.email,
          firstName: customerData.first_name,
          lastName: customerData.last_name,
          storeId: store.id
        }
      });

      logger.info('Customer webhook processed successfully', {
        topic,
        customerId: customerData.id,
        email: customerData.email,
        storeId: store.id
      });

      return {
        status: 'success',
        action: topic === 'customers/create' ? 'created' : 'updated',
        customerId: customerResult.id,
        shopifyCustomerId: customerData.id
      };
    } catch (error) {
      logger.error('Customer webhook processing failed', {
        topic,
        customerId: customerData.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle product webhooks
   */
  async handleProductWebhook(productData, store, topic) {
    try {
      // Get the first variant for pricing (Shopify products have variants)
      const firstVariant = productData.variants && productData.variants[0];
      const price = firstVariant ? parseFloat(firstVariant.price) : 0;

      const productResult = await prisma.product.upsert({
        where: { shopifyProductId: productData.id.toString() },
        update: {
          title: productData.title,
          price: price
        },
        create: {
          shopifyProductId: productData.id.toString(),
          title: productData.title,
          price: price,
          storeId: store.id
        }
      });

      logger.info('Product webhook processed successfully', {
        topic,
        productId: productData.id,
        title: productData.title,
        storeId: store.id
      });

      return {
        status: 'success',
        action: topic === 'products/create' ? 'created' : 'updated',
        productId: productResult.id,
        shopifyProductId: productData.id
      };
    } catch (error) {
      logger.error('Product webhook processing failed', {
        topic,
        productId: productData.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle app uninstall
   */
  async handleAppUninstall(data, store) {
    try {
      // When app is uninstalled, you might want to:
      // 1. Mark the store as inactive
      // 2. Clean up data (optional)
      // 3. Send notification
      
      logger.warn('App uninstalled', {
        storeId: store.id,
        shopName: store.shopName
      });

      // For now, just log it - you could extend this to mark store as inactive
      return {
        status: 'success',
        action: 'uninstalled',
        storeId: store.id
      };
    } catch (error) {
      logger.error('App uninstall webhook failed', {
        storeId: store.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Upsert customer from order data
   */
  async upsertCustomerFromOrder(customerData, store) {
    try {
      if (!customerData || !customerData.id) {
        return null;
      }

      return await prisma.customer.upsert({
        where: { shopifyCustomerId: customerData.id.toString() },
        update: {
          email: customerData.email,
          firstName: customerData.first_name,
          lastName: customerData.last_name
        },
        create: {
          shopifyCustomerId: customerData.id.toString(),
          email: customerData.email,
          firstName: customerData.first_name,
          lastName: customerData.last_name,
          storeId: store.id
        }
      });
    } catch (error) {
      logger.error('Failed to upsert customer from order', {
        customerId: customerData.id,
        error: error.message
      });
      return null; // Continue processing order even if customer upsert fails
    }
  }

  /**
   * Handle order line items
   */
  async handleOrderLineItems(lineItems, orderId, store) {
    try {
      // First, delete existing line items for this order (in case of update)
      await prisma.lineItem.deleteMany({
        where: { orderId }
      });

      // Create new line items
      for (const item of lineItems) {
        await prisma.lineItem.create({
          data: {
            shopifyProductId: item.product_id ? item.product_id.toString() : null,
            quantity: item.quantity,
            price: parseFloat(item.price),
            orderId: orderId
          }
        });
      }

      logger.debug('Line items processed', {
        orderId,
        itemCount: lineItems.length
      });
    } catch (error) {
      logger.error('Failed to process line items', {
        orderId,
        error: error.message
      });
      // Don't throw error - line item failure shouldn't fail the entire order
    }
  }

  /**
   * Get webhook processing statistics
   */
  async getWebhookStats() {
    // This would require a webhook_logs table to implement properly
    // For now, return basic info
    return {
      supportedTopics: this.supportedTopics,
      message: 'Webhook stats would require a logging table to track processing history'
    };
  }
}

module.exports = new ShopifyWebhookService();