import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.PROD 
    ? 'https://xeno-project-kathy-production.up.railway.app' 
    : 'http://localhost:8080',
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API functions
export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  },

  register: async (email, password) => {
    const response = await api.post('/api/auth/register', { email, password });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/api/auth/logout');
    return response.data;
  }
};

// Dashboard API functions
export const dashboardAPI = {
  // Overview stats
  getOverview: async () => {
    const response = await api.get('/api/analytics/overview');
    return response.data;
  },

  getDailyStats: async () => {
    const response = await api.get('/api/analytics/daily-stats');
    return response.data;
  },

  getChartsData: async () => {
    const response = await api.get('/api/analytics/charts-data');
    return response.data;
  },

  // Orders and customers
  getOrders: async (startDate, endDate) => {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await api.get('/api/orders', { params });
    return response.data;
  },

  getTopCustomers: async () => {
    const response = await api.get('/api/top-customers');
    return response.data;
  },

  // Analytics endpoints
  getMonthlyTrends: async () => {
    const response = await api.get('/api/analytics/monthly-trends');
    return response.data;
  },

  getCustomerGrowth: async () => {
    const response = await api.get('/api/analytics/customer-growth');
    return response.data;
  },

  getRevenueByHour: async () => {
    const response = await api.get('/api/analytics/revenue-by-hour');
    return response.data;
  },

  getProductPerformance: async () => {
    const response = await api.get('/api/analytics/product-performance');
    return response.data;
  },

  // 🎯 Creative Business Performance Analytics
  getCustomerInsights: async () => {
    const response = await api.get('/api/analytics/customer-insights');
    return response.data;
  },

  getSalesFunnel: async () => {
    const response = await api.get('/api/analytics/sales-funnel');
    return response.data;
  },

  getSeasonalTrends: async () => {
    const response = await api.get('/api/analytics/seasonal-trends');
    return response.data;
  },

  getOrderAnalysis: async () => {
    const response = await api.get('/api/analytics/order-analysis');
    return response.data;
  },

  getBusinessHealth: async () => {
    const response = await api.get('/api/analytics/business-health');
    return response.data;
  },

  // Legacy endpoints
  getAbandonedCarts: async () => {
    const response = await api.get('/api/events/abandoned-carts');
    return response.data;
  },

  getRevenueOverTime: async () => {
    const response = await api.get('/api/revenue-over-time');
    return response.data;
  },

  syncShopifyData: async () => {
    const response = await api.post('/api/sync/shopify', {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  },

  // Real-time polling controls (alternative to webhooks)
  startPolling: async () => {
    const response = await api.post('/api/polling/start');
    return response.data;
  },

  stopPolling: async () => {
    const response = await api.post('/api/polling/stop');
    return response.data;
  },

  getPollingStatus: async () => {
    const response = await api.get('/api/polling/status');
    return response.data;
  }
};

export default api;