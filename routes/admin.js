const express = require('express');
const router = express.Router();
const { User, Grade, Subject, Lesson } = require('../models');
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

module.exports = router;
