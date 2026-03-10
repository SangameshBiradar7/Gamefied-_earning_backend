const express = require('express');
const router = express.Router();
const { User, Grade, Subject, Lesson, UserMission } = require('../models');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Get analytics overview
router.get('/overview', auth, adminAuth, async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalGrades = await Grade.countDocuments({ isActive: true });
    const totalSubjects = await Subject.countDocuments({ isActive: true });
    const totalLessons = await Lesson.countDocuments({ isActive: true });

    // Active students in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeStudents = await User.countDocuments({
      role: 'student',
      'completedLessons.completedAt': { $gte: sevenDaysAgo }
    });

    // Active students in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyActiveStudents = await User.countDocuments({
      role: 'student',
      'completedLessons.completedAt': { $gte: thirtyDaysAgo }
    });

    // Average points
    const averagePoints = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: null, avgPoints: { $avg: '$points' } } }
    ]);

    // Total points earned
    const totalPoints = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: null, totalPoints: { $sum: '$points' } } }
    ]);

    res.json({
      totalStudents,
      totalGrades,
      totalSubjects,
      totalLessons,
      activeStudents,
      monthlyActiveStudents,
      averagePoints: averagePoints[0]?.avgPoints || 0,
      totalPoints: totalPoints[0]?.totalPoints || 0
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get grade statistics
router.get('/grades', auth, adminAuth, async (req, res) => {
  try {
    const grades = await Grade.find({ isActive: true }).sort({ order: 1 });
    const gradeStats = await Promise.all(grades.map(async (grade) => {
      const studentCount = await User.countDocuments({ role: 'student', grade: grade._id });
      const averagePoints = await User.aggregate([
        { $match: { role: 'student', grade: grade._id } },
        { $group: { _id: null, avgPoints: { $avg: '$points' } } }
      ]);
      
      return {
        grade: grade.displayName,
        studentCount,
        averagePoints: averagePoints[0]?.avgPoints || 0
      };
    }));

    res.json(gradeStats);
  } catch (error) {
    console.error('Error fetching grade analytics:', error);
    res.status(500).json({ error: 'Failed to fetch grade analytics' });
  }
});

// Get engagement statistics
router.get('/engagement', auth, adminAuth, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Daily activity for the last 30 days
    const dailyActivity = await User.aggregate([
      { $match: { role: 'student' } },
      { $unwind: '$completedLessons' },
      { $match: { 'completedLessons.completedAt': { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$completedLessons.completedAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Average streak
    const averageStreak = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: null, avgStreak: { $avg: '$streak.current' } } }
    ]);

    // Top performers
    const topPerformers = await User.find({ role: 'student' })
      .select('username points level completedLessons')
      .sort({ points: -1 })
      .limit(10);

    res.json({
      dailyActivity,
      averageStreak: averageStreak[0]?.avgStreak || 0,
      topPerformers
    });
  } catch (error) {
    console.error('Error fetching engagement analytics:', error);
    res.status(500).json({ error: 'Failed to fetch engagement analytics' });
  }
});

module.exports = router;
