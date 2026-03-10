const mongoose = require('mongoose');

const quizQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['multiple_choice', 'true_false'],
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

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  order: {
    type: Number,
    default: 0
  },
  // Video lecture - using URL for cloud storage
  videoUrl: {
    type: String,
    default: ''
  },
  // YouTube URL for video
  youtubeUrl: {
    type: String,
    default: ''
  },
  // YouTube video ID (extracted for embed)
  youtubeId: {
    type: String,
    default: ''
  },
  videoDuration: {
    type: Number,
    default: 0 // in seconds
  },
  // Lesson notes - can be text or URL to PDF
  notes: {
    type: String,
    default: ''
  },
  notesUrl: {
    type: String,
    default: ''
  },
  // Quiz questions
  quiz: [quizQuestionSchema],
  // Points for completing the lesson
  pointsReward: {
    type: Number,
    default: 50
  },
  quizPointsReward: {
    type: Number,
    default: 100
  },
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

lessonSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Lesson', lessonSchema);
