const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Lesson, Subject } = require('../models');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { extractYouTubeId, convertToEmbedUrl, isValidYouTubeUrl } = require('../utils/youtube');

// Configure multer for video uploads
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// Get all lessons (optionally filtered by subject)
router.get('/', async (req, res) => {
  try {
    const { subjectId } = req.query;
    const query = { isActive: true };
    if (subjectId) {
      query.subject = subjectId;
    }
    const lessons = await Lesson.find(query).populate('subject', 'name displayName color').sort({ order: 1 });
    res.json(lessons);
  } catch (error) {
    console.error('Error fetching lessons:', error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

// Get single lesson with content
router.get('/:id', async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id).populate('subject', 'name displayName color grade');
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    res.json(lesson);
  } catch (error) {
    console.error('Error fetching lesson:', error);
    res.status(500).json({ error: 'Failed to fetch lesson' });
  }
});

// Admin: Create lesson (supports multipart/form-data for video upload)
router.post('/', auth, adminAuth, upload.single('video'), async (req, res) => {
  try {
    let { title, description, subjectId, order, videoUrl, videoDuration, notes, notesUrl, quiz, pointsReward, quizPointsReward, youtubeUrl } = req.body;
    
    // Debug: Log received data
    console.log('=== Creating Lesson Debug ===');
    console.log('req.body:', JSON.stringify(req.body));
    console.log('title:', title);
    console.log('subjectId:', subjectId);
    console.log('youtubeUrl:', youtubeUrl);
    console.log('videoUrl:', videoUrl);
    console.log('quiz:', quiz);
    console.log('req.file:', req.file ? req.file.originalname : 'no file');
    console.log('===========================');
    
    // Parse quiz if it's sent as a string
    if (typeof quiz === 'string') {
      try {
        quiz = JSON.parse(quiz);
      } catch (e) {
        quiz = [];
      }
    }
    
    // If a file was uploaded, use its path as videoUrl
    if (req.file) {
      videoUrl = `/uploads/${req.file.filename}`;
    }
    
    // Extract YouTube video ID if YouTube URL is provided
    let youtubeId = '';
    if (youtubeUrl && isValidYouTubeUrl(youtubeUrl)) {
      youtubeId = extractYouTubeId(youtubeUrl);
    }
    
    const lesson = new Lesson({
      title,
      description,
      subject: subjectId,
      order: order || 0,
      videoUrl: videoUrl || '',
      youtubeUrl: youtubeUrl || '',
      youtubeId: youtubeId,
      videoDuration: videoDuration || 0,
      notes: notes || '',
      notesUrl: notesUrl || '',
      quiz: quiz || [],
      pointsReward: pointsReward || 50,
      quizPointsReward: quizPointsReward || 100
    });
    
    await lesson.save();
    console.log('Lesson created successfully:', lesson._id);
    console.log('Lesson data:', JSON.stringify(lesson));
    res.status(201).json(lesson);
  } catch (error) {
    console.error('Error creating lesson:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to create lesson: ' + error.message });
  }
});

// Admin: Update lesson (supports multipart/form-data for video upload)
router.put('/:id', auth, adminAuth, upload.single('video'), async (req, res) => {
  try {
    let { title, description, order, videoUrl, videoDuration, notes, notesUrl, quiz, pointsReward, quizPointsReward, isActive, existingVideoUrl, youtubeUrl, existingYoutubeUrl } = req.body;
    
    // Parse quiz if it's sent as a string
    if (typeof quiz === 'string') {
      try {
        quiz = JSON.parse(quiz);
      } catch (e) {
        quiz = [];
      }
    }
    
    // If a new file was uploaded, use its path; otherwise keep existing videoUrl
    if (req.file) {
      videoUrl = `/uploads/${req.file.filename}`;
    } else if (existingVideoUrl) {
      videoUrl = existingVideoUrl;
    }
    
    // Extract YouTube video ID if YouTube URL is provided
    let youtubeId = '';
    let finalYoutubeUrl = youtubeUrl || existingYoutubeUrl || '';
    if (finalYoutubeUrl && isValidYouTubeUrl(finalYoutubeUrl)) {
      youtubeId = extractYouTubeId(finalYoutubeUrl);
    }
    
    const lesson = await Lesson.findByIdAndUpdate(
      req.params.id,
      { title, description, order, videoUrl, videoDuration, notes, notesUrl, quiz, pointsReward, quizPointsReward, isActive, youtubeUrl: finalYoutubeUrl, youtubeId },
      { new: true }
    );
    
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    
    res.json(lesson);
  } catch (error) {
    console.error('Error updating lesson:', error);
    res.status(500).json({ error: 'Failed to update lesson' });
  }
});

// Admin: Delete lesson
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const lesson = await Lesson.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    
    res.json({ message: 'Lesson deleted successfully' });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    res.status(500).json({ error: 'Failed to delete lesson' });
  }
});

// Track video completion
router.post('/video-progress', auth, async (req, res) => {
  try {
    const { lessonId, watchedPercent, completed, currentTime } = req.body;
    const userId = req.user.userId;
    
    const { User, Lesson } = require('../models');
    const user = await User.findById(userId);
    const lesson = await Lesson.findById(lessonId);
    
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    
    // Find existing lesson progress
    const lessonProgressIndex = user.completedLessons.findIndex(
      l => l.lessonId.toString() === lessonId
    );
    
    const videoWatchedPercent = Math.max(watchedPercent || 0, 0);
    const videoCompleted = completed || videoWatchedPercent >= 90;
    
    // Video completion points (+20 for watching video)
    let pointsEarned = 0;
    const VIDEO_POINTS = 20;
    
    if (lessonProgressIndex === -1) {
      // First time tracking this lesson
      user.completedLessons.push({
        lessonId: lesson._id,
        videoCompleted: videoCompleted,
        videoWatchedPercent: videoWatchedPercent,
        lastWatchedAt: new Date(),
        currentVideoTime: currentTime || 0,
        quizCompleted: false
      });
      
      // Award points for video completion
      if (videoCompleted) {
        pointsEarned = VIDEO_POINTS;
        user.points += VIDEO_POINTS;
      }
    } else {
      // Update existing progress
      const existingProgress = user.completedLessons[lessonProgressIndex];
      
      // Only award points if video wasn't previously completed
      if (!existingProgress.videoCompleted && videoCompleted) {
        pointsEarned = VIDEO_POINTS;
        user.points += VIDEO_POINTS;
      }
      
      user.completedLessons[lessonProgressIndex].videoWatchedPercent = Math.max(
        existingProgress.videoWatchedPercent,
        videoWatchedPercent
      );
      user.completedLessons[lessonProgressIndex].lastWatchedAt = new Date();
      user.completedLessons[lessonProgressIndex].currentVideoTime = currentTime || 0;
      user.completedLessons[lessonProgressIndex].videoCompleted = 
        existingProgress.videoCompleted || videoCompleted;
    }
    
    await user.save();
    
    res.json({
      success: true,
      videoCompleted,
      videoWatchedPercent,
      pointsEarned,
      totalPoints: user.points
    });
  } catch (error) {
    console.error('Error tracking video progress:', error);
    res.status(500).json({ error: 'Failed to track video progress' });
  }
});

module.exports = router;
