import React, { useState, useEffect, useCallback, useMemo } from 'react';

// API Configuration
const API_BASE_URL = 'https://rti-trading-backend-production.up.railway.app/api';

const getAuthToken = () => localStorage.getItem('authToken');

const authFetch = async (endpoint, options = {}) => {
  const token = getAuthToken();
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  
  if (response.status === 401) {
    localStorage.removeItem('authToken');
    window.location.href = '/login.html';
    return;
  }
  
  return response;
};

// API Functions
const API = {
  // FIXED: Handle new alerts response format
  getAlerts: async (type = 'ALL', page = 1, limit = 50) => {
    try {
      const response = await authFetch(`/alerts?type=${type}&page=${page}&limit=${limit}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('🚨 Alerts API response:', data);
      
      // Handle both old and new response formats
      if (Array.isArray(data)) {
        return {
          alerts: data,
          pagination: { page: 1, limit: data.length, total: data.length, hasMore: false }
        };
      } else if (data && Array.isArray(data.alerts)) {
        return data;
      } else {
        console.warn('⚠️ Invalid alerts response:', data);
        return {
          alerts: [],
          pagination: { page: 1, limit: 0, total: 0, hasMore: false }
        };
      }
    } catch (error) {
      console.error('❌ Error fetching alerts:', error);
      return {
        alerts: [],
        pagination: { page: 1, limit: 0, total: 0, hasMore: false }
      };
    }
  },

  getProfile: async () => {
    const response = await authFetch('/auth/profile');
    return response.json();
  },

  getUserProfile: async () => {
    const response = await authFetch('/users/profile');
    return response.json();
  },

  getActiveUsers: async () => {
    try {
      const response = await authFetch('/users/active');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('❌ Error fetching active users:', error);
      return [];
    }
  },

  getMarketData: async () => {
    const response = await authFetch('/market/data');
    return response.json();
  }
};

// Main Dashboard Component
const Dashboard = () => {
  // State management
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });
  
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsPagination, setAlertsPagination] = useState(null);
  const [selectedAlertType, setSelectedAlertType] = useState('ALL');
  
  const [activeUsers, setActiveUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  
  const [marketData, setMarketData] = useState({});
  const [marketLoading, setMarketLoading] = useState(true);
  
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // FIXED: Fetch alerts with proper error handling
  const fetchAlerts = useCallback(async (type = 'ALL', page = 1) => {
    try {
      setAlertsLoading(true);
      setError(null);
      
      console.log('📡 Fetching alerts:', { type, page });
      
      const response = await API.getAlerts(type, page, 50);
      console.log('✅ Alerts fetched:', response);
      
      // CRITICAL: Always ensure alerts is an array
      const alertsArray = Array.isArray(response.alerts) ? response.alerts : [];
      
      setAlerts(alertsArray);
      setAlertsPagination(response.pagination);
      
    } catch (error) {
      console.error('❌ Error fetching alerts:', error);
      setError('Failed to load alerts');
      setAlerts([]); // Always set to empty array on error
      setAlertsPagination(null);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  // Fetch active users
  const fetchActiveUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const users = await API.getActiveUsers();
      
      // CRITICAL: Always ensure users is an array
      const usersArray = Array.isArray(users) ? users : [];
      setActiveUsers(usersArray);
      
    } catch (error) {
      console.error('❌ Error fetching active users:', error);
      setActiveUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Fetch market data
  const fetchMarketData = useCallback(async () => {
    try {
      setMarketLoading(true);
      const data = await API.getMarketData();
      setMarketData(data || {});
    } catch (error) {
      console.error('❌ Error fetching market data:', error);
      setMarketData({});
    } finally {
      setMarketLoading(false);
    }
  }, []);

  // Auto-refresh data periodically
  const startPolling = useCallback(() => {
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing data...');
      fetchAlerts(selectedAlertType);
      fetchActiveUsers();
      fetchMarketData();
      setLastUpdate(new Date());
    }, 30000); // Refresh every 30 seconds

    return interval;
  }, [fetchAlerts, fetchActiveUsers, fetchMarketData, selectedAlertType]);

  // Initialize data on component mount
  useEffect(() => {
    console.log('🚀 Dashboard initializing...');
    
    fetchAlerts(selectedAlertType);
    fetchActiveUsers();
    fetchMarketData();
    
    // Start auto-refresh polling
    const pollInterval = startPolling();
    
    // Cleanup
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [fetchAlerts, fetchActiveUsers, fetchMarketData, startPolling, selectedAlertType]);

  // Fetch alerts when type changes
  useEffect(() => {
    fetchAlerts(selectedAlertType);
  }, [fetchAlerts, selectedAlertType]);

  // FIXED: Safe filtering with array check
  const filteredAlerts = useMemo(() => {
    if (!Array.isArray(alerts)) {
      console.warn('⚠️ Alerts is not an array:', typeof alerts, alerts);
      return [];
    }
    
    return alerts.filter(alert => {
      if (!alert || typeof alert !== 'object') return false;
      
      if (selectedAlertType === 'ALL') return true;
      return alert.type === selectedAlertType;
    });
  }, [alerts, selectedAlertType]);

  // Render loading state
  if (alertsLoading && usersLoading && marketLoading) {
    return (
      <div className="dashboard-container">
        <div className="loading-screen">
          <div className="spinner">⏳</div>
          <h2>Loading Dashboard...</h2>
          <p>Fetching your trading data...</p>
        </div>
      </div>
    );
  }

  // Render main dashboard
  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>RTi Trading Dashboard</h1>
          <div className="last-update">
            <span className="status-indicator">🔄</span>
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <img 
              src={user.avatar || 'https://ui-avatars.com/api/?background=22c55e&color=fff&name=User'} 
              alt="Avatar" 
              className="user-avatar"
            />
            <span className="username">{user.username || 'User'}</span>
            <span className={`user-tier ${user.tier?.toLowerCase() || 'free'}`}>
              {user.tier || 'FREE'}
            </span>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span>❌ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Main Content */}
      <div className="dashboard-content">
        {/* Market Data Section */}
        <section className="market-section">
          <h2>Market Overview</h2>
          {marketLoading ? (
            <div className="loading-state">Loading market data...</div>
          ) : (
            <div className="market-grid">
              {Object.entries(marketData).length === 0 ? (
                <div className="no-data">No market data available</div>
              ) : (
                Object.entries(marketData).map(([symbol, data]) => (
                  <div key={symbol} className="market-card">
                    <h3>{symbol}</h3>
                    <div className="price">${data.price?.toFixed(2)}</div>
                    <div className={`change ${data.change >= 0 ? 'positive' : 'negative'}`}>
                      {data.change >= 0 ? '+' : ''}{data.change?.toFixed(2)} 
                      ({data.changePercent?.toFixed(2)}%)
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* Alerts Section */}
        <section className="alerts-section">
          <div className="section-header">
            <h2>Trading Alerts</h2>
            <div className="alerts-controls">
              <select 
                value={selectedAlertType} 
                onChange={(e) => setSelectedAlertType(e.target.value)}
                className="alert-filter"
              >
                <option value="ALL">All Alerts</option>
                <option value="NEWS">News</option>
                <option value="BOT_SIGNAL">Bot Signals</option>
                <option value="MARKET_UPDATE">Market Updates</option>
                <option value="ANNOUNCEMENT">Announcements</option>
              </select>
              <button 
                onClick={() => {
                  fetchAlerts(selectedAlertType);
                  fetchActiveUsers();
                  fetchMarketData();
                  setLastUpdate(new Date());
                }} 
                className="refresh-button"
                title="Manual refresh (auto-refresh every 30s)"
              >
                🔄 Refresh All
              </button>
            </div>
          </div>

          {/* Debug Info */}
          <div className="debug-info">
            <small>
              🐛 Alerts: {typeof alerts} | Array: {Array.isArray(alerts) ? 'Yes' : 'No'} | 
              Count: {Array.isArray(alerts) ? alerts.length : 'N/A'} | 
              Filtered: {filteredAlerts.length} | 
              🔄 Auto-refresh: 30s intervals
            </small>
          </div>

          {/* Alerts Content */}
          {alertsLoading ? (
            <div className="loading-state">Loading alerts...</div>
          ) : filteredAlerts.length === 0 ? (
            <div className="no-alerts">
              <div className="empty-icon">📭</div>
              <h3>No alerts available</h3>
              <p>Check back later for trading signals and updates.</p>
            </div>
          ) : (
            <div className="alerts-list">
              {filteredAlerts.map((alert, index) => {
                if (!alert || typeof alert !== 'object') {
                  return null;
                }

                return (
                  <div key={alert._id || alert.id || `alert-${index}`} className="alert-card">
                    <div className="alert-header">
                      <span className={`alert-type ${(alert.type || 'unknown').toLowerCase()}`}>
                        {alert.type || 'UNKNOWN'}
                      </span>
                      <span className={`alert-priority ${(alert.priority || 'medium').toLowerCase()}`}>
                        {alert.priority || 'MEDIUM'}
                      </span>
                      <span className="alert-time">
                        {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : 'Unknown time'}
                      </span>
                    </div>
                    
                    <h4 className="alert-title">{alert.title || 'No title'}</h4>
                    <p className="alert-message">{alert.message || 'No message'}</p>
                    
                    {alert.botName && (
                      <div className="alert-meta">
                        <span className="bot-name">🤖 {alert.botName}</span>
                      </div>
                    )}
                    
                    {alert.pnl && (
                      <div className="alert-pnl">
                        <span className="pnl">💰 P&L: {alert.pnl}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More Button */}
          {alertsPagination?.hasMore && (
            <button 
              className="load-more-button"
              onClick={() => fetchAlerts(selectedAlertType, alertsPagination.page + 1)}
            >
              Load More Alerts
            </button>
          )}
        </section>

        {/* Active Users Section */}
        <section className="users-section">
          <h2>Active Traders</h2>
          {usersLoading ? (
            <div className="loading-state">Loading active users...</div>
          ) : (
            <div className="users-grid">
              {Array.isArray(activeUsers) && activeUsers.length > 0 ? (
                activeUsers.map((activeUser, index) => (
                  <div key={activeUser._id || activeUser.id || `user-${index}`} className="user-card">
                    <img 
                      src={activeUser.avatar || 'https://ui-avatars.com/api/?background=22c55e&color=fff&name=User'} 
                      alt={`${activeUser.username}'s avatar`}
                      className="user-avatar-small"
                    />
                    <div className="user-details">
                      <div className="username">{activeUser.username}</div>
                      <div className={`tier ${activeUser.tier?.toLowerCase() || 'free'}`}>
                        {activeUser.tier || 'FREE'}
                      </div>
                      <div className="last-active">
                        {activeUser.lastActive ? 
                          `Active ${new Date(activeUser.lastActive).toLocaleTimeString()}` : 
                          'Recently active'
                        }
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-users">No active traders found</div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Styles */}
      <style jsx>{`
        .dashboard-container {
          min-height: 100vh;
          background: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .loading-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          text-align: center;
        }

        .spinner {
          font-size: 48px;
          margin-bottom: 20px;
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .dashboard-header {
          background: white;
          padding: 20px;
          border-bottom: 1px solid #ddd;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .header-left h1 {
          margin: 0 0 5px 0;
          color: #333;
        }

        .last-update {
          font-size: 14px;
          color: #666;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .status-indicator {
          font-size: 12px;
        }

        .header-right .user-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid #ddd;
        }

        .username {
          font-weight: bold;
          color: #333;
        }

        .user-tier {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
        }

        .user-tier.free {
          background: #f5f5f5;
          color: #666;
        }

        .user-tier.weekly, .user-tier.monthly {
          background: #e3f2fd;
          color: #1976d2;
        }

        .user-tier.admin {
          background: #ffebee;
          color: #d32f2f;
        }

        .error-banner {
          background: #ffebee;
          color: #d32f2f;
          padding: 10px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .error-banner button {
          background: none;
          border: none;
          color: #d32f2f;
          cursor: pointer;
          font-size: 16px;
        }

        .dashboard-content {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .market-section, .alerts-section, .users-section {
          background: white;
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .section-header h2 {
          margin: 0;
          color: #333;
        }

        .alerts-controls {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .alert-filter {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
        }

        .refresh-button, .load-more-button {
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .refresh-button:hover, .load-more-button:hover {
          background: #0056b3;
        }

        .debug-info {
          background: #f8f9fa;
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 16px;
          font-family: monospace;
          color: #666;
        }

        .loading-state, .no-alerts, .no-users, .no-data {
          text-align: center;
          padding: 40px 20px;
          color: #666;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .market-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .market-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }

        .market-card h3 {
          margin: 0 0 8px 0;
          color: #333;
        }

        .price {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 8px;
          color: #333;
        }

        .change.positive {
          color: #22c55e;
        }

        .change.negative {
          color: #ef4444;
        }

        .alerts-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .alert-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          background: #fafafa;
        }

        .alert-header {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .alert-type, .alert-priority {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
        }

        .alert-type {
          background: #e3f2fd;
          color: #1976d2;
        }

        .alert-priority {
          background: #fff3e0;
          color: #f57c00;
        }

        .alert-priority.high {
          background: #ffebee;
          color: #d32f2f;
        }

        .alert-time {
          font-size: 12px;
          color: #666;
          margin-left: auto;
        }

        .alert-title {
          margin: 0 0 8px 0;
          color: #333;
          font-size: 16px;
        }

        .alert-message {
          color: #666;
          line-height: 1.5;
          margin-bottom: 12px;
        }

        .alert-meta, .alert-pnl {
          font-size: 12px;
          color: #666;
        }

        .users-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .user-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar-small {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 2px solid #ddd;
        }

        .user-details .username {
          font-weight: bold;
          margin-bottom: 4px;
        }

        .user-details .tier {
          font-size: 12px;
          margin-bottom: 4px;
        }

        .user-details .tier.free {
          color: #666;
        }

        .user-details .tier.weekly, .user-details .tier.monthly {
          color: #1976d2;
        }

        .last-active {
          font-size: 11px;
          color: #999;
        }

        .load-more-button {
          width: 100%;
          margin-top: 16px;
          padding: 12px;
        }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }

          .section-header {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }

          .alerts-controls {
            flex-direction: column;
            width: 100%;
          }

          .alert-filter {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
