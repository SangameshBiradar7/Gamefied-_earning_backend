const express = require('express');
const router = express.Router();
const { Subject, Lesson, Grade } = require('../models');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Get all subjects (optionally filtered by grade)
router.get('/', async (req, res) => {
  try {
    const { gradeId } = req.query;
    const query = { isActive: true };
    if (gradeId) {
      query.grade = gradeId;
    }
    const subjects = await Subject.find(query).populate('grade', 'name displayName').sort({ order: 1 });
    res.json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Get single subject with lessons
router.get('/:id', async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).populate('grade', 'name displayName');
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    const lessons = await Lesson.find({ subject: subject._id, isActive: true }).sort({ order: 1 });
    res.json({ subject, lessons });
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ error: 'Failed to fetch subject' });
  }
});

// Admin: Create subject
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const { name, displayName, description, icon, color, gradeId, order } = req.body;
    
    const subject = new Subject({
      name,
      displayName,
      description,
      icon: icon || 'book',
      color: color || '#4F46E5',
      grade: gradeId,
      order: order || 0
    });
    
    await subject.save();
    res.status(201).json(subject);
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

// Admin: Update subject
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { name, displayName, description, icon, color, order, isActive } = req.body;
    
    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { name, displayName, description, icon, color, order, isActive },
      { new: true }
    );
    
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    res.json(subject);
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ error: 'Failed to update subject' });
  }
});

// Admin: Delete subject
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

module.exports = router;
