import express from 'express';
import cors from 'cors';
import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
const server = http.createServer(app);

// --- Configuration ---
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-this-in-production';
const PORT = process.env.PORT || 3001;

// --- CORS Configuration (MUST COME FIRST) ---
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Handle preflight for all routes
app.options('*', cors());

// --- Body parsing middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- In-memory demo data (replace with database in production) ---
let users = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@example.com',
    password: '$2a$10$8K1p/a0dclxKxlHNDWX7.uF8C8XSqGtPKJvSbkAxHj6Z1K6Zv6Xz6', // password: admin123
    isAdmin: true,
    isActive: true
  },
  {
    id: '2', 
    username: 'user1',
    email: 'user1@example.com',
    password: '$2a$10$8K1p/a0dclxKxlHNDWX7.uF8C8XSqGtPKJvSbkAxHj6Z1K6Zv6Xz6', // password: admin123
    isAdmin: false,
    isActive: true
  }
];

let alerts = [
  {
    id: '1',
    type: 'BUY',
    symbol: 'BTCUSD',
    price: 45000,
    message: 'Bitcoin buy signal triggered',
    createdAt: new Date().toISOString(),
    userId: '1'
  },
  {
    id: '2',
    type: 'SELL', 
    symbol: 'ETHUSD',
    price: 3200,
    message: 'Ethereum sell signal triggered',
    createdAt: new Date().toISOString(),
    userId: '1'
  }
];

// --- Helper Functions ---
const signToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      email: user.email,
      isAdmin: user.isAdmin 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const shapeUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  isAdmin: user.isAdmin,
  isActive: user.isActive
});

const authFromHeader = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  
  const token = authHeader.substring(7);
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// --- Routes ---

// Health check
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: '✅ RTi Backend is running in ES module mode',
    timestamp: new Date().toISOString(),
    routes: [
      'GET /healthz',
      'POST /api/auth/login', 
      'POST /api/auth/register',
      'GET /api/auth/profile',
      'GET /api/users/active',
      'GET /api/alerts',
      'POST /api/alerts'
    ]
  });
});

// --- Auth Endpoints ---

// Login handler
const loginHandler = async (req, res) => {
  const { username, password } = req.body || {};
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  const user = users.find(u => u.username === username || u.email === username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // For demo purposes, accept plain "admin123" or check bcrypt
  const isValidPassword = password === 'admin123' || await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = signToken(user);
  return res.json({ 
    token, 
    user: shapeUser(user),
    message: 'Login successful'
  });
};

app.post('/api/login', loginHandler);          // alias
app.post('/api/auth/login', loginHandler);     // main

// Register
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Check if user already exists
  const existingUser = users.find(u => u.username === username || u.email === email);
  if (existingUser) {
    return res.status(409).json({ error: 'Username or email already exists' });
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Create new user
  const newUser = {
    id: (users.length + 1).toString(),
    username,
    email,
    password: hashedPassword,
    isAdmin: false,
    isActive: true
  };
  
  users.push(newUser);
  
  const token = signToken(newUser);
  return res.status(201).json({ 
    token, 
    user: shapeUser(newUser),
    message: 'Registration successful'
  });
});

// Profile
app.get('/api/auth/profile', (req, res) => {
  const decoded = authFromHeader(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = users.find(u => u.id === decoded.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  res.json({ user: shapeUser(user) });
});

// Legacy profile endpoint (if needed)
app.post('/api/profile', (req, res) => {
  const { token } = req.body || {};
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: shapeUser(user) });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Protected route example
app.get('/api/secure', (req, res) => {
  const decoded = authFromHeader(req);
  if (!decoded) return res.status(403).json({ error: 'No or bad token' });
  res.json({ 
    message: `Welcome ${decoded.username}! You have access.`,
    user: decoded
  });
});

// --- Data Endpoints ---

// Active users list
app.get('/api/users/active', (_req, res) => {
  const activeUsers = users
    .filter(u => u.isActive)
    .map(u => ({
      _id: u.id,
      username: u.username,
      email: u.email,
      isActive: u.isActive
    }));
  
  res.json(activeUsers);
});

// Get alerts
app.get('/api/alerts', (req, res) => {
  const { type } = req.query;
  const filteredAlerts = type && type !== 'ALL' 
    ? alerts.filter(a => a.type === type) 
    : alerts;
  
  const sortedAlerts = filteredAlerts.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  
  res.json(sortedAlerts);
});

// Create alert
app.post('/api/alerts', (req, res) => {
  const decoded = authFromHeader(req);
  // Optional: require authentication
  // if (!decoded) return res.status(403).json({ error: 'Authentication required' });
  
  const { type, symbol, price, message } = req.body || {};
  
  if (!type || !symbol || !price) {
    return res.status(400).json({ error: 'Missing required fields: type, symbol, price' });
  }
  
  const newAlert = {
    id: (alerts.length + 1).toString(),
    type,
    symbol: symbol.toUpperCase(),
    price: parseFloat(price),
    message: message || `${type} signal for ${symbol}`,
    createdAt: new Date().toISOString(),
    userId: decoded?.id || 'anonymous'
  };
  
  alerts.push(newAlert);
  
  res.status(201).json({
    alert: newAlert,
    message: 'Alert created successfully'
  });
});

// Delete alert
app.delete('/api/alerts/:id', (req, res) => {
  const { id } = req.params;
  const alertIndex = alerts.findIndex(a => a.id === id);
  
  if (alertIndex === -1) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  
  const deletedAlert = alerts.splice(alertIndex, 1)[0];
  res.json({ 
    message: 'Alert deleted successfully', 
    alert: deletedAlert 
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// --- Start Server ---
server.listen(PORT, () => {
  console.log(`🚀 RTi Backend Server running on port ${PORT}`);
  console.log(`📋 Available routes:`);
  console.log(`   GET  /                    - Server info`);
  console.log(`   GET  /healthz             - Health check`);
  console.log(`   POST /api/auth/login      - User login`);
  console.log(`   POST /api/auth/register   - User registration`);
  console.log(`   GET  /api/auth/profile    - Get user profile`);
  console.log(`   GET  /api/users/active    - Get active users`);
  console.log(`   GET  /api/alerts          - Get alerts`);
  console.log(`   POST /api/alerts          - Create alert`);
  console.log(`   DELETE /api/alerts/:id    - Delete alert`);
});
