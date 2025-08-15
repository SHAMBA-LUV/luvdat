const express = require('express');
const { db } = require('../database/connection');
const logger = require('../utils/logger');

const router = express.Router();

// Get dashboard analytics
router.get('/dashboard', async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    
    const analytics = await db.getDashboardAnalytics(timeframe);
    
    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('Get dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get protection analytics
router.get('/protection', async (req, res) => {
  try {
    const analytics = await db.getProtectionAnalytics();
    
    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('Get protection analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get realtime data
router.get('/realtime', async (req, res) => {
  try {
    const data = await db.getRealtimeData();
    
    res.json({
      success: true,
      data
    });

  } catch (error) {
    logger.error('Get realtime data error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;