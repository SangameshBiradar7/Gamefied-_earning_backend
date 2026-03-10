const express = require('express');
const router = express.Router();
const { User, Grade } = require('../models');

// Get leaderboard - top students by points
router.get('/points', async (req, res) => {
  try {
    const { limit = 10, gradeId, school, village } = req.query;
    
    const query = { role: 'student' };
    
    // Apply filters
    if (gradeId) {
      query.grade = gradeId;
    }
    if (school) {
      query.school = { $regex: school, $options: 'i' };
    }
    if (village) {
      query.village = { $regex: village, $options: 'i' };
    }
    
    const students = await User.find(query)
      .select('username points level grade school village')
      .populate('grade', 'displayName')
      .sort({ points: -1 })
      .limit(parseInt(limit));

    res.json(students);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get leaderboard - top students by streak
router.get('/streaks', async (req, res) => {
  try {
    const { limit = 10, gradeId, school, village } = req.query;
    
    const query = { role: 'student' };
    
    // Apply filters
    if (gradeId) {
      query.grade = gradeId;
    }
    if (school) {
      query.school = { $regex: school, $options: 'i' };
    }
    if (village) {
      query.village = { $regex: village, $options: 'i' };
    }
    
    const students = await User.find(query)
      .select('username streak level grade school village')
      .populate('grade', 'displayName')
      .sort({ 'streak.current': -1 })
      .limit(parseInt(limit));

    res.json(students);
  } catch (error) {
    console.error('Error fetching streak leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch streak leaderboard' });
  }
});

// Get leaderboard - top students by grade
router.get('/grade/:gradeId', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const students = await User.find({ role: 'student', grade: req.params.gradeId })
      .select('username points level')
      .sort({ points: -1 })
      .limit(parseInt(limit));

    const grade = await Grade.findById(req.params.gradeId);
    res.json({ grade, students });
  } catch (error) {
    console.error('Error fetching grade leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch grade leaderboard' });
  }
});

// Get overall leaderboard with all categories
router.get('/', async (req, res) => {
  try {
    const { limit = 10, gradeId, school, village } = req.query;
    const numLimit = parseInt(limit);
    
    const query = { role: 'student' };
    
    // Apply filters
    if (gradeId) {
      query.grade = gradeId;
    }
    if (school) {
      query.school = { $regex: school, $options: 'i' };
    }
    if (village) {
      query.village = { $regex: village, $options: 'i' };
    }

    // Top by points
    const topPoints = await User.find(query)
      .select('username points level grade school village')
      .populate('grade', 'displayName')
      .sort({ points: -1 })
      .limit(numLimit);

    // Top by streak
    const topStreaks = await User.find(query)
      .select('username streak level grade school village')
      .populate('grade', 'displayName')
      .sort({ 'streak.current': -1 })
      .limit(numLimit);

    // Top performers this week (based on quiz results)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const topThisWeek = await User.find({ 
      role: 'student',
      'quizResults.completedAt': { $gte: oneWeekAgo }
    })
      .select('username points level quizResults')
      .limit(numLimit);

    res.json({
      topPoints,
      topStreaks,
      topThisWeek
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get unique schools and villages for filter dropdowns
router.get('/filters', async (req, res) => {
  try {
    const schools = await User.distinct('school', { role: 'student', school: { $ne: '', $exists: true } });
    const villages = await User.distinct('village', { role: 'student', village: { $ne: '', $exists: true } });
    const grades = await Grade.find({ isActive: true }).sort({ order: 1 });
    
    res.json({
      schools: schools.filter(s => s),
      villages: villages.filter(v => v),
      grades
    });
  } catch (error) {
    console.error('Error fetching filters:', error);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

module.exports = router;
