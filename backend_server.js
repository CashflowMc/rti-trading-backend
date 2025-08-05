const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const http = require('http');
const cron = require('node-cron');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on('connected', () => {
  console.log('✅ Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  tier: { type: String, enum: ['SILVER', 'GOLD', 'PLATINUM', 'ADMIN'], default: 'SILVER' },
  isAdmin: { type: Boolean, default: false },
  avatar: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

const User = mongoose.model('User', userSchema);

// Alert Schema
const alertSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['BOT_SIGNAL', 'NEWS', 'MARKET_UPDATE'], required: true },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
  symbol: { type: String, default: '' },
  botName: { type: String, default: '' },
  pnl: { type: String, default: null },
  status: { type: String, enum: ['ACTIVE', 'CLOSED', 'ARCHIVED'], default: 'ACTIVE' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) } // 24 hours
});

const Alert = mongoose.model('Alert', alertSchema);

// Trading Strategy Schema
const strategySchema = new mongoose.Schema({
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  timeframe: { type: String, required: true },
  script: { type: String, required: true },
  levels: {
    resistance: String,
    support: String,
    target: String,
    stop: String
  },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const Strategy = mongoose.model('Strategy', strategySchema);

// Market Data Schema
const marketDataSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  price: { type: Number, required: true },
  change: { type: Number, default: 0 },
  changePercent: { type: Number, default: 0 },
  volume: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
});

const MarketData = mongoose.model('MarketData', marketDataSchema);

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      avatar: `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face&facepad=2&bg=gray`
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id, username: user.username, isAdmin: user.isAdmin },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
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

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id, username: user.username, isAdmin: user.isAdmin },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
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

// Get User Profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Alerts
app.get('/api/alerts', authenticateToken, async (req, res) => {
  try {
    const { type, priority } = req.query;
    let filter = { status: { $ne: 'ARCHIVED' } };

    if (type && type !== 'ALL') {
      filter.type = type;
    }
    if (priority) {
      filter.priority = priority;
    }

    const alerts = await Alert.find(filter)
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create Alert (Admin only)
app.post('/api/alerts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, message, type, priority, symbol, botName } = req.body;

    const alert = new Alert({
      title,
      message,
      type,
      priority,
      symbol,
      botName,
      createdBy: req.user.userId
    });

    await alert.save();
    await alert.populate('createdBy', 'username');

    // Emit to all connected clients
    io.emit('newAlert', alert);

    res.status(201).json(alert);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete Alert (Admin only)
app.delete('/api/alerts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndDelete(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Emit to all connected clients
    io.emit('alertDeleted', req.params.id);

    res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Trading Strategies
app.get('/api/strategies', authenticateToken, async (req, res) => {
  try {
    const strategies = await Strategy.find({ isActive: true })
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });

    res.json(strategies);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create Trading Strategy
app.post('/api/strategies', authenticateToken, async (req, res) => {
  try {
    const { name, symbol, timeframe, script, levels } = req.body;

    const strategy = new Strategy({
      name,
      symbol,
      timeframe,
      script,
      levels,
      createdBy: req.user.userId
    });

    await strategy.save();
    await strategy.populate('createdBy', 'username');

    res.status(201).json(strategy);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Market Data
app.get('/api/market/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const marketData = await MarketData.findOne({ symbol: symbol.toUpperCase() })
      .sort({ timestamp: -1 });

    if (!marketData) {
      return res.status(404).json({ error: 'Market data not found' });
    }

    res.json(marketData);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Active Users
app.get('/api/users/active', authenticateToken, async (req, res) => {
  try {
    const users = await User.find({ 
      isActive: true,
      lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    })
    .select('username tier avatar lastLogin')
    .sort({ lastLogin: -1 })
    .limit(20);

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinTradingRoom', (userId) => {
    socket.join('trading-room');
    console.log(`User ${userId} joined trading room`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Mock market data updates (replace with real market data API)
cron.schedule('*/30 * * * * *', async () => {
  try {
    const symbols = ['SPY', 'QQQ', 'BTC', 'TSLA', 'AAPL'];
    
    for (const symbol of symbols) {
      const lastData = await MarketData.findOne({ symbol }).sort({ timestamp: -1 });
      const basePrice = lastData ? lastData.price : getRandomPrice(symbol);
      
      const change = (Math.random() - 0.5) * 2; // Random change between -1 and 1
      const newPrice = Math.max(0.01, basePrice + change);
      const changePercent = ((newPrice - basePrice) / basePrice) * 100;

      const marketData = new MarketData({
        symbol,
        price: Math.round(newPrice * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        volume: Math.floor(Math.random() * 1000000)
      });

      await marketData.save();
      
      // Emit to all connected clients
      io.to('trading-room').emit('marketUpdate', marketData);
    }
  } catch (error) {
    console.error('Market data update error:', error);
  }
});

function getRandomPrice(symbol) {
  const basePrices = {
    'SPY': 450,
    'QQQ': 380,
    'BTC': 45000,
    'TSLA': 250,
    'AAPL': 175
  };
  return basePrices[symbol] || 100;
}

// Create default admin user
async function createDefaultAdmin() {
  try {
    const adminExists = await User.findOne({ isAdmin: true });
    if (adminExists) return;

    const hashedPassword = await bcrypt.hash('admin123', 12);
    const admin = new User({
      username: 'admin',
      email: 'admin@cashflowops.pro',
      password: hashedPassword,
      tier: 'ADMIN',
      isAdmin: true,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face&facepad=2&bg=gray'
    });

    await admin.save();
    console.log('✅ Default admin user created');
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 RTi Trading Backend running on port ${PORT}`);
  createDefaultAdmin();
});

module.exports = app;