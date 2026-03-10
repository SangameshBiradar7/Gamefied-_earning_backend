// Seed script to populate database with sample data
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

const Grade = require('./models/Grade');
const Subject = require('./models/Subject');
const Lesson = require('./models/Lesson');
const Mission = require('./models/Mission');
const Badge = require('./models/Badge');
const User = require('./models/User');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

const seedData = async () => {
  await connectDB();

  // Clear existing data
  await Subject.deleteMany({});
  await Lesson.deleteMany({});
  await Mission.deleteMany({});
  await Badge.deleteMany({});
  await User.deleteMany({});

  console.log('Cleared existing data');

  // Get grades
  const grades = await Grade.find();
  console.log('Found grades:', grades.map(g => g.name));

  // Create subjects for each grade
  const subjectData = [
    { name: 'Mathematics', displayName: 'Mathematics', icon: 'calculator', color: '#3498db' },
    { name: 'Science', displayName: 'Science', icon: 'flask', color: '#2ecc71' },
    { name: 'English', displayName: 'English', icon: 'book', color: '#9b59b6' },
    { name: 'History', displayName: 'History', icon: 'clock', color: '#e74c3c' },
    { name: 'Geography', displayName: 'Geography', icon: 'globe', color: '#f39c12' }
  ];

  const subjects = [];
  for (const grade of grades) {
    for (const subj of subjectData) {
      const subject = await Subject.create({
        name: subj.name,
        displayName: subj.displayName,
        grade: grade._id,
        icon: subj.icon,
        color: subj.color,
        description: `Learn ${subj.displayName} for ${grade.displayName}`
      });
      subjects.push(subject);
      console.log(`Created subject: ${subj.name} for ${grade.name}`);
    }
  }

  // Create lessons for each subject
  const lessonData = [
    { title: 'Introduction', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoDuration: 600 },
    { title: 'Basic Concepts', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoDuration: 900 },
    { title: 'Advanced Topics', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoDuration: 1200 },
    { title: 'Practice Problems', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoDuration: 1500 },
    { title: 'Quiz Review', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoDuration: 1800 }
  ];

  for (const subject of subjects) {
    for (let i = 0; i < lessonData.length; i++) {
      const lesson = await Lesson.create({
        title: `${lessonData[i].title} - ${subject.name}`,
        subject: subject._id,
        videoUrl: lessonData[i].videoUrl,
        videoDuration: lessonData[i].videoDuration,
        order: i + 1,
        content: `# ${lessonData[i].title}\n\nThis is the content for ${subject.name}.`
      });
      console.log(`Created lesson: ${lesson.title}`);
    }
  }

  // Create missions
  const missions = [
    { title: 'Daily Learner', description: 'Complete 1 lesson today', type: 'daily', requirement: 1, action: 'complete_lesson', targetValue: 1, pointsReward: 50 },
    { title: 'Double Knowledge', description: 'Complete 2 lessons today', type: 'daily', requirement: 1, action: 'complete_lesson', targetValue: 2, pointsReward: 100 },
    { title: 'Quiz Ace', description: 'Score above 80% in a quiz', type: 'daily', requirement: 1, action: 'score_quiz', targetValue: 80, pointsReward: 75 },
    { title: 'Perfect Quiz', description: 'Get 100% in a quiz', type: 'daily', requirement: 1, action: 'score_quiz', targetValue: 100, pointsReward: 150 },
    { title: 'Streak Starter', description: 'Maintain a 3-day streak', type: 'weekly', requirement: 1, action: 'maintain_streak', targetValue: 3, pointsReward: 100 }
  ];

  for (const mission of missions) {
    await Mission.create(mission);
    console.log(`Created mission: ${mission.title}`);
  }

  // Create badges
  const badges = [
    { badgeId: 'first_lesson', name: 'First Steps', description: 'Complete your first lesson', icon: 'star', color: '#4F46E5', category: 'lesson', requirement: 1, pointsReward: 50 },
    { badgeId: 'five_lessons', name: 'Quick Learner', description: 'Complete 5 lessons', icon: 'zap', color: '#10B981', category: 'lesson', requirement: 5, pointsReward: 100 },
    { badgeId: 'ten_lessons', name: 'Knowledge Seeker', description: 'Complete 10 lessons', icon: 'book-open', color: '#8B5CF6', category: 'lesson', requirement: 10, pointsReward: 200 },
    { badgeId: 'quiz_master', name: 'Quiz Master', description: 'Score 100% on 5 quizzes', icon: 'award', color: '#F59E0B', category: 'quiz', requirement: 5, pointsReward: 150 },
    { badgeId: 'streak_7', name: 'Streak Champion', description: 'Maintain a 7-day streak', icon: 'flame', color: '#F97316', category: 'streak', requirement: 7, pointsReward: 200 }
  ];

  for (const badge of badges) {
    await Badge.create(badge);
    console.log(`Created badge: ${badge.name}`);
  }

  // Create admin user
  const hashedAdminPassword = await bcrypt.hash('admin123', 10);
  const admin = await User.create({
    username: 'admin',
    password: hashedAdminPassword,
    role: 'admin',
    points: 0,
    streak: { current: 0, lastActivityDate: null, longest: 0 },
    badges: [],
    grade: grades[0]?._id
  });
  console.log('Created admin user: admin / admin123');

  // Create sample student
  const hashedStudentPassword = await bcrypt.hash('student123', 10);
  const student = await User.create({
    username: 'student',
    password: hashedStudentPassword,
    role: 'student',
    points: 0,
    streak: { current: 0, lastActivityDate: null, longest: 0 },
    badges: [],
    grade: grades[0]?._id
  });
  console.log('Created student user: student / student123');

  console.log('\n✅ Seed completed successfully!');
  console.log('\nTest Accounts:');
  console.log('  Admin: admin / admin123');
  console.log('  Student: student / student123');

  process.exit(0);
};

seedData();
