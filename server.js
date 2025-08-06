// 📁 FILE: rti-trading-backend/server.js
// COMPLETE FIXED SERVER WITH CORS + AVATAR UPLOAD + ALL FEATURES

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createServer } = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = createServer(app);

console.log('🚀 Starting RTi Cashflowops Backend...');

// 🔥 PRODUCTION-READY CORS CONFIGURATION
console.log('🌐 Configuring CORS...');

// Method 1: Primary CORS middleware
app.use(cors({
  origin: function (origin, callback) {
    console.log('🔍 CORS request from:', origin || 'no-origin');
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    const allowedOrigins = [
      'https://cashflowops.pro',
      'https://www.cashflowops.pro',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:8080',
      'http://127.0.0.1:8080'
    ];
    
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS allowed for:', origin);
      callback(null, true);
    } else {
      console.log('⚠️ CORS blocked for:', origin);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin',
    'Cache-Control',
    'X-Access-Token'
  ],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

// Method 2: Explicit CORS headers (backup)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (origin && (
    origin.includes('cashflowops.pro') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  )) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE,PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,X-Access-Token');
    res.header('Access-Control-Max-Age', '86400');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling OPTIONS preflight from:', origin);
    return res.sendStatus(200);
  }
  
  next();
});

// Method 3: Railway-specific CORS fix
app.use((req, res, next) => {
  if (req.headers.origin && req.headers.origin.includes('cashflowops.pro')) {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE,PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
  }
  next();
});

// Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: [
      'https://cashflowops.pro',
      'https://www.cashflowops.pro',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  allowEIO3: true
});

// Middleware (MUST come after CORS)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`📡 ${req.method} ${req.path} from ${req.headers.origin || 'no-origin'}`);
  }
  next();
});

// Static file serving
app.use(express.static('public'));

// ====== AVATAR UPLOAD CONFIGURATION ======
console.log('📸 Configuring avatar upload system...');

// Create uploads directory
const uploadDir = path.join(__dirname, 'uploads/avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('📁 Created uploads directory:', uploadDir);
}

// Enhanced multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user._id;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `user_${userId}_${timestamp}${ext}`;
    console.log('📝 Generated filename:', filename);
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  console.log('🔍 Checking file type:', file.mimetype);
  const allowedTypes = [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/gif', 
    'image/webp',
    'image/bmp'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    console.log('✅ File type allowed:', file.mimetype);
    cb(null, true);
  } else {
    console.log('❌ File type rejected:', file.mimetype);
    cb(new Error(`Invalid file type: ${file.mimetype}. Only images are allowed.`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
    fieldNameSize: 300,
    fieldSize: 2 * 1024 * 1024
  }
});

// Serve uploaded files with proper headers
app.use('/uploads', (req, res, next) => {
  res.header('Cache-Control', 'public, max-age=31536000');
  res.header('Access-Control-Allow-Origin', '*');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// ====== DATABASE CONNECTION ======
console.log('🗄️ Connecting to MongoDB...');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rti-trading', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

// ====== DATABASE SCHEMAS ======

// Enhanced User Schema
const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },
  tier: { 
    type: String, 
    enum: ['FREE', 'WEEKLY', 'MONTHLY', 'ADMIN'], 
    default: 'FREE' 
  },
  isAdmin: { type: Boolean, default: false },
  avatar: { 
    type: String, 
    default: function() {
      return `https://ui-avatars.com/api/?background=22c55e&color=fff&name=${this.username || 'User'}`;
    }
  },
  
  // Profile fields
  bio: {
    type: String,
    maxlength: 500,
    default: '',
    trim: true
  },
  tradingExperience: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
    default: 'Beginner'
  },
  favoriteMarkets: [{
    type: String,
    enum: ['Forex', 'Crypto', 'Stocks', 'Options', 'Futures', 'Commodities']
  }],
  socialLinks: {
    twitter: { type: String, default: '', trim: true },
    discord: { type: String, default: '', trim: true },
    telegram: { type: String, default: '', trim: true }
  },
  tradingStats: {
    winRate: { type: Number, default: 0, min: 0, max: 100 },
    totalTrades: { type: Number, default: 0, min: 0 },
    favoriteStrategy: { type: String, default: '', trim: true }
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // Subscription fields
  stripeCustomerId: String,
  subscriptionId: String,
  subscriptionStatus: String,
  subscriptionEndDate: Date,
  
  // Activity tracking
  lastActive: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
  loginCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save middleware
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.isModified('username') && !this.avatar.includes('/uploads/')) {
    this.avatar = `https://ui-avatars.com/api/?background=22c55e&color=fff&name=${this.username}`;
  }
  next();
});

userSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Alert Schema
const alertSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  type: { 
    type: String, 
    enum: ['NEWS', 'BOT_SIGNAL', 'MARKET_UPDATE', 'ANNOUNCEMENT'], 
    required: true 
  },
  priority: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], 
    default: 'MEDIUM' 
  },
  botName: { type: String, trim: true },
  pnl: String,
  metadata: {
    symbol: String,
    action: String,
    price: Number,
    target: Number,
    stopLoss: Number
  },
  isActive: { type: Boolean, default: true },
  expiresAt: Date,
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

// Subscription Plans Schema
const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  tier: { type: String, required: true, unique: true },
  priceId: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  interval: { type: String, required: true, enum: ['day', 'week', 'month', 'year'] },
  features: [String],
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create models
const User = mongoose.model('User', userSchema);
const Alert = mongoose.model('Alert', alertSchema);
const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

// ====== MIDDLEWARE ======

// Enhanced authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'NO_TOKEN'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', async (err, decoded) => {
    if (err) {
      console.log('❌ Invalid token:', err.message);
      return res.status(403).json({ 
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }
    
    try {
      const user = await User.findById(decoded.userId);
      if (!user) {
        console.log('❌ User not found for token:', decoded.userId);
        return res.status(404).json({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }
      
      // Update last active
      user.lastActive = new Date();
      await user.save();
      
      req.user = user;
      next();
    } catch (error) {
      console.error('❌ Auth middleware error:', error);
      res.status(500).json({ 
        error: 'Authentication error',
        code: 'AUTH_ERROR'
      });
    }
  });
};

// Subscription middleware
const checkSubscription = (requiredTier = 'WEEKLY') => {
  return async (req, res, next) => {
    const user = req.user;
    
    // Admin bypass
    if (user.isAdmin) {
      return next();
    }
    
    // Check if subscription required
    if (user.tier === 'FREE' && requiredTier !== 'FREE') {
      return res.status(402).json({ 
        error: 'Subscription required',
        message: `${requiredTier} subscription needed for this feature`,
        requiredTier,
        currentTier: user.tier,
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }
    
    // Check subscription expiration
    if (user.subscriptionEndDate && user.subscriptionEndDate < new Date()) {
      user.tier = 'FREE';
      await user.save();
      return res.status(402).json({ 
        error: 'Subscription expired',
        message: 'Please renew your subscription',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }
    
    next();
  };
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ 
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }
  next();
};

// ====== HEALTH CHECK ROUTES ======
app.get('/', (req, res) => {
  res.json({ 
    status: 'RTi Trading Backend is healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ====== TEST ROUTES ======
app.get('/api/test', (req, res) => {
  console.log('🧪 Test endpoint accessed from:', req.headers.origin);
  res.json({ 
    message: 'Backend is working perfectly!',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    corsEnabled: true,
    status: 'success'
  });
});

app.get('/api/cors-test', (req, res) => {
  console.log('🧪 CORS test endpoint accessed from:', req.headers.origin);
  res.json({ 
    message: 'CORS is working!',
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    headers: {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers'),
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
    }
  });
});

// ====== AUTHENTICATION ROUTES ======
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    console.log('📝 Registration attempt:', { username, email });
    
    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Username, email, and password are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters',
        code: 'PASSWORD_TOO_SHORT'
      });
    }
    
    // Check existing user
    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username }] 
    });
    
    if (existingUser) {
      const field = existingUser.email === email.toLowerCase() ? 'email' : 'username';
      return res.status(400).json({ 
        error: `This ${field} is already taken`,
        code: 'USER_EXISTS',
        field
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create Stripe customer
    let stripeCustomerId = null;
    try {
      const customer = await stripe.customers.create({
        email: email.toLowerCase(),
        name: username,
        metadata: { source: 'rti-trading-app' }
      });
      stripeCustomerId = customer.id;
    } catch (stripeError) {
      console.warn('⚠️ Stripe customer creation failed:', stripeError.message);
    }
    
    // Create user
    const user = new User({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      stripeCustomerId,
      loginCount: 1,
      lastLogin: new Date()
    });
    
    await user.save();
    console.log('✅ User registered:', user.username);
    
    // Generate token
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        tier: user.tier,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
        createdAt: user.createdAt
      }
    });
    
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ 
      error: 'Registration failed',
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('🔑 Login attempt for:', username);
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }
    
    // Find user
    const user = await User.findOne({ 
      $or: [
        { username: username.trim() }, 
        { email: username.toLowerCase().trim() }
      ] 
    });
    
    if (!user) {
      console.log('❌ User not found:', username);
      return res.status(400).json({ 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('❌ Invalid password for:', username);
      return res.status(400).json({ 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Update login info
    user.lastLogin = new Date();
    user.loginCount += 1;
    await user.save();
    
    // Generate token
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );
    
    console.log('✅ Login successful for:', user.username);
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        tier: user.tier,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
        lastLogin: user.lastLogin
      }
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get('/api/auth/profile', authenticateToken, (req, res) => {
  res.json({
    id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    tier: req.user.tier,
    isAdmin: req.user.isAdmin,
    avatar: req.user.avatar,
    lastActive: req.user.lastActive,
    loginCount: req.user.loginCount
  });
});

app.post('/api/auth/refresh', authenticateToken, (req, res) => {
  const token = jwt.sign(
    { userId: req.user._id }, 
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '30d' }
  );
  
  res.json({
    success: true,
    token,
    expiresIn: '30d'
  });
});

// ====== USER PROFILE ROUTES ======
app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      tier: user.tier,
      isAdmin: user.isAdmin,
      bio: user.bio || '',
      tradingExperience: user.tradingExperience || 'Beginner',
      favoriteMarkets: user.favoriteMarkets || [],
      socialLinks: user.socialLinks || {},
      tradingStats: user.tradingStats || {},
      isPublic: user.isPublic !== false,
      createdAt: user.createdAt,
      lastActive: user.lastActive,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionEndDate: user.subscriptionEndDate
    });
    
  } catch (error) {
    console.error('❌ Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body;
    
    console.log('📝 Profile update for user:', userId);
    
    // Allowed fields for update
    const allowedFields = [
      'bio',
      'tradingExperience', 
      'favoriteMarkets',
      'socialLinks',
      'tradingStats',
      'isPublic'
    ];
    
    const profileUpdate = {};
    allowedFields.forEach(field => {
      if (updateData.hasOwnProperty(field)) {
        profileUpdate[field] = updateData[field];
      }
    });
    
    // Validate data
    if (profileUpdate.bio && profileUpdate.bio.length > 500) {
      return res.status(400).json({ error: 'Bio must be 500 characters or less' });
    }
    
    if (profileUpdate.tradingExperience && 
        !['Beginner', 'Intermediate', 'Advanced', 'Expert'].includes(profileUpdate.tradingExperience)) {
      return res.status(400).json({ error: 'Invalid trading experience level' });
    }
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        $set: { ...profileUpdate, updatedAt: new Date() }
      },
      { 
        new: true,
        runValidators: true 
      }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('✅ Profile updated for:', updatedUser.username);
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        tier: updatedUser.tier,
        isAdmin: updatedUser.isAdmin,
        bio: updatedUser.bio,
        tradingExperience: updatedUser.tradingExperience,
        favoriteMarkets: updatedUser.favoriteMarkets,
        socialLinks: updatedUser.socialLinks,
        tradingStats: updatedUser.tradingStats,
        isPublic: updatedUser.isPublic
      }
    });
    
  } catch (error) {
    console.error('❌ Profile update error:', error);
    res.status(500).json({ 
      error: 'Failed to update profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get('/api/users/:userId/profile', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user;
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Privacy check
    const canView = user.isPublic || 
                   userId === requestingUser._id.toString() || 
                   requestingUser.isAdmin;
    
    if (!canView) {
      return res.status(403).json({ error: 'Profile is private' });
    }
    
    res.json({
      id: user._id,
      username: user.username,
      avatar: user.avatar,
      tier: user.tier,
      isAdmin: user.isAdmin,
      bio: user.bio || '',
      tradingExperience: user.tradingExperience || 'Beginner',
      favoriteMarkets: user.favoriteMarkets || [],
      socialLinks: user.socialLinks || {},
      tradingStats: user.tradingStats || {},
      isPublic: user.isPublic !== false,
      createdAt: user.createdAt,
      lastActive: user.lastActive
    });
    
  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// ====== AVATAR UPLOAD ROUTES ======
app.get('/api/users/avatar/test', authenticateToken, (req, res) => {
  console.log('🧪 Avatar test endpoint accessed by:', req.user.username);
  res.json({
    success: true,
    message: 'Avatar upload endpoint is working!',
    user_id: req.user._id,
    username: req.user.username,
    current_avatar: req.user.avatar,
    timestamp: new Date().toISOString(),
    upload_limits: {
      maxSize: '10MB',
      allowedTypes: ['JPEG', 'PNG', 'GIF', 'WEBP', 'BMP']
    }
  });
});

app.post('/api/users/avatar', authenticateToken, (req, res) => {
  const userId = req.user._id;
  const username = req.user.username;
  
  console.log('📸 Avatar upload request from:', username, `(${userId})`);
  
  upload.single('avatar')(req, res, async (err) => {
    try {
      // Handle multer errors
      if (err) {
        console.error('❌ Multer error:', err.message);
        
        if (err instanceof multer.MulterError) {
          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              return res.status(400).json({ 
                error: 'File too large. Maximum size is 10MB.',
                code: 'FILE_TOO_LARGE'
              });
            case 'LIMIT_FILE_COUNT':
              return res.status(400).json({ 
                error: 'Too many files. Upload one file at a time.',
                code: 'TOO_MANY_FILES'
              });
            case 'LIMIT_UNEXPECTED_FILE':
              return res.status(400).json({ 
                error: 'Unexpected field name. Use "avatar" as field name.',
                code: 'WRONG_FIELD_NAME'
              });
            default:
              return res.status(400).json({ 
                error: 'Upload error: ' + err.message,
                code: 'UPLOAD_ERROR'
              });
          }
        }
        
        return res.status(400).json({ 
          error: err.message,
          code: 'VALIDATION_ERROR'
        });
      }

      // Check if file was uploaded
      if (!req.file) {
        console.log('❌ No file uploaded');
        return res.status(400).json({ 
          error: 'No file uploaded. Please select an image file.',
          code: 'NO_FILE'
        });
      }

      const file = req.file;
      console.log('✅ File received:', {
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        path: file.path
      });
      
      // Generate avatar URL
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const host = req.headers.host;
      const avatarUrl = `${protocol}://${host}/uploads/avatars/${file.filename}`;
      
      console.log('🔗 Generated avatar URL:', avatarUrl);

      // Cleanup old avatar file
      try {
        const currentUser = await User.findById(userId);
        if (currentUser?.avatar?.includes('/uploads/avatars/')) {
          const oldFilename = path.basename(currentUser.avatar.split('?')[0]);
          const oldFilePath = path.join(uploadDir, oldFilename);
          
          if (fs.existsSync(oldFilePath) && oldFilename.startsWith('user_') && oldFilename !== file.filename) {
            fs.unlinkSync(oldFilePath);
            console.log('🗑️ Deleted old avatar:', oldFilename);
          }
        }
      } catch (cleanupError) {
        console.warn('⚠️ Old avatar cleanup failed:', cleanupError.message);
      }

      // Update user's avatar in database
      const updatedUser = await User.findByIdAndUpdate(
        userId, 
        { 
          avatar: avatarUrl,
          updatedAt: new Date()
        },
        { new: true }
      ).select('username avatar email tier isAdmin');

      if (!updatedUser) {
        // Cleanup uploaded file if user update failed
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        return res.status(404).json({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      console.log('✅ Avatar updated successfully for:', username);

      // Broadcast avatar update via Socket.IO
      io.emit('avatarUpdated', {
        userId: userId,
        username: username,
        newAvatar: avatarUrl,
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Avatar uploaded successfully!',
        avatarUrl: avatarUrl,
        filename: file.filename,
        fileSize: file.size,
        user: {
          id: userId,
          username: updatedUser.username,
          avatar: avatarUrl,
          tier: updatedUser.tier
        },
        uploadInfo: {
          originalName: file.originalname,
          size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
          type: file.mimetype,
          uploadedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Avatar upload error:', error);
      
      // Cleanup uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log('🧹 Cleaned up failed upload file');
        } catch (cleanupError) {
          console.error('❌ Failed to cleanup file:', cleanupError);
        }
      }
      
      res.status(500).json({ 
        error: 'Avatar upload failed',
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
});

app.get('/api/users/:userId/avatar', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('avatar username');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      userId: user._id,
      username: user.username,
      avatar: user.avatar
    });

  } catch (error) {
    console.error('❌ Error fetching user avatar:', error);
    res.status(500).json({ error: 'Failed to fetch user avatar' });
  }
});

// ====== SUBSCRIPTION ROUTES ======
app.get('/api/subscription/plans', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true })
      .sort({ sortOrder: 1, price: 1 });
    res.json(plans);
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ error: 'Error fetching subscription plans' });
  }
});

app.post('/api/subscription/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { priceId } = req.body;
    const user = req.user;
    
    if (!user.stripeCustomerId) {
      return res.status(400).json({ 
        error: 'No Stripe customer ID found',
        code: 'NO_STRIPE_CUSTOMER'
      });
    }
    
    const session = await stripe.checkout.sessions.create({
      customer: user.stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'https://cashflowops.pro'}/dashboard.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://cashflowops.pro'}/subscription.html`,
      metadata: {
        userId: user._id.toString()
      }
    });
    
    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({ error: 'Error creating checkout session' });
  }
});

// Stripe Webhook
app.post('/api/webhooks/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        
        const tier = subscription.items.data[0].price.id.includes('weekly') ? 'WEEKLY' : 'MONTHLY';
        const endDate = new Date(subscription.current_period_end * 1000);
        
        await User.findByIdAndUpdate(session.metadata.userId, {
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          tier: tier,
          subscriptionEndDate: endDate
        });
        
        console.log('✅ Subscription activated for user:', session.metadata.userId);
        break;
        
      case 'customer.subscription.deleted':
        const deletedSub = event.data.object;
        await User.findOneAndUpdate(
          { subscriptionId: deletedSub.id },
          {
            tier: 'FREE',
            subscriptionStatus: 'canceled',
            subscriptionEndDate: null
          }
        );
        
        console.log('❌ Subscription canceled:', deletedSub.id);
        break;
        
      case 'customer.subscription.updated':
        const updatedSub = event.data.object;
        const updatedTier = updatedSub.items.data[0].price.id.includes('weekly') ? 'WEEKLY' : 'MONTHLY';
        const updatedEndDate = new Date(updatedSub.current_period_end * 1000);
        
        await User.findOneAndUpdate(
          { subscriptionId: updatedSub.id },
          {
            subscriptionStatus: updatedSub.status,
            tier: updatedTier,
            subscriptionEndDate: updatedEndDate
          }
        );
        
        console.log('🔄 Subscription updated:', updatedSub.id);
        break;
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ====== ALERT ROUTES ======
app.get('/api/alerts', authenticateToken, async (req, res) => {
  try {
    const { type = 'ALL', limit = 50, page = 1 } = req.query;
    const user = req.user;
    
    let query = { isActive: { $ne: false } };
    if (type !== 'ALL') {
      query.type = type;
    }
    
    // Add expiration filter
    query.$or = [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ];
    
    const alerts = await Alert.find(query)
      .populate('createdBy', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    // Apply subscription limits
    let limitedAlerts = alerts;
    if (user.tier === 'FREE' && !user.isAdmin) {
      limitedAlerts = alerts.slice(0, 5);
    }
    
    res.json({
      alerts: limitedAlerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: limitedAlerts.length,
        hasMore: alerts.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Error fetching alerts' });
  }
});

app.post('/api/alerts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, message, type, priority, botName, pnl, metadata, expiresAt } = req.body;
    
    if (!title || !message || !type) {
      return res.status(400).json({ 
        error: 'Title, message, and type are required',
        code: 'MISSING_FIELDS'
      });
    }
    
    const alert = new Alert({
      title,
      message,
      type,
      priority: priority || 'MEDIUM',
      botName,
      pnl,
      metadata,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdBy: req.user._id
    });
    
    await alert.save();
    await alert.populate('createdBy', 'username avatar');
    
    // Broadcast to all connected users
    io.emit('newAlert', alert);
    
    console.log('🚨 New alert created by:', req.user.username, '- Type:', type);
    
    res.status(201).json({
      success: true,
      alert
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ error: 'Error creating alert' });
  }
});

app.put('/api/alerts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const alert = await Alert.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    ).populate('createdBy', 'username avatar');
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    io.emit('alertUpdated', alert);
    
    res.json({
      success: true,
      alert
    });
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({ error: 'Error updating alert' });
  }
});

app.delete('/api/alerts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndDelete(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    io.emit('alertDeleted', req.params.id);
    
    console.log('🗑️ Alert deleted by:', req.user.username);
    
    res.json({ 
      success: true,
      message: 'Alert deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Error deleting alert' });
  }
});

// ====== USER MANAGEMENT ROUTES ======
app.get('/api/users/active', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const timeThreshold = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes
    
    const activeUsers = await User.find({
      lastActive: { $gte: timeThreshold }
    }).select('username avatar tier lastActive').sort({ lastActive: -1 });
    
    // Apply subscription limits
    let limitedUsers = activeUsers;
    if (user.tier === 'FREE' && !user.isAdmin) {
      limitedUsers = activeUsers.slice(0, 5);
    }
    
    res.json(limitedUsers);
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ error: 'Error fetching active users' });
  }
});

app.get('/api/users/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const freeUsers = await User.countDocuments({ tier: 'FREE' });
    const weeklyUsers = await User.countDocuments({ tier: 'WEEKLY' });
    const monthlyUsers = await User.countDocuments({ tier: 'MONTHLY' });
    const admins = await User.countDocuments({ isAdmin: true });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsersToday = await User.countDocuments({ 
      createdAt: { $gte: today } 
    });
    
    const activeToday = await User.countDocuments({
      lastActive: { $gte: today }
    });
    
    res.json({
      total: totalUsers,
      tiers: {
        free: freeUsers,
        weekly: weeklyUsers,
        monthly: monthlyUsers
      },
      admins,
      newToday: newUsersToday,
      activeToday
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Error fetching user stats' });
  }
});

// ====== MARKET DATA ROUTES ======
app.get('/api/market/data', authenticateToken, checkSubscription('WEEKLY'), async (req, res) => {
  try {
    // Mock market data - replace with real API calls
    const marketData = {
      'BTC': {
        symbol: 'BTC',
        price: 45000 + (Math.random() - 0.5) * 2000,
        change: (Math.random() - 0.5) * 1000,
        changePercent: (Math.random() - 0.5) * 5,
        volume: Math.random() * 1000000000,
        lastUpdate: new Date()
      },
      'ETH': {
        symbol: 'ETH',
        price: 3000 + (Math.random() - 0.5) * 400,
        change: (Math.random() - 0.5) * 100,
        changePercent: (Math.random() - 0.5) * 6,
        volume: Math.random() * 500000000,
        lastUpdate: new Date()
      },
      'SOL': {
        symbol: 'SOL',
        price: 100 + (Math.random() - 0.5) * 40,
        change: (Math.random() - 0.5) * 10,
        changePercent: (Math.random() - 0.5) * 8,
        volume: Math.random() * 100000000,
        lastUpdate: new Date()
      }
    };
    
    res.json(marketData);
  } catch (error) {
    console.error('Error fetching market data:', error);
    res.status(500).json({ error: 'Error fetching market data' });
  }
});

// ====== SOCKET.IO REAL-TIME FEATURES ======
io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);
  
  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      const user = await User.findById(decoded.userId);
      if (user) {
        socket.userId = user._id.toString();
        socket.username = user.username;
        socket.join('authenticated');
        console.log('🔐 User authenticated via socket:', user.username);
      }
    } catch (error) {
      console.log('❌ Socket authentication failed:', error.message);
    }
  });
  
  socket.on('joinTradingRoom', (data) => {
    socket.join('trading-room');
    console.log(`👤 User ${data.username || socket.id} joined trading room`);
    
    // Notify others
    socket.to('trading-room').emit('userJoined', {
      id: socket.id,
      username: data.username,
      timestamp: new Date()
    });
  });
  
  socket.on('leaveTradingRoom', () => {
    socket.leave('trading-room');
    console.log(`👤 User ${socket.username || socket.id} left trading room`);
  });
  
  socket.on('typing', (data) => {
    socket.to('trading-room').emit('userTyping', {
      username: data.username,
      isTyping: data.isTyping
    });
  });
  
  socket.on('disconnect', () => {
    console.log('👤 User disconnected:', socket.id);
    io.to('trading-room').emit('userLeft', {
      id: socket.id,
      username: socket.username,
      timestamp: new Date()
    });
  });
});

// Market data simulation
let marketSimulation;
const startMarketSimulation = () => {
  marketSimulation = setInterval(() => {
    const symbols = ['BTC', 'ETH', 'SOL', 'DOGE', 'ADA'];
    const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    
    const marketUpdate = {
      symbol: randomSymbol,
      price: Math.random() * 50000 + 1000,
      change: (Math.random() - 0.5) * 1000,
      changePercent: (Math.random() - 0.5) * 10,
      volume: Math.random() * 1000000000,
      timestamp: new Date()
    };
    
    io.to('trading-room').emit('marketUpdate', marketUpdate);
  }, 15000); // Every 15 seconds
};

// ====== INITIALIZATION FUNCTIONS ======
const initializeSubscriptionPlans = async () => {
  try {
    const existingPlans = await SubscriptionPlan.countDocuments();
    if (existingPlans === 0) {
      const plans = [
        {
          name: 'Weekly Access',
          tier: 'WEEKLY',
          priceId: process.env.STRIPE_WEEKLY_PRICE_ID || 'price_weekly_placeholder',
          price: 6,
          interval: 'week',
          sortOrder: 1,
          features: [
            'Full group access',
            'Custom charts & analysis',
            'Unlimited live alerts',
            'Live news feed',
            'Real-time market data',
            'Direct trader access'
          ]
        },
        {
          name: 'Monthly Access',
          tier: 'MONTHLY',
          priceId: process.env.STRIPE_MONTHLY_PRICE_ID || 'price_monthly_placeholder',
          price: 20,
          interval: 'month',
          sortOrder: 2,
          features: [
            'Full group access',
            'Custom charts & analysis',
            'Unlimited live alerts',
            'Live news feed',
            'Real-time market data',
            'Direct trader access',
            'Save $4/month vs weekly',
            'Priority support'
          ]
        }
      ];
      
      await SubscriptionPlan.insertMany(plans);
      console.log('📦 Subscription plans initialized');
    }
  } catch (error) {
    console.error('❌ Error initializing subscription plans:', error);
  }
};

const createDefaultUsers = async () => {
  try {
    // Create admin user
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      
      let stripeCustomerId = null;
      try {
        const customer = await stripe.customers.create({
          email: 'admin@rti-cashflowops.com',
          name: 'Admin User'
        });
        stripeCustomerId = customer.id;
      } catch (stripeError) {
        console.warn('⚠️ Admin Stripe customer creation failed');
      }
      
      const admin = new User({
        username: 'admin',
        email: 'admin@rti-cashflowops.com',
        password: hashedPassword,
        tier: 'ADMIN',
        isAdmin: true,
        avatar: 'https://ui-avatars.com/api/?background=ef4444&color=fff&name=Admin',
        stripeCustomerId,
        bio: 'System administrator',
        isPublic: false
      });
      
      await admin.save();
      console.log('👑 Admin user created - username: admin, password:', adminPassword);
    }
    
    // Create test user
    const testExists = await User.findOne({ username: 'testuser' });
    if (!testExists) {
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash('test123', salt);
      
      let stripeCustomerId = null;
      try {
        const customer = await stripe.customers.create({
          email: 'test@example.com',
          name: 'Test User'
        });
        stripeCustomerId = customer.id;
      } catch (stripeError) {
        console.warn('⚠️ Test Stripe customer creation failed');
      }
      
      const testUser = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: hashedPassword,
        tier: 'FREE',
        isAdmin: false,
        avatar: 'https://ui-avatars.com/api/?background=3b82f6&color=fff&name=Test',
        stripeCustomerId,
        bio: 'Test account for subscription testing',
        tradingExperience: 'Beginner'
      });
      
      await testUser.save();
      console.log('🧪 Test user created - username: testuser, password: test123');
    }
  } catch (error) {
    console.error('❌ Error creating default users:', error);
  }
};

// ====== ERROR HANDLING ======
app.use((err, req, res, next) => {
  console.error('🚨 Unhandled error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      details: err.message,
      code: 'VALIDATION_ERROR'
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format',
      code: 'INVALID_ID'
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    code: 'SERVER_ERROR',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.originalUrl
  });
});

// ====== SERVER STARTUP ======
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const startServer = async () => {
  try {
    console.log('🚀 Initializing RTi Cashflowops Backend...');
    
    // Wait for MongoDB connection
    await new Promise((resolve, reject) => {
      mongoose.connection.once('open', resolve);
      mongoose.connection.once('error', reject);
      
      setTimeout(() => reject(new Error('MongoDB connection timeout')), 10000);
    });
    
    console.log('✅ MongoDB connected');
    
    // Initialize data
    await createDefaultUsers();
    await initializeSubscriptionPlans();
    
    // Start market simulation
    startMarketSimulation();
    
    // Start server
    server.listen(PORT, HOST, () => {
      console.log('🎉 ==========================================');
      console.log('🚀 RTi Cashflowops Backend READY!');
      console.log('🎉 ==========================================');
      console.log(`🌐 Server running on: http://${HOST}:${PORT}`);
      console.log(`📡 Socket.IO enabled for real-time features`);
      console.log(`💳 Stripe integration: ${process.env.STRIPE_SECRET_KEY ? 'Active' : 'Disabled'}`);
      console.log(`🔒 Subscription system: Active`);
      console.log(`📸 Avatar upload system: Enabled`);
      console.log(`👤 User profile system: Enabled`);
      console.log(`🌐 CORS enabled for production domains`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('🎉 ==========================================');
      console.log('🔗 API Endpoints:');
      console.log(`   📍 Health: ${HOST}:${PORT}/health`);
      console.log(`   🧪 Test: ${HOST}:${PORT}/api/test`);
      console.log(`   🧪 CORS Test: ${HOST}:${PORT}/api/cors-test`);
      console.log(`   📸 Avatar Test: ${HOST}:${PORT}/api/users/avatar/test`);
      console.log('🎉 ==========================================');
      console.log('🧪 TEST CREDENTIALS:');
      console.log(`   👑 Admin: admin / ${process.env.ADMIN_PASSWORD || 'admin123'}`);
      console.log(`   🧪 Test User: testuser / test123`);
      console.log('🎉 ==========================================');
      console.log('✅ Backend fully operational and ready for production!');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully...');
  if (marketSimulation) clearInterval(marketSimulation);
  server.close(() => {
    console.log('✅ Server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully...');
  if (marketSimulation) clearInterval(marketSimulation);
  server.close(() => {
    console.log('✅ Server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Start the server
startServer();

module.exports = app;
