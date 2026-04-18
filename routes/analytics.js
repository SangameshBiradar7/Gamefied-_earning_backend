const express = require('express');
const router = express.Router();
const { User, Grade, Subject, Lesson, UserMission } = require('../models');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// ============ A. LEVEL ANALYTICS ============

// Get student distribution by level (for bar/pie/line charts)
router.get('/level-distribution', auth, adminAuth, async (req, res) => {
  try {
    const levels = ['Beginner', 'Learner', 'Advanced', 'Expert', 'Master'];
    const distribution = await Promise.all(levels.map(async (level) => {
      const count = await User.countDocuments({ role: 'student', level });
      return { level, count };
    }));

    // Also get cumulative data for line graph (over time - last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const levelTrend = await User.aggregate([
      { $match: { role: 'student', createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            level: '$level'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$$_id.level',
          data: {
            $push: {
              date: '$_id.date',
              count: '$count'
            }
          }
        }
      }
    ]);

    res.json({
      distribution,
      trend: levelTrend
    });
  } catch (error) {
    console.error('Error fetching level distribution:', error);
    res.status(500).json({ error: 'Failed to fetch level distribution' });
  }
});

// ============ B. PERFORMANCE ANALYTICS ============

// Get highest scoring students
router.get('/top-students', auth, adminAuth, async (req, res) => {
  try {
    const { limit = 10, gradeId } = req.query;
    const query = { role: 'student' };
    if (gradeId) query.grade = gradeId;

    const topStudents = await User.find(query)
      .select('username points level grade school village completedLessons streak')
      .populate('grade', 'displayName')
      .sort({ points: -1 })
      .limit(parseInt(limit));

    res.json(topStudents);
  } catch (error) {
    console.error('Error fetching top students:', error);
    res.status(500).json({ error: 'Failed to fetch top students' });
  }
});

// Get lowest performing students
router.get('/lowest-students', auth, adminAuth, async (req, res) => {
  try {
    const { limit = 10, gradeId } = req.query;
    const query = { role: 'student' };
    if (gradeId) query.grade = gradeId;

    const lowestStudents = await User.find(query)
      .select('username points level grade school village completedLessons lastLogin')
      .populate('grade', 'displayName')
      .sort({ points: 1, createdAt: -1 })
      .limit(parseInt(limit));

    res.json(lowestStudents);
  } catch (error) {
    console.error('Error fetching lowest students:', error);
    res.status(500).json({ error: 'Failed to fetch lowest students' });
  }
});

// Get students with longest streaks
router.get('/top-streaks', auth, adminAuth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const topStreaks = await User.find({ role: 'student' })
      .select('username streak points level grade')
      .populate('grade', 'displayName')
      .sort({ 'streak.current': -1 })
      .limit(parseInt(limit));

    res.json(topStreaks);
  } catch (error) {
    console.error('Error fetching top streaks:', error);
    res.status(500).json({ error: 'Failed to fetch top streaks' });
  }
});

// Get students with zero activity (no lessons completed)
router.get('/inactive-students', auth, adminAuth, async (req, res) => {
  try {
    const { limit = 20, days = 7 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const inactiveStudents = await User.find({
      role: 'student',
      $or: [
        { completedLessons: { $exists: false, $size: 0 } },
        { completedLessons: { $eq: [] } }
      ]
    })
      .select('username grade school village createdAt points')
      .populate('grade', 'displayName')
      .limit(parseInt(limit));

    // Also students who haven't logged in recently
    const noRecentActivity = await User.find({
      role: 'student',
      $or: [
        { lastLogin: { $lt: cutoffDate } },
        { lastLogin: { $exists: false } }
      ]
    })
      .select('username grade school village lastLogin points')
      .populate('grade', 'displayName')
      .limit(parseInt(limit));

    res.json({
      neverActive: inactiveStudents,
      noRecentActivity,
      cutoffDate
    });
  } catch (error) {
    console.error('Error fetching inactive students:', error);
    res.status(500).json({ error: 'Failed to fetch inactive students' });
  }
});

// Get most active students (by lessons completed)
router.get('/most-active', auth, adminAuth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const activeStudents = await User.find({ role: 'student' })
      .select('username completedLessons points streak grade')
      .populate('grade', 'displayName')
      .sort({ 'completedLessons.length': -1 })
      .limit(parseInt(limit));

    res.json(activeStudents);
  } catch (error) {
    console.error('Error fetching most active students:', error);
    res.status(500).json({ error: 'Failed to fetch most active students' });
  }
});

// Grade-wise performance
router.get('/grade-performance', auth, adminAuth, async (req, res) => {
  try {
    const grades = await Grade.find({ isActive: true }).sort({ order: 1 });
    const gradePerformance = await Promise.all(grades.map(async (grade) => {
      const students = await User.find({ role: 'student', grade: grade._id });
      const totalStudents = students.length;
      const avgPoints = students.reduce((sum, s) => sum + s.points, 0) / (totalStudents || 1);
      const avgStreak = students.reduce((sum, s) => sum + (s.streak?.current || 0), 0) / (totalStudents || 1);
      const totalLessons = students.reduce((sum, s) => sum + (s.completedLessons?.length || 0), 0);

      return {
        gradeId: grade._id,
        gradeName: grade.displayName,
        totalStudents,
        avgPoints: Math.round(avgPoints),
        avgStreak: Math.round(avgStreak * 10) / 10,
        totalCompletedLessons: totalLessons
      };
    }));

    res.json(gradePerformance);
  } catch (error) {
    console.error('Error fetching grade performance:', error);
    res.status(500).json({ error: 'Failed to fetch grade performance' });
  }
});

// Subject-wise performance
router.get('/subject-performance', auth, adminAuth, async (req, res) => {
  try {
    const subjects = await Subject.find({ isActive: true });
    const subjectPerformance = await Promise.all(subjects.map(async (subject) => {
      const lessons = await Lesson.find({ subject: subject._id, isActive: true });
      const totalLessons = lessons.length;

      // Count how many students completed each lesson
      let totalCompletions = 0;
      for (const lesson of lessons) {
        const completions = await User.countDocuments({
          'completedLessons.lessonId': lesson._id
        });
        totalCompletions += completions;
      }

      return {
        subjectId: subject._id,
        subjectName: subject.displayName,
        grade: subject.grade,
        totalLessons,
        totalCompletions,
        avgCompletionsPerLesson: totalLessons > 0 ? Math.round(totalCompletions / totalLessons) : 0
      };
    }));

    res.json(subjectPerformance);
  } catch (error) {
    console.error('Error fetching subject performance:', error);
    res.status(500).json({ error: 'Failed to fetch subject performance' });
  }
});

// ============ C. ACTIVITY TRACKING ============

// Daily active students tracker
router.get('/daily-activity', auth, adminAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Group by date
    const activity = await User.aggregate([
      { $match: { role: 'student', 'completedLessons.completedAt': { $gte: startDate } } },
      { $unwind: '$completedLessons' },
      { $match: { 'completedLessons.completedAt': { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$completedLessons.completedAt' }
          },
          count: { $sum: 1 },
          uniqueStudents: { $addToSet: '$_id' }
        }
      },
      {
        $project: {
          date: '$_id',
          count: 1,
          uniqueStudents: { $size: '$uniqueStudents' }
        }
      },
      { $sort: { date: 1 } }
    ]);

    res.json(activity);
  } catch (error) {
    console.error('Error fetching daily activity:', error);
    res.status(500).json({ error: 'Failed to fetch daily activity' });
  }
});

// Weekly engagement summary
router.get('/weekly-engagement', auth, adminAuth, async (req, res) => {
  try {
    const { weeks = 4 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (parseInt(weeks) * 7));

    const weeklyData = await User.aggregate([
      { $match: { role: 'student', 'completedLessons.completedAt': { $gte: startDate } } },
      { $unwind: '$completedLessons' },
      {
        $group: {
          _id: {
            year: { $year: '$completedLessons.completedAt' },
            week: { $week: '$completedLessons.completedAt' }
          },
          totalLessons: { $sum: 1 },
          uniqueStudents: { $addToSet: '$_id' },
          totalPoints: { $sum: 1 } // placeholder
        }
      },
      {
        $project: {
          weekNumber: '$_id.week',
          totalLessons: 1,
          uniqueStudents: { $size: '$uniqueStudents' }
        }
      },
      { $sort: { weekNumber: 1 } }
    ]);

    res.json(weeklyData);
  } catch (error) {
    console.error('Error fetching weekly engagement:', error);
    res.status(500).json({ error: 'Failed to fetch weekly engagement' });
  }
});

// Monthly progress report
router.get('/monthly-report', auth, adminAuth, async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year || new Date().getFullYear();

    const monthlyData = await User.aggregate([
      { $match: { role: 'student' } },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          totalPoints: { $sum: '$points' },
          avgPoints: { $avg: '$points' },
          totalCompletedLessons: { $sum: { $size: '$completedLessons' } },
          avgStreak: { $avg: '$streak.current' }
        }
      }
    ]);

    // Get new registrations per month
    const monthlyRegistrations = await User.aggregate([
      {
        $match: {
          role: 'student',
          createdAt: { $gte: new Date(currentYear, 0, 1) }
        }
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      yearlyStats: monthlyData[0] || {},
      monthlyRegistrations,
      year: currentYear
    });
  } catch (error) {
    console.error('Error fetching monthly report:', error);
    res.status(500).json({ error: 'Failed to fetch monthly report' });
  }
});

// ============ D. QUIZ ANALYTICS ============

// Quiz completion rate
router.get('/quiz-completion', auth, adminAuth, async (req, res) => {
  try {
    const totalLessons = await Lesson.countDocuments({ isActive: true });
    const lessonsWithQuiz = await Lesson.countDocuments({ isActive: true, quiz: { $exists: true, $ne: [] } });

    // Total quiz attempts
    const totalQuizAttempts = await User.aggregate([
      { $match: { role: 'student' } },
      { $unwind: '$quizResults' },
      { $count: 'attempts' }
    ]);

    // Average score across all quizzes
    const avgScore = await User.aggregate([
      { $match: { role: 'student', quizResults: { $exists: true, $ne: [] } } },
      { $unwind: '$quizResults' },
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$quizResults.score' },
          totalQuizzes: { $sum: 1 }
        }
      }
    ]);

    // Failed quizzes (< 50%)
    const failedQuizzes = await User.aggregate([
      { $match: { role: 'student' } },
      { $unwind: '$quizResults' },
      { $match: { 'quizResults.score': { $lt: 50 } } },
      { $count: 'failedCount' }
    ]);

    res.json({
      totalLessons,
      lessonsWithQuiz,
      totalQuizAttempts: totalQuizAttempts[0]?.attempts || 0,
      averageScore: Math.round(avgScore[0]?.avgScore || 0),
      totalQuizzes: avgScore[0]?.totalQuizzes || 0,
      failedQuizzes: failedQuizzes[0]?.failedCount || 0
    });
  } catch (error) {
    console.error('Error fetching quiz analytics:', error);
    res.status(500).json({ error: 'Failed to fetch quiz analytics' });
  }
});

// Top performers in quizzes
router.get('/top-quiz-performers', auth, adminAuth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topPerformers = await User.aggregate([
      { $match: { role: 'student', quizResults: { $exists: true, $ne: [] } } },
      {
        $addFields: {
          avgQuizScore: {
            $avg: '$quizResults.score'
          },
          perfectQuizzes: {
            $size: {
              $filter: {
                input: '$quizResults',
                as: 'qr',
                cond: { $eq: ['$$qr.score', 100] }
              }
            }
          },
          totalQuizzes: { $size: '$quizResults' }
        }
      },
      { $sort: { avgQuizScore: -1, perfectQuizzes: -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          username: 1,
          points: 1,
          level: 1,
          avgQuizScore: { $round: ['$avgQuizScore', 2] },
          perfectQuizzes: 1,
          totalQuizzes: 1,
          grade: 1
        }
      }
    ]);

    res.json(topPerformers);
  } catch (error) {
    console.error('Error fetching top quiz performers:', error);
    res.status(500).json({ error: 'Failed to fetch top quiz performers' });
  }
});

// ============ E. LOCATION ANALYTICS ============

// Village performance comparison
router.get('/village-analytics', auth, adminAuth, async (req, res) => {
  try {
    const villages = await User.distinct('village', { 
      role: 'student', 
      village: { $ne: '', $exists: true } 
    });

    const villageStats = await Promise.all(villages.map(async (village) => {
      const students = await User.find({ role: 'student', village });
      const totalStudents = students.length;
      const avgPoints = students.reduce((sum, s) => sum + s.points, 0) / (totalStudents || 1);
      const totalCompleted = students.reduce((sum, s) => sum + (s.completedLessons?.length || 0), 0);
      const avgStreak = students.reduce((sum, s) => sum + (s.streak?.current || 0), 0) / (totalStudents || 1);

      return {
        village,
        totalStudents,
        avgPoints: Math.round(avgPoints),
        totalCompletedLessons: totalCompleted,
        avgStreak: Math.round(avgStreak * 10) / 10
      };
    }));

    res.json(villageStats.sort((a, b) => b.avgPoints - a.avgPoints));
  } catch (error) {
    console.error('Error fetching village analytics:', error);
    res.status(500).json({ error: 'Failed to fetch village analytics' });
  }
});

// School performance comparison
router.get('/school-analytics', auth, adminAuth, async (req, res) => {
  try {
    const schools = await User.distinct('school', { 
      role: 'student', 
      school: { $ne: '', $exists: true } 
    });

    const schoolStats = await Promise.all(schools.map(async (school) => {
      const students = await User.find({ role: 'student', school });
      const totalStudents = students.length;
      const avgPoints = students.reduce((sum, s) => sum + s.points, 0) / (totalStudents || 1);
      const totalCompleted = students.reduce((sum, s) => sum + (s.completedLessons?.length || 0), 0);
      const avgStreak = students.reduce((sum, s) => sum + (s.streak?.current || 0), 0) / (totalStudents || 1);

      return {
        school,
        totalStudents,
        avgPoints: Math.round(avgPoints),
        totalCompletedLessons: totalCompleted,
        avgStreak: Math.round(avgStreak * 10) / 10
      };
    }));

    res.json(schoolStats.sort((a, b) => b.avgPoints - a.avgPoints));
  } catch (error) {
    console.error('Error fetching school analytics:', error);
    res.status(500).json({ error: 'Failed to fetch school analytics' });
  }
});

// ============ F. ATTENTION/GUIDANCE SYSTEM ============

// Students needing attention (at-risk)
router.get('/attention-needed', auth, adminAuth, async (req, res) => {
  try {
    const { threshold = 3 } = req.query; // days of inactivity
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(threshold));

    const atRiskStudents = await Promise.all([
      // Students inactive for many days
      User.find({
        role: 'student',
        $or: [
          { lastLogin: { $lt: cutoffDate } },
          { lastLogin: { $exists: false } }
        ]
      })
      .select('username grade school village lastLogin streak points completedLessons')
      .populate('grade', 'displayName')
      .limit(50),

      // Students with consistently low quiz scores (< 50%)
      User.aggregate([
        { $match: { role: 'student', quizResults: { $exists: true, $ne: [] } } },
        { $unwind: '$quizResults' },
        {
          $group: {
            _id: '$_id',
            username: { $first: '$username' },
            avgScore: { $avg: '$quizResults.score' },
            failedQuizzes: {
              $sum: {
                $cond: [{ $lt: ['$quizResults.score', 50] }, 1, 0]
              }
            },
            totalQuizzes: { $sum: 1 }
          }
        },
        { $match: { avgScore: { $lt: 50 } } },
        { $sort: { avgScore: 1 } },
        { $limit: 20 }
      ]),

      // Students losing streaks (had streak but now dropping)
      User.find({
        role: 'student',
        'streak.current': { $lt: 3 },
        'streak.longest': { $gte: 3 }
      })
      .select('username streak points grade')
      .populate('grade', 'displayName')
      .limit(20),

      // Students with zero lessons completed but registered > 7 days ago
      User.find({
        role: 'student',
        completedLessons: { $exists: false, $size: 0 },
        createdAt: { $lt: cutoffDate }
      })
      .select('username grade createdAt points')
      .populate('grade', 'displayName')
      .limit(20)
    ]);

    res.json({
      inactive: atRiskStudents[0],
      lowPerformers: atRiskStudents[1],
      lostStreaks: atRiskStudents[2],
      neverStarted: atRiskStudents[3],
      recommendations: generateRecommendations(atRiskStudents)
    });
  } catch (error) {
    console.error('Error fetching attention data:', error);
    res.status(500).json({ error: 'Failed to fetch attention data' });
  }
});

// Helper function to generate recommendations
function generateRecommendations(atRiskStudents) {
  const recommendations = [];
  
  atRiskStudents[0]?.forEach(student => {
    recommendations.push({
      studentId: student._id,
      username: student.username,
      type: 'INACTIVE',
      issue: `Inactive for ${Math.floor((Date.now() - new Date(student.lastLogin || student.createdAt)) / (1000 * 60 * 60 * 24))} days`,
      action: 'Send reminder notification'
    });
  });

  atRiskStudents[1]?.forEach(student => {
    recommendations.push({
      studentId: student._id,
      username: student.username,
      type: 'LOW_SCORES',
      issue: `Average score: ${student.avgScore}% across ${student.totalQuizzes} quizzes`,
      action: 'Suggest easier lessons or review material'
    });
  });

  return recommendations;
}

// ============ UPDATED OVERVIEW WITH MORE METRICS ============

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

    // New registrations today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newToday = await User.countDocuments({
      role: 'student',
      createdAt: { $gte: today }
    });

    // Students with perfect streaks (>= 7 days)
    const perfectStreaks = await User.countDocuments({
      role: 'student',
      'streak.current': { $gte: 7 }
    });

    // Lessons completed today
    const lessonsToday = await User.aggregate([
      { $unwind: '$completedLessons' },
      {
        $match: {
          'completedLessons.completedAt': { $gte: today }
        }
      },
      { $count: 'count' }
    ]);

    res.json({
      totalStudents,
      totalGrades,
      totalSubjects,
      totalLessons,
      activeStudents,
      newToday,
      perfectStreaks: perfectStreaks,
      lessonsToday: lessonsToday[0]?.count || 0,
      averagePoints: Math.round(averagePoints[0]?.avgPoints || 0),
      totalPoints: totalPoints[0]?.totalPoints || 0
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
