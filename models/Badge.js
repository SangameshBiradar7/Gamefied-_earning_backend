const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  badgeId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: 'trophy'
  },
  color: {
    type: String,
    default: '#FFD700'
  },
  category: {
    type: String,
    enum: ['lesson', 'quiz', 'streak', 'level', 'special'],
    default: 'special'
  },
  requirement: {
    type: Number,
    default: 1
  },
  pointsReward: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Predefined badges
const defaultBadges = [
  {
    badgeId: 'first_lesson',
    name: 'First Steps',
    description: 'Complete your first lesson',
    icon: 'star',
    color: '#4F46E5',
    category: 'lesson',
    requirement: 1,
    pointsReward: 50
  },
  {
    badgeId: 'five_lessons',
    name: 'Dedicated Learner',
    description: 'Complete 5 lessons',
    icon: 'book',
    color: '#10B981',
    category: 'lesson',
    requirement: 5,
    pointsReward: 100
  },
  {
    badgeId: 'ten_lessons',
    name: 'Knowledge Seeker',
    description: 'Complete 10 lessons',
    icon: 'graduation-cap',
    color: '#8B5CF6',
    category: 'lesson',
    requirement: 10,
    pointsReward: 200
  },
  {
    badgeId: 'quiz_champion',
    name: 'Quiz Champion',
    description: 'Score 100% in any quiz',
    icon: 'trophy',
    color: '#F59E0B',
    category: 'quiz',
    requirement: 100,
    pointsReward: 150
  },
  {
    badgeId: 'perfect_quiz',
    name: 'Perfect Score',
    description: 'Get perfect scores in 5 quizzes',
    icon: 'medal',
    color: '#EF4444',
    category: 'quiz',
    requirement: 5,
    pointsReward: 300
  },
  {
    badgeId: 'streak_3',
    name: 'Getting Started',
    description: 'Maintain a 3-day learning streak',
    icon: 'fire',
    color: '#F97316',
    category: 'streak',
    requirement: 3,
    pointsReward: 75
  },
  {
    badgeId: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day learning streak',
    icon: 'calendar-check',
    color: '#14B8A6',
    category: 'streak',
    requirement: 7,
    pointsReward: 200
  },
  {
    badgeId: 'streak_30',
    name: 'Monthly Master',
    description: 'Maintain a 30-day learning streak',
    icon: 'crown',
    color: '#FFD700',
    category: 'streak',
    requirement: 30,
    pointsReward: 1000
  },
  {
    badgeId: 'level_learner',
    name: 'Rising Star',
    description: 'Reach Learner level',
    icon: 'arrow-up',
    color: '#06B6D4',
    category: 'level',
    requirement: 500,
    pointsReward: 100
  },
  {
    badgeId: 'level_advanced',
    name: 'Advanced Learner',
    description: 'Reach Advanced level',
    icon: 'rocket',
    color: '#8B5CF6',
    category: 'level',
    requirement: 2000,
    pointsReward: 250
  },
  {
    badgeId: 'level_expert',
    name: 'Expert Scholar',
    description: 'Reach Expert level',
    icon: 'lightbulb',
    color: '#F59E0B',
    category: 'level',
    requirement: 5000,
    pointsReward: 500
  },
  {
    badgeId: 'level_master',
    name: 'Grand Master',
    description: 'Reach Master level',
    icon: 'crown',
    color: '#EF4444',
    category: 'level',
    requirement: 10000,
    pointsReward: 1000
  },
  {
    badgeId: 'subject_master_math',
    name: 'Math Wizard',
    description: 'Complete all Math lessons',
    icon: 'calculator',
    color: '#3B82F6',
    category: 'special',
    requirement: 1,
    pointsReward: 500
  },
  {
    badgeId: 'subject_master_science',
    name: 'Science Expert',
    description: 'Complete all Science lessons',
    icon: 'flask',
    color: '#10B981',
    category: 'special',
    requirement: 1,
    pointsReward: 500
  }
];

// Method to initialize default badges
badgeSchema.statics.initializeBadges = async function() {
  for (const badge of defaultBadges) {
    await this.findOneAndUpdate(
      { badgeId: badge.badgeId },
      badge,
      { upsert: true, new: true }
    );
  }
};

module.exports = mongoose.model('Badge', badgeSchema);
