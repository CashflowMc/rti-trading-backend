const express = require('express');
const cors = require('cors');
const http = require('http');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// ✅ Allowed origin for CORS
const allowedOrigins = ['https://cashflowops.pro'];

// ✅ Apply proper CORS settings for Express
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT'],
  credentials: true,
}));

app.use(express.json());
app.use('/avatars', express.static(path.join(__dirname, 'avatars')));

// ✅ Set up Socket.IO with the same CORS origin
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT'],
    credentials: true
  }
});

// 🔒 Dummy users and alerts
const users = [
  { id: 1, username: 'testuser', password: 'password123', isAdmin: false, avatar: '' }
];
const alerts = [];

const JWT_SECRET = 'supersecret';

// 🔐 Auth Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);
  const token = authHeader.split(' ')[1];
  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch {
    res.sendStatus(403);
  }
}

// 🔐 Login Route
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token, user });
});

// 📢 Get Alerts (Auth required)
app.get('/api/alerts', authMiddleware, (req, res) => {
  res.json(alerts);
});

// 📢 Post New Alert (public)
app.post('/api/alerts', (req, res) => {
  const alert = {
    title: req.body.title,
    message: req.body.message,
    createdAt: new Date().toISOString()
  };
  alerts.unshift(alert);
  io.emit('alert', alert);
  res.json({ success: true });
});

// 🧑‍🎓 Update User Profile (Auth required)
app.put('/api/users/:id', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.username = req.body.username;
  user.isAdmin = req.body.isAdmin;
  res.json({ success: true });
});

// 🖼 Upload Avatar (Auth required)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './avatars'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

app.post('/api/users/:id/avatar', authMiddleware, upload.single('avatar'), (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.avatar = `/avatars/${req.file.filename}`;
  res.json({ avatarUrl: user.avatar });
});

// ✅ Start Server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
