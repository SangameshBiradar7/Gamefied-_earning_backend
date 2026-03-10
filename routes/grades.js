const express = require('express');
const router = express.Router();
const { Grade, Subject } = require('../models');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Get all active grades
router.get('/', async (req, res) => {
  try {
    const grades = await Grade.find({ isActive: true }).sort({ order: 1 });
    res.json(grades);
  } catch (error) {
    console.error('Error fetching grades:', error);
    res.status(500).json({ error: 'Failed to fetch grades' });
  }
});

// Get single grade with subjects
router.get('/:id', async (req, res) => {
  try {
    const grade = await Grade.findById(req.params.id);
    if (!grade) {
      return res.status(404).json({ error: 'Grade not found' });
    }
    
    const subjects = await Subject.find({ grade: grade._id, isActive: true }).sort({ order: 1 });
    res.json({ grade, subjects });
  } catch (error) {
    console.error('Error fetching grade:', error);
    res.status(500).json({ error: 'Failed to fetch grade' });
  }
});

// Admin: Create grade
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const { name, displayName, description, order } = req.body;
    
    const grade = new Grade({
      name,
      displayName,
      description,
      order: order || 0
    });
    
    await grade.save();
    res.status(201).json(grade);
  } catch (error) {
    console.error('Error creating grade:', error);
    res.status(500).json({ error: 'Failed to create grade' });
  }
});

// Admin: Update grade
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { name, displayName, description, order, isActive } = req.body;
    
    const grade = await Grade.findByIdAndUpdate(
      req.params.id,
      { name, displayName, description, order, isActive },
      { new: true }
    );
    
    if (!grade) {
      return res.status(404).json({ error: 'Grade not found' });
    }
    
    res.json(grade);
  } catch (error) {
    console.error('Error updating grade:', error);
    res.status(500).json({ error: 'Failed to update grade' });
  }
});

// Admin: Delete grade
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const grade = await Grade.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!grade) {
      return res.status(404).json({ error: 'Grade not found' });
    }
    
    res.json({ message: 'Grade deleted successfully' });
  } catch (error) {
    console.error('Error deleting grade:', error);
    res.status(500).json({ error: 'Failed to delete grade' });
  }
});

module.exports = router;
