// 📁 FILE: server.js (Railway Backend)
// ✅ CLEAN NODE.JS SERVER - NO HTML/JSX ALLOWED

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES6 module setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// CORS Configuration
app.use(cors({
    origin: [
        'https://cashflowops.pro',
        'http://localhost:3000',
        'http://localhost:8080',
        'http://127.0.0.1:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ===== MOCK DATABASE =====
// In production, replace with real database (MongoDB, PostgreSQL, etc.)
let users = [
    {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: password
        tier: 'ADMIN',
        isAdmin: true,
        avatar: 'https://ui-avatars.com/api/?background=dc2626&color=fff&name=Admin',
        createdAt: new Date(),
        lastActive: new Date()
    },
    {
        id: 2,
        username: 'testuser',
        email: 'test@example.com',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: password
        tier: 'MONTHLY',
        isAdmin: false,
        avatar: 'https://ui-avatars.com/api/?background=22c55e&color=fff&name=Test',
        createdAt: new Date(),
        lastActive: new Date()
    }
];

let alerts = [
    {
        _id: '1',
        title: 'BTC Breaking Resistance',
        message: 'Bitcoin is approaching major resistance at $45,000. Watch for breakout confirmation.',
        type: 'BOT_SIGNAL',
        priority: 'HIGH',
        botName: 'TrendBot Pro',
        pnl: '+$2,450',
        createdAt: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    },
    {
        _id: '2', 
        title: 'Market Update',
        message: 'US markets showing strong bullish momentum ahead of Fed meeting.',
        type: 'MARKET_UPDATE',
        priority: 'MEDIUM',
        createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    },
    {
        _id: '3',
        title: 'ETH Signal Alert', 
        message: 'Ethereum forming ascending triangle pattern. Entry point: $2,100',
        type: 'BOT_SIGNAL',
        priority: 'HIGH',
        botName: 'Pattern Scanner',
        pnl: '+$1,200',
        createdAt: new Date(Date.now() - 1000 * 60 * 45), // 45 minutes ago
    }
];

let marketData = {
    BTC: {
        price: 43250.00,
        change: 1250.50,
        changePercent: 2.98
    },
    ETH: {
        price: 2089.75,
        change: -45.25,
        changePercent: -2.12
    },
    SPY: {
        price: 445.20,
        change: 3.80,
        changePercent: 0.86
    },
    QQQ: {
        price: 378.90,
        change: -2.10,
        changePercent: -0.55
    }
};

// ===== MIDDLEWARE =====

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
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

// ===== API ROUTES =====

// Health check
app.get('/api/test', (req, res) => {
    res.json({
        message: 'RTi Trading Backend is running!',
        timestamp: new Date().toISOString(),
        server: 'Railway Production',
        status: 'healthy'
    });
});

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
    res.json({
        message: 'CORS is working!',
        origin: req.headers.origin,
        timestamp: new Date().toISOString()
    });
});

// ===== AUTH ROUTES =====

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }

        // Check if user exists
        const existingUser = users.find(u => u.email === email || u.username === username);
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = {
            id: users.length + 1,
            username,
            email,
            password: hashedPassword,
            tier: 'FREE',
            isAdmin: false,
            avatar: `https://ui-avatars.com/api/?background=22c55e&color=fff&name=${encodeURIComponent(username)}`,
            createdAt: new Date(),
            lastActive: new Date()
        };

        users.push(newUser);

        // Generate token
        const token = jwt.sign(
            { 
                id: newUser.id, 
                username: newUser.username, 
                email: newUser.email,
                isAdmin: newUser.isAdmin,
                tier: newUser.tier
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Return user data (without password)
        const { password: _, ...userWithoutPassword } = newUser;
        
        res.status(201).json({
            token,
            user: userWithoutPassword,
            message: 'User registered successfully'
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, username, password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        if (!email && !username) {
            return res.status(400).json({ error: 'Email or username is required' });
        }

        // Find user
        const user = users.find(u => 
            u.email === email || u.username === username || u.email === username
        );

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last active
        user.lastActive = new Date();

        // Generate token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                email: user.email,
                isAdmin: user.isAdmin,
                tier: user.tier
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Return user data (without password)
        const { password: _, ...userWithoutPassword } = user;
        
        res.json({
            token,
            user: userWithoutPassword,
            message: 'Login successful'
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user profile
app.get('/api/auth/profile', authenticateToken, (req, res) => {
    try {
        const user = users.find(u => u.id === req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===== ALERTS ROUTES =====

// Get alerts
app.get('/api/alerts', authenticateToken, (req, res) => {
    try {
        const { type = 'ALL', page = 1, limit = 50 } = req.query;
        
        let filteredAlerts = alerts;
        
        if (type !== 'ALL') {
            filteredAlerts = alerts.filter(alert => alert.type === type);
        }

        // Sort by creation date (newest first)
        filteredAlerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Pagination
        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const endIndex = startIndex + parseInt(limit);
        const paginatedAlerts = filteredAlerts.slice(startIndex, endIndex);

        res.json({
            alerts: paginatedAlerts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: filteredAlerts.length,
                hasMore: endIndex < filteredAlerts.length
            }
        });

    } catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create alert (admin only)
app.post('/api/alerts', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { title, message, type, priority, botName, pnl } = req.body;

        if (!title || !message) {
            return res.status(400).json({ error: 'Title and message are required' });
        }

        const newAlert = {
            _id: (alerts.length + 1).toString(),
            title,
            message,
            type: type || 'NEWS',
            priority: priority || 'MEDIUM',
            botName: botName || null,
            pnl: pnl || null,
            createdAt: new Date()
        };

        alerts.unshift(newAlert);

        res.status(201).json({
            alert: newAlert,
            message: 'Alert created successfully'
        });

    } catch (error) {
        console.error('Create alert error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete alert (admin only)
app.delete('/api/alerts/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        
        const alertIndex = alerts.findIndex(alert => alert._id === id);
        if (alertIndex === -1) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        alerts.splice(alertIndex, 1);
        
        res.json({ message: 'Alert deleted successfully' });

    } catch (error) {
        console.error('Delete alert error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===== USER ROUTES =====

// Get active users
app.get('/api/users/active', authenticateToken, (req, res) => {
    try {
        // Return users who were active in the last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const activeUsers = users
            .filter(user => new Date(user.lastActive) > oneDayAgo)
            .map(user => ({
                id: user.id,
                username: user.username,
                tier: user.tier,
                avatar: user.avatar,
                lastActive: user.lastActive
            }));

        res.json(activeUsers);

    } catch (error) {
        console.error('Get active users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===== MARKET DATA ROUTES =====

// Get market data
app.get('/api/market/data', authenticateToken, (req, res) => {
    try {
        // Add some random fluctuation to simulate live data
        const updatedMarketData = { ...marketData };
        
        Object.keys(updatedMarketData).forEach(symbol => {
            const randomChange = (Math.random() - 0.5) * 10; // Random change between -5 and +5
            const currentPrice = updatedMarketData[symbol].price;
            const newPrice = currentPrice + randomChange;
            const change = newPrice - currentPrice;
            const changePercent = (change / currentPrice) * 100;
            
            updatedMarketData[symbol] = {
                price: parseFloat(newPrice.toFixed(2)),
                change: parseFloat(change.toFixed(2)),
                changePercent: parseFloat(changePercent.toFixed(2))
            };
        });

        marketData = updatedMarketData;
        res.json(marketData);

    } catch (error) {
        console.error('Get market data error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===== SUBSCRIPTION ROUTES =====

// Get subscription plans
app.get('/api/subscription/plans', (req, res) => {
    const plans = [
        {
            id: 'weekly',
            name: 'Weekly Access',
            price: 29.99,
            interval: 'week',
            features: [
                'Full trading group access',
                'Live alerts & signals',
                'Market analysis',
                'Direct trader support'
            ]
        },
        {
            id: 'monthly', 
            name: 'Monthly Access',
            price: 99.99,
            interval: 'month',
            popular: true,
            features: [
                'Full trading group access',
                'Live alerts & signals', 
                'Market analysis',
                'Direct trader support',
                'Exclusive webinars',
                'Priority support'
            ]
        }
    ];

    res.json(plans);
});

// Create checkout session (mock)
app.post('/api/subscription/create-checkout-session', authenticateToken, (req, res) => {
    try {
        const { priceId } = req.body;
        
        // Mock Stripe checkout session
        const sessionId = 'cs_' + Math.random().toString(36).substr(2, 9);
        
        res.json({
            sessionId,
            url: `https://checkout.stripe.com/pay/${sessionId}`,
            message: 'Checkout session created successfully'
        });

    } catch (error) {
        console.error('Create checkout session error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===== ERROR HANDLING =====

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ===== SERVER STARTUP =====

app.listen(PORT, () => {
    console.log(`🚀 RTi Trading Backend running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/test`);
    console.log(`👥 Mock users available: admin/password, testuser/password`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    process.exit(0);
});
