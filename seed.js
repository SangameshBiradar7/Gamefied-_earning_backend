// Seed script to add dummy student data for analytics testing
// DOES NOT CLEAR EXISTING DATA - only adds new students
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

const Grade = require('./models/Grade');
const Subject = require('./models/Subject');
const Lesson = require('./models/Lesson');
const { Mission, UserMission } = require('./models/Mission');
const Badge = require('./models/Badge');
const User = require('./models/User');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

const seedStudents = async () => {
  await connectDB();

  // Drop the old email index if it exists (from previous schema)
  try {
    await User.collection.dropIndex('email_1');
    console.log('🗑️  Dropped old email index');
  } catch (e) {
    // Index doesn't exist, that's fine
  }

  // Check counts
  const existingStudents = await User.countDocuments({ role: 'student' });
  console.log(`📊 Current student count: ${existingStudents}`);
  
  if (existingStudents >= 250) {
    console.log('✅ Already have enough students. Skipping seed.');
    process.exit(0);
  }

  // Get grades
  const grades = await Grade.find();
  console.log('🎓 Found grades:', grades.map(g => g.displayName || g.name).join(', '));
  
  if (grades.length === 0) {
    console.log('❌ No grades found! Run the server first to initialize default grades.');
    process.exit(1);
  }

  // Data for dummy students
  const villages = ['Ram Nagar', 'Gandhi Nagar', 'Shivaji Nagar', 'Ambedkar Nagar', 'Subhash Nagar', 'Nehru Nagar', 'Patel Nagar', 'Indira Nagar', 'Sarvodaya Nagar', 'Lokmanya Nagar'];
  const schools = ['Govt High School', 'Kendriya Vidyalaya', 'Navodaya Vidyalaya', 'DPS', 'Sri Venkatesh School', 'St. Mary\'s School', 'City Public School', 'Royal Academy'];
  
  const firstNames = ['Aarav', 'Aarya', 'Aditya', 'Ananya', 'Arjun', 'Esha', 'Krishna', 'Kavya', 'Neha', 'Rahul', 
                      'Priya', 'Rohan', 'Sneha', 'Vikas', 'Pooja', 'Amit', 'Sunita', 'Rajesh', 'Manish', 'Suresh',
                      'Sanjay', 'Meena', 'Vijay', 'Anita', 'Deepak', 'Rekha', 'Mohan', 'Geeta', 'Ramesh', 'Sushma',
                      'Nikhil', ' Divya', 'Kiran', 'Manoj', 'Rekha', 'Alok', 'Swati', 'Gaurav', 'Komal', 'Tarun'];
  const lastNames = ['Patel', 'Sharma', 'Singh', 'Kumar', 'Yadav', 'Reddy', 'Gupta', 'Mishra', 'Jha', 'Thakur',
                     'Nair', 'Menon', 'Pillai', 'Shastri', 'Joshi', 'Acharya', 'Desai', 'Mehta', 'Shah', 'Choudhary',
                     'Rao', 'Pandey', 'Dwivedi', 'Trivedi', 'Chaturvedi', 'Mukherjee', 'Das', 'Sinha', 'Verma', 'Saxena'];

  const passwords = ['student123', 'test123', 'demo123', 'learn123', 'pass123'];
  let createdCount = 0;
  let skippedCount = 0;

  console.log('\n🏫 Creating dummy students for analytics...\n');

  // Create 250 dummy students with varied analytics
  for (let i = 1; i <= 250; i++) {
    const grade = grades[Math.floor(Math.random() * grades.length)];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const username = `student_${firstName.toLowerCase()}_${i}`;
    const password = passwords[Math.floor(Math.random() * passwords.length)];
    
    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      skippedCount++;
      continue;
    }
    
    // Random stats for varied analytics
    const points = Math.floor(Math.random() * 8000) + 100; // 100-8100 points
    const streak = Math.floor(Math.random() * 30); // 0-30 day streak
    const completedLessonsCount = Math.floor(points / 120); // Rough approximation
    const village = villages[Math.floor(Math.random() * villages.length)];
    const school = schools[Math.floor(Math.random() * schools.length)];
    const daysActive = Math.floor(Math.random() * 60); // 0-60 days since first activity
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Construct completed lessons array with mock data
    const completedLessons = [];
    if (completedLessonsCount > 0) {
      for (let j = 0; j < Math.min(completedLessonsCount, 50); j++) {
        completedLessons.push({
          lessonId: null,
          videoCompleted: true,
          videoWatchedPercent: 100,
          quizCompleted: Math.random() > 0.3,
          completedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
        });
      }
    }
    
    // Quiz results
    const quizResults = [];
    const numQuizzes = Math.floor(Math.random() * 20);
    for (let q = 0; q < numQuizzes; q++) {
      quizResults.push({
        lessonId: null,
        score: Math.floor(Math.random() * 100),
        pointsEarned: Math.floor(Math.random() * 100),
        completedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      });
    }
    
    const user = new User({
      username,
      password: hashedPassword,
      role: 'student',
      grade: grade._id,
      school: school,
      village: village,
      points: points,
      streak: {
        current: streak,
        longest: Math.max(streak, Math.floor(Math.random() * 30)),
        lastActivityDate: daysActive > 0 ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : null
      },
      completedLessons: completedLessons,
      quizResults: quizResults,
      badges: [],
      level: points < 500 ? 'Beginner' : points < 2000 ? 'Learner' : points < 5000 ? 'Advanced' : points < 10000 ? 'Expert' : 'Master',
      lastLogin: daysActive > 0 ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : null
    });
    
    await user.save();
    createdCount++;
    
    if (createdCount % 50 === 0) {
      console.log(`   ✅ Created ${createdCount} students so far...`);
    }
  }

  // Create a few special profile students
  console.log('\n🌟 Creating special profile students...');
  
  const specialStudents = [
    { username: 'topper_ram', points: 9500, streak: 45, village: villages[0], school: schools[0] },
    { username: 'shooting_star', points: 9200, streak: 50, village: villages[1], school: schools[1] },
    { username: 'quiz_master', points: 8800, streak: 35, village: villages[2], school: schools[2] },
    { username: 'beginner1', points: 100, streak: 0, village: villages[3], school: schools[3] },
    { username: 'inactive1', points: 50, streak: 0, village: villages[4], school: schools[4] },
    { username: 'low_performer', points: 200, streak: 2, village: villages[5], school: schools[0] }
  ];

  for (const spec of specialStudents) {
    const existing = await User.findOne({ username: spec.username });
    if (!existing) {
      const hashedPwd = await bcrypt.hash('test123', 10);
      await User.create({
        username: spec.username,
        password: hashedPwd,
        role: 'student',
        grade: grades[0]._id,
        school: spec.school,
        village: spec.village,
        points: spec.points,
        streak: { current: spec.streak, longest: spec.streak, lastActivityDate: new Date() },
        completedLessons: [],
        quizResults: [],
        badges: [],
        level: spec.points < 500 ? 'Beginner' : spec.points < 2000 ? 'Learner' : 'Advanced'
      });
      console.log(`   ✅ Created special student: ${spec.username} (${spec.points} pts, ${spec.streak} streak)`);
      createdCount++;
    } else {
      console.log(`   ℹ️ ${spec.username} already exists`);
    }
  }

  // Ensure admin exists
  const adminExists = await User.findOne({ username: 'admin' });
  if (!adminExists) {
    const hashedAdminPwd = await bcrypt.hash('admin123', 10);
    await User.create({
      username: 'admin',
      password: hashedAdminPwd,
      role: 'admin',
      points: 0,
      streak: { current: 0, lastActivityDate: null, longest: 0 },
      badges: [],
      grade: grades[0]._id
    });
    console.log('👑 Admin user created: admin / admin123');
  }

  console.log(`\n🎉 Seed completed successfully!`);
  console.log(`   📈 Total students in database: ${await User.countDocuments({ role: 'student' })}`);
  console.log(`   ✨ New students created: ${createdCount}`);
  console.log(`   ⏭️  Skipped (already existed): ${skippedCount}`);
  console.log('\n🔑 Test Accounts:');
  console.log('   Admin: admin / admin123');
  console.log('   Student: teststudent / test123');
  console.log('   Special: topper_ram / test123');
  console.log('   Special: beginner1 / test123\n');

  process.exit(0);
};

seedStudents().catch(err => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});