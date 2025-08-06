// Frontend API Integration for RTi Cashflowops
// Base configuration
const API_BASE_URL = 'https://cashflowops.pro/api'; // or http://localhost:5000/api for development

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

// API Functions
const API = {
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
  },

  // Test endpoint
  testConnection: async () => {
    const response = await fetch(`${API_BASE_URL}/test`);
    return response.json();
  }
};

// Usage Examples:

// 1. Login user
/*
const loginUser = async (username, password) => {
  try {
    const result = await API.login({ username, password });
    if (result.token) {
      localStorage.setItem('authToken', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      window.location.href = '/dashboard.html';
    }
  } catch (error) {
    console.error('Login failed:', error);
  }
};
*/

// 2. Update user profile
/*
const updateUserProfile = async (profileData) => {
  try {
    const result = await API.updateProfile({
      bio: profileData.bio,
      tradingExperience: profileData.tradingExperience,
      favoriteMarkets: profileData.favoriteMarkets,
      socialLinks: {
        twitter: profileData.twitter,
        discord: profileData.discord,
        telegram: profileData.telegram
      },
      tradingStats: {
        winRate: profileData.winRate,
        totalTrades: profileData.totalTrades,
        favoriteStrategy: profileData.favoriteStrategy
      },
      isPublic: profileData.isPublic
    });
    console.log('Profile updated:', result);
  } catch (error) {
    console.error('Profile update failed:', error);
  }
};
*/

// 3. Upload avatar
/*
const handleAvatarUpload = async (fileInput) => {
  const file = fileInput.files[0];
  if (!file) return;

  try {
    const result = await API.uploadAvatar(file);
    console.log('Avatar uploaded:', result);
    // Update UI with new avatar URL
    document.querySelector('.user-avatar').src = result.avatarUrl;
  } catch (error) {
    console.error('Avatar upload failed:', error);
  }
};
*/

// 4. Real-time Socket.IO connection
/*
const connectToSocket = () => {
  const socket = io('https://cashflowops.pro', {
    withCredentials: true
  });

  socket.on('connect', () => {
    console.log('Connected to socket server');
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      socket.emit('joinTradingRoom', user.id);
    }
  });

  socket.on('newAlert', (alert) => {
    console.log('New alert:', alert);
    // Update alerts UI
  });

  socket.on('marketUpdate', (update) => {
    console.log('Market update:', update);
    // Update market data UI
  });

  return socket;
};
*/

export default API;
