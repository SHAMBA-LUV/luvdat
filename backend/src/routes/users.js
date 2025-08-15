const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/connection');
const logger = require('../utils/logger');

const router = express.Router();

// Register new user
router.post('/register', [
  body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
  body('authMethod').isString().notEmpty().withMessage('Auth method is required'),
  body('deviceFingerprint').isString().notEmpty().withMessage('Device fingerprint is required'),
  body('ipAddress').isIP().withMessage('Valid IP address is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      walletAddress,
      authMethod,
      authIdentifier,
      deviceFingerprint,
      userAgent,
      screenResolution,
      timezone,
      ipAddress
    } = req.body;

    // Check if user already exists
    const existingUser = await db.getUserByWallet(walletAddress);
    if (existingUser) {
      logger.info('User already registered', { walletAddress });
      return res.json({
        success: true,
        message: 'User already registered',
        data: existingUser
      });
    }

    // Create new user
    const user = await db.createUser({
      walletAddress,
      authMethod,
      authIdentifier,
      deviceFingerprint,
      userAgent,
      screenResolution,
      timezone,
      ipAddress
    });

    logger.info('User registered successfully', { walletAddress });
    res.json({
      success: true,
      message: 'User registered successfully',
      data: user
    });

  } catch (error) {
    logger.error('User registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user details
router.get('/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    const user = await db.getUserByWallet(walletAddress);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user IP address
router.put('/:walletAddress/ip', [
  body('ipAddress').isIP().withMessage('Valid IP address is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { walletAddress } = req.params;
    const { ipAddress, userAgent } = req.body;

    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    const updatedUser = await db.updateUserIP(walletAddress, ipAddress, userAgent);
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logger.info('User IP updated', { walletAddress, ipAddress });
    res.json({
      success: true,
      message: 'IP address updated successfully',
      data: updatedUser
    });

  } catch (error) {
    logger.error('Update user IP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;