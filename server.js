// server.js - RTi CashflowOps Backend Full Feature Version

import express from 'express';
import cors from 'cors';
import http from 'http';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['https://cashflowops.pro'],
    methods: ['GET', 'POST', 'PUT'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: (origin, cb) => !origin || ['https://cashflowops.pro'].includes(origin) ? cb(null, true) : cb(new Error('CORS Blocked')),
  credentials: true
}));
app.use(express.json());
app.use('/avatars', express.static(path.join(__dirname, 'avatars')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.set('trust proxy', 1); // Important for rate limiter on Railway

// Rate limiter
app.use('/api/', rateLimit({ windowMs: 60 * 1000, max: 60 }));

// In-memory data
const users = [
  { id: 1, username: 'testuser', password: 'password123', isAdmin: false, avatar: '', tier: 'FREE', bio: '', email: '', joinedAt: new Date().toISOString() },
  { id: 2, username: 'admin', password: 'admin123', isAdmin: true, avatar: '', tier: 'ADMIN', bio: '', email: '', joinedAt: new Date().toISOString() }
];
const alerts = [];
const chatMessages = [];
const announcements = [];
const JWT_SECRET = 'supersecret';

// Middleware for JWT auth
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.sendStatus(403);
  }
}

// Multer setup for avatar upload
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `avatar-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage: avatarStorage });

// ======== ROUTES ========

// Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token, user });
});

// Alerts
app.get('/api/alerts', authMiddleware, (req, res) => res.json(alerts));
app.post('/api/alerts', authMiddleware, (req, res) => {
  const alert = { ...req.body, createdAt: new Date().toISOString() };
  alerts.unshift(alert);
  io.emit('alert', alert);
  res.json({ success: true });
});

// Chat
app.post('/api/chat', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  const message = {
    id: Date.now(),
    user: { id: user.id, username: user.username, avatar: user.avatar, tier: user.tier, isAdmin: user.isAdmin },
    message: req.body.message,
    timestamp: new Date().toISOString()
  };
  chatMessages.push(message);
  io.emit('chatMessage', message);
  res.json({ success: true });
});
app.get('/api/chat', authMiddleware, (req, res) => res.json(chatMessages.slice(-100)));

// Profile Update
app.post('/api/profile/update', authMiddleware, upload.single('avatar'), (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  const { username, bio } = req.body;
  if (username) user.username = username;
  if (bio) user.bio = bio;
  if (req.file) user.avatar = `/avatars/${req.file.filename}`;
  res.json(user);
});

// Market data
app.get('/api/market/:symbol', authMiddleware, async (req, res) => {
  try {
    const apiKey = process.env.FMP_API_KEY;
    const url = `https://financialmodelingprep.com/api/v3/quote/${req.params.symbol}?apikey=${apiKey}`;
    const { data } = await axios.get(url);
    res.json(data[0]);
  } catch {
    res.status(500).json({ error: 'Market API failed' });
  }
});

// Announcements
app.post('/api/announce', authMiddleware, (req, res) => {
  if (!req.user.isAdmin) return res.sendStatus(403);
  const msg = { id: Date.now(), message: req.body.message, createdAt: new Date().toISOString() };
  announcements.push(msg);
  io.emit('announcement', msg);
  res.json({ success: true });
});
app.get('/api/announce', authMiddleware, (req, res) => res.json(announcements.slice(-10)));

// AI Assistant
app.post('/api/ask', authMiddleware, async (req, res) => {
  try {
    const prompt = req.body.prompt;
    const openaiRes = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_KEY}` }
    });
    res.json(openaiRes.data);
  } catch (err) {
    res.status(500).json({ error: 'AI error' });
  }
});

// Premium content
app.get('/api/secure-data', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (user.tier === 'FREE') return res.status(403).json({ error: 'Upgrade required' });
  res.json({ secret: 'This is premium content for upgraded users!' });
});

// WebSocket Events
io.on('connection', (socket) => {
  console.log('Socket connected');
});

// Start Server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`✅ RTi Server running on port ${PORT}`));
