// 📁 FILE: server.js
// COMPLETE SERVER WITH SIMPLIFIED CORS FIX

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

// 🔥 SIMPLIFIED CORS CONFIGURATION THAT WORKS ON RAILWAY
console.log('🌐 Configuring CORS...');

// Simple CORS middleware
app.use(cors());

// Explicit CORS headers (backup)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
  
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight from:', req.headers.origin);
    return res.sendStatus(200);
  }
  
  next();
});

// Request logging
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`📡 ${req.method} ${req.path} from ${req.headers.origin || 'no-origin'}`);
  }
  next();
});

// Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// ====== AVATAR UPLOAD CONFIGURATION ======
const uploadDir = path.join(__dirname, 'uploads/avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ====== DATABASE CONNECTION ======
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rti-trading', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// ====== DATABASE SCHEMAS ======
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
  isPublic: { type: Boolean, default: true },
  stripeCustomerId: String,
  subscriptionId: String,
  subscriptionStatus: String,
  subscriptionEndDate: Date,
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const alertSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['NEWS', 'BOT_SIGNAL', 'MARKET_UPDATE', 'ANNOUNCEMENT'], 
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

// ====== MIDDLEWARE ======
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

// ====== HEALTH CHECK ROUTES ======
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
    timestamp: new Date().toISOString(),
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
    corsFixed: true
  });
});

// ====== AUTHENTICATION ROUTES ======
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    console.log('📝 Registration attempt:', { username, email });
    
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
    
    let stripeCustomerId = null;
    try {
      const customer = await stripe.customers.create({
        email,
        name: username
      });
      stripeCustomerId = customer.id;
    } catch (stripeError) {
      console.warn('⚠️ Stripe customer creation failed:', stripeError.message);
    }
    
    const user = new User({
      username,
      email,
      password: hashedPassword,
      avatar: `https://ui-avatars.com/api/?background=22c55e&color=fff&name=${username}`,
      stripeCustomerId
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
    const { username, password } = req.body;
    
    console.log('🔑 Login attempt for:', username);
    
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

// ====== USER PROFILE ROUTES ======
app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
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
    
    const allowedFields = [
      'bio', 'tradingExperience', 'favoriteMarkets',
      'socialLinks', 'tradingStats', 'isPublic'
    ];
    
    const profileUpdate = {};
    allowedFields.forEach(field => {
      if (updateData.hasOwnProperty(field)) {
        profileUpdate[field] = updateData[field];
      }
    });
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: profileUpdate, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-password');
    
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
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ====== AVATAR UPLOAD ROUTES ======
app.get('/api/users/avatar/test', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Avatar upload endpoint is working!',
    user_id: req.user._id,
    username: req.user.username,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/users/avatar', authenticateToken, (req, res) => {
  const userId = req.user._id;
  
  upload.single('avatar')(req, res, async (err) => {
    try {
      if (err) {
        console.error('❌ Upload error:', err);
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;

      const updatedUser = await User.findByIdAndUpdate(
        userId, 
        { avatar: avatarUrl },
        { new: true }
      ).select('username avatar email tier');

      console.log('✅ Avatar updated for:', updatedUser.username);

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        avatarUrl: avatarUrl,
        user: {
          id: userId,
          username: updatedUser.username,
          avatar: avatarUrl
        }
      });

    } catch (error) {
      console.error('❌ Avatar upload error:', error);
      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  });
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
    
    // FIXED: Return in new format to match frontend expectations
    res.json({
      alerts: limitedAlerts,
      pagination: {
        page: 1,
        limit: limitedAlerts.length,
        total: alerts.length,
        hasMore: false
      }
    });
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
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/dashboard.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription.html`,
      metadata: { userId: user._id.toString() }
    });
    
    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({ error: 'Error creating checkout session' });
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

// ====== SOCKET.IO ======
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

// ====== INITIALIZATION ======
const createDefaultUsers = async () => {
  try {
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      const admin = new User({
        username: 'admin',
        email: 'admin@rti-cashflowops.com',
        password: hashedPassword,
        tier: 'ADMIN',
        isAdmin: true,
        avatar: 'https://ui-avatars.com/api/?background=ef4444&color=fff&name=Admin'
      });
      
      await admin.save();
      console.log('👑 Admin user created - username: admin, password: admin123');
    }
    
    const testExists = await User.findOne({ username: 'testuser' });
    if (!testExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('test123', salt);
      
      const testUser = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: hashedPassword,
        tier: 'FREE',
        isAdmin: false,
        avatar: 'https://ui-avatars.com/api/?background=3b82f6&color=fff&name=Test'
      });
      
      await testUser.save();
      console.log('🧪 Test user created - username: testuser, password: test123');
    }
  } catch (error) {
    console.error('Error creating default users:', error);
  }
};

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

// ====== ERROR HANDLING ======
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// ====== SERVER STARTUP ======
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await mongoose.connection.once('open', () => {
      console.log('🗄️ Connected to MongoDB');
    });
    
    await createDefaultUsers();
    await initializeSubscriptionPlans();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log('🎉 ==========================================');
      console.log('🚀 RTi Cashflowops Backend READY!');
      console.log('🎉 ==========================================');
      console.log(`🌐 Server: http://0.0.0.0:${PORT}`);
      console.log(`🧪 Test: /api/test`);
      console.log(`🧪 CORS Test: /api/cors-test`);
      console.log(`🔑 Login Test: testuser / test123`);
      console.log(`👑 Admin: admin / admin123`);
      console.log('✅ SIMPLIFIED CORS - SHOULD WORK ON RAILWAY');
      console.log('🎉 ==========================================');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
