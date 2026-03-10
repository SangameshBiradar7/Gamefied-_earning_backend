const express = require('express');
const router = express.Router();
const { Badge } = require('../models');

// Get all badges
router.get('/', async (req, res) => {
  try {
    const badges = await Badge.find({ isActive: true });
    res.json(badges);
  } catch (error) {
    console.error('Error fetching badges:', error);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// Get badge by ID
router.get('/:id', async (req, res) => {
  try {
    const badge = await Badge.findOne({ badgeId: req.params.id });
    if (!badge) {
      return res.status(404).json({ error: 'Badge not found' });
    }
    res.json(badge);
  } catch (error) {
    console.error('Error fetching badge:', error);
    res.status(500).json({ error: 'Failed to fetch badge' });
  }
});

module.exports = router;
