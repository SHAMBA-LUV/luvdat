const express = require('express');
const { db } = require('../database/connection');
const logger = require('../utils/logger');

const router = express.Router();

// Get claim count for IP
router.get('/:ipHash/claims', async (req, res) => {
  try {
    const { ipHash } = req.params;
    
    // For in-memory DB, we'll use the IP address directly
    const ipAddress = ipHash; // Simplified for in-memory DB
    
    const stats = await db.getIPClaimCount(ipAddress);
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Get IP claim count error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get IP statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getIPStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Get IP stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;