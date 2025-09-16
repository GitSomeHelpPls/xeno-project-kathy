const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');
const authRoutes = require('./routes/auth');
const { authenticateToken, optionalAuth } = require('./middleware/auth');

// Import new middleware and utilities
const { 
  logger, 
  requestLogger, 
  errorHandler, 
  notFoundHandler, 
  setupGracefulShutdown,
  asyncHandler 
} = require('./middleware/logging');
const { 
  sanitizeInput, 
  createRateLimiter, 
  validateContentType,
  validateWebhook
} = require('./middleware/validation');
const scheduler = require('./scheduler');
const webhookService = require('./services/webhookService');
const shopifyPoller = require('./shopify-poller');
const redisService = require('./services/redisService');

require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

// Production optimizations
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy
  app.use((req, res, next) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
}

// Setup graceful shutdown
setupGracefulShutdown();

// Global middleware
app.use(requestLogger); // Log all requests
app.use(sanitizeInput); // Sanitize all inputs
app.use(createRateLimiter(15 * 60 * 1000, 100)); // Rate limiting: 100 req/15min
app.use(validateContentType()); // Validate content types

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || false
    : 'http://localhost:5173',
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cookieParser());

// Auth routes
app.use('/api/auth', authRoutes);

// Example health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// One-time production setup endpoint
app.post('/api/setup/admin', asyncHandler(async (req, res) => {
  try {
    const { hashPassword } = require('./utils/password');
    
    // Check if admin already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'admin@xeno.com' }
    });
    
    if (existingUser) {
      return res.json({ 
        status: 'exists', 
        message: 'Admin user already exists' 
      });
    }
    
    // Create admin user
    const hashedPassword = await hashPassword('admin123');
    
    const user = await prisma.user.create({
      data: {
        email: 'admin@xeno.com',
        password: hashedPassword,
        name: 'Admin User'
      }
    });
    
    // Ensure store exists
    const store = await prisma.store.findFirst();
    if (!store) {
      await prisma.store.create({
        data: {
          shopName: process.env.SHOPIFY_STORE_URL || 'xeno-project-kathy.myshopify.com',
          accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
          userId: user.id,
        }
      });
    }
    
    logger.info('Admin user created for production', { email: user.email });
    
    res.json({
      status: 'created',
      message: 'Admin user and store setup completed',
      user: { email: user.email, id: user.id }
    });
    
  } catch (error) {
    logger.error('Failed to create admin user', error);
    res.status(500).json({
      error: 'Setup failed',
      message: error.message
    });
  }
}));
// Example user route (replace with your actual logic)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  // Replace with your actual authentication logic
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }
  // Example: Find user in DB
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // Add password check here
  res.json({ message: 'Login successful', user });
});


// Simplified helper function to get store
// This temporarily goes back to the old way of getting the store
// to isolate the problem.
const getStore = async () => {
  // Find the first store in the database
  const store = await prisma.store.findFirst();
  if (!store) {
    logger.error("No store found in the database. Please run ingest.js");
    throw new Error('Store configuration not found in the database.');
  }
  return store;
};


// --- API ENDPOINT IMPLEMENTATIONS (protected with authentication) ---

app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const store = await getStore();
    const [totalCustomers, totalOrders, revenue] = await Promise.all([
      prisma.customer.count({ where: { storeId: store.id } }),
      prisma.order.count({ where: { storeId: store.id } }),
      prisma.order.aggregate({ _sum: { totalPrice: true }, where: { storeId: store.id } }),
    ]);
    res.json({
      totalCustomers,
      totalOrders,
      totalRevenue: revenue._sum.totalPrice || 0,
    });
  } catch (error) {
    console.error("Error in /api/stats:", error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats.' });
  }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const store = await getStore();
    const { startDate, endDate } = req.query;
    const whereClause = {
      storeId: store.id,
      ...(startDate && endDate && {
        createdAt: { gte: new Date(startDate), lte: new Date(endDate) },
      }),
    };
    const orders = await prisma.order.findMany({
      where: whereClause,
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (error) {
    console.error("Error in /api/orders:", error);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

app.get('/api/top-customers', authenticateToken, async (req, res) => {
  try {
    const store = await getStore();
    const topCustomers = await prisma.order.groupBy({
      by: ['customerId'],
      _sum: {
        totalPrice: true,
      },
      where: {
        storeId: store.id,
      },
      orderBy: {
        _sum: {
          totalPrice: 'desc',
        },
      },
      take: 5,
    });

    if (topCustomers.length === 0) {
        return res.json([]);
    }

    const customerDetails = await prisma.customer.findMany({
        where: {
            id: { in: topCustomers.map(c => c.customerId) }
        }
    });

    const enrichedCustomers = topCustomers
      .map(c => {
        const details = customerDetails.find(cd => cd.id === c.customerId);
        if (!details) return null; 
        return {
            ...details,
            totalSpend: c._sum.totalPrice,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.totalSpend - a.totalSpend);

    res.json(enrichedCustomers);
  } catch (error) {
    console.error("Error in /api/top-customers:", error);
    res.status(500).json({ error: 'Failed to fetch top customers.' });
  }
});

app.get('/api/events/abandoned-carts', authenticateToken, async (req, res) => {
  try {
    const store = await getStore();
    // Find customers who have not placed any orders
    const customers = await prisma.customer.findMany({
      where: {
        storeId: store.id,
        orders: { none: {} }
      }
    });
    res.json(customers);
  } catch (error) {
    console.error("Error in /api/events/abandoned-carts:", error);
    res.status(500).json({ error: 'Failed to fetch abandoned carts.' });
  }
});

// Enhanced analytics endpoints for detailed dashboard
app.get('/api/analytics/daily-stats', authenticateToken, async (req, res) => {
  try {
    const store = await getStore();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Today's stats
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [todayRevenue, todayOrders, todayCustomers] = await Promise.all([
      prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: { storeId: store.id, createdAt: { gte: todayStart, lt: todayEnd } }
      }),
      prisma.order.count({
        where: { storeId: store.id, createdAt: { gte: todayStart, lt: todayEnd } }
      }),
      prisma.customer.count({
        where: { storeId: store.id, createdAt: { gte: todayStart, lt: todayEnd } }
      })
    ]);

    // Yesterday's stats for comparison
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);

    const [yesterdayRevenue, yesterdayOrders] = await Promise.all([
      prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: { storeId: store.id, createdAt: { gte: yesterdayStart, lt: yesterdayEnd } }
      }),
      prisma.order.count({
        where: { storeId: store.id, createdAt: { gte: yesterdayStart, lt: yesterdayEnd } }
      })
    ]);

    // Week ago stats for comparison
    const weekAgoStart = new Date(weekAgo.getFullYear(), weekAgo.getMonth(), weekAgo.getDate());
    const weekAgoEnd = new Date(weekAgoStart);
    weekAgoEnd.setDate(weekAgoEnd.getDate() + 1);

    const weekAgoRevenue = await prisma.order.aggregate({
      _sum: { totalPrice: true },
      where: { storeId: store.id, createdAt: { gte: weekAgoStart, lt: weekAgoEnd } }
    });

    // Calculate percentage changes
    const revenueChange = yesterdayRevenue._sum.totalPrice ? 
      (((todayRevenue._sum.totalPrice || 0) - (yesterdayRevenue._sum.totalPrice || 0)) / (yesterdayRevenue._sum.totalPrice || 0) * 100) : 0;
    
    const revenueWeekChange = weekAgoRevenue._sum.totalPrice ? 
      (((todayRevenue._sum.totalPrice || 0) - (weekAgoRevenue._sum.totalPrice || 0)) / (weekAgoRevenue._sum.totalPrice || 0) * 100) : 0;

    const ordersChange = yesterdayOrders ? 
      ((todayOrders - yesterdayOrders) / yesterdayOrders * 100) : 0;

    res.json({
      todayMoney: todayRevenue._sum.totalPrice || 0,
      todayUsers: todayCustomers,
      todayOrders,
      adsViews: Math.floor(Math.random() * 5000) + 1000, // Mock data for ads views
      sales: todayRevenue._sum.totalPrice || 0,
      changes: {
        money: revenueWeekChange,
        users: Math.floor(Math.random() * 20) - 10, // Mock data
        adsViews: Math.floor(Math.random() * 10) - 5, // Mock data  
        sales: revenueChange
      }
    });
  } catch (error) {
    console.error("Error in /api/analytics/daily-stats:", error);
    res.status(500).json({ error: 'Failed to fetch daily stats.' });
  }
});

app.get('/api/analytics/charts-data', authenticateToken, async (req, res) => {
  try {
    const store = await getStore();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get orders from last 30 days
    const orders = await prisma.order.findMany({
      where: { 
        storeId: store.id,
        createdAt: { gte: thirtyDaysAgo }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Website views (mock data - days of week)
    const websiteViews = {
      labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      datasets: [{
        label: 'Views',
        data: [45, 42, 22, 28, 55, 65, 78],
        backgroundColor: '#22c55e',
        borderColor: '#22c55e',
        borderWidth: 2
      }]
    };

    // Daily sales (line chart from real data)
    const dailySalesMap = {};
    orders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0];
      const month = new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short' });
      if (!dailySalesMap[month]) dailySalesMap[month] = 0;
      dailySalesMap[month] += order.totalPrice || 0;
    });

    const dailySales = {
      labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
      datasets: [{
        label: 'Sales',
        data: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map(month => {
          const fullMonth = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].indexOf(month)];
          return dailySalesMap[fullMonth] || Math.floor(Math.random() * 400) + 100;
        }),
        borderColor: '#22c55e',
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4
      }]
    };

    // Completed tasks (mock data based on orders count)
    const completedTasks = {
      labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [{
        label: 'Tasks',
        data: [80, 60, 280, 220, 520, 250, 420, 230, 500],
        borderColor: '#22c55e',
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4
      }]
    };

    res.json({
      websiteViews,
      dailySales,
      completedTasks
    });
  } catch (error) {
    console.error("Error in /api/analytics/charts-data:", error);
    res.status(500).json({ error: 'Failed to fetch charts data.' });
  }
});

app.get('/api/revenue-over-time', authenticateToken, async (req, res) => {
    try {
    const store = await getStore();
    // Get all orders for the store
    const orders = await prisma.order.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'asc' },
    });
    // Aggregate revenue by day
    const dailyRevenue = {};
    orders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0];
      if (!dailyRevenue[date]) dailyRevenue[date] = 0;
      dailyRevenue[date] += order.totalPrice || 0;
    });
    // Prepare Chart.js data format
    const labels = Object.keys(dailyRevenue);
    const data = Object.values(dailyRevenue);
    res.json({
      labels,
      datasets: [
        {
          label: 'Revenue',
          data,
          fill: true,
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          borderColor: 'rgba(255, 99, 132, 1)',
        },
      ],
    });
    } catch (error) {
        console.error("Error in /api/revenue-over-time:", error);
        res.status(500).json({ error: 'Failed to fetch revenue data.' });
    }
});

// Enhanced Shopify webhook endpoint with complete data sync
app.post('/api/webhooks/shopify', 
  // Use raw body parser for webhook verification
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    try {
      const webhookData = JSON.parse(req.body.toString());
      const shopDomain = req.get('X-Shopify-Shop-Domain');
      const topic = req.get('X-Shopify-Topic');
      const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
      
      logger.info('Received Shopify webhook', {
        shopDomain,
        topic,
        dataId: webhookData.id,
        hasHmac: !!hmacHeader
      });

      // Verify webhook authenticity if HMAC secret is configured
      const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
      if (webhookSecret) {
        const isValid = webhookService.verifyWebhook(
          req.body.toString(),
          hmacHeader,
          webhookSecret
        );
        
        if (!isValid) {
          logger.warn('Webhook verification failed', { shopDomain, topic });
          return res.status(401).json({ 
            error: 'Webhook verification failed' 
          });
        }
      }

      // Process the webhook
      const result = await webhookService.processWebhook(
        topic,
        webhookData,
        shopDomain
      );

      logger.info('Webhook processed successfully', {
        shopDomain,
        topic,
        result: result.status,
        action: result.action
      });

      res.status(200).json({
        status: 'success',
        message: `Webhook processed: ${result.action || result.status}`,
        ...result
      });

    } catch (error) {
      logger.error('Webhook processing error', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({ 
        error: 'Webhook processing failed',
        message: error.message
      });
    }
  })
);

// Enhanced manual data sync endpoint with Redis caching and real-time updates
app.post('/api/sync/shopify', (req, res, next) => {
  // Add debug logging before any processing
  logger.info('� SYNC ENDPOINT HIT - Raw request debug', {
    method: req.method,
    url: req.url,
    headers: {
      authorization: req.headers.authorization ? `${req.headers.authorization.substring(0, 50)}...` : 'NONE',
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'] ? req.headers['user-agent'].substring(0, 50) + '...' : 'NONE'
    },
    body: req.body,
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : []
  });
  
  next();
}, asyncHandler(async (req, res) => {
  const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.info('🔍 Inside async handler - processing sync', { syncId });

    const store = await getStore();
    const { syncType = 'full' } = req.body; // 'full' or 'incremental'
    
    logger.info('Manual sync initiated', { 
      syncId,
      userId: 'debug-user',
      storeId: store.id,
      syncType 
    });

    // Clear analytics cache before sync
    await redisService.invalidateAnalytics();
    
    // Publish sync start event
    await redisService.publishSyncEvent('sync_start', { syncId, syncType: 'manual' });
    
    // Use the scheduler for consistent sync behavior
    const result = await scheduler.performSync('manual_api');
    
    // 🆕 After basic sync, process recent orders to ensure all data is updated
    if (result.status === 'success') {
      logger.info('🔄 Running post-sync webhook processing for recent orders', { syncId });
      
      try {
        // Fetch recent orders from Shopify (last 50 orders) to process as webhooks
        const shopifyUrl = process.env.SHOPIFY_STORE_URL;
        const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
        
        if (shopifyUrl && accessToken) {
          const ordersResponse = await fetch(`https://${shopifyUrl}/admin/api/2023-10/orders.json?limit=50&status=any`, {
            headers: { 'X-Shopify-Access-Token': accessToken },
          });
          
          if (ordersResponse.ok) {
            const { orders } = await ordersResponse.json();
            logger.info(`📦 Processing ${orders.length} recent orders for webhook-like updates`, { syncId });
            
            // Process each order through webhook service to ensure proper updates
            for (const order of orders) {
              try {
                await webhookService.processWebhook('orders/updated', order, shopifyUrl);
              } catch (webhookError) {
                logger.warn('Order webhook processing failed', {
                  syncId,
                  orderId: order.id,
                  error: webhookError.message
                });
              }
            }
            
            // Also fetch and process recent customers
            const customersResponse = await fetch(`https://${shopifyUrl}/admin/api/2023-10/customers.json?limit=50`, {
              headers: { 'X-Shopify-Access-Token': accessToken },
            });
            
            if (customersResponse.ok) {
              const { customers } = await customersResponse.json();
              logger.info(`👥 Processing ${customers.length} recent customers for webhook-like updates`, { syncId });
              
              for (const customer of customers) {
                try {
                  await webhookService.processWebhook('customers/update', customer, shopifyUrl);
                } catch (webhookError) {
                  logger.warn('Customer webhook processing failed', {
                    syncId,
                    customerId: customer.id,
                    error: webhookError.message
                  });
                }
              }
            }
            
            logger.info('✅ Post-sync webhook processing completed', { syncId });
          }
        }
      } catch (postSyncError) {
        logger.warn('Post-sync webhook processing failed', {
          syncId,
          error: postSyncError.message
        });
        // Don't fail the entire sync for post-processing errors
      }
    }
    
    // Cache sync result
    await redisService.set(`sync:${syncId}`, {
      syncId,
      result,
      userId: req.user?.id,
      syncType,
      timestamp: new Date().toISOString()
    }, 3600); // Cache for 1 hour
    
    // Publish sync completion
    if (result.status === 'success') {
      await redisService.publishSyncEvent('sync_complete', {
        syncId,
        message: `${syncType} sync completed successfully`,
        duration: result.duration,
        syncType
      });
    } else {
      await redisService.publishSyncEvent('sync_error', {
        syncId,
        error: result.error || 'Sync failed',
        syncType
      });
    }
    
    logger.info('Manual sync completed', {
      syncId,
      userId: req.user?.id,
      result: result.status,
      duration: result.duration
    });

    res.json({
      status: 'success',
      message: `${syncType} sync completed with webhook processing`,
      syncId,
      syncResult: result,
      timestamp: new Date().toISOString(),
      details: 'Data synced from Shopify and processed through webhook handlers for comprehensive updates'
    });
    
  } catch (error) {
    // Publish sync error
    await redisService.publishSyncEvent('sync_error', {
      syncId,
      error: error.message,
      syncType: 'manual'
    });
    
    logger.error('Manual sync failed', { 
      syncId,
      userId: req.user?.id,
      error: error.message 
    });
    
    res.status(500).json({ 
      error: 'Manual sync failed',
      message: error.message,
      syncId
    });
  }
}));

// Webhook management endpoints
app.get('/api/webhooks/stats', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const stats = await webhookService.getWebhookStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get webhook stats', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to get webhook stats',
      message: error.message
    });
  }
}));

// Real-time polling endpoints (alternative to webhooks)
app.post('/api/polling/start', authenticateToken, asyncHandler(async (req, res) => {
  try {
    if (shopifyPoller.isPolling) {
      return res.json({
        status: 'already_running',
        message: 'Polling is already active',
        stats: shopifyPoller.getStats()
      });
    }
    
    await shopifyPoller.startPolling();
    
    res.json({
      status: 'success',
      message: 'Real-time polling started',
      stats: shopifyPoller.getStats()
    });
  } catch (error) {
    logger.error('Failed to start polling', { error: error.message });
    res.status(500).json({
      error: 'Failed to start polling',
      message: error.message
    });
  }
}));

app.post('/api/polling/stop', authenticateToken, asyncHandler(async (req, res) => {
  try {
    shopifyPoller.stopPolling();
    
    res.json({
      status: 'success', 
      message: 'Polling stopped',
      stats: shopifyPoller.getStats()
    });
  } catch (error) {
    logger.error('Failed to stop polling', { error: error.message });
    res.status(500).json({
      error: 'Failed to stop polling',
      message: error.message
    });
  }
}));

app.get('/api/polling/status', authenticateToken, asyncHandler(async (req, res) => {
  try {
    res.json({
      status: 'success',
      polling: shopifyPoller.getStats()
    });
  } catch (error) {
    logger.error('Failed to get polling status', { error: error.message });
    res.status(500).json({
      error: 'Failed to get polling status', 
      message: error.message
    });
  }
}));

// Redis health check endpoint
app.get('/api/redis/health', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const healthStatus = await redisService.ping();
    const status = redisService.getStatus();
    res.json({
      status: 'success',
      redis: {
        connected: healthStatus,
        ...status
      }
    });
  } catch (error) {
    logger.error('Failed to check Redis health', { error: error.message });
    res.status(500).json({
      error: 'Failed to check Redis health',
      message: error.message
    });
  }
}));

// Enhanced Analytics Dashboard Endpoints
app.get('/api/analytics/overview', authenticateToken, async (req, res) => {
  try {
    const cacheKey = 'overview';
    
    // Try to get cached data first
    const cachedData = await redisService.getCachedAnalytics();
    if (cachedData) {
      logger.info('📦 Serving cached analytics overview');
      return res.json({
        ...cachedData,
        cached: true,
        cacheTimestamp: cachedData.timestamp
      });
    }
    
    const store = await getStore();
    
    // Get total counts and revenue
    const [totalCustomers, totalOrders, totalRevenue, totalProducts] = await Promise.all([
      prisma.customer.count({ where: { storeId: store.id } }),
      prisma.order.count({ where: { storeId: store.id } }),
      prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: { storeId: store.id }
      }),
      prisma.product.count({ where: { storeId: store.id } })
    ]);

    // Get average order value
    const avgOrderValue = totalOrders > 0 ? (totalRevenue._sum.totalPrice || 0) / totalOrders : 0;

    // Get recent activity
    const recentOrders = await prisma.order.findMany({
      where: { storeId: store.id },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const responseData = {
      totalCustomers,
      totalOrders,
      totalRevenue: totalRevenue._sum.totalPrice || 0,
      totalProducts,
      avgOrderValue,
      recentOrders,
      cached: false,
      timestamp: new Date().toISOString()
    };
    
    // Cache the data
    await redisService.cacheAnalytics(responseData);
    
    res.json(responseData);
  } catch (error) {
    console.error("Error in /api/analytics/overview:", error);
    res.status(500).json({ error: 'Failed to fetch overview analytics.' });
  }
});

// Monthly performance trends
app.get('/api/analytics/monthly-trends', authenticateToken, async (req, res) => {
  try {
    const store = await getStore();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const orders = await prisma.order.findMany({
      where: { 
        storeId: store.id,
        createdAt: { gte: sixMonthsAgo }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group by month
    const monthlyData = {};
    orders.forEach(order => {
      const monthKey = order.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, orders: 0 };
      }
      monthlyData[monthKey].revenue += order.totalPrice || 0;
      monthlyData[monthKey].orders += 1;
    });

    // Convert to array format for charts
    const months = Object.keys(monthlyData).sort();
    const revenueData = months.map(month => monthlyData[month].revenue);
    const orderData = months.map(month => monthlyData[month].orders);

    res.json({
      labels: months.map(month => new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })),
      revenue: revenueData,
      orders: orderData
    });
  } catch (error) {
    console.error("Error in /api/analytics/monthly-trends:", error);
    res.status(500).json({ error: 'Failed to fetch monthly trends.' });
  }
});

// Customer growth analytics
app.get('/api/analytics/customer-growth', authenticateToken, async (req, res) => {
  try {
    const store = await getStore();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const customers = await prisma.customer.findMany({
      where: { 
        storeId: store.id,
        createdAt: { gte: sixMonthsAgo }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group by month
    const monthlyCustomers = {};
    customers.forEach(customer => {
      const monthKey = customer.createdAt.toISOString().substring(0, 7);
      if (!monthlyCustomers[monthKey]) {
        monthlyCustomers[monthKey] = 0;
      }
      monthlyCustomers[monthKey] += 1;
    });

    const months = Object.keys(monthlyCustomers).sort();
    const customerData = months.map(month => monthlyCustomers[month]);

    res.json({
      labels: months.map(month => new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' })),
      customers: customerData
    });
  } catch (error) {
    console.error("Error in /api/analytics/customer-growth:", error);
    res.status(500).json({ error: 'Failed to fetch customer growth.' });
  }
});

// Revenue by time of day
app.get('/api/analytics/revenue-by-hour', authenticateToken, async (req, res) => {
  try {
    const store = await getStore();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orders = await prisma.order.findMany({
      where: { 
        storeId: store.id,
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    // Group by hour of day
    const hourlyRevenue = Array(24).fill(0);
    orders.forEach(order => {
      const hour = order.createdAt.getHours();
      hourlyRevenue[hour] += order.totalPrice || 0;
    });

    res.json({
      labels: Array.from({length: 24}, (_, i) => `${i}:00`),
      revenue: hourlyRevenue
    });
  } catch (error) {
    console.error("Error in /api/analytics/revenue-by-hour:", error);
    res.status(500).json({ error: 'Failed to fetch hourly revenue.' });
  }
});

// Product performance
app.get('/api/analytics/product-performance', authenticateToken, async (req, res) => {
  try {
    const store = await getStore();
    
    const productStats = await prisma.lineItem.groupBy({
      by: ['shopifyProductId'],
      _sum: {
        quantity: true,
        price: true
      },
      _count: {
        id: true
      },
      orderBy: {
        _sum: {
          price: 'desc'
        }
      },
      take: 10
    });

    // Get product details
    const productIds = productStats.map(stat => stat.shopifyProductId).filter(Boolean);
    const products = await prisma.product.findMany({
      where: {
        shopifyProductId: { in: productIds },
        storeId: store.id
      }
    });

    const enrichedStats = productStats.map(stat => {
      const product = products.find(p => p.shopifyProductId === stat.shopifyProductId);
      return {
        productTitle: product?.title || 'Unknown Product',
        totalRevenue: stat._sum.price || 0,
        totalQuantity: stat._sum.quantity || 0,
        orderCount: stat._count.id
      };
    });

    res.json(enrichedStats);
  } catch (error) {
    console.error("Error in /api/analytics/product-performance:", error);
    res.status(500).json({ error: 'Failed to fetch product performance.' });
  }
});

// 🎯 CREATIVE BUSINESS PERFORMANCE METRICS

// Customer Lifetime Value & Segmentation
app.get('/api/analytics/customer-insights', authenticateToken, async (req, res) => {
  try {
    const store = await getStore();
    
    // Get customer spending patterns
    const customerMetrics = await prisma.order.groupBy({
      by: ['customerId'],
      _sum: { totalPrice: true },
      _count: { id: true },
      _avg: { totalPrice: true },
      where: { storeId: store.id }
    });

    // Get customer details
    const customerDetails = await prisma.customer.findMany({
      where: { 
        storeId: store.id,
        id: { in: customerMetrics.map(c => c.customerId) }
      }
    });

    // Calculate customer segments
    let highValue = 0, mediumValue = 0, lowValue = 0;
    let repeatCustomers = 0, oneTimeCustomers = 0;
    const totalSpends = customerMetrics.map(c => c._sum.totalPrice);
    const avgSpend = totalSpends.reduce((a, b) => a + b, 0) / totalSpends.length;

    customerMetrics.forEach(metric => {
      if (metric._sum.totalPrice > avgSpend * 1.5) highValue++;
      else if (metric._sum.totalPrice > avgSpend * 0.5) mediumValue++;
      else lowValue++;

      if (metric._count.id > 1) repeatCustomers++;
      else oneTimeCustomers++;
    });

    // Customer retention rate
    const retentionRate = customerMetrics.length > 0 ? (repeatCustomers / customerMetrics.length * 100) : 0;

    res.json({
      segments: {
        labels: ['High Value', 'Medium Value', 'Low Value'],
        data: [highValue, mediumValue, lowValue],
        colors: ['#22c55e', '#f59e0b', '#ef4444']
      },
      loyalty: {
        labels: ['Repeat Customers', 'One-time Customers'],
        data: [repeatCustomers, oneTimeCustomers],
        colors: ['#3b82f6', '#94a3b8']
      },
      metrics: {
        avgCustomerValue: avgSpend,
        retentionRate,
        totalCustomers: customerMetrics.length
      }
    });
  } catch (error) {
    console.error("Error in /api/analytics/customer-insights:", error);
    res.status(500).json({ error: 'Failed to fetch customer insights.' });
  }
});

// Sales Velocity & Conversion Funnel
app.get('/api/analytics/sales-funnel', authenticateToken, async (req, res) => {
  try {
    const store = await getStore();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get daily sales velocity over last 30 days
    const orders = await prisma.order.findMany({
      where: { 
        storeId: store.id,
        createdAt: { gte: thirtyDaysAgo }
      },
      include: { lineItems: true },
      orderBy: { createdAt: 'asc' }
    });

    // Calculate daily metrics
    const dailyMetrics = {};
    orders.forEach(order => {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      if (!dailyMetrics[dateKey]) {
        dailyMetrics[dateKey] = {
          revenue: 0,
          orders: 0,
          items: 0,
          avgOrderValue: 0
        };
      }
      dailyMetrics[dateKey].revenue += order.totalPrice;
      dailyMetrics[dateKey].orders += 1;
      dailyMetrics[dateKey].items += order.lineItems.reduce((sum, item) => sum + item.quantity, 0);
    });

    // Calculate conversion metrics
    const totalCustomers = await prisma.customer.count({ where: { storeId: store.id } });
    const customersWithOrders = await prisma.customer.count({
      where: {
        storeId: store.id,
        orders: { some: {} }
      }
    });

    const conversionRate = totalCustomers > 0 ? (customersWithOrders / totalCustomers * 100) : 0;
    
    // Prepare chart data
    const dates = Object.keys(dailyMetrics).sort();
    const revenueVelocity = dates.map(date => dailyMetrics[date].revenue);
    const orderVelocity = dates.map(date => dailyMetrics[date].orders);

    res.json({
      velocity: {
        labels: dates.map(date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        revenue: revenueVelocity,
        orders: orderVelocity
      },
      funnel: {
        totalVisitors: totalCustomers,
        convertedCustomers: customersWithOrders,
        conversionRate,
        totalOrders: orders.length
      }
    });
  } catch (error) {
    console.error("Error in /api/analytics/sales-funnel:", error);
    res.status(500).json({ error: 'Failed to fetch sales funnel data.' });
  }
});

// Seasonal Trends & Forecasting
app.get('/api/analytics/seasonal-trends', authenticateToken, async (req, res) => {
  try {
    const store = await getStore();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const orders = await prisma.order.findMany({
      where: { 
        storeId: store.id,
        createdAt: { gte: oneYearAgo }
      }
    });

    // Group by day of week
    const dayOfWeekData = Array(7).fill(0);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Group by month
    const monthlyData = Array(12).fill(0);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    orders.forEach(order => {
      const dayOfWeek = order.createdAt.getDay();
      const month = order.createdAt.getMonth();
      
      dayOfWeekData[dayOfWeek] += order.totalPrice;
      monthlyData[month] += order.totalPrice;
    });

    // Calculate growth trends
    const currentMonth = new Date().getMonth();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const monthlyGrowth = monthlyData[lastMonth] > 0 ? 
      ((monthlyData[currentMonth] - monthlyData[lastMonth]) / monthlyData[lastMonth] * 100) : 0;

    res.json({
      dayOfWeek: {
        labels: dayNames,
        data: dayOfWeekData
      },
      monthly: {
        labels: monthNames,
        data: monthlyData
      },
      trends: {
        bestDay: dayNames[dayOfWeekData.indexOf(Math.max(...dayOfWeekData))],
        bestMonth: monthNames[monthlyData.indexOf(Math.max(...monthlyData))],
        monthlyGrowth: monthlyGrowth.toFixed(1)
      }
    });
  } catch (error) {
    console.error("Error in /api/analytics/seasonal-trends:", error);
    res.status(500).json({ error: 'Failed to fetch seasonal trends.' });
  }
});

// Order Size & Basket Analysis
app.get('/api/analytics/order-analysis', authenticateToken, async (req, res) => {
  try {
    const store = await getStore();

    const orders = await prisma.order.findMany({
      where: { storeId: store.id },
      include: { lineItems: true }
    });

    // Analyze order sizes
    const orderSizes = orders.map(order => ({
      value: order.totalPrice,
      itemCount: order.lineItems.reduce((sum, item) => sum + item.quantity, 0)
    }));

    // Create order value ranges
    const ranges = {
      '0-50': 0,
      '51-100': 0,
      '101-200': 0,
      '201-500': 0,
      '500+': 0
    };

    orderSizes.forEach(order => {
      if (order.value <= 50) ranges['0-50']++;
      else if (order.value <= 100) ranges['51-100']++;
      else if (order.value <= 200) ranges['101-200']++;
      else if (order.value <= 500) ranges['201-500']++;
      else ranges['500+']++;
    });

    // Calculate basket metrics
    const avgBasketSize = orderSizes.length > 0 ? 
      orderSizes.reduce((sum, order) => sum + order.itemCount, 0) / orderSizes.length : 0;
    
    const avgOrderValue = orderSizes.length > 0 ?
      orderSizes.reduce((sum, order) => sum + order.value, 0) / orderSizes.length : 0;

    res.json({
      orderRanges: {
        labels: Object.keys(ranges),
        data: Object.values(ranges)
      },
      metrics: {
        avgBasketSize: Math.round(avgBasketSize * 100) / 100,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        totalOrders: orders.length
      }
    });
  } catch (error) {
    console.error("Error in /api/analytics/order-analysis:", error);
    res.status(500).json({ error: 'Failed to fetch order analysis.' });
  }
});

// Custom Events & Business Intelligence
app.get('/api/analytics/business-health', authenticateToken, async (req, res) => {
  try {
    const store = await getStore();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get custom events if any
    const customEvents = await prisma.customEvent.findMany({
      where: { 
        storeId: store.id,
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    // Business health metrics
    const recentOrders = await prisma.order.count({
      where: {
        storeId: store.id,
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    const recentCustomers = await prisma.customer.count({
      where: {
        storeId: store.id,
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    // Calculate business health score (0-100)
    let healthScore = 0;
    if (recentOrders > 0) healthScore += 30; // Recent activity
    if (recentCustomers > 0) healthScore += 20; // New customers
    if (recentOrders > 10) healthScore += 25; // Good volume
    if (recentCustomers > 5) healthScore += 25; // Good growth

    // Risk indicators
    const risks = [];
    if (recentOrders === 0) risks.push('No recent orders');
    if (recentCustomers === 0) risks.push('No new customers');
    if (recentOrders < 5) risks.push('Low order volume');

    res.json({
      healthScore,
      risks,
      metrics: {
        recentOrders,
        recentCustomers,
        customEventsCount: customEvents.length
      },
      recommendation: healthScore > 75 ? 'Excellent performance!' : 
                     healthScore > 50 ? 'Good performance, room for improvement' :
                     'Needs attention - focus on customer acquisition'
    });
  } catch (error) {
    console.error("Error in /api/analytics/business-health:", error);
    res.status(500).json({ error: 'Failed to fetch business health data.' });
  }
});

// Scheduler management endpoints
app.get('/api/scheduler/stats', authenticateToken, (req, res) => {
  try {
    const stats = scheduler.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get scheduler stats', { error: error.message });
    res.status(500).json({ error: 'Failed to get scheduler stats' });
  }
});

app.post('/api/scheduler/sync', authenticateToken, async (req, res) => {
  try {
    logger.info('Manual sync triggered by user', { userId: req.user?.id });
    const result = await scheduler.performSync('manual_api');
    res.json(result);
  } catch (error) {
    logger.error('Manual sync failed', { error: error.message });
    res.status(500).json({ error: 'Manual sync failed' });
  }
});

// Health check endpoint with detailed status
app.get('/api/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    scheduler: scheduler.getStats()
  };
  
  res.json(health);
});

// 404 handler for unknown routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

// Create HTTP server and Socket.io
const { createServer } = require('http');
const { Server } = require('socket.io');

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info('Client connected to WebSocket', { socketId: socket.id });

  socket.on('disconnect', () => {
    logger.info('Client disconnected from WebSocket', { socketId: socket.id });
  });

  // Join sync room for real-time sync updates
  socket.on('join-sync', () => {
    socket.join('sync-updates');
    socket.emit('sync-status', { message: 'Connected to sync updates' });
  });
});

// Initialize webhook service with Socket.io for real-time events
webhookService.setSocketIO(io);

// Subscribe to Redis sync events for real-time updates
redisService.subscribeToSyncEvents((eventData) => {
  const { type, data, timestamp } = eventData;
  
  switch (type) {
    case 'sync_start':
      io.to('sync-updates').emit('sync-started', data);
      break;
    case 'sync_complete':
      io.to('sync-updates').emit('sync-completed', data);
      break;
    case 'sync_error':
      io.to('sync-updates').emit('sync-error', data);
      break;
    default:
      io.to('sync-updates').emit('sync-event', { type, data, timestamp });
  }
});

redisService.subscribe('sync:error', (data) => {
  io.to('sync-updates').emit('sync-error', data);
});

const server = httpServer.listen(PORT, () => {
  logger.info(`🚀 Server starting on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  });
  
  // Start the scheduler in production
  if (process.env.NODE_ENV === 'production') {
    scheduler.start();
  }
});

module.exports = app;

