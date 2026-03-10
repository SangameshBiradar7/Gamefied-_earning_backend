const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const authRoutes = require('./routes/auth');
const gradeRoutes = require('./routes/grades');
const subjectRoutes = require('./routes/subjects');
const lessonRoutes = require('./routes/lessons');
const quizRoutes = require('./routes/quiz');
const userRoutes = require('./routes/users');
const badgeRoutes = require('./routes/badges');
const missionRoutes = require('./routes/missions');
const leaderboardRoutes = require('./routes/leaderboard');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');
const uploadRoutes = require('./routes/upload');

const { Badge } = require('./models');
const { Mission } = require('./models/Mission');
const { Grade } = require('./models');

// Initialize default grades
const initializeDefaultGrades = async () => {
  const defaultGrades = [
    { name: 'grade6', displayName: 'Grade 6', order: 1 },
    { name: 'grade7', displayName: 'Grade 7', order: 2 },
    { name: 'grade8', displayName: 'Grade 8', order: 3 },
    { name: 'grade9', displayName: 'Grade 9', order: 4 },
    { name: 'grade10', displayName: 'Grade 10', order: 5 }
  ];
  
  for (const grade of defaultGrades) {
    await Grade.findOneAndUpdate({ name: grade.name }, grade, { upsert: true, new: true });
  }
  console.log('Default grades initialized');
};

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/users', userRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Gamified Learning API is running' });
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gamified-learning';
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected successfully');
    
    // Initialize default grades
    try {
      await initializeDefaultGrades();
    } catch (error) {
      console.log('Grades may already exist');
    }
    
    // Initialize default badges and missions
    try {
      await Badge.initializeBadges();
      await Mission.initializeMissions();
      console.log('Default badges and missions initialized');
    } catch (error) {
      console.log('Badges and missions may already exist');
    }
    
    // Create default admin account if not exists
    const { User } = require('./models');
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const admin = new User({
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        points: 0
      });
      await admin.save();
      console.log('Default admin account created: admin / admin123');
    }
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    // Start server anyway for demo purposes
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} (without database)`);
    });
  });

module.exports = app;
