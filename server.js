import express from 'express';
import cors from 'cors';
import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Server } from 'socket.io';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// --- Socket.io Setup ---
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  },
  transports: ['polling', 'websocket']
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);
  
  // Join user to a room (optional, for user-specific notifications)
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined room user-${userId}`);
  });
  
  // Handle real-time alerts
  socket.on('new-alert', (alertData) => {
    console.log('📢 Broadcasting new alert:', alertData);
    io.emit('alert-update', alertData);
  });
  
  // Handle trading updates
  socket.on('price-update', (priceData) => {
    io.emit('price-change', priceData);
  });
  
  // Handle user status updates
  socket.on('user-status', (statusData) => {
    io.emit('user-status-change', statusData);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Make io available to routes (optional, for emitting from API endpoints)
app.set('socketio', io);

// --- File Upload Configuration ---
// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// --- In-memory demo data (replace with database in production) ---
let users = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@example.com',
    password: '$2a$10$8K1p/a0dclxKxlHNDWX7.uF8C8XSqGtPKJvSbkAxHj6Z1K6Zv6Xz6', // password: admin123
    isAdmin: true,
    isActive: true,
    firstName: 'Admin',
    lastName: 'User',
    bio: 'System administrator and trading expert',
    phone: '+1 (555) 123-4567',
    location: 'New York, USA',
    website: 'https://cashflowops.pro',
    profilePicture: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2', 
    username: 'user1',
    email: 'user1@example.com',
    password: '$2a$10$8K1p/a0dclxKxlHNDWX7.uF8C8XSqGtPKJvSbkAxHj6Z1K6Zv6Xz6', // password: admin123
    isAdmin: false,
    isActive: true,
    firstName: 'John',
    lastName: 'Trader',
    bio: 'Professional trader with 5+ years experience',
    phone: '+1 (555) 987-6543',
    location: 'Los Angeles, USA',
    website: 'https://johntrader.com',
    profilePicture: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
  isActive: user.isActive,
  firstName: user.firstName,
  lastName: user.lastName,
  bio: user.bio,
  phone: user.phone,
  location: user.location,
  website: user.website,
  profilePicture: user.profilePicture,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
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
  const io = req.app.get('socketio');
  res.json({ 
    message: '✅ RTi Backend is running in ES module mode',
    timestamp: new Date().toISOString(),
    socketEnabled: !!io,
    connectedClients: io ? io.engine.clientsCount : 0,
    routes: [
      'GET /healthz',
      'POST /api/auth/login', 
      'POST /api/auth/register',
      'GET /api/auth/profile',
      'PUT /api/profile/update',
      'POST /api/profile/upload-picture',
      'DELETE /api/profile/picture',
      'GET /api/users/:userId',
      'GET /api/users/active',
      'GET /api/alerts',
      'POST /api/alerts',
      'DELETE /api/alerts/:id',
      'POST /api/test-socket',
      'GET /api/socket/status'
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
  const { 
    username, 
    email, 
    password, 
    firstName, 
    lastName, 
    bio, 
    phone, 
    location, 
    website 
  } = req.body || {};
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
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
    isActive: true,
    firstName: firstName || '',
    lastName: lastName || '',
    bio: bio || '',
    phone: phone || '',
    location: location || '',
    website: website || '',
    profilePicture: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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

// --- Profile Management Endpoints ---

// Upload profile picture
app.post('/api/profile/upload-picture', upload.single('profilePicture'), (req, res) => {
  const decoded = authFromHeader(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Generate the URL for the uploaded file
  const fileUrl = `/uploads/${req.file.filename}`;
  
  res.json({
    success: true,
    message: 'Profile picture uploaded successfully',
    profilePicture: fileUrl,
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    }
  });
});

// Update profile
app.put('/api/profile/update', (req, res) => {
  const decoded = authFromHeader(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const userIndex = users.findIndex(u => u.id === decoded.id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const {
    username,
    email,
    firstName,
    lastName,
    bio,
    phone,
    location,
    website,
    profilePicture
  } = req.body;

  // Validate required fields
  if (!username || !email) {
    return res.status(400).json({ error: 'Username and email are required' });
  }

  // Check if username or email is taken by another user
  const existingUser = users.find(u => 
    u.id !== decoded.id && (u.username === username || u.email === email)
  );
  if (existingUser) {
    return res.status(409).json({ error: 'Username or email already taken' });
  }

  // Update user data
  users[userIndex] = {
    ...users[userIndex],
    username,
    email,
    firstName: firstName || users[userIndex].firstName,
    lastName: lastName || users[userIndex].lastName,
    bio: bio || users[userIndex].bio,
    phone: phone || users[userIndex].phone,
    location: location || users[userIndex].location,
    website: website || users[userIndex].website,
    profilePicture: profilePicture || users[userIndex].profilePicture,
    updatedAt: new Date().toISOString()
  };

  const updatedUser = users[userIndex];

  // Generate new JWT token with updated info
  const newToken = signToken(updatedUser);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: shapeUser(updatedUser),
    token: newToken
  });
});

// Delete profile picture
app.delete('/api/profile/picture', (req, res) => {
  const decoded = authFromHeader(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const userIndex = users.findIndex(u => u.id === decoded.id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users[userIndex];
  
  // Delete the old file if it exists
  if (user.profilePicture && user.profilePicture.startsWith('/uploads/')) {
    const filePath = path.join(__dirname, user.profilePicture);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // Update user record
  users[userIndex].profilePicture = null;
  users[userIndex].updatedAt = new Date().toISOString();

  res.json({
    success: true,
    message: 'Profile picture deleted successfully',
    user: shapeUser(users[userIndex])
  });
});

// Get public user profile (for viewing other users)
app.get('/api/users/:userId', (req, res) => {
  const { userId } = req.params;
  const user = users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Return public profile info only
  const publicProfile = {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    bio: user.bio,
    location: user.location,
    website: user.website,
    profilePicture: user.profilePicture,
    isActive: user.isActive,
    createdAt: user.createdAt
  };

  res.json({ user: publicProfile });
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
  
  // Emit real-time alert to all connected clients
  const io = req.app.get('socketio');
  if (io) {
    io.emit('alert-update', {
      type: 'new-alert',
      alert: newAlert
    });
    console.log('📢 Real-time alert broadcasted:', newAlert.symbol);
  }
  
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
  
  // Emit real-time update for alert deletion
  const io = req.app.get('socketio');
  if (io) {
    io.emit('alert-update', {
      type: 'alert-deleted',
      alertId: id,
      alert: deletedAlert
    });
    console.log('📢 Alert deletion broadcasted:', id);
  }
  
  res.json({ 
    message: 'Alert deleted successfully', 
    alert: deletedAlert 
  });
});

// Test socket endpoint
app.post('/api/test-socket', (req, res) => {
  const { message, data } = req.body || {};
  const io = req.app.get('socketio');
  
  if (!io) {
    return res.status(500).json({ error: 'Socket.io not available' });
  }
  
  // Broadcast test message
  io.emit('test-message', {
    message: message || 'Test message from server',
    data: data || { timestamp: new Date().toISOString() },
    serverTime: new Date().toISOString()
  });
  
  res.json({
    success: true,
    message: 'Test message broadcasted',
    connectedClients: io.engine.clientsCount
  });
});

// Socket status endpoint
app.get('/api/socket/status', (req, res) => {
  const io = req.app.get('socketio');
  
  res.json({
    socketEnabled: !!io,
    connectedClients: io ? io.engine.clientsCount : 0,
    serverTime: new Date().toISOString()
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
  console.log(`🔌 Socket.io enabled with CORS support`);
  console.log(`📁 File uploads enabled - storing in: ${uploadsDir}`);
  console.log(`📋 Available routes:`);
  console.log(`   GET  /                           - Server info & status`);
  console.log(`   GET  /healthz                    - Health check`);
  console.log(`   POST /api/auth/login             - User login`);
  console.log(`   POST /api/auth/register          - User registration`);
  console.log(`   GET  /api/auth/profile           - Get user profile`);
  console.log(`   PUT  /api/profile/update         - Update user profile`);
  console.log(`   POST /api/profile/upload-picture - Upload profile picture`);
  console.log(`   DELETE /api/profile/picture      - Delete profile picture`);
  console.log(`   GET  /api/users/:userId          - Get public user profile`);
  console.log(`   GET  /api/users/active           - Get active users`);
  console.log(`   GET  /api/alerts                 - Get alerts`);
  console.log(`   POST /api/alerts                 - Create alert`);
  console.log(`   DELETE /api/alerts/:id           - Delete alert`);
  console.log(`   POST /api/test-socket            - Test socket broadcast`);
  console.log(`   GET  /api/socket/status          - Socket connection status`);
  console.log(`   GET  /uploads/*                  - Serve uploaded files`);
  console.log(`🌐 Socket.io events: connection, new-alert, price-update, user-status`);
});