const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  password: {
    type: String,
    required: true,
    minlength: 4
  },
  role: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student'
  },
  // Student specific fields
  grade: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grade'
  },
  // School and Village for leaderboard filters
  school: {
    type: String,
    default: ''
  },
  village: {
    type: String,
    default: ''
  },
  points: {
    type: Number,
    default: 0
  },
  level: {
    type: String,
    enum: ['Beginner', 'Learner', 'Advanced', 'Expert', 'Master'],
    default: 'Beginner'
  },
  streak: {
    current: {
      type: Number,
      default: 0
    },
    lastActivityDate: {
      type: Date,
      default: null
    },
    longest: {
      type: Number,
      default: 0
    }
  },
  badges: [{
    badgeId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    earnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  completedLessons: [{
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson'
    },
    videoCompleted: {
      type: Boolean,
      default: false
    },
    videoWatchedPercent: {
      type: Number,
      default: 0
    },
    quizCompleted: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date,
      default: Date.now
    }
  }],
  quizResults: [{
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson'
    },
    score: Number,
    pointsEarned: Number,
    completedAt: {
      type: Date,
      default: Date.now
    }
  }],
  weeklyTestResults: [{
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WeeklyTest'
    },
    score: Number,
    timeTaken: Number, // in seconds
    answers: [{
      questionIndex: Number,
      selectedAnswer: String,
      isCorrect: Boolean,
      pointsEarned: Number
    }],
    completedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Calculate level based on points
userSchema.methods.calculateLevel = function() {
  const points = this.points;
  if (points >= 10000) return 'Master';
  if (points >= 5000) return 'Expert';
  if (points >= 2000) return 'Advanced';
  if (points >= 500) return 'Learner';
  return 'Beginner';
};

module.exports = mongoose.model('User', userSchema);
