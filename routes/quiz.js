const express = require('express');
const router = express.Router();
const { User, Lesson, Badge, Subject } = require('../models');
const auth = require('../middleware/auth');

// Point values
const VIDEO_WATCH_POINTS = 20;      // +20 for watching video
const QUIZ_COMPLETE_POINTS = 30;    // +30 for completing quiz
const CORRECT_ANSWER_POINTS = 10;   // +10 per correct answer
const STREAK_BONUS_POINTS = 5;      // +5 streak bonus

// Get quiz for a lesson (without correct answers)
router.get('/lesson/:lessonId', auth, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.lessonId);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Return quiz without correct answers
    const quiz = lesson.quiz.map(q => ({
      _id: q._id,
      question: q.question,
      type: q.type,
      options: q.options,
      points: q.points
    }));

    // Get user's current progress for this lesson
    const user = await User.findById(req.user.userId);
    const lessonProgress = user.completedLessons.find(
      l => l.lessonId.toString() === req.params.lessonId
    );

    res.json({ 
      quiz, 
      lessonId: lesson._id, 
      title: lesson.title,
      videoCompleted: lessonProgress?.videoCompleted || false,
      quizCompleted: lessonProgress?.quizCompleted || false
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// Submit quiz answers
router.post('/submit', auth, async (req, res) => {
  try {
    const { lessonId, answers } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Calculate score
    let correctAnswers = 0;
    let totalPoints = 0;
    let earnedPoints = 0;
    const results = [];

    lesson.quiz.forEach((question, index) => {
      const userAnswer = answers[index];
      const isCorrect = userAnswer === question.correctAnswer;
      
      if (isCorrect) {
        correctAnswers++;
        // +10 points per correct answer
        earnedPoints += CORRECT_ANSWER_POINTS;
      }

      results.push({
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        points: question.points
      });

      totalPoints += question.points;
    });

    const score = Math.round((correctAnswers / lesson.quiz.length) * 100);

    // Find existing lesson progress
    const lessonProgressIndex = user.completedLessons.findIndex(
      l => l.lessonId.toString() === lessonId
    );

    // Check if lesson already completed (quiz)
    const alreadyQuizCompleted = lessonProgressIndex !== -1 && 
      user.completedLessons[lessonProgressIndex].quizCompleted;

    // Add +30 points for completing quiz (only first time)
    if (!alreadyQuizCompleted) {
      earnedPoints += QUIZ_COMPLETE_POINTS;
    }

    // Save quiz result
    user.quizResults.push({
      lessonId: lesson._id,
      score,
      pointsEarned: earnedPoints
    });

    // Add quiz points
    user.points += earnedPoints;

    // Update streak with bonus
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastActivity = user.streak.lastActivityDate;
    let newStreak = user.streak.current;
    let streakBonusEarned = 0;

    if (lastActivity) {
      const lastDate = new Date(lastActivity);
      lastDate.setHours(0, 0, 0, 0);
      const dayDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === 1) {
        newStreak += 1;
        // +5 streak bonus for consecutive days
        if (newStreak > 1) {
          streakBonusEarned = STREAK_BONUS_POINTS;
          user.points += STREAK_BONUS_POINTS;
          earnedPoints += STREAK_BONUS_POINTS;
        }
      } else if (dayDiff > 1) {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    user.streak.current = newStreak;
    user.streak.lastActivityDate = today;
    if (newStreak > user.streak.longest) {
      user.streak.longest = newStreak;
    }

    // Update lesson progress
    if (lessonProgressIndex === -1) {
      user.completedLessons.push({
        lessonId: lesson._id,
        videoCompleted: true,
        videoWatchedPercent: 100,
        quizCompleted: true
      });
    } else {
      user.completedLessons[lessonProgressIndex].quizCompleted = true;
      user.completedLessons[lessonProgressIndex].videoCompleted = 
        user.completedLessons[lessonProgressIndex].videoCompleted || true;
    }

    // Calculate level
    user.level = user.calculateLevel();

    await user.save();

    // Check for badges
    const newBadges = [];
    const completedLessonsCount = user.completedLessons.length;
    const perfectQuizzes = user.quizResults.filter(r => r.score === 100).length;

    // First lesson badge
    if (completedLessonsCount >= 1) {
      const hasBadge = user.badges.some(b => b.badgeId === 'first_lesson');
      if (!hasBadge) {
        const badge = await Badge.findOne({ badgeId: 'first_lesson' });
        if (badge) {
          user.badges.push({ badgeId: 'first_lesson', name: badge.name });
          user.points += badge.pointsReward;
          newBadges.push(badge);
        }
      }
    }

    // 5 lessons badge
    if (completedLessonsCount >= 5) {
      const hasBadge = user.badges.some(b => b.badgeId === 'five_lessons');
      if (!hasBadge) {
        const badge = await Badge.findOne({ badgeId: 'five_lessons' });
        if (badge) {
          user.badges.push({ badgeId: 'five_lessons', name: badge.name });
          user.points += badge.pointsReward;
          newBadges.push(badge);
        }
      }
    }

    // 10 lessons badge
    if (completedLessonsCount >= 10) {
      const hasBadge = user.badges.some(b => b.badgeId === 'ten_lessons');
      if (!hasBadge) {
        const badge = await Badge.findOne({ badgeId: 'ten_lessons' });
        if (badge) {
          user.badges.push({ badgeId: 'ten_lessons', name: badge.name });
          user.points += badge.pointsReward;
          newBadges.push(badge);
        }
      }
    }

    // Quiz champion badge
    if (score === 100) {
      const hasBadge = user.badges.some(b => b.badgeId === 'quiz_champion');
      if (!hasBadge) {
        const badge = await Badge.findOne({ badgeId: 'quiz_champion' });
        if (badge) {
          user.badges.push({ badgeId: 'quiz_champion', name: badge.name });
          user.points += badge.pointsReward;
          newBadges.push(badge);
        }
      }
    }

    // Perfect quiz badge
    if (perfectQuizzes >= 5) {
      const hasBadge = user.badges.some(b => b.badgeId === 'perfect_quiz');
      if (!hasBadge) {
        const badge = await Badge.findOne({ badgeId: 'perfect_quiz' });
        if (badge) {
          user.badges.push({ badgeId: 'perfect_quiz', name: badge.name });
          user.points += badge.pointsReward;
          newBadges.push(badge);
        }
      }
    }

    // Streak badges
    if (newStreak >= 3) {
      const hasBadge = user.badges.some(b => b.badgeId === 'streak_3');
      if (!hasBadge) {
        const badge = await Badge.findOne({ badgeId: 'streak_3' });
        if (badge) {
          user.badges.push({ badgeId: 'streak_3', name: badge.name });
          user.points += badge.pointsReward;
          newBadges.push(badge);
        }
      }
    }

    if (newStreak >= 7) {
      const hasBadge = user.badges.some(b => b.badgeId === 'streak_7');
      if (!hasBadge) {
        const badge = await Badge.findOne({ badgeId: 'streak_7' });
        if (badge) {
          user.badges.push({ badgeId: 'streak_7', name: badge.name });
          user.points += badge.pointsReward;
          newBadges.push(badge);
        }
      }
    }

    if (newStreak >= 30) {
      const hasBadge = user.badges.some(b => b.badgeId === 'streak_30');
      if (!hasBadge) {
        const badge = await Badge.findOne({ badgeId: 'streak_30' });
        if (badge) {
          user.badges.push({ badgeId: 'streak_30', name: badge.name });
          user.points += badge.pointsReward;
          newBadges.push(badge);
        }
      }
    }

    // Level badges
    const levelBadges = [
      { points: 500, badgeId: 'level_learner' },
      { points: 2000, badgeId: 'level_advanced' },
      { points: 5000, badgeId: 'level_expert' },
      { points: 10000, badgeId: 'level_master' }
    ];

    for (const level of levelBadges) {
      if (user.points >= level.points) {
        const hasBadge = user.badges.some(b => b.badgeId === level.badgeId);
        if (!hasBadge) {
          const badge = await Badge.findOne({ badgeId: level.badgeId });
          if (badge) {
            user.badges.push({ badgeId: level.badgeId, name: badge.name });
            user.points += badge.pointsReward;
            newBadges.push(badge);
          }
        }
      }
    }

    await user.save();

    res.json({
      results,
      score,
      totalPoints,
      earnedPoints,
      correctAnswers,
      totalQuestions: lesson.quiz.length,
      streak: user.streak,
      level: user.level,
      points: user.points,
      newBadges,
      lessonCompleted: !alreadyQuizCompleted,
      streakBonusEarned,
      pointsBreakdown: {
        correctAnswerPoints: correctAnswers * CORRECT_ANSWER_POINTS,
        quizCompleteBonus: !alreadyQuizCompleted ? QUIZ_COMPLETE_POINTS : 0,
        streakBonus: streakBonusEarned
      }
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

module.exports = router;
