// 📁 RTI Trading Backend - server.js
// 🚀 Railway Production Server with Express + Socket.IO

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

// Get __dirname in ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// ✅ Allow frontend from Railway or localhost
app.use(cors({
  origin: [
    'https://cashflowops.pro',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🧪 Simple Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ===== Mock Data =====
let users = [
  { id: 1, username: 'admin', password: bcrypt.hashSync('admin123', 10), isAdmin: true },
  { id: 2, username: 'user', password: bcrypt.hashSync('user123', 10), isAdmin: false },
];

let alerts = [];
let marketData = { sp500: 4525, dowjones: 34700 };

// ===== Auth Middleware =====
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  next();
};

// ===== Routes =====
app.get('/api/test', (req, res) => {
  res.json({
    message: '✅ RTi Trading Backend is running!',
    timestamp: new Date().toISOString(),
    status: 'healthy',
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token, user: { id: user.id, username: user.username, isAdmin: user.isAdmin } });
});

app.get('/api/alerts', authenticateToken, (req, res) => {
  res.json(alerts);
});

app.post('/api/alerts', authenticateToken, requireAdmin, (req, res) => {
  const newAlert = { ...req.body, id: Date.now(), createdAt: new Date() };
  alerts.unshift(newAlert);
  io.emit('alert', newAlert);
  res.status(201).json({ message: 'Alert created', alert: newAlert });
});

app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
  res.json(users.map(({ password, ...u }) => u));
});

app.get('/api/market', (req, res) => {
  res.json(marketData);
});

app.put('/api/market', authenticateToken, requireAdmin, (req, res) => {
  marketData = { ...marketData, ...req.body };
  io.emit('market-update', marketData);
  res.json({ message: 'Market data updated', marketData });
});

// ===== Fallbacks and Error Handling =====
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error('🔥 Internal server error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ===== Socket.IO =====
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: ['https://cashflowops.pro', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.emit('alert', {
    _id: 'live',
    title: '🎉 Connected',
    message: 'You are now receiving live trading alerts!',
    type: 'INFO',
    priority: 'LOW',
    createdAt: new Date(),
  });

  socket.on('disconnect', () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// ===== Start Server =====
server.listen(PORT, () => {
  console.log(`🚀 Server live on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/test`);
});
