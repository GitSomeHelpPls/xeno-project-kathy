import { useState, useEffect } from 'react';
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';
import { useAuth } from '../hooks/useAuth';
import { dashboardAPI } from '../utils/api';
import socketService from '../services/socketService';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Dashboard = () => {
  const { user, logout } = useAuth();
  
  // Core data states
  const [overview, setOverview] = useState(null);
  const [dailyStats, setDailyStats] = useState(null);
  const [monthlyTrends, setMonthlyTrends] = useState(null);
  const [customerGrowth, setCustomerGrowth] = useState(null);
  const [revenueByHour, setRevenueByHour] = useState(null);
  const [productPerformance, setProductPerformance] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  
  // 🎯 Creative Analytics States
  const [customerInsights, setCustomerInsights] = useState(null);
  const [salesFunnel, setSalesFunnel] = useState(null);
  const [seasonalTrends, setSeasonalTrends] = useState(null);
  const [orderAnalysis, setOrderAnalysis] = useState(null);
  const [businessHealth, setBusinessHealth] = useState(null);
  
  // UI states
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, success, error
  const [webhookProcessing, setWebhookProcessing] = useState(false); // Track webhook processing
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('sales'); // Tab state for detailed analytics
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  
  // ⭐ NEW: Real-time update states
  const [hasNewData, setHasNewData] = useState(false);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [pendingUpdates, setPendingUpdates] = useState([]);

  // Add CSS animation style for spinner
  const spinnerStyle = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    @keyframes bounce {
      0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-4px); }
      60% { transform: translateY(-2px); }
    }
    
    /* Hide scrollbar for webkit browsers */
    *::-webkit-scrollbar {
      display: none;
    }
  `;

  // Add the style tag if it doesn't exist
  if (!document.querySelector('#dashboard-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'dashboard-spinner-style';
    style.textContent = spinnerStyle;
    document.head.appendChild(style);
  }

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    fetchAllDashboardData();
  }, []);

  // Socket.io setup for real-time sync updates
  useEffect(() => {
    // Connect to WebSocket
    socketService.connect();

    // Set up sync event listeners
    const handleSyncStarted = (data) => {
      console.log('🔄 Sync started:', data);
      setSyncing(true);
      setSyncStatus('syncing');
      setSyncProgress('Starting comprehensive data sync...');
      setWebhookProcessing(false);
      setHasNewData(false); // Clear new data indicator
    };

    const handleSyncProgress = (data) => {
      console.log('📊 Sync progress:', data);
      const message = data.message || 'Syncing data...';
      setSyncProgress(message);
      
      // Detect webhook processing phase
      if (message.includes('webhook') || message.includes('Processing') || message.includes('orders') || message.includes('customers')) {
        setWebhookProcessing(true);
      }
    };

    const handleSyncCompleted = (data) => {
      console.log('✅ Sync completed:', data);
      setSyncing(false);
      setSyncStatus('success');
      setWebhookProcessing(false);
      setSyncProgress('Sync completed - Refreshing dashboard...');
      setLastSyncTime(new Date());
      setHasNewData(false);
      setNewOrdersCount(0);
      setPendingUpdates([]);
      
      // Show success message about webhook processing
      if (data.details) {
        console.log('Sync details:', data.details);
      }
      
      // 🚀 Immediate data refresh after sync completion
      setTimeout(() => {
        console.log('🔄 Refreshing dashboard data after sync...');
        setSyncProgress('Updating dashboard...');
        fetchAllDashboardData(true).then(() => { // Force fresh data
          console.log('✅ Dashboard data refreshed successfully');
          setSyncStatus('idle');
          setSyncProgress('');
        }).catch((error) => {
          console.error('❌ Failed to refresh dashboard data:', error);
          setSyncProgress('Data refresh failed');
          setTimeout(() => {
            setSyncStatus('idle');
            setSyncProgress('');
          }, 2000);
        });
      }, 1000); // Reduced delay to 1 second for faster refresh
    };

    const handleSyncError = (data) => {
      console.error('❌ Sync error:', data);
      setSyncing(false);
      setSyncStatus('error');
      setSyncProgress(`Sync failed: ${data.error || 'Unknown error'}`);
      
      // Clear error after 5 seconds
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncProgress('');
      }, 5000);
    };

    // ⭐ NEW: Handle order payment notifications
    const handleOrderPaid = (orderData) => {
      console.log('💳 Order paid:', orderData);
      
      setNewOrdersCount(prev => prev + 1);
      setHasNewData(true);
      setPendingUpdates(prev => [
        ...prev, 
        { 
          type: 'order-paid', 
          data: orderData, 
          timestamp: new Date(),
          id: Date.now() 
        }
      ]);
      
      // Show notification
      if (Notification.permission === 'granted') {
        new Notification('Order Payment Received!', {
          body: `Payment for Order #${orderData.order_number || 'Unknown'} - ₹${orderData.total_price || '0.00'}`,
          icon: '/shopify-icon.png'
        });
      }
      
      setHasNewData(true);
      
      if (autoRefreshEnabled) {
        setTimeout(() => {
          fetchAllDashboardData(true); // Force fresh data
        }, 2000);
      }
    };

    // ⭐ NEW: Handle order update notifications
    const handleOrderUpdated = (orderData) => {
      console.log('📝 Order updated:', orderData);
      
      setPendingUpdates(prev => [
        ...prev, 
        { 
          type: 'order-updated', 
          data: orderData, 
          timestamp: new Date(),
          id: Date.now() 
        }
      ]);
      
      setHasNewData(true);
      
      if (autoRefreshEnabled) {
        setTimeout(() => {
          fetchAllDashboardData(true); // Force fresh data
        }, 1500);
      }
    };

    // ⭐ NEW: Handle customer update notifications  
    const handleCustomerUpdated = (customerData) => {
      console.log('👥 Customer updated:', customerData);
      
      setPendingUpdates(prev => [
        ...prev, 
        { 
          type: 'customer-updated', 
          data: customerData, 
          timestamp: new Date(),
          id: Date.now() 
        }
      ]);
      
      setHasNewData(true);
      
      if (autoRefreshEnabled) {
        setTimeout(() => {
          fetchAllDashboardData(true); // Force fresh data
        }, 1500);
      }
    };
    const handleNewOrder = (orderData) => {
      console.log('🛒 New order received:', orderData);
      
      setNewOrdersCount(prev => prev + 1);
      setHasNewData(true);
      setPendingUpdates(prev => [
        ...prev, 
        { 
          type: 'order', 
          data: orderData, 
          timestamp: new Date(),
          id: Date.now() 
        }
      ]);
      
      // Show notification
      if (Notification.permission === 'granted') {
        new Notification('New Shopify Order!', {
          body: `Order #${orderData.order_number || 'Unknown'} - ₹${orderData.total_price || '0.00'}`,
          icon: '/shopify-icon.png'
        });
      }
      
      // Auto-refresh if enabled
      if (autoRefreshEnabled) {
        setTimeout(() => {
          fetchAllDashboardData(true); // Force fresh data for real-time updates
        }, 1000);
      }
    };

    // ⭐ NEW: Handle data change notifications 
    const handleDataChanged = (changeData) => {
      console.log('📈 Data changed:', changeData);
      setHasNewData(true);
      
      if (autoRefreshEnabled) {
        setTimeout(() => {
          fetchAllDashboardData(true); // Force fresh data
        }, 2000);
      }
    };

    // Register listeners
    socketService.onSyncStarted(handleSyncStarted);
    socketService.onSyncProgress(handleSyncProgress);
    socketService.onSyncCompleted(handleSyncCompleted);
    socketService.onSyncError(handleSyncError);
    
    // ⭐ NEW: Register enhanced event listeners for webhook processing
    socketService.on('new-order', handleNewOrder);
    socketService.on('order-paid', handleOrderPaid);
    socketService.on('order-updated', handleOrderUpdated);
    socketService.on('customers/update', handleCustomerUpdated);
    socketService.on('data-changed', handleDataChanged);

    // Cleanup
    return () => {
      socketService.off('syncStarted', handleSyncStarted);
      socketService.off('syncProgress', handleSyncProgress);
      socketService.off('syncCompleted', handleSyncCompleted);
      socketService.off('syncError', handleSyncError);
      socketService.off('new-order', handleNewOrder);
      socketService.off('order-paid', handleOrderPaid);
      socketService.off('order-updated', handleOrderUpdated);
      socketService.off('customers/update', handleCustomerUpdated);
      socketService.off('data-changed', handleDataChanged);
      socketService.disconnect();
    };
  }, [autoRefreshEnabled]);

  const fetchAllDashboardData = async (forceFresh = false) => {
    try {
      setLoading(true);
      setError('');
      
      // Add cache busting parameter when forceFresh is true
      const cacheParam = forceFresh ? `?_t=${Date.now()}` : '';
      console.log('Fetching dashboard data', { forceFresh, cacheParam });
      
      const [
        overviewData,
        dailyStatsData,
        monthlyTrendsData,
        customerGrowthData,
        revenueByHourData,
        productPerformanceData,
        topCustomersData,
        customerInsightsData,
        salesFunnelData,
        seasonalTrendsData,
        orderAnalysisData,
        businessHealthData
      ] = await Promise.all([
        dashboardAPI.getOverview(),
        dashboardAPI.getDailyStats(),
        dashboardAPI.getMonthlyTrends(),
        dashboardAPI.getCustomerGrowth(),
        dashboardAPI.getRevenueByHour(),
        dashboardAPI.getProductPerformance(),
        dashboardAPI.getTopCustomers(),
        // 🎯 Creative Analytics
        dashboardAPI.getCustomerInsights(),
        dashboardAPI.getSalesFunnel(),
        dashboardAPI.getSeasonalTrends(),
        dashboardAPI.getOrderAnalysis(),
        dashboardAPI.getBusinessHealth()
      ]);
      
      setOverview(overviewData);
      setDailyStats(dailyStatsData);
      setMonthlyTrends(monthlyTrendsData);
      setCustomerGrowth(customerGrowthData);
      setRevenueByHour(revenueByHourData);
      setProductPerformance(productPerformanceData);
      setTopCustomers(topCustomersData);
      setRecentOrders(overviewData.recentOrders || []);
      
      // Set creative analytics data
      setCustomerInsights(customerInsightsData);
      setSalesFunnel(salesFunnelData);
      setSeasonalTrends(seasonalTrendsData);
      setOrderAnalysis(orderAnalysisData);
      setBusinessHealth(businessHealthData);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      // The syncing state will be managed by WebSocket events
      console.log('🔄 Starting manual sync...');
      setSyncStatus('syncing');
      setSyncing(true);
      
      // Just trigger the sync - WebSocket will handle the status updates
      const result = await dashboardAPI.syncShopifyData();
      console.log('Sync API response:', result);
      
      // 🚀 Always refresh data after sync, regardless of WebSocket status
      console.log('🔄 Refreshing data after manual sync...');
      setSyncProgress('Sync completed - Updating dashboard...');
      
      setTimeout(async () => {
        try {
          await fetchAllDashboardData(true); // Force fresh data
          console.log('✅ Dashboard data refreshed after manual sync');
          setSyncing(false);
          setSyncStatus('success');
          setSyncProgress('Dashboard updated successfully!');
          setLastSyncTime(new Date());
          
          setTimeout(() => {
            setSyncStatus('idle');
            setSyncProgress('');
          }, 2000);
        } catch (fetchError) {
          console.error('Failed to refresh dashboard:', fetchError);
          setSyncStatus('error');
          setSyncProgress('Failed to refresh dashboard');
        }
      }, 1500);
      
    } catch (error) {
      console.error('Sync error:', error);
      setSyncing(false);
      setSyncStatus('error');
      setSyncProgress(`Sync failed: ${error.message}`);
      
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncProgress('');
      }, 5000);
    }
  };

  const handleDateFilter = async () => {
    if (dateRange.startDate && dateRange.endDate) {
      try {
        const ordersData = await dashboardAPI.getOrders(dateRange.startDate, dateRange.endDate);
        setRecentOrders(ordersData);
      } catch (error) {
        console.error('Error filtering orders:', error);
      }
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f9fafb',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #10b981',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 2rem'
          }}></div>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            color: '#111827', 
            margin: '0 0 0.5rem 0' 
          }}>
            Loading Dashboard
          </h2>
          <p style={{ 
            color: '#6b7280', 
            fontSize: '0.875rem',
            margin: 0
          }}>
            Fetching your analytics data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f9fafb',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
        <div style={{ 
          textAlign: 'center',
          backgroundColor: '#ffffff',
          padding: '3rem',
          borderRadius: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          maxWidth: '400px',
          margin: '2rem'
        }}>
          <div style={{ 
            fontSize: '3rem', 
            marginBottom: '1rem',
            color: '#ef4444'
          }}>
            ⚠️
          </div>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '700', 
            color: '#111827', 
            margin: '0 0 1rem 0' 
          }}>
            Unable to Load Dashboard
          </h2>
          <p style={{ 
            color: '#6b7280', 
            fontSize: '0.875rem',
            margin: '0 0 2rem 0',
            lineHeight: '1.5'
          }}>
            {error}
          </p>
          <button 
            onClick={fetchAllDashboardData}
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#047857'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value || 0);
  };

  const formatPercentage = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  // Modern card styles with consistent heights
  const cardStyle = {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    transition: 'all 0.2s ease-in-out',
    overflow: 'hidden',
    padding: '1.5rem',
    position: 'relative',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '120px'
  };

  const chartCardStyle = {
    ...cardStyle,
    overflow: 'hidden',
    minHeight: '400px',
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #ffffff 100%)'
  };

  const tableCardStyle = {
    ...cardStyle,
    overflow: 'hidden',
    maxHeight: '500px',
    background: 'linear-gradient(135deg, #fefefe 0%, #f3f4f6 30%, #ffffff 100%)'
  };

  // Themed card styles for different sections
  const revenueCardStyle = {
    ...cardStyle,
    background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 50%, #ffffff 100%)'
  };

  const customerCardStyle = {
    ...cardStyle,
    background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 50%, #ffffff 100%)'
  };

  const orderCardStyle = {
    ...cardStyle,
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #ffffff 100%)'
  };

  const productCardStyle = {
    ...cardStyle,
    background: 'linear-gradient(135deg, #fef3c7 0%, #fef9e3 50%, #ffffff 100%)'
  };

  const insightsCardStyle = {
    ...cardStyle,
    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #ffffff 100%)'
  };

  const trendsCardStyle = {
    ...cardStyle,
    background: 'linear-gradient(135deg, #fef3e2 0%, #fef7ed 50%, #ffffff 100%)'
  };

  const salesCardStyle = {
    ...cardStyle,
    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 30%, #ffffff 100%)'
  };

  return (
    <div style={{ 
      backgroundColor: '#f9fafb', 
      width: '100%',
      minHeight: '100vh',
      margin: 0,
      padding: 0,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      boxSizing: 'border-box'
    }}>
      {/* Modern Navigation Header */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        height: '70px',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ 
            fontSize: '1.75rem', 
            fontWeight: '700', 
            color: '#1f2937',
            letterSpacing: '-0.025em'
          }}>
            XenoAdmin
          </div>
          <div style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            backgroundColor: '#f3f4f6',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontWeight: '500'
          }}>
            Analytics Dashboard
          </div>
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#6b7280',
            fontSize: '0.875rem'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981'
            }}></div>
            Welcome, {user?.email?.split('@')[0] || 'User'}
          </div>
          
          <button 
            onClick={handleSync}
            disabled={syncing || syncStatus === 'syncing'}
            style={{
              backgroundColor: (syncing || syncStatus === 'syncing') ? '#9ca3af' : 
                               syncStatus === 'success' ? '#059669' :
                               syncStatus === 'error' ? '#dc2626' : 
                               hasNewData ? '#f59e0b' : '#10b981',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: syncing ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              position: 'relative',
              animation: hasNewData ? 'pulse 2s infinite' : 'none'
            }}
          >
            <span style={{ fontSize: '1rem' }}>
              {syncStatus === 'syncing' ? '🔄' : 
               syncStatus === 'success' ? '✅' : 
               syncStatus === 'error' ? '❌' : 
               hasNewData ? '🟡' : '🔄'}
            </span>
            {syncing || syncStatus === 'syncing' ? (
              <span>
                {webhookProcessing ? '🔄 Processing Webhooks...' : syncProgress || 'Syncing...'}
              </span>
            ) : syncStatus === 'success' ? (
              'Sync & Webhooks Complete!'
            ) : syncStatus === 'error' ? (
              'Sync Failed'
            ) : hasNewData ? (
              `Update Available${newOrdersCount > 0 ? ` (${newOrdersCount})` : ''}`
            ) : (
              'Sync with Webhooks'
            )}
            
            {/* New Data Badge */}
            {hasNewData && newOrdersCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                backgroundColor: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                animation: 'bounce 1s infinite'
              }}>
                {newOrdersCount > 99 ? '99+' : newOrdersCount}
              </span>
            )}
          </button>
          
          {/* Auto-refresh toggle and sync info */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '0.25rem',
            fontSize: '0.75rem',
            color: '#6b7280'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={autoRefreshEnabled}
                onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                style={{ margin: 0 }}
              />
              Auto-refresh
            </label>
            {lastSyncTime && (
              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                Last sync: {lastSyncTime.toLocaleTimeString()}
              </div>
            )}
            {pendingUpdates.length > 0 && (
              <div style={{ fontSize: '0.75rem' }}>
                <div style={{ color: '#f59e0b', marginBottom: '2px' }}>
                  {pendingUpdates.length} pending update{pendingUpdates.length > 1 ? 's' : ''}
                </div>
                <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
                  {pendingUpdates.map((update, i) => {
                    const updateTypes = {
                      'order': '🛒 New Order',
                      'order-paid': '💳 Payment',
                      'order-updated': '📝 Order Update',
                      'customer-updated': '👥 Customer Update'
                    };
                    return updateTypes[update.type] || '📊 Data Update';
                  }).slice(0, 3).join(', ')}{pendingUpdates.length > 3 ? '...' : ''}
                </div>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleLogout} 
            style={{
              backgroundColor: 'transparent',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main style={{ 
        padding: '2rem',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Dashboard Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: '700', 
            color: '#111827', 
            margin: '0 0 0.5rem 0',
            letterSpacing: '-0.025em'
          }}>
            Analytics Overview
          </h1>
          <p style={{ 
            color: '#6b7280', 
            margin: 0,
            fontSize: '1rem',
            lineHeight: '1.5'
          }}>
            Real-time insights and performance metrics for your e-commerce business
          </p>
        </div>

        {/* Overview Stats Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '2rem',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Total Revenue */}
          <div style={revenueCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#666', fontSize: '0.875rem', margin: '0 0 0.5rem 0' }}>Total Revenue</p>
                <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333', margin: '0 0 0.5rem 0', wordBreak: 'break-word' }}>
                  {formatCurrency(overview?.totalRevenue || 0)}
                </h2>
                <p style={{ 
                  color: dailyStats?.changes?.money >= 0 ? '#22c55e' : '#ef4444', 
                  fontSize: '0.875rem', 
                  margin: 0,
                  fontWeight: '500'
                }}>
                  {formatPercentage(dailyStats?.changes?.money || 0)} from last week
                </p>
              </div>
              <div style={{
                backgroundColor: '#22c55e',
                padding: '0.75rem',
                borderRadius: '8px',
                color: 'white',
                fontSize: '1.25rem'
              }}>
                💰
              </div>
            </div>
          </div>

          {/* Total Customers */}
          <div style={customerCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#666', fontSize: '0.875rem', margin: '0 0 0.5rem 0' }}>Total Customers</p>
                <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333', margin: '0 0 0.5rem 0' }}>
                  {formatNumber(overview?.totalCustomers || 0)}
                </h2>
                <p style={{ 
                  color: dailyStats?.changes?.users >= 0 ? '#22c55e' : '#ef4444', 
                  fontSize: '0.875rem', 
                  margin: 0,
                  fontWeight: '500'
                }}>
                  {formatPercentage(dailyStats?.changes?.users || 0)} from last month
                </p>
              </div>
              <div style={{
                backgroundColor: '#3b82f6',
                padding: '0.75rem',
                borderRadius: '8px',
                color: 'white',
                fontSize: '1.25rem'
              }}>
                👥
              </div>
            </div>
          </div>

          {/* Total Orders */}
          <div style={orderCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#666', fontSize: '0.875rem', margin: '0 0 0.5rem 0' }}>Total Orders</p>
                <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333', margin: '0 0 0.5rem 0' }}>
                  {formatNumber(overview?.totalOrders || 0)}
                </h2>
                <p style={{ 
                  color: dailyStats?.changes?.sales >= 0 ? '#22c55e' : '#ef4444', 
                  fontSize: '0.875rem', 
                  margin: 0,
                  fontWeight: '500'
                }}>
                  {formatPercentage(dailyStats?.changes?.sales || 0)} from yesterday
                </p>
              </div>
              <div style={{
                backgroundColor: '#8b5cf6',
                padding: '0.75rem',
                borderRadius: '8px',
                color: 'white',
                fontSize: '1.25rem'
              }}>
                �
              </div>
            </div>
          </div>

          {/* Average Order Value */}
          <div style={productCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#666', fontSize: '0.875rem', margin: '0 0 0.5rem 0' }}>Avg Order Value</p>
                <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333', margin: '0 0 0.5rem 0' }}>
                  {formatCurrency(overview?.avgOrderValue || 0)}
                </h2>
                <p style={{ 
                  color: '#666', 
                  fontSize: '0.875rem', 
                  margin: 0,
                  fontWeight: '500'
                }}>
                  Per order average
                </p>
              </div>
              <div style={{
                backgroundColor: '#f59e0b',
                padding: '0.75rem',
                borderRadius: '8px',
                color: 'white',
                fontSize: '1.25rem'
              }}>
                �
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Charts */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '2.5rem',
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
          {/* Monthly Revenue Trends */}
          <div style={chartCardStyle}>
            <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981'
                }}></div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827', margin: 0 }}>
                  Revenue Trends
                </h3>
              </div>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, lineHeight: '1.4' }}>
                6-month revenue performance overview
              </p>
            </div>
            <div style={{ height: '280px' }}>
              {monthlyTrends && (
                <Line
                  data={{
                    labels: monthlyTrends.labels,
                    datasets: [{
                      label: 'Revenue',
                      data: monthlyTrends.revenue,
                      borderColor: '#10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      pointBackgroundColor: '#10b981',
                      pointBorderColor: '#ffffff',
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 8
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: '#111827',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#374151',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                          label: (context) => `Revenue: ${formatCurrency(context.parsed.y)}`
                        }
                      }
                    },
                    scales: {
                      y: { 
                        beginAtZero: true,
                        grid: {
                          color: '#f3f4f6',
                          drawBorder: false
                        },
                        ticks: {
                          color: '#6b7280',
                          font: { size: 12 },
                          callback: (value) => formatCurrency(value)
                        }
                      },
                      x: { 
                        grid: { display: false },
                        ticks: {
                          color: '#6b7280',
                          font: { size: 12 }
                        }
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Customer Growth */}
          <div style={chartCardStyle}>
            <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6'
                }}></div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827', margin: 0 }}>
                  Customer Growth
                </h3>
              </div>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, lineHeight: '1.4' }}>
                New customer acquisition trends
              </p>
            </div>
            <div style={{ height: '280px' }}>
              {customerGrowth && (
                <Bar
                  data={{
                    labels: customerGrowth.labels,
                    datasets: [{
                      label: 'New Customers',
                      data: customerGrowth.customers,
                      backgroundColor: '#3b82f6',
                      borderRadius: 8,
                      borderSkipped: false
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: '#111827',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#374151',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false
                      }
                    },
                    scales: {
                      y: { 
                        beginAtZero: true,
                        grid: {
                          color: '#f3f4f6',
                          drawBorder: false
                        },
                        ticks: { 
                          precision: 0,
                          color: '#6b7280',
                          font: { size: 12 }
                        }
                      },
                      x: { 
                        grid: { display: false },
                        ticks: {
                          color: '#6b7280',
                          font: { size: 12 }
                        }
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Revenue by Hour */}
          <div style={chartCardStyle}>
            <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#8b5cf6'
                }}></div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827', margin: 0 }}>
                  Hourly Revenue
                </h3>
              </div>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, lineHeight: '1.4' }}>
                Sales distribution throughout the day
              </p>
            </div>
            <div style={{ height: '280px' }}>
              {revenueByHour && (
                <Line
                  data={{
                    labels: revenueByHour.labels,
                    datasets: [{
                      label: 'Revenue',
                      data: revenueByHour.revenue,
                      borderColor: '#8b5cf6',
                      backgroundColor: 'rgba(139, 92, 246, 0.1)',
                      borderWidth: 3,
                      tension: 0.4,
                      fill: true,
                      pointBackgroundColor: '#8b5cf6',
                      pointBorderColor: '#ffffff',
                      pointBorderWidth: 2,
                      pointRadius: 4,
                      pointHoverRadius: 7
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: '#111827',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#374151',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                          label: (context) => `Revenue: ${formatCurrency(context.parsed.y)}`
                        }
                      }
                    },
                    scales: {
                      y: { 
                        beginAtZero: true,
                        grid: {
                          color: '#f3f4f6',
                          drawBorder: false
                        },
                        ticks: {
                          color: '#6b7280',
                          font: { size: 12 },
                          callback: (value) => formatCurrency(value)
                        }
                      },
                      x: { 
                        grid: { display: false },
                        ticks: {
                          color: '#6b7280',
                          font: { size: 12 }
                        }
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Data Tables & Analytics */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '2rem',
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
          {/* Top Customers */}
            <div style={tableCardStyle}>
              <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#f59e0b'
                  }}></div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827', margin: 0 }}>
                    Top Customers
                  </h3>
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, lineHeight: '1.4' }}>
                  Highest spending customers this month
                </p>
              </div>
              <div style={{ 
                maxHeight: '350px', 
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}>
                {topCustomers.length > 0 ? topCustomers.map((customer, index) => (
                <div key={customer.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem 0',
                  borderBottom: index < topCustomers.length - 1 ? '1px solid #f9fafb' : 'none',
                  transition: 'background-color 0.2s ease',
                  cursor: 'pointer',
                  minHeight: '70px'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#6b7280'
                    }}>
                      {customer.firstName?.charAt(0)}{customer.lastName?.charAt(0)}
                    </div>
                    <div>
                      <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', fontWeight: '600', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>
                        {customer.firstName} {customer.lastName}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>
                        {customer.email}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: '0.875rem',
                      fontWeight: '700',
                      color: '#059669',
                      backgroundColor: '#d1fae5',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px'
                    }}>
                      {formatCurrency(customer.totalSpend)}
                    </span>
                  </div>
                </div>
              )) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '3rem 1rem',
                  color: '#9ca3af'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>👥</div>
                  <p style={{ fontSize: '0.875rem', margin: 0 }}>
                    No customer data available
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Orders */}
            <div style={tableCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', margin: 0 }}>
                  Recent Orders
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    style={{
                      padding: '0.25rem',
                      fontSize: '0.75rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    style={{
                      padding: '0.25rem',
                      fontSize: '0.75rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                  <button
                    onClick={handleDateFilter}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#22c55e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Filter
                  </button>
                </div>
              </div>
              <div style={{ 
                maxHeight: '350px', 
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}>
                {recentOrders.length > 0 ? recentOrders.slice(0, 10).map((order, index) => (
                <div key={order.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 0',
                  borderBottom: index < 9 ? '1px solid #f0f0f0' : 'none',
                  minHeight: '60px'
                }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: '1rem' }}>
                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', fontWeight: '500', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Order #{order.shopifyOrderId || order.id}
                    </p>
                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.75rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.customer?.firstName || 'Customer'} {order.customer?.lastName || ''}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {new Date(order.createdAt || order.processedAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#22c55e'
                  }}>
                    {formatCurrency(order.totalPrice)}
                  </span>
                </div>
              )) : (
                <p style={{ color: '#666', fontSize: '0.875rem', textAlign: 'center', margin: '2rem 0' }}>
                  No orders available
                </p>
              )}
            </div>
          </div>

          {/* Product Performance */}
            <div style={tableCardStyle}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', margin: '0 0 1rem 0' }}>
                Top Products by Revenue
              </h3>
              <div style={{ 
                maxHeight: '350px', 
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}>
                {productPerformance && productPerformance.length > 0 ? productPerformance.slice(0, 5).map((product, index) => (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 0',
                  borderBottom: index < 4 ? '1px solid #f0f0f0' : 'none',
                  minHeight: '60px'
                }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: '1rem' }}>
                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', fontWeight: '500', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {product.productTitle}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                      {product.totalQuantity} sold • {product.orderCount} orders
                    </p>
                  </div>
                  <span style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#22c55e',
                    marginLeft: '1rem'
                  }}>
                    {formatCurrency(product.totalRevenue)}
                  </span>
                </div>
              )) : (
                <p style={{ color: '#666', fontSize: '0.875rem', textAlign: 'center', margin: '2rem 0' }}>
                  No product data available
                </p>
              )}
            </div>
          </div>

          {/* 🎯 CREATIVE BUSINESS ANALYTICS SECTION */}
          
          {/* Business Health Score */}
          {businessHealth && (
            <div style={{ 
              ...cardStyle, 
              minHeight: '350px',
              height: 'auto',
              overflow: 'visible',
              background: `linear-gradient(135deg, ${
                businessHealth.healthScore > 75 ? '#22c55e' : 
                businessHealth.healthScore > 50 ? '#f59e0b' : '#ef4444'
              }20, transparent)` 
            }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', margin: '0 0 1rem 0' }}>
                Business Health Score
              </h3>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  border: `4px solid ${
                    businessHealth.healthScore > 75 ? '#22c55e' : 
                    businessHealth.healthScore > 50 ? '#f59e0b' : '#ef4444'
                  }`,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: businessHealth.healthScore > 75 ? '#166534' : 
                         businessHealth.healthScore > 50 ? '#92400e' : '#991b1b'
                }}>
                  {businessHealth.healthScore}
                </div>
              </div>
              <p style={{ textAlign: 'center', margin: '0 0 1.5rem 0', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                {businessHealth.recommendation}
              </p>
              {businessHealth.risks && businessHealth.risks.length > 0 && (
                <div style={{ backgroundColor: '#fef2f2', padding: '1rem', borderRadius: '8px', marginTop: 'auto' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#dc2626', margin: '0 0 0.75rem 0' }}>
                    Areas of Concern:
                  </h4>
                  {businessHealth.risks.map((risk, index) => (
                    <p key={index} style={{ fontSize: '0.75rem', color: '#dc2626', margin: '0.5rem 0', lineHeight: '1.4' }}>
                      • {risk}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Customer Insights - Segments & Loyalty */}
          {customerInsights && (
            <div style={{ ...insightsCardStyle, height: '500px' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', margin: '0 0 1rem 0' }}>
                Customer Insights
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', margin: '0 0 0.75rem 0' }}>Customer Segments</h4>
                  <div style={{ height: '180px', width: '100%', position: 'relative' }}>
                    <Doughnut
                      data={{
                        labels: customerInsights.segments.labels,
                        datasets: [{
                          data: customerInsights.segments.data,
                          backgroundColor: customerInsights.segments.colors,
                          borderWidth: 0
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'bottom', labels: { fontSize: 10 } }
                        }
                      }}
                    />
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', margin: '0 0 0.75rem 0' }}>Customer Loyalty</h4>
                  <div style={{ height: '180px', width: '100%', position: 'relative' }}>
                    <Doughnut
                      data={{
                        labels: customerInsights.loyalty.labels,
                        datasets: [{
                          data: customerInsights.loyalty.data,
                          backgroundColor: customerInsights.loyalty.colors,
                          borderWidth: 0
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'bottom', labels: { fontSize: 10 } }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                gap: '1rem', 
                marginTop: '1.5rem',
                padding: '1rem',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                width: '100%',
                minWidth: 0
              }}>
                <div style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                  <p style={{ fontSize: 'clamp(1rem, 3vw, 1.5rem)', fontWeight: '700', color: '#22c55e', margin: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatCurrency(customerInsights.metrics.avgCustomerValue)}
                  </p>
                  <p style={{ fontSize: 'clamp(0.6rem, 2vw, 0.75rem)', color: '#666', margin: '0.5rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Avg Customer Value</p>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                  <p style={{ fontSize: 'clamp(1rem, 3vw, 1.5rem)', fontWeight: '700', color: '#3b82f6', margin: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {customerInsights.metrics.retentionRate.toFixed(1)}%
                  </p>
                  <p style={{ fontSize: 'clamp(0.6rem, 2vw, 0.75rem)', color: '#666', margin: '0.5rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Retention Rate</p>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                  <p style={{ fontSize: 'clamp(1rem, 3vw, 1.5rem)', fontWeight: '700', color: '#8b5cf6', margin: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {customerInsights.metrics.totalCustomers}
                  </p>
                  <p style={{ fontSize: 'clamp(0.6rem, 2vw, 0.75rem)', color: '#666', margin: '0.5rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Total Customers</p>
                </div>
              </div>
            </div>
          )}

          {/* Sales Performance */}
          {salesFunnel && (
            <div style={{ ...salesCardStyle, minHeight: '400px', height: 'auto' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', margin: '0 0 1.5rem 0' }}>
                Sales Performance
              </h3>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ textAlign: 'center', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '12px', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '3rem', fontWeight: '700', color: '#22c55e', margin: '0' }}>
                    {salesFunnel.funnel.conversionRate.toFixed(1)}%
                  </p>
                  <p style={{ fontSize: '1rem', color: '#666', margin: '0.5rem 0 0 0' }}>Conversion Rate</p>
                </div>
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
                gap: '1rem',
                width: '100%',
                minWidth: 0
              }}>
                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3b82f6', margin: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatNumber(salesFunnel.funnel.totalVisitors)}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#666', margin: '0.25rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Total Visitors</p>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#22c55e', margin: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatNumber(salesFunnel.funnel.convertedCustomers)}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#666', margin: '0.25rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Converted Customers</p>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#8b5cf6', margin: '0' }}>
                    {formatCurrency((salesFunnel.funnel.totalVisitors * overview?.avgOrderValue) || 0)}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#666', margin: '0.25rem 0 0 0' }}>Potential Revenue</p>
                </div>
              </div>
            </div>
          )}

          {/* Seasonal Trends */}
          {seasonalTrends && (
            <div style={{ ...trendsCardStyle, minHeight: '400px', height: 'auto' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', margin: '0 0 1.5rem 0' }}>
                Seasonal Trends
              </h3>
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', margin: '0 0 1rem 0', textAlign: 'center' }}>
                  Revenue by Day of Week
                </h4>
                <div style={{ height: '200px' }}>
                  <Bar
                    data={{
                      labels: seasonalTrends.dayOfWeek.labels,
                      datasets: [{
                        label: 'Revenue',
                        data: seasonalTrends.dayOfWeek.data,
                        backgroundColor: [
                          '#ef4444', '#f97316', '#f59e0b', '#eab308', 
                          '#22c55e', '#10b981', '#06b6d4'
                        ],
                        borderRadius: 8,
                        borderSkipped: false
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { 
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: '#111827',
                          titleColor: '#ffffff',
                          bodyColor: '#ffffff',
                          borderColor: '#374151',
                          borderWidth: 1,
                          cornerRadius: 8,
                          displayColors: false,
                          callbacks: {
                            label: (context) => `Revenue: ${formatCurrency(context.parsed.y)}`
                          }
                        }
                      },
                      scales: { 
                        y: { 
                          beginAtZero: true,
                          grid: {
                            color: '#f3f4f6',
                            drawBorder: false
                          },
                          ticks: {
                            color: '#6b7280',
                            font: { size: 12 },
                            callback: (value) => formatCurrency(value)
                          }
                        },
                        x: { 
                          grid: { display: false },
                          ticks: {
                            color: '#6b7280',
                            font: { size: 12 }
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                gap: '0.5rem',
                padding: '1.5rem',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                width: '100%',
                minWidth: '30px',
                marginTop: '0.3rem'
              }}>
                <div style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                  <p style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)', fontWeight: '700', color: '#8b5cf6', margin: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {seasonalTrends.trends.bestDay}
                  </p>
                  <p style={{ fontSize: 'clamp(0.6rem, 2vw, 0.75rem)', color: '#666', margin: '0.5rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Best Day</p>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                  <p style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)', fontWeight: '700', color: '#06b6d4', margin: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {seasonalTrends.trends.bestMonth}
                  </p>
                  <p style={{ fontSize: 'clamp(0.6rem, 2vw, 0.75rem)', color: '#666', margin: '0.5rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Best Month</p>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                  <p style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)', fontWeight: '700', color: '#22c55e', margin: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {seasonalTrends.trends.monthlyGrowth}%
                  </p>
                  <p style={{ fontSize: 'clamp(0.6rem, 2vw, 0.75rem)', color: '#666', margin: '0.5rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Monthly Growth</p>
                </div>
              </div>
            </div>
          )}

          {/* Order Analysis */}
          {orderAnalysis && (
            <div style={{ ...insightsCardStyle, minHeight: '400px', height: 'auto' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', margin: '0 0 1.5rem 0' }}>
                Order Analysis
              </h3>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
                gap: '1.5rem',
                marginBottom: '2rem',
                width: '100%',
                minWidth: 0
              }}>
                <div style={{ textAlign: 'center', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                  <p style={{ fontSize: '2.5rem', fontWeight: '700', color: '#22c55e', margin: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatCurrency(orderAnalysis.metrics.avgOrderValue)}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#666', margin: '0.5rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Avg Order Value</p>
                </div>
                <div style={{ textAlign: 'center', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                  <p style={{ fontSize: '2.5rem', fontWeight: '700', color: '#3b82f6', margin: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {orderAnalysis.metrics.avgBasketSize}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#666', margin: '0.5rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Items per Order</p>
                </div>
                <div style={{ textAlign: 'center', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                  <p style={{ fontSize: '2.5rem', fontWeight: '700', color: '#8b5cf6', margin: '0' }}>
                    {formatNumber(orderAnalysis.metrics.totalOrders)}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#666', margin: '0.5rem 0 0 0' }}>Total Orders</p>
                </div>
              </div>
              <div style={{ 
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', margin: '0 0 1rem 0', textAlign: 'center' }}>
                  Order Value Distribution
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  {orderAnalysis.orderRanges.labels.map((label, index) => (
                    <div key={index} style={{ 
                      flex: 1, 
                      textAlign: 'center',
                      padding: '0.75rem 0.5rem',
                      backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#8b5cf6'][index] + '20',
                      borderRadius: '6px',
                      border: '1px solid ' + ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#8b5cf6'][index] + '40'
                    }}>
                      <p style={{ fontSize: '1.25rem', fontWeight: '700', color: ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#8b5cf6'][index], margin: '0' }}>
                        {orderAnalysis.orderRanges.data[index]}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#666', margin: '0.25rem 0 0 0' }}>
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 🎯 DETAILED ANALYTICS TABBED SECTION */}
        <div style={{ marginBottom: '2rem' }}>
          {/* Tab Navigation */}
          <div style={{ 
            display: 'flex', 
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px 12px 0 0',
            padding: '0.5rem',
            gap: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
          }}>
            {[
              { id: 'sales', label: 'Sales Velocity & Funnel', icon: '📈' },
              { id: 'orders', label: 'Order Distribution', icon: '🛒' },
              { id: 'seasonal', label: 'Monthly Trends', icon: '📅' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  backgroundColor: activeTab === tab.id ? '#10b981' : 'transparent',
                  color: activeTab === tab.id ? '#ffffff' : '#6b7280',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.target.style.backgroundColor = '#f3f4f6';
                    e.target.style.color = '#374151';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = '#6b7280';
                  }
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            padding: '2rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            minHeight: '500px'
          }}>
            {/* Sales Velocity & Funnel Tab */}
            {activeTab === 'sales' && salesFunnel && (
              <div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', margin: '0 0 2rem 0' }}>
                  Sales Velocity & Conversion Funnel
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1rem 0' }}>Sales Velocity (30 Days)</h4>
                    <div style={{ height: '300px' }}>
                      <Line
                        data={{
                          labels: salesFunnel.velocity.labels,
                          datasets: [
                            {
                              label: 'Daily Revenue',
                              data: salesFunnel.velocity.revenue,
                              borderColor: '#22c55e',
                              backgroundColor: '#22c55e20',
                              tension: 0.4,
                              fill: true,
                              borderWidth: 3,
                              pointBackgroundColor: '#22c55e',
                              pointBorderColor: '#ffffff',
                              pointBorderWidth: 2,
                              pointRadius: 5,
                              pointHoverRadius: 8
                            },
                            {
                              label: 'Daily Orders',
                              data: salesFunnel.velocity.orders,
                              borderColor: '#3b82f6',
                              backgroundColor: '#3b82f620',
                              tension: 0.4,
                              yAxisID: 'y1',
                              borderWidth: 3,
                              pointBackgroundColor: '#3b82f6',
                              pointBorderColor: '#ffffff',
                              pointBorderWidth: 2,
                              pointRadius: 5,
                              pointHoverRadius: 8
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          scales: {
                            y: { 
                              beginAtZero: true,
                              grid: {
                                color: '#f3f4f6',
                                drawBorder: false
                              },
                              ticks: {
                                color: '#6b7280',
                                font: { size: 12 },
                                callback: (value) => formatCurrency(value)
                              }
                            },
                            y1: { 
                              type: 'linear', 
                              display: true, 
                              position: 'right', 
                              beginAtZero: true,
                              grid: { display: false },
                              ticks: {
                                color: '#6b7280',
                                font: { size: 12 }
                              }
                            },
                            x: { 
                              grid: { display: false },
                              ticks: {
                                color: '#6b7280',
                                font: { size: 12 }
                              }
                            }
                          },
                          plugins: {
                            legend: { 
                              position: 'bottom',
                              labels: {
                                usePointStyle: true,
                                padding: 20
                              }
                            },
                            tooltip: {
                              backgroundColor: '#111827',
                              titleColor: '#ffffff',
                              bodyColor: '#ffffff',
                              borderColor: '#374151',
                              borderWidth: 1,
                              cornerRadius: 8,
                              displayColors: true
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ 
                    padding: '2rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 2rem 0', textAlign: 'center' }}>
                      Conversion Funnel Analysis
                    </h4>
                    
                    <div style={{ marginBottom: '2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: '500' }}>Total Visitors</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#3b82f6' }}>
                          {formatNumber(salesFunnel.funnel.totalVisitors)}
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '12px', backgroundColor: '#e5e7eb', borderRadius: '6px' }}>
                        <div style={{ 
                          width: '100%', 
                          height: '100%', 
                          backgroundColor: '#3b82f6', 
                          borderRadius: '6px' 
                        }}></div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: '500' }}>Converted Customers</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#22c55e' }}>
                          {formatNumber(salesFunnel.funnel.convertedCustomers)}
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '12px', backgroundColor: '#e5e7eb', borderRadius: '6px' }}>
                        <div style={{ 
                          width: `${salesFunnel.funnel.conversionRate}%`, 
                          height: '100%', 
                          backgroundColor: '#22c55e', 
                          borderRadius: '6px' 
                        }}></div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'center', padding: '1.5rem', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
                      <p style={{ fontSize: '3rem', fontWeight: '700', color: '#22c55e', margin: '0' }}>
                        {salesFunnel.funnel.conversionRate.toFixed(1)}%
                      </p>
                      <p style={{ fontSize: '1rem', color: '#666', margin: '0.5rem 0 0 0', fontWeight: '500' }}>Conversion Rate</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Order Distribution Tab */}
            {activeTab === 'orders' && orderAnalysis && (
              <div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', margin: '0 0 2rem 0' }}>
                  Order Value Distribution & Analysis
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1rem 0' }}>Order Value Distribution</h4>
                    <div style={{ height: '350px' }}>
                      <Doughnut
                        data={{
                          labels: orderAnalysis.orderRanges.labels,
                          datasets: [{
                            data: orderAnalysis.orderRanges.data,
                            backgroundColor: [
                              '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#8b5cf6'
                            ],
                            borderWidth: 0,
                            hoverOffset: 10
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { 
                              position: 'bottom',
                              labels: {
                                padding: 20,
                                usePointStyle: true,
                                font: {
                                  size: 12
                                }
                              }
                            },
                            tooltip: {
                              backgroundColor: '#111827',
                              titleColor: '#ffffff',
                              bodyColor: '#ffffff',
                              borderColor: '#374151',
                              borderWidth: 1,
                              cornerRadius: 8,
                              callbacks: {
                                label: (context) => `${context.label}: ${context.parsed} orders`
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1.5rem'
                  }}>
                    <div style={{ 
                      padding: '2rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 2rem 0' }}>
                        Key Order Metrics
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                        <div>
                          <p style={{ fontSize: '2.5rem', fontWeight: '700', color: '#22c55e', margin: '0' }}>
                            {formatCurrency(orderAnalysis.metrics.avgOrderValue)}
                          </p>
                          <p style={{ fontSize: '1rem', color: '#666', margin: '0.5rem 0 0 0' }}>Average Order Value</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '2.5rem', fontWeight: '700', color: '#3b82f6', margin: '0' }}>
                            {orderAnalysis.metrics.avgBasketSize}
                          </p>
                          <p style={{ fontSize: '1rem', color: '#666', margin: '0.5rem 0 0 0' }}>Average Basket Size</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '2.5rem', fontWeight: '700', color: '#8b5cf6', margin: '0' }}>
                            {formatNumber(orderAnalysis.metrics.totalOrders)}
                          </p>
                          <p style={{ fontSize: '1rem', color: '#666', margin: '0.5rem 0 0 0' }}>Total Orders</p>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ 
                      padding: '1.5rem',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px'
                    }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1rem 0' }}>Order Range Breakdown</h4>
                      {orderAnalysis.orderRanges.labels.map((label, index) => (
                        <div key={index} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '0.75rem 0',
                          borderBottom: index < orderAnalysis.orderRanges.labels.length - 1 ? '1px solid #f3f4f6' : 'none'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#8b5cf6'][index]
                            }}></div>
                            <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{label}</span>
                          </div>
                          <span style={{ fontSize: '1rem', fontWeight: '700', color: '#111827' }}>
                            {orderAnalysis.orderRanges.data[index]} orders
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Monthly Trends Tab */}
            {activeTab === 'seasonal' && seasonalTrends && (
              <div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', margin: '0 0 2rem 0' }}>
                  Monthly Performance & Seasonal Patterns
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1rem 0' }}>Monthly Revenue Trends</h4>
                    <div style={{ height: '350px' }}>
                      <Line
                        data={{
                          labels: seasonalTrends.monthly.labels,
                          datasets: [{
                            label: 'Monthly Revenue',
                            data: seasonalTrends.monthly.data,
                            borderColor: '#8b5cf6',
                            backgroundColor: '#8b5cf620',
                            tension: 0.4,
                            fill: true,
                            pointBackgroundColor: '#8b5cf6',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 3,
                            pointRadius: 6,
                            pointHoverRadius: 10,
                            borderWidth: 3
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { 
                            legend: { display: false },
                            tooltip: {
                              backgroundColor: '#111827',
                              titleColor: '#ffffff',
                              bodyColor: '#ffffff',
                              borderColor: '#374151',
                              borderWidth: 1,
                              cornerRadius: 8,
                              displayColors: false,
                              callbacks: {
                                label: (context) => `Revenue: ${formatCurrency(context.parsed.y)}`
                              }
                            }
                          },
                          scales: { 
                            y: { 
                              beginAtZero: true,
                              grid: {
                                color: '#f3f4f6',
                                drawBorder: false
                              },
                              ticks: {
                                color: '#6b7280',
                                font: { size: 12 },
                                callback: (value) => formatCurrency(value)
                              }
                            },
                            x: { 
                              grid: { display: false },
                              ticks: {
                                color: '#6b7280',
                                font: { size: 12 }
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '2rem'
                  }}>
                    <div style={{ 
                      padding: '2rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '12px'
                    }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1.5rem 0', textAlign: 'center' }}>
                        Performance Highlights
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '1.75rem', fontWeight: '700', color: '#8b5cf6', margin: '0' }}>
                            {seasonalTrends.trends.bestDay}
                          </p>
                          <p style={{ fontSize: '0.875rem', color: '#666', margin: '0.25rem 0 0 0' }}>Best Performing Day</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '1.75rem', fontWeight: '700', color: '#06b6d4', margin: '0' }}>
                            {seasonalTrends.trends.bestMonth}
                          </p>
                          <p style={{ fontSize: '0.875rem', color: '#666', margin: '0.25rem 0 0 0' }}>Peak Month</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '1.75rem', fontWeight: '700', color: '#22c55e', margin: '0' }}>
                            {seasonalTrends.trends.monthlyGrowth}%
                          </p>
                          <p style={{ fontSize: '0.875rem', color: '#666', margin: '0.25rem 0 0 0' }}>Monthly Growth Rate</p>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ 
                      padding: '1.5rem',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px'
                    }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: '0 0 1rem 0' }}>Weekly Performance</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                        {seasonalTrends.dayOfWeek.labels.map((day, index) => (
                          <div key={day} style={{ 
                            textAlign: 'center',
                            padding: '1rem 0.5rem',
                            backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#10b981', '#06b6d4'][index] + '20',
                            borderRadius: '8px',
                            border: '1px solid ' + ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#10b981', '#06b6d4'][index] + '40'
                          }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', margin: '0 0 0.5rem 0' }}>
                              {day}
                            </p>
                            <p style={{ fontSize: '0.875rem', fontWeight: '700', color: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#10b981', '#06b6d4'][index], margin: '0' }}>
                              {formatCurrency(seasonalTrends.dayOfWeek.data[index])}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer style={{
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e5e7eb',
        padding: '1.5rem 2rem',
        textAlign: 'center',
        marginTop: '2rem'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #ffffff 100%)',
          borderRadius: '12px',
          padding: '1rem 2rem',
          display: 'inline-block',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          border: '1px solid rgba(148, 163, 184, 0.1)'
        }}>
          <p style={{
            margin: 0,
            color: '#64748b',
            fontSize: '0.9rem',
            fontWeight: '500',
            letterSpacing: '-0.01em'
          }}>
            Made by <span style={{ 
              color: '#3b82f6', 
              fontWeight: '600' 
            }}>Katherine</span> • <span style={{ 
              color: '#64748b',
              fontWeight: '400' 
            }}>Manav Rachna University</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
