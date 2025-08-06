// 🔧 CORRECTED Frontend API Configuration
// Base configuration - FIXED URL
const API_BASE_URL = 'https://rti-trading-backend-production.up.railway.app/api'; // ✅ CORRECT Railway URL

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Helper function to make authenticated requests
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
  
  // Handle unauthorized responses
  if (response.status === 401) {
    localStorage.removeItem('authToken');
    window.location.href = '/login.html';
    return;
  }
  
  return response;
};

// API Functions - ALL USING CORRECT URL NOW
const API = {
  // Test endpoint - verify connection
  testConnection: async () => {
    const response = await fetch(`${API_BASE_URL}/test`);
    return response.json();
  },

  // Authentication
  register: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return response.json();
  },

  login: async (credentials) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    return response.json();
  },

  getProfile: async () => {
    const response = await authFetch('/auth/profile');
    return response.json();
  },

  // User Profile Management
  getUserProfile: async () => {
    const response = await authFetch('/users/profile');
    return response.json();
  },

  updateProfile: async (profileData) => {
    const response = await authFetch('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
    return response.json();
  },

  getUserProfileById: async (userId) => {
    const response = await authFetch(`/users/${userId}/profile`);
    return response.json();
  },

  // Avatar Upload
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    
    const response = await authFetch('/users/avatar', {
      method: 'POST',
      headers: {}, // Don't set Content-Type for FormData
      body: formData
    });
    return response.json();
  },

  // Alerts
  getAlerts: async (type = 'ALL') => {
    const response = await authFetch(`/alerts?type=${type}`);
    return response.json();
  },

  createAlert: async (alertData) => {
    const response = await authFetch('/alerts', {
      method: 'POST',
      body: JSON.stringify(alertData)
    });
    return response.json();
  },

  deleteAlert: async (alertId) => {
    const response = await authFetch(`/alerts/${alertId}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  // Subscription
  getSubscriptionPlans: async () => {
    const response = await fetch(`${API_BASE_URL}/subscription/plans`);
    return response.json();
  },

  createCheckoutSession: async (priceId) => {
    const response = await authFetch('/subscription/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ priceId })
    });
    return response.json();
  },

  // Market Data
  getMarketData: async () => {
    const response = await authFetch('/market/data');
    return response.json();
  },

  // Active Users
  getActiveUsers: async () => {
    const response = await authFetch('/users/active');
    return response.json();
  }
};

// 🧪 QUICK TEST - Run this in browser console to verify connection
const testBackendConnection = async () => {
  try {
    console.log('🔍 Testing backend connection...');
    const result = await API.testConnection();
    console.log('✅ Backend connected successfully:', result);
    return true;
  } catch (error) {
    console.error('❌ Backend connection failed:', error);
    return false;
  }
};

// 🧪 QUICK LOGIN TEST
const testLogin = async () => {
  try {
    console.log('🔑 Testing login...');
    const result = await API.login({ 
      username: 'testuser', 
      password: 'test123' 
    });
    console.log('✅ Login successful:', result);
    
    if (result.token) {
      localStorage.setItem('authToken', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      console.log('💾 Token saved to localStorage');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Login failed:', error);
    return null;
  }
};

// Socket.IO connection using correct URL
const connectToSocket = () => {
  const socket = io('https://rti-trading-backend-production.up.railway.app', {
    withCredentials: true
  });

  socket.on('connect', () => {
    console.log('🔌 Connected to socket server');
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      socket.emit('joinTradingRoom', user.id);
    }
  });

  socket.on('newAlert', (alert) => {
    console.log('🚨 New alert:', alert);
    // Update alerts UI
  });

  socket.on('marketUpdate', (update) => {
    console.log('📈 Market update:', update);
    // Update market data UI
  });

  socket.on('disconnect', () => {
    console.log('🔌 Disconnected from socket server');
  });

  return socket;
};

export default API;

// 🚨 IMMEDIATE ACTION: Update this line in your frontend code
console.log('🔗 API Base URL:', API_BASE_URL);
console.log('📝 Make sure this points to your Railway backend!');

// For debugging - uncomment these lines temporarily:
// testBackendConnection();
// testLogin();
