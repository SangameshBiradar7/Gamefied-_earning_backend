const express = require('express');
const router = express.Router();
const { Mission, UserMission, User } = require('../models');
const auth = require('../middleware/auth');

// Get daily missions for current user
router.get('/daily', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get active daily missions
    const missions = await Mission.find({ type: 'daily', isActive: true });
    
    // Get user mission progress
    const userMissions = await UserMission.find({ 
      user: userId,
      startedAt: { $gte: today }
    });
    
    const missionProgress = missions.map(mission => {
      const progress = userMissions.find(um => um.mission.toString() === mission._id.toString());
      return {
        id: mission._id,
        title: mission.title,
        description: mission.description,
        type: mission.type,
        targetValue: mission.targetValue,
        pointsReward: mission.pointsReward,
        progress: progress ? progress.progress : 0,
        completed: progress ? progress.completed : false
      };
    });
    
    res.json(missionProgress);
  } catch (error) {
    console.error('Error fetching missions:', error);
    res.status(500).json({ error: 'Failed to fetch missions' });
  }
});

// Get weekly missions
router.get('/weekly', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get active weekly missions
    const missions = await Mission.find({ type: 'weekly', isActive: true });
    
    // Get user mission progress
    const userMissions = await UserMission.find({ 
      user: userId,
      startedAt: { $gte: today }
    });
    
    const missionProgress = missions.map(mission => {
      const progress = userMissions.find(um => um.mission.toString() === mission._id.toString());
      return {
        id: mission._id,
        title: mission.title,
        description: mission.description,
        type: mission.type,
        targetValue: mission.targetValue,
        pointsReward: mission.pointsReward,
        progress: progress ? progress.progress : 0,
        completed: progress ? progress.completed : false
      };
    });
    
    res.json(missionProgress);
  } catch (error) {
    console.error('Error fetching missions:', error);
    res.status(500).json({ error: 'Failed to fetch missions' });
  }
});

// Update mission progress
router.post('/update', auth, async (req, res) => {
  try {
    const { action, value } = req.body;
    const userId = req.user.userId;
    
    // Find missions that match the action
    const missions = await Mission.find({ action, isActive: true });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const results = [];
    
    for (const mission of missions) {
      // Find or create user mission
      let userMission = await UserMission.findOne({
        user: userId,
        mission: mission._id,
        startedAt: { $gte: today }
      });
      
      if (!userMission) {
        userMission = new UserMission({
          user: userId,
          mission: mission._id,
          progress: 0
        });
      }
      
      if (!userMission.completed) {
        // Update progress based on action
        if (action === 'complete_lesson' || action === 'score_quiz') {
          userMission.progress += value;
        } else if (action === 'maintain_streak' || action === 'earn_points') {
          userMission.progress = value;
        }
        
        // Check if completed
        if (userMission.progress >= mission.targetValue) {
          userMission.completed = true;
          userMission.completedAt = new Date();
          
          // Award points
          const user = await User.findById(userId);
          user.points += mission.pointsReward;
          await user.save();
          
          results.push({
            missionId: mission._id,
            completed: true,
            pointsAwarded: mission.pointsReward
          });
        }
        
        await userMission.save();
      }
    }
    
    res.json({ updated: results.length, results });
  } catch (error) {
    console.error('Error updating mission:', error);
    res.status(500).json({ error: 'Failed to update mission' });
  }
});

module.exports = router;
