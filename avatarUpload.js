// avatarUpload.js - Backend endpoint for handling profile photo uploads
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Configure multer for file upload handling
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/avatars';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: userId_timestamp.extension
    const userId = req.user.id;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${userId}_${timestamp}${ext}`);
  }
});

// File filter for image validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only allow 1 file
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// POST /api/users/avatar - Upload avatar endpoint
router.post('/users/avatar', authenticateToken, (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    try {
      // Handle multer errors
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size too large. Maximum 5MB allowed.' });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files. Only 1 file allowed.' });
          }
        }
        return res.status(400).json({ error: err.message });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const userId = req.user.id;
      const filename = req.file.filename;
      
      // Generate the URL for the uploaded file
      const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${filename}`;

      // Update user's avatar in database
      // Replace this with your actual database update logic
      await updateUserAvatar(userId, avatarUrl);

      // Delete old avatar file if it exists (optional cleanup)
      // await deleteOldAvatar(userId);

      console.log(`✅ Avatar uploaded successfully for user ${userId}: ${filename}`);

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        avatarUrl: avatarUrl,
        filename: filename
      });

    } catch (error) {
      console.error('❌ Avatar upload error:', error);
      
      // Clean up uploaded file if database update fails
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({ 
        error: 'Failed to upload avatar',
        details: error.message
      });
    }
  });
});

// Serve uploaded files statically
router.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database update function (replace with your actual implementation)
async function updateUserAvatar(userId, avatarUrl) {
  // Example with MongoDB/Mongoose:
  /*
  const User = require('./models/User');
  await User.findByIdAndUpdate(userId, { avatar: avatarUrl });
  */
  
  // Example with PostgreSQL/MySQL:
  /*
  const db = require('./database');
  await db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, userId]);
  */
  
  // Example with your existing user management system:
  /*
  const user = await getUserById(userId);
  user.avatar = avatarUrl;
  await saveUser(user);
  */
  
  console.log(`📝 Updated avatar for user ${userId}: ${avatarUrl}`);
}

// Optional: Clean up old avatar files
async function deleteOldAvatar(userId) {
  try {
    // Get user's current avatar to delete old file
    const user = await getUserById(userId);
    if (user.avatar && user.avatar.includes('/uploads/avatars/')) {
      const oldFilename = path.basename(user.avatar);
      const oldFilePath = path.join(__dirname, 'uploads/avatars', oldFilename);
      
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
        console.log(`🗑️ Deleted old avatar: ${oldFilename}`);
      }
    }
  } catch (error) {
    console.error('⚠️ Error deleting old avatar:', error);
    // Don't throw error here, as it's not critical
  }
}

module.exports = router;
