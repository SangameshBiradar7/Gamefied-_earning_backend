const mongoose = require('mongoose');

const missionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['daily', 'weekly', 'special'],
    default: 'daily'
  },
  requirement: {
    type: Number,
    required: true
  },
  action: {
    type: String,
    enum: ['complete_lesson', 'score_quiz', 'maintain_streak', 'earn_points'],
    required: true
  },
  targetValue: {
    type: Number,
    required: true
  },
  pointsReward: {
    type: Number,
    required: true
  },
  badgeReward: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// User mission progress
const userMissionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mission',
    required: true
  },
  progress: {
    type: Number,
    default: 0
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  startedAt: {
    type: Date,
    default: Date.now
  }
});

const Mission = mongoose.model('Mission', missionSchema);
const UserMission = mongoose.model('UserMission', userMissionSchema);

// Predefined missions
const defaultMissions = [
  {
    title: 'Daily Learner',
    description: 'Complete 1 lesson today',
    type: 'daily',
    requirement: 1,
    action: 'complete_lesson',
    targetValue: 1,
    pointsReward: 50
  },
  {
    title: 'Double Knowledge',
    description: 'Complete 2 lessons today',
    type: 'daily',
    requirement: 1,
    action: 'complete_lesson',
    targetValue: 2,
    pointsReward: 100
  },
  {
    title: 'Quiz Ace',
    description: 'Score above 80% in a quiz',
    type: 'daily',
    requirement: 1,
    action: 'score_quiz',
    targetValue: 80,
    pointsReward: 75
  },
  {
    title: 'Perfect Quiz',
    description: 'Get 100% in a quiz',
    type: 'daily',
    requirement: 1,
    action: 'score_quiz',
    targetValue: 100,
    pointsReward: 150
  },
  {
    title: 'Streak Starter',
    description: 'Maintain a 3-day streak',
    type: 'weekly',
    requirement: 1,
    action: 'maintain_streak',
    targetValue: 3,
    pointsReward: 100
  },
  {
    title: 'Point Collector',
    description: 'Earn 200 points today',
    type: 'daily',
    requirement: 1,
    action: 'earn_points',
    targetValue: 200,
    pointsReward: 50
  }
];

// Method to initialize default missions
missionSchema.statics.initializeMissions = async function() {
  for (const mission of defaultMissions) {
    await this.findOneAndUpdate(
      { title: mission.title },
      mission,
      { upsert: true, new: true }
    );
  }
};

module.exports = { Mission, UserMission };
