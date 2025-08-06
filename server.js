// 📁 FILE: rti-trading-backend/server.js
// COMPLETE SERVER WITH FIXED CORS + AVATAR UPLOAD + PROFILE ENDPOINTS

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

// 🔥 FIXED CORS CONFIGURATION FOR RAILWAY PRODUCTION
console.log('🚀 Loading CORS configuration...');

// METHOD 1: Primary CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    console.log('🔍 CORS request from origin:', origin);
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      console.log('✅ Allowing request with no origin');
      return callback(null, true);
    }
    
    // List of allowed origins
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
      console.log('✅ Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('❌ Origin blocked:', origin);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
}));

// METHOD 2: Explicit CORS headers (backup)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  console.log(`📡 ${req.method} ${req.path} from ${origin || 'no-origin'}`);
  
  // Set CORS headers for allowed origins
  if (origin && (
    origin === 'https://cashflowops.pro' ||
    origin === 'https://www.cashflowops.pro' ||
    origin.includes('localhost')
  )) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    console.log('✅ CORS headers set for:', origin);
  }
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling OPTIONS preflight request');
    return res.sendStatus(200);
  }
  
  next();
});

// METHOD 3: Force CORS for Railway (additional backup)
app.use((req, res, next) => {
  // Railway-specific fix - force headers
  if (req.headers.origin && req.headers.origin.includes('cashflowops.pro')) {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

// Socket.IO with CORS fix
const io = new Server(server, {
  cors: {
    origin: [
      'https://cashflowops.pro',
      'https://www.cashflowops.pro',
      'http://localhost:3000'
    ],
    credentials: true,
    methods: ["GET", "POST"]
  }
});

// Middleware (AFTER CORS)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// ====== AVATAR UPLOAD CONFIGURATION ======
// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads/avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user._id;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `user_${userId}_${timestamp}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  }
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rti-trading', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// ENHANCED USER SCHEMA WITH PROFILE FIELDS
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  tier: { 
    type: String, 
    enum: ['FREE', 'WEEKLY', 'MONTHLY', 'ADMIN'], 
    default: 'FREE' 
  },
  isAdmin: { type: Boolean, default: false },
  avatar: { 
    type: String, 
    default: 'https://ui-avatars.com/api/?background=22c55e&color=fff&name=' 
  },
  
  // PROFILE FIELDS
  bio: {
    type: String,
    maxlength: 500,
    default: ''
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
    twitter: { type: String, default: '' },
    discord: { type: String, default: '' },
    telegram: { type: String, default: '' }
  },
  tradingStats: {
    winRate: { type: Number, default: 0, min: 0, max: 100 },
    totalTrades: { type: Number, default: 0, min: 0 },
    favoriteStrategy: { type: String, default: '' }
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // SUBSCRIPTION FIELDS
  stripeCustomerId: String,
  subscriptionId: String,
  subscriptionStatus: String,
  subscriptionEndDate: Date,
  
  // ACTIVITY TRACKING
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamps on save
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

userSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Alert Schema
const alertSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['NEWS', 'BOT_SIGNAL', 'MARKET_UPDATE'], 
    required: true 
  },
  priority: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH'], 
    default: 'MEDIUM' 
  },
  botName: String,
  pnl: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

// Subscription Plans Schema
const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  tier: { type: String, required: true },
  priceId: { type: String, required: true },
  price: { type: Number, required: true },
  interval: { type: String, required: true },
  features: [String],
  isActive: { type: Boolean, default: true }
});

const User = mongoose.model('User', userSchema);
const Alert = mongoose.model('Alert', alertSchema);
const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    try {
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      user.lastActive = new Date();
      await user.save();
      
      req.user = user;
      next();
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
};

// Subscription Middleware
const checkSubscription = (requiredTier = 'WEEKLY') => {
  return (req, res, next) => {
    const user = req.user;
    
    if (user.isAdmin) {
      return next();
    }
    
    if (user.tier === 'FREE' && requiredTier !== 'FREE') {
      return res.status(402).json({ 
        error: 'Subscription required',
        message: 'Upgrade to access this feature',
        requiredTier 
      });
    }
    
    if (user.subscriptionEndDate && user.subscriptionEndDate < new Date()) {
      user.tier = 'FREE';
      user.save();
      return res.status(402).json({ 
        error: 'Subscription expired',
        message: 'Please renew your subscription' 
      });
    }
    
    next();
  };
};

// Initialize subscription plans data
const initializeSubscriptionPlans = async () => {
  try {
    const existingPlans = await SubscriptionPlan.countDocuments();
    if (existingPlans === 0) {
      const plans = [
        {
          name: 'Weekly Access',
          tier: 'WEEKLY',
          priceId: 'price_weekly_placeholder',
          price: 6,
          interval: 'week',
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
          priceId: 'price_monthly_placeholder',
          price: 20,
          interval: 'month',
          features: [
            'Full group access',
            'Custom charts & analysis',
            'Unlimited live alerts',
            'Live news feed',
            'Real-time market data',
            'Direct trader access',
            'Save $4/month vs weekly'
          ]
        }
      ];
      
      await SubscriptionPlan.insertMany(plans);
      console.log('📦 Subscription plans initialized');
    }
  } catch (error) {
    console.error('Error initializing subscription plans:', error);
  }
};

// ====== TEST ROUTES ======
app.get('/api/cors-test', (req, res) => {
  console.log('🧪 CORS test endpoint hit from:', req.headers.origin);
  res.json({ 
    message: 'CORS is working!',
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    corsHeaders: {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers')
    }
  });
});

app.get('/api/test', (req, res) => {
  console.log('🧪 Test endpoint hit from:', req.headers.origin);
  res.json({ 
    message: 'Backend is working!', 
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    corsWorking: true,
    status: 'ok'
  });
});

// Root health check for Railway
app.get('/', (req, res) => {
  res.json({ 
    status: 'RTi Trading Backend is healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ====== AUTHENTICATION ROUTES ======
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Username or email already exists' 
      });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const customer = await stripe.customers.create({
      email,
      name: username
    });
    
    const user = new User({
      username,
      email,
      password: hashedPassword,
      avatar: `https://ui-avatars.com/api/?background=22c55e&color=fff&name=${username}`,
      stripeCustomerId: customer.id
    });
    
    await user.save();
    
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        tier: user.tier,
        isAdmin: user.isAdmin,
        avatar: user.avatar
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔑 Login attempt for:', req.body.username);
    const { username, password } = req.body;
    
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }] 
    });
    
    if (!user) {
      console.log('❌ User not found:', username);
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('❌ Invalid password for:', username);
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );
    
    console.log('✅ Login successful for:', username);
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        tier: user.tier,
        isAdmin: user.isAdmin,
        avatar: user.avatar
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

app.get('/api/auth/profile', authenticateToken, (req, res) => {
  res.json({
    id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    tier: req.user.tier,
    isAdmin: req.user.isAdmin,
    avatar: req.user.avatar
  });
});

// ====== SUBSCRIPTION ROUTES ======
app.get('/api/subscription/plans', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
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
    
    const session = await stripe.checkout.sessions.create({
      customer: user.stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/dashboard.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription.html`,
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
    const { type = 'ALL' } = req.query;
    const user = req.user;
    
    let query = {};
    if (type !== 'ALL') {
      query.type = type;
    }
    
    const alerts = await Alert.find(query)
      .populate('createdBy', 'username avatar')
      .sort({ createdAt: -1 });
    
    // Apply subscription limits
    let limitedAlerts = alerts;
    if (user.tier === 'FREE' && !user.isAdmin) {
      limitedAlerts = alerts.slice(0, 3);
    }
    
    res.json(limitedAlerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Error fetching alerts' });
  }
});

app.post('/api/alerts', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { title, message, type, priority, botName, pnl } = req.body;
    
    const alert = new Alert({
      title,
      message,
      type,
      priority,
      botName,
      pnl,
      createdBy: req.user._id
    });
    
    await alert.save();
    await alert.populate('createdBy', 'username avatar');
    
    io.emit('newAlert', alert);
    
    res.status(201).json(alert);
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ error: 'Error creating alert' });
  }
});

app.delete('/api/alerts/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const alert = await Alert.findByIdAndDelete(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    io.emit('alertDeleted', req.params.id);
    
    res.json({ message: 'Alert deleted' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Error deleting alert' });
  }
});

// ====== USER ROUTES ======
app.get('/api/users/active', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const activeUsers = await User.find({
      lastActive: { $gte: fiveMinutesAgo }
    }).select('username avatar tier lastActive');
    
    let limitedUsers = activeUsers;
    if (user.tier === 'FREE' && !user.isAdmin) {
      limitedUsers = activeUsers.slice(0, 3);
    }
    
    res.json(limitedUsers);
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ error: 'Error fetching active users' });
  }
});

// ====== USER PROFILE ROUTES ======

// Update user profile (PUT /api/users/profile)
app.put('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body;
    
    console.log(`📝 Profile update request from user: ${userId}`, updateData);
    
    // Filter allowed profile fields
    const allowedFields = [
      'bio',
      'tradingExperience', 
      'favoriteMarkets',
      'socialLinks',
      'tradingStats',
      'isPublic'
    ];
    
    const profileUpdate = {};
    
    // Build the profile update object
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        profileUpdate[key] = updateData[key];
      }
    });
    
    // Update user with profile data
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        $set: profileUpdate,
        updatedAt: new Date()
      },
      { 
        new: true,
        runValidators: true 
      }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`✅ Profile updated successfully for user ${userId}`);
    
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
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get user profile by ID (GET /api/users/:userId/profile)
app.get('/api/users/:userId/profile', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user;
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if profile is public or if it's the user's own profile or if requesting user is admin
    const canViewProfile = user.isPublic || 
                          userId === requestingUser._id.toString() || 
                          requestingUser.isAdmin;
    
    if (!canViewProfile) {
      return res.status(403).json({ error: 'Profile is private' });
    }
    
    // Return profile data
    const profileData = {
      id: user._id,
      username: user.username,
      avatar: user.avatar,
      tier: user.tier,
      isAdmin: user.isAdmin,
      bio: user.bio || '',
      tradingExperience: user.tradingExperience || 'Beginner',
      favoriteMarkets: user.favoriteMarkets || [],
      socialLinks: user.socialLinks || {
        twitter: '',
        discord: '',
        telegram: ''
      },
      tradingStats: user.tradingStats || {
        winRate: 0,
        totalTrades: 0,
        favoriteStrategy: ''
      },
      isPublic: user.isPublic !== false,
      createdAt: user.createdAt,
      lastActive: user.lastActive
    };
    
    res.json(profileData);
    
  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Get current user's profile (GET /api/users/profile)
app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return complete profile data for own profile
    const profileData = {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      tier: user.tier,
      isAdmin: user.isAdmin,
      bio: user.bio || '',
      tradingExperience: user.tradingExperience || 'Beginner',
      favoriteMarkets: user.favoriteMarkets || [],
      socialLinks: user.socialLinks || {
        twitter: '',
        discord: '',
        telegram: ''
      },
      tradingStats: user.tradingStats || {
        winRate: 0,
        totalTrades: 0,
        favoriteStrategy: ''
      },
      isPublic: user.isPublic !== false,
      createdAt: user.createdAt,
      lastActive: user.lastActive,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionEndDate: user.subscriptionEndDate
    };
    
    res.json(profileData);
    
  } catch (error) {
    console.error('❌ Error fetching own profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ====== AVATAR UPLOAD ROUTES ======
app.get('/api/users/avatar/test', authenticateToken, (req, res) => {
  res.json({
    message: 'Avatar upload endpoint is working!',
    user_id: req.user._id,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/users/avatar', authenticateToken, (req, res) => {
  const userId = req.user._id;
  console.log(`📸 Avatar upload request from user: ${userId}`);
  
  upload.single('avatar')(req, res, async (err) => {
    try {
      // Handle upload errors
      if (err) {
        console.error('❌ Upload error:', err);
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size too large. Maximum 5MB allowed.' });
          }
        }
        return res.status(400).json({ error: err.message });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const filename = req.file.filename;
      
      // Generate the URL for the uploaded file
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? `https://${req.get('host')}`
        : `${req.protocol}://${req.get('host')}`;
      const avatarUrl = `${baseUrl}/uploads/avatars/${filename}`;

      console.log(`✅ File uploaded:`, {
        userId,
        filename,
        avatarUrl,
        size: req.file.size
      });

      // Delete old avatar file (cleanup)
      try {
        const currentUser = await User.findById(userId);
        if (currentUser && currentUser.avatar && currentUser.avatar.includes('/uploads/avatars/')) {
          const oldFilename = path.basename(currentUser.avatar);
          const oldFilePath = path.join(uploadDir, oldFilename);
          if (fs.existsSync(oldFilePath) && oldFilename.startsWith('user_')) {
            fs.unlinkSync(oldFilePath);
            console.log(`🗑️ Deleted old avatar: ${oldFilename}`);
          }
        }
      } catch (cleanupError) {
        console.warn('⚠️ Could not clean up old avatar:', cleanupError.message);
      }

      // Update user's avatar in database
      const updatedUser = await User.findByIdAndUpdate(
        userId, 
        { avatar: avatarUrl },
        { new: true }
      ).select('username avatar email tier');

      if (!updatedUser) {
        // Delete uploaded file if user update failed
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({ error: 'User not found' });
      }

      console.log(`✅ Avatar upload completed for user ${userId}`);

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        avatarUrl: avatarUrl,
        filename: filename,
        user: {
          id: userId,
          username: updatedUser.username,
          avatar: avatarUrl
        }
      });

    } catch (error) {
      console.error('❌ Avatar upload error:', error);
      
      // Clean up uploaded file if there was an error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ 
        error: 'Failed to upload avatar',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  });
});

// Get user avatar endpoint (optional)
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

// ====== MARKET DATA ROUTES ======
app.get('/api/market/data', authenticateToken, checkSubscription('WEEKLY'), async (req, res) => {
  try {
    const marketData = {
      'BTC': {
        price: 45000 + Math.random() * 1000,
        change: (Math.random() - 0.5) * 1000,
        changePercent: (Math.random() - 0.5) * 10
      },
      'ETH': {
        price: 3000 + Math.random() * 200,
        change: (Math.random() - 0.5) * 100,
        changePercent: (Math.random() - 0.5) * 8
      },
      'SOL': {
        price: 100 + Math.random() * 20,
        change: (Math.random() - 0.5) * 10,
        changePercent: (Math.random() - 0.5) * 12
      }
    };
    
    res.json(marketData);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching market data' });
  }
});

// ====== SOCKET.IO REAL-TIME FEATURES ======
io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);
  
  socket.on('joinTradingRoom', (userId) => {
    socket.join('trading-room');
    console.log(`👤 User ${userId} joined trading room`);
  });
  
  socket.on('disconnect', () => {
    console.log('👤 User disconnected:', socket.id);
  });
});

// Simulate market updates every 30 seconds
setInterval(() => {
  const symbols = ['BTC', 'ETH', 'SOL'];
  const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
  
  const marketUpdate = {
    symbol: randomSymbol,
    price: Math.random() * 50000,
    change: (Math.random() - 0.5) * 1000,
    changePercent: (Math.random() - 0.5) * 10,
    timestamp: new Date()
  };
  
  io.to('trading-room').emit('marketUpdate', marketUpdate);
}, 30000);

// Create admin user if doesn't exist
const createAdminUser = async () => {
  try {
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      const customer = await stripe.customers.create({
        email: 'admin@rti-cashflowops.com',
        name: 'Admin User'
      });
      
      const admin = new User({
        username: 'admin',
        email: 'admin@rti-cashflowops.com',
        password: hashedPassword,
        tier: 'ADMIN',
        isAdmin: true,
        avatar: 'https://ui-avatars.com/api/?background=ef4444&color=fff&name=Admin',
        stripeCustomerId: customer.id
      });
      
      await admin.save();
      console.log('👑 Admin user created - username: admin, password: admin123');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

// Create test user for subscription testing
const createTestUser = async () => {
  try {
    const testExists = await User.findOne({ username: 'testuser' });
    if (!testExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('test123', salt);
      
      const customer = await stripe.customers.create({
        email: 'test@example.com',
        name: 'Test User'
      });
      
      const testUser = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: hashedPassword,
        tier: 'FREE',
        isAdmin: false,
        avatar: 'https://ui-avatars.com/api/?background=3b82f6&color=fff&name=Test',
        stripeCustomerId: customer.id,
        // Explicitly ensure no subscription history
        subscriptionId: undefined,
        subscriptionStatus: undefined,
        subscriptionEndDate: undefined
      });
      
      await testUser.save();
      console.log('🧪 Test user created for subscription testing:');
      console.log('   Username: testuser');
      console.log('   Password: test123');
      console.log('   Email: test@example.com');
      console.log('   Tier: FREE (no subscription history)');
      console.log('   This user will be prompted for subscription on dashboard access');
    }
  } catch (error) {
    console.error('Error creating test user:', error);
  }
};

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await mongoose.connection.once('open', () => {
      console.log('🗄️  Connected to MongoDB');
    });
    
    await createAdminUser();
    await createTestUser();
    await initializeSubscriptionPlans();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 RTi Cashflowops Backend running on port ${PORT}`);
      console.log(`📡 Socket.IO enabled for real-time features`);
      console.log(`💳 Stripe integration ready`);
      console.log(`🔒 Subscription system active`);
      console.log(`📸 Avatar upload system enabled`);
      console.log(`👤 User profile system enabled`);
      console.log(`🌐 CORS enabled for: cashflowops.pro`);
      console.log(`🔗 Test endpoint: http://localhost:${PORT}/api/test`);
      console.log(`📸 Avatar test: http://localhost:${PORT}/api/users/avatar/test`);
      console.log(`👤 Profile test: http://localhost:${PORT}/api/users/profile`);
      console.log(`\n🧪 TEST CREDENTIALS:`);
      console.log(`   Admin: admin / admin123`);
      console.log(`   Test User: testuser / test123 (will require subscription)`);
      console.log(`\n✅ CORS CONFIGURATION LOADED - READY FOR PRODUCTION`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
