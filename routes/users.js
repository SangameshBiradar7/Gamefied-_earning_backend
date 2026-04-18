const express = require('express');
const router = express.Router();
const { User, Grade, Subject, Lesson } = require('../models');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Get all students (admin only)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const { role } = req.query;
    const query = {};
    if (role) {
      query.role = role;
    }

    const students = await User.find(query)
      .select('-password')
      .populate('grade', 'name displayName')
      .sort({ createdAt: -1 });
    
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password')
      .populate('grade', 'name displayName');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get completed lesson details with full progress
    const completedLessonsWithDetails = user.completedLessons.map(cl => {
      const lesson = cl.lessonId ? 
        typeof cl.lessonId === 'object' ? cl.lessonId : null : null;
      return {
        id: cl.lessonId ? 
          (typeof cl.lessonId === 'object' ? cl.lessonId._id : cl.lessonId) : null,
        title: lesson ? lesson.title : 'Lesson',
        subject: lesson ? lesson.subject : null,
        videoCompleted: cl.videoCompleted || false,
        videoWatchedPercent: cl.videoWatchedPercent || 0,
        quizCompleted: cl.quizCompleted || false,
        completedAt: cl.completedAt
      };
    });

    res.json({
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        grade: user.grade,
        points: user.points,
        level: user.level,
        streak: user.streak,
        badges: user.badges,
        completedLessons: completedLessonsWithDetails,
        quizResults: user.quizResults
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user grade (used by students after registration)
router.put('/grade', auth, async (req, res) => {
  try {
    const { gradeId } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.grade = gradeId || null;
    await user.save();

    const updatedUser = await User.findById(userId).populate('grade', 'name displayName');
    
    res.json({ 
      message: 'Grade updated successfully',
      grade: updatedUser.grade
    });
  } catch (error) {
    console.error('Error updating grade:', error);
    res.status(500).json({ error: 'Failed to update grade' });
  }
});

// Get user progress for a subject
router.get('/progress/:subjectId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const subject = await Subject.findById(req.params.subjectId);
    
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    const lessons = await Lesson.find({ subject: subject._id, isActive: true });
    const completedLessonIds = user.completedLessons.map(l => l.lessonId.toString());
    
    const progress = {
      totalLessons: lessons.length,
      completedLessons: lessons.filter(l => completedLessonIds.includes(l._id.toString())).length,
      lessons: lessons.map(l => ({
        id: l._id,
        title: l.title,
        completed: completedLessonIds.includes(l._id.toString())
      }))
    };

    res.json(progress);
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

module.exports = router;