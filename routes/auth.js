const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User, Grade } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'gamified-learning-secret-key-2024';

// Register new student
router.post('/register', async (req, res) => {
  try {
    const { username, password, gradeId } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create new user
    const user = new User({
      username,
      password,
      role: 'student',
      grade: gradeId || null,
      points: 0,
      level: 'Beginner'
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        grade: user.grade,
        points: user.points,
        level: user.level
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Get grade info if student
    let gradeInfo = null;
    if (user.role === 'student' && user.grade) {
      gradeInfo = await Grade.findById(user.grade);
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        grade: gradeInfo,
        points: user.points,
        level: user.level,
        streak: user.streak,
        badges: user.badges
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    let gradeInfo = null;
    if (user.grade) {
      gradeInfo = await Grade.findById(user.grade);
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        grade: gradeInfo,
        points: user.points,
        level: user.level,
        streak: user.streak,
        badges: user.badges
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
