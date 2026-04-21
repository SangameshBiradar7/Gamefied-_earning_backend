const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['multiple_choice', 'true_false', 'short_answer'],
    default: 'multiple_choice'
  },
  options: [{
    type: String
  }],
  correctAnswer: {
    type: String,
    required: true
  },
  points: {
    type: Number,
    default: 10
  }
}, { _id: true });

const weeklyTestSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  weekNumber: {
    type: Number,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  grade: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grade',
    required: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  },
  questions: [questionSchema],
  timeLimit: {
    type: Number,
    default: 30
  },
  pointsReward: {
    type: Number,
    default: 100
  },
  maxScore: {
    type: Number,
    default: 100
  },
  passingScore: {
    type: Number,
    default: 50
  },
  availableFrom: {
    type: Date,
    default: Date.now
  },
  availableUntil: {
    type: Date
  },
  assignedStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

weeklyTestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('WeeklyTest', weeklyTestSchema);
