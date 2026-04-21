const express = require('express');
const router = express.Router();
const { User, Grade, Subject, Lesson, WeeklyTest } = require('../models');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Admin dashboard overview
router.get('/dashboard', auth, adminAuth, async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    
    // Active students (who completed at least one lesson in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeStudents = await User.countDocuments({
      role: 'student',
      'completedLessons.completedAt': { $gte: sevenDaysAgo }
    });
    
    // Get grades with student counts
    const grades = await Grade.find({ isActive: true });
    const gradeStats = await Promise.all(grades.map(async (grade) => {
      const studentCount = await User.countDocuments({ role: 'student', grade: grade._id });
      return {
        grade: grade,
        studentCount
      };
    }));
    
    // Top performing students
    const topStudents = await User.find({ role: 'student' })
      .select('username points level')
      .sort({ points: -1 })
      .limit(5);
    
    // Students with longest streaks
    const topStreaks = await User.find({ role: 'student' })
      .select('username streak')
      .sort({ 'streak.current': -1 })
      .limit(5);
    
    res.json({
      totalStudents,
      activeStudents,
      gradeStats,
      topStudents,
      topStreaks
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// ============ GRADE MANAGEMENT ============

// Get all grades
router.get('/grades', auth, adminAuth, async (req, res) => {
  try {
    const grades = await Grade.find().sort({ order: 1 });
    const gradesWithCount = await Promise.all(grades.map(async (grade) => {
      const studentCount = await User.countDocuments({ role: 'student', grade: grade._id });
      const subjectCount = await Subject.countDocuments({ grade: grade._id, isActive: true });
      return { ...grade.toObject(), studentCount, subjectCount };
    }));
    res.json(gradesWithCount);
  } catch (error) {
    console.error('Error fetching grades:', error);
    res.status(500).json({ error: 'Failed to fetch grades' });
  }
});

// Create grade
router.post('/grades', auth, adminAuth, async (req, res) => {
  try {
    const { name, displayName, description, order } = req.body;
    const grade = new Grade({ name, displayName, description, order: order || 0 });
    await grade.save();
    res.status(201).json(grade);
  } catch (error) {
    console.error('Error creating grade:', error);
    res.status(500).json({ error: 'Failed to create grade' });
  }
});

// Update grade
router.put('/grades/:id', auth, adminAuth, async (req, res) => {
  try {
    const { name, displayName, description, order, isActive } = req.body;
    const grade = await Grade.findByIdAndUpdate(
      req.params.id,
      { name, displayName, description, order, isActive },
      { new: true }
    );
    if (!grade) return res.status(404).json({ error: 'Grade not found' });
    res.json(grade);
  } catch (error) {
    console.error('Error updating grade:', error);
    res.status(500).json({ error: 'Failed to update grade' });
  }
});

// Delete grade
router.delete('/grades/:id', auth, adminAuth, async (req, res) => {
  try {
    const grade = await Grade.findByIdAndDelete(req.params.id);
    if (!grade) return res.status(404).json({ error: 'Grade not found' });
    await Subject.deleteMany({ grade: req.params.id });
    res.json({ message: 'Grade deleted successfully' });
  } catch (error) {
    console.error('Error deleting grade:', error);
    res.status(500).json({ error: 'Failed to delete grade' });
  }
});

// ============ SUBJECT MANAGEMENT ============

// Get all subjects (optionally by grade)
router.get('/subjects', auth, adminAuth, async (req, res) => {
  try {
    const { gradeId } = req.query;
    const query = gradeId ? { grade: gradeId } : {};
    const subjects = await Subject.find(query).populate('grade', 'displayName').sort({ order: 1 });
    const subjectsWithCount = await Promise.all(subjects.map(async (subject) => {
      const lessonCount = await Lesson.countDocuments({ subject: subject._id, isActive: true });
      return { ...subject.toObject(), lessonCount };
    }));
    res.json(subjectsWithCount);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Create subject
router.post('/subjects', auth, adminAuth, async (req, res) => {
  try {
    const { name, displayName, description, grade, icon, color, order } = req.body;
    const subject = new Subject({ name, displayName, description, grade, icon, color, order: order || 0 });
    await subject.save();
    res.status(201).json(subject);
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

// Update subject
router.put('/subjects/:id', auth, adminAuth, async (req, res) => {
  try {
    const { name, displayName, description, icon, color, order, isActive } = req.body;
    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { name, displayName, description, icon, color, order, isActive },
      { new: true }
    );
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
    res.json(subject);
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ error: 'Failed to update subject' });
  }
});

// Delete subject
router.delete('/subjects/:id', auth, adminAuth, async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
    await Lesson.deleteMany({ subject: req.params.id });
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

// ============ LESSON MANAGEMENT ============

// Get all lessons (optionally by subject)
router.get('/lessons', auth, adminAuth, async (req, res) => {
  try {
    const { subjectId, page = 1, limit = 20 } = req.query;
    const query = subjectId ? { subject: subjectId } : {};
    const lessons = await Lesson.find(query)
      .populate('subject', 'displayName grade')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ order: 1 });
    const total = await Lesson.countDocuments(query);
    res.json({ lessons, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Error fetching lessons:', error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

// Create lesson
router.post('/lessons', auth, adminAuth, async (req, res) => {
  try {
    const { title, description, subject, order, videoUrl, notes, quiz, pointsReward, quizPointsReward } = req.body;
    const lesson = new Lesson({ title, description, subject, order: order || 0, videoUrl, notes, quiz, pointsReward, quizPointsReward });
    await lesson.save();
    res.status(201).json(lesson);
  } catch (error) {
    console.error('Error creating lesson:', error);
    res.status(500).json({ error: 'Failed to create lesson' });
  }
});

// Update lesson
router.put('/lessons/:id', auth, adminAuth, async (req, res) => {
  try {
    const { title, description, order, videoUrl, notes, quiz, pointsReward, quizPointsReward, isActive } = req.body;
    const lesson = await Lesson.findByIdAndUpdate(
      req.params.id,
      { title, description, order, videoUrl, notes, quiz, pointsReward, quizPointsReward, isActive },
      { new: true }
    );
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json(lesson);
  } catch (error) {
    console.error('Error updating lesson:', error);
    res.status(500).json({ error: 'Failed to update lesson' });
  }
});

// Delete lesson
router.delete('/lessons/:id', auth, adminAuth, async (req, res) => {
  try {
    const lesson = await Lesson.findByIdAndDelete(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json({ message: 'Lesson deleted successfully' });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    res.status(500).json({ error: 'Failed to delete lesson' });
  }
});

// ============ STUDENT MANAGEMENT ============

// Admin: Get all students
router.get('/students', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const query = { role: 'student' };
    
    if (search) {
      query.username = { $regex: search, $options: 'i' };
    }
    
    const students = await User.find(query)
      .select('-password')
      .populate('grade', 'name displayName')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await User.countDocuments(query);
    
    res.json({
      students,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Admin: Update student
router.put('/students/:id', auth, adminAuth, async (req, res) => {
  try {
    const { points, level, streak, badges } = req.body;
    const student = await User.findByIdAndUpdate(
      req.params.id,
      { points, level, streak, badges },
      { new: true }
    ).select('-password');
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json(student);
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Admin: Delete student
router.delete('/students/:id', auth, adminAuth, async (req, res) => {
  try {
    const student = await User.findByIdAndDelete(req.params.id);
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// Admin: Get all content (grades, subjects, lessons)
router.get('/content', auth, adminAuth, async (req, res) => {
  try {
    const grades = await Grade.find({ isActive: true }).sort({ order: 1 });
    
    const content = await Promise.all(grades.map(async (grade) => {
      const subjects = await Subject.find({ grade: grade._id, isActive: true }).sort({ order: 1 });
      const subjectData = await Promise.all(subjects.map(async (subject) => {
        const lessons = await Lesson.find({ subject: subject._id, isActive: true }).sort({ order: 1 });
        return {
          subject,
          lessons
        };
      }));
      
      return {
        grade,
        subjects: subjectData
      };
    }));
    
    res.json(content);
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

// Admin: Seed initial data
router.post('/seed', auth, adminAuth, async (req, res) => {
  try {
    // Create grades
    const grades = [
      { name: 'grade6', displayName: 'Grade 6', order: 1 },
      { name: 'grade7', displayName: 'Grade 7', order: 2 },
      { name: 'grade8', displayName: 'Grade 8', order: 3 },
      { name: 'grade9', displayName: 'Grade 9', order: 4 },
      { name: 'grade10', displayName: 'Grade 10', order: 5 }
    ];

    const createdGrades = await Promise.all(
      grades.map(g => Grade.findOneAndUpdate({ name: g.name }, g, { upsert: true, new: true }))
    );

    // Create subjects for each grade
    const subjectTemplates = [
      { name: 'mathematics', displayName: 'Mathematics', icon: 'calculator', color: '#3B82F6' },
      { name: 'science', displayName: 'Science', icon: 'flask', color: '#10B981' },
      { name: 'english', displayName: 'English', icon: 'book', color: '#8B5CF6' },
      { name: 'social_studies', displayName: 'Social Studies', icon: 'globe', color: '#F59E0B' }
    ];

    const subjects = [];
    for (const grade of createdGrades) {
      for (let i = 0; i < subjectTemplates.length; i++) {
        const subject = await Subject.findOneAndUpdate(
          { name: subjectTemplates[i].name, grade: grade._id },
          { ...subjectTemplates[i], grade: grade._id, order: i },
          { upsert: true, new: true }
        );
        subjects.push(subject);
      }
    }

    // Create sample lessons for Mathematics
    const mathSubject = subjects.find(s => s.name === 'mathematics');
    if (mathSubject) {
      const lessons = [
        {
          title: 'Introduction to Algebra',
          description: 'Learn the basics of algebraic expressions and variables',
          subject: mathSubject._id,
          order: 1,
          videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4',
          notes: 'Algebra uses letters to represent numbers. These letters are called variables. An algebraic expression is a mathematical phrase that can contain ordinary numbers, variables (like x or y) and operators (like add, subtract, multiply, and divide).',
          quiz: [
            {
              question: 'What is a variable in algebra?',
              type: 'multiple_choice',
              options: ['A fixed number', 'A letter that represents a number', 'A mathematical operator', 'A type of equation'],
              correctAnswer: 'A letter that represents a number',
              points: 10
            },
            {
              question: 'What is 2x + 5 when x = 3?',
              type: 'multiple_choice',
              options: ['10', '11', '12', '13'],
              correctAnswer: '11',
              points: 10
            },
            {
              question: 'Is x + 3 = 5 an algebraic expression?',
              type: 'true_false',
              options: ['True', 'False'],
              correctAnswer: 'False',
              points: 10
            }
          ],
          pointsReward: 50,
          quizPointsReward: 100
        },
        {
          title: 'Understanding Fractions',
          description: 'Learn about fractions and their operations',
          subject: mathSubject._id,
          order: 2,
          videoUrl: '',
          notes: 'A fraction represents a part of a whole. It consists of a numerator (top number) and a denominator (bottom number). For example, 3/4 means 3 parts out of 4 equal parts.',
          quiz: [
            {
              question: 'What is the numerator in 3/4?',
              type: 'multiple_choice',
              options: ['3', '4', '7', '1'],
              correctAnswer: '3',
              points: 10
            },
            {
              question: 'What is 1/2 + 1/4?',
              type: 'multiple_choice',
              options: ['1/4', '1/2', '3/4', '1'],
              correctAnswer: '3/4',
              points: 10
            },
            {
              question: 'A fraction always has a numerator smaller than its denominator.',
              type: 'true_false',
              options: ['True', 'False'],
              correctAnswer: 'False',
              points: 10
            }
          ],
          pointsReward: 50,
          quizPointsReward: 100
        }
      ];

      await Lesson.insertMany(lessons);
    }

    // Create sample lessons for Science
    const scienceSubject = subjects.find(s => s.name === 'science');
    if (scienceSubject) {
      const lessons = [
        {
          title: 'Introduction to Physics',
          description: 'Learn the fundamental concepts of physics',
          subject: scienceSubject._id,
          order: 1,
          videoUrl: '',
          notes: 'Physics is the study of matter, energy, and the interactions between them. It tries to explain how the universe works using laws and theories.',
          quiz: [
            {
              question: 'What is physics the study of?',
              type: 'multiple_choice',
              options: ['Living things', 'Matter, energy, and their interactions', 'Numbers and shapes', 'History and society'],
              correctAnswer: 'Matter, energy, and their interactions',
              points: 10
            },
            {
              question: 'What is matter?',
              type: 'multiple_choice',
              options: ['Energy', 'Anything that has mass and takes up space', 'Force', 'Light'],
              correctAnswer: 'Anything that has mass and takes up space',
              points: 10
            },
            {
              question: 'Physics helps us understand how the universe works.',
              type: 'true_false',
              options: ['True', 'False'],
              correctAnswer: 'True',
              points: 10
            }
          ],
          pointsReward: 50,
          quizPointsReward: 100
        }
      ];

      await Lesson.insertMany(lessons);
    }

    res.json({ message: 'Sample data created successfully', grades: createdGrades.length, subjects: subjects.length });
  } catch (error) {
    console.error('Error seeding data:', error);
    res.status(500).json({ error: 'Failed to seed data' });
  }
});

// ============ WEEKLY TEST MANAGEMENT ============

// Get all weekly tests (with optional filters)
router.get('/weekly-tests', auth, adminAuth, async (req, res) => {
  try {
    const { gradeId, activeOnly = false } = req.query;
    const query = { isActive: true };
    
    if (gradeId) {
      query.grade = gradeId;
    }
    if (activeOnly === 'true') {
      const now = new Date();
      query.$or = [
        { availableUntil: { $exists: false } },
        { availableUntil: { $gte: now } }
      ];
    }

    const tests = await WeeklyTest.find(query)
      .populate('grade', 'displayName')
      .populate('subject', 'displayName')
      .sort({ createdAt: -1 });

    // Add submission counts and compute pass rate
    const testsWithStats = await Promise.all(tests.map(async (test) => {
      const submissions = await User.find({
        'weeklyTestResults.testId': test._id
      });

      const submissionCount = submissions.length;
      const passedCount = submissions.filter(u => {
        const result = u.weeklyTestResults?.find(r =>
          r.testId.toString() === test._id.toString()
        );
        return result && result.score >= test.passingScore;
      }).length;

      return {
        ...test.toObject(),
        results: {
          attempted: submissionCount,
          passRate: submissionCount > 0 ? Math.round((passedCount / submissionCount) * 100) : 0
        }
      };
    }));

    res.json(testsWithStats);
      
      const submissionCount = submissions.length;
      const passedCount = submissions.filter(u => {
        const result = u.weeklyTestResults?.find(r => 
          r.testId.toString() === test._id.toString()
        );
        return result && result.score >= test.passingScore;
      }).length;

      return {
        ...test.toObject(),
        results: {
          attempted: submissionCount,
          passRate: submissionCount > 0 ? Math.round((passedCount / submissionCount) * 100) : 0
        }
      };
    }));

    res.json(testsWithStats);
  } catch (error) {
    console.error('Error fetching weekly tests:', error);
    res.status(500).json({ error: 'Failed to fetch weekly tests' });
  }
});
      
      return {
        ...test.toObject(),
        submissionCount
      };
    }));

    res.json(testsWithStats);
  } catch (error) {
    console.error('Error fetching weekly tests:', error);
    res.status(500).json({ error: 'Failed to fetch weekly tests' });
  }
});

// Get single weekly test with submissions
router.get('/weekly-tests/:id', auth, adminAuth, async (req, res) => {
  try {
    const test = await WeeklyTest.findById(req.params.id)
      .populate('grade', 'displayName')
      .populate('subject', 'displayName');

    if (!test) {
      return res.status(404).json({ error: 'Weekly test not found' });
    }

    // Get student submissions
    const students = await User.find({
      'weeklyTestResults.testId': test._id
    })
      .select('username grade school village')
      .populate('grade', 'displayName');

    const submissions = students.map(user => {
      const result = user.weeklyTestResults?.find(r => 
        r.testId.toString() === test._id.toString()
      );
      return {
        userId: user._id,
        username: user.username,
        grade: user.grade,
        school: user.school,
        village: user.village,
        score: result?.score || 0,
        completedAt: result?.completedAt || null,
        timeTaken: result?.timeTaken || 0
      };
    });

    res.json({
      test,
      submissions,
      totalSubmissions: submissions.length,
      averageScore: submissions.length > 0 
        ? Math.round(submissions.reduce((sum, s) => sum + s.score, 0) / submissions.length)
        : 0
    });
  } catch (error) {
    console.error('Error fetching weekly test:', error);
    res.status(500).json({ error: 'Failed to fetch weekly test' });
  }
});

// Create weekly test
router.post('/weekly-tests', auth, adminAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      weekNumber,
      year,
      grade,
      subject,
      questions,
      timeLimit,
      pointsReward,
      maxScore,
      passingScore,
      availableFrom,
      availableUntil,
      assignedStudents,
      isActive
    } = req.body;

    const weeklyTest = new WeeklyTest({
      title,
      description,
      weekNumber,
      year,
      grade,
      subject,
      questions: questions || [],
      timeLimit: timeLimit || 30,
      pointsReward: pointsReward || 100,
      maxScore: maxScore || 100,
      passingScore: passingScore || 50,
      availableFrom: availableFrom ? new Date(availableFrom) : new Date(),
      availableUntil: availableUntil ? new Date(availableUntil) : null,
      assignedStudents: assignedStudents || [],
      isActive: isActive !== false
    });

    await weeklyTest.save();
    res.status(201).json(weeklyTest);
  } catch (error) {
    console.error('Error creating weekly test:', error);
    res.status(500).json({ error: 'Failed to create weekly test: ' + error.message });
  }
});

// Update weekly test
router.put('/weekly-tests/:id', auth, adminAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      weekNumber,
      year,
      grade,
      subject,
      questions,
      timeLimit,
      pointsReward,
      maxScore,
      passingScore,
      availableFrom,
      availableUntil,
      assignedStudents,
      isActive
    } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (weekNumber !== undefined) updateData.weekNumber = weekNumber;
    if (year !== undefined) updateData.year = year;
    if (grade !== undefined) updateData.grade = grade;
    if (subject !== undefined) updateData.subject = subject;
    if (questions !== undefined) updateData.questions = questions;
    if (timeLimit !== undefined) updateData.timeLimit = timeLimit;
    if (pointsReward !== undefined) updateData.pointsReward = pointsReward;
    if (maxScore !== undefined) updateData.maxScore = maxScore;
    if (passingScore !== undefined) updateData.passingScore = passingScore;
    if (availableFrom !== undefined) updateData.availableFrom = availableFrom ? new Date(availableFrom) : new Date();
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

// Delete weekly test (soft delete)
router.delete('/weekly-tests/:id', auth, adminAuth, async (req, res) => {
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

module.exports = router;
