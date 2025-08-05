// 📁 FILE: rti-trading-backend/server.js
// COMPLETE SERVER WITH CORS FIX FOR PRODUCTION + TEST USER

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = createServer(app);

// FIXED CORS CONFIGURATION FOR PRODUCTION
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://cashflowops.pro',
    'https://www.cashflowops.pro'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
}));

// Additional CORS headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://cashflowops.pro',
    'https://www.cashflowops.pro'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE');
  res.header('Access-Control-Allow-Headers', 'Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Socket.IO with CORS fix
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://cashflowops.pro',
      'https://www.cashflowops.pro'
    ],
    credentials: true,
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rti-trading', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// User Schema
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
  stripeCustomerId: String,
  subscriptionId: String,
  subscriptionStatus: String,
  subscriptionEndDate: Date,
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
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

// ====== TEST ROUTE ======
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend is working!', 
    timestamp: new Date().toISOString(),
    status: 'ok',
    cors: 'enabled'
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
    const { username, password } = req.body;
    
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }] 
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );
    
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
    await createTestUser(); // Add test user creation
    await initializeSubscriptionPlans();
    
    server.listen(PORT, () => {
      console.log(`🚀 RTi Cashflowops Backend running on port ${PORT}`);
      console.log(`📡 Socket.IO enabled for real-time features`);
      console.log(`💳 Stripe integration ready`);
      console.log(`🔒 Subscription system active`);
      console.log(`🌐 CORS enabled for: cashflowops.pro`);
      console.log(`🔗 Test endpoint: http://localhost:${PORT}/api/test`);
      console.log(`\n🧪 TEST CREDENTIALS:`);
      console.log(`   Admin: admin / admin123`);
      console.log(`   Test User: testuser / test123 (will require subscription)`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
