const express = require('express');
const router = express.Router();
const { WeeklyTest, Grade, Subject, User } = require('../models');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Get all weekly tests (optionally by grade)
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const { gradeId, activeOnly = false } = req.query;
    const query = {};
    
    if (gradeId) {
      query.grade = gradeId;
    }
    if (activeOnly === 'true') {
      query.isActive = true;
      // Also filter by date if availableUntil is in future
      const now = new Date();
      query.$or = [
        { availableUntil: { $exists: false } },
        { availableUntil: { $gte: now } }
      ];
    }

    const tests = await WeeklyTest.find(query)
      .populate('grade', 'displayName')
      .populate('subject', 'displayName')
      .populate('assignedStudents', 'username')
      .sort({ createdAt: -1 });

    // Add submission counts
    const testsWithStats = await Promise.all(tests.map(async (test) => {
      const submissionCount = await User.countDocuments({
        'weeklyTestResults.testId': test._id
      });
      
      const avgScore = await User.aggregate([
        { $match: { 'weeklyTestResults.testId': test._id } },
        { $unwind: '$weeklyTestResults' },
        { $match: { 'weeklyTestResults.testId': test._id } },
        {
          $group: {
            _id: null,
            avgScore: { $avg: '$weeklyTestResults.score' },
            totalSubmissions: { $sum: 1 }
          }
        }
      ]);

      return {
        ...test.toObject(),
        submissionCount,
        averageScore: avgScore[0]?.avgScore || 0,
        totalSubmissions: avgScore[0]?.totalSubmissions || 0
      };
    }));

    res.json(testsWithStats);
  } catch (error) {
    console.error('Error fetching weekly tests:', error);
    res.status(500).json({ error: 'Failed to fetch weekly tests' });
  }
});

// Get single weekly test
router.get('/:id', auth, adminAuth, async (req, res) => {
  try {
    const test = await WeeklyTest.findById(req.params.id)
      .populate('grade', 'displayName')
      .populate('subject', 'displayName')
      .populate('assignedStudents', 'username grade');

    if (!test) {
      return res.status(404).json({ error: 'Weekly test not found' });
    }

    // Get submission details
    const submissions = await User.find({
      'weeklyTestResults.testId': test._id
    })
      .select('username grade')
      .populate('grade', 'displayName')
      .populate('weeklyTestResults');

    const submissionData = submissions.map(user => {
      const result = user.weeklyTestResults?.find(r => 
        r.testId.toString() === test._id.toString()
      );
      return {
        userId: user._id,
        username: user.username,
        grade: user.grade,
        score: result?.score || 0,
        completedAt: result?.completedAt || null,
        answers: result?.answers || []
      };
    });

    res.json({
      test,
      submissions: submissionData,
      totalSubmissions: submissionData.length
    });
  } catch (error) {
    console.error('Error fetching weekly test:', error);
    res.status(500).json({ error: 'Failed to fetch weekly test' });
  }
});

// Create weekly test
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      grade,
      subject,
      questions,
      timeLimit,
      pointsReward,
      maxScore,
      availableFrom,
      availableUntil,
      assignedStudents,
      isActive
    } = req.body;

    const weeklyTest = new WeeklyTest({
      title,
      description,
      grade,
      subject,
      questions: questions || [],
      timeLimit: timeLimit || 30,
      pointsReward: pointsReward || 100,
      maxScore: maxScore || 100,
      availableFrom: availableFrom ? new Date(availableFrom) : new Date(),
      availableUntil: availableUntil ? new Date(availableUntil) : null,
      assignedStudents: assignedStudents || [],
      isActive: isActive !== false
    });

    await weeklyTest.save();
    
    // If assignedStudents provided, ensure they can only take this specific test
    // This creates a special assignment logic

    res.status(201).json(weeklyTest);
  } catch (error) {
    console.error('Error creating weekly test:', error);
    res.status(500).json({ error: 'Failed to create weekly test: ' + error.message });
  }
});

// Update weekly test
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      grade,
      subject,
      questions,
      timeLimit,
      pointsReward,
      maxScore,
      availableFrom,
      availableUntil,
      assignedStudents,
      isActive
    } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (grade !== undefined) updateData.grade = grade;
    if (subject !== undefined) updateData.subject = subject;
    if (questions !== undefined) updateData.questions = questions;
    if (timeLimit !== undefined) updateData.timeLimit = timeLimit;
    if (pointsReward !== undefined) updateData.pointsReward = pointsReward;
    if (maxScore !== undefined) updateData.maxScore = maxScore;
    if (availableFrom !== undefined) updateData.availableFrom = new Date(availableFrom);
    if (availableUntil !== undefined) updateData.availableUntil = availableUntil ? new Date(availableUntil) : null;
    if (assignedStudents !== undefined) updateData.assignedStudents = assignedStudents;
    if (isActive !== undefined) updateData.isActive = isActive;

    const test = await WeeklyTest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('grade', 'displayName')
     .populate('subject', 'displayName');

    if (!test) {
      return res.status(404).json({ error: 'Weekly test not found' });
    }

    res.json(test);
  } catch (error) {
    console.error('Error updating weekly test:', error);
    res.status(500).json({ error: 'Failed to update weekly test' });
  }
});

// Delete weekly test (soft delete via isActive)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const test = await WeeklyTest.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!test) {
      return res.status(404).json({ error: 'Weekly test not found' });
    }

    res.json({ message: 'Weekly test deleted successfully' });
  } catch (error) {
    console.error('Error deleting weekly test:', error);
    res.status(500).json({ error: 'Failed to delete weekly test' });
  }
});

// Get test submissions/attempts
router.get('/:id/submissions', auth, adminAuth, async (req, res) => {
  try {
    const test = await WeeklyTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ error: 'Weekly test not found' });
    }

    const students = await User.find({
      'weeklyTestResults.testId': test._id
    })
      .select('username grade school village')
      .populate('grade', 'displayName');

    const submissions = await Promise.all(students.map(async (student) => {
      const result = student.weeklyTestResults?.find(r => 
        r.testId.toString() === test._id.toString()
      );
      return {
        userId: student._id,
        username: student.username,
        grade: student.grade,
        school: student.school,
        village: student.village,
        score: result?.score || 0,
        completedAt: result?.completedAt || null,
        timeTaken: result?.timeTaken || 0,
        answers: result?.answers || []
      };
    }));

    res.json({
      testId: test._id,
      testTitle: test.title,
      totalSubmissions: submissions.length,
      averageScore: submissions.length > 0 
        ? submissions.reduce((sum, s) => sum + s.score, 0) / submissions.length 
        : 0,
      submissions: submissions.sort((a, b) => b.score - a.score)
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Get available grades for test creation
router.get('/meta/grades', auth, adminAuth, async (req, res) => {
  try {
    const grades = await Grade.find({ isActive: true }).sort({ order: 1 });
    res.json(grades);
  } catch (error) {
    console.error('Error fetching grades:', error);
    res.status(500).json({ error: 'Failed to fetch grades' });
  }
});

// Get subjects for a grade
router.get('/meta/subjects/:gradeId', auth, adminAuth, async (req, res) => {
  try {
    const subjects = await Subject.find({ 
      grade: req.params.gradeId, 
      isActive: true 
    }).sort({ order: 1 });
    res.json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

module.exports = router;
