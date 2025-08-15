const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/connection');
const logger = require('../utils/logger');

const router = express.Router();

// Check airdrop eligibility
router.post('/check-eligibility', [
  body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
  body('ipAddress').isIP().withMessage('Valid IP address is required'),
  body('deviceFingerprint').isString().notEmpty().withMessage('Device fingerprint is required')
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

    const { walletAddress, ipAddress, deviceFingerprint, userAgent } = req.body;

    // Get user's claim history
    const claimHistory = await db.getUserClaimHistory(walletAddress);
    const ipStats = await db.getIPClaimCount(ipAddress);

    // Check if user has already claimed
    const hasClaimed = claimHistory.some(claim => claim.status === 'completed');
    
    // Check IP-based restrictions
    const ipClaimCount = ipStats.claimCount;
    const isIPBlocked = ipClaimCount > 5; // Allow up to 5 claims per IP

    // Calculate risk score
    let riskScore = 0;
    if (hasClaimed) riskScore += 100;
    if (ipClaimCount > 3) riskScore += 30;
    if (ipClaimCount > 5) riskScore += 50;

    const canClaim = !hasClaimed && !isIPBlocked && riskScore < 80;

    const result = {
      canClaim,
      reason: canClaim ? 'Eligible for airdrop' : 
        hasClaimed ? 'Already claimed airdrop' :
        isIPBlocked ? 'Too many claims from this IP' :
        'Risk score too high',
      riskScore,
      ipInfo: {
        location: {
          country_code: 'US', // Simplified for in-memory DB
          region: 'Unknown',
          city: 'Unknown'
        },
        isVPN: false,
        isProxy: false
      }
    };

    logger.info('Airdrop eligibility checked', { 
      walletAddress, 
      canClaim, 
      riskScore,
      ipClaimCount 
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Airdrop eligibility check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Record airdrop claim
router.post('/claim', [
  body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
  body('ipAddress').isIP().withMessage('Valid IP address is required'),
  body('deviceFingerprint').isString().notEmpty().withMessage('Device fingerprint is required'),
  body('claimAmount').isString().notEmpty().withMessage('Claim amount is required'),
  body('status').isIn(['pending', 'completed', 'failed', 'blocked']).withMessage('Invalid status')
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
      ipAddress,
      deviceFingerprint,
      claimAmount,
      transactionHash,
      status,
      userAgent
    } = req.body;

    // Record the claim
    const claim = await db.recordAirdropClaim({
      walletAddress,
      ipAddress,
      deviceFingerprint,
      claimAmount,
      transactionHash,
      status,
      userAgent
    });

    logger.info('Airdrop claim recorded', { 
      walletAddress, 
      status, 
      transactionHash: transactionHash || 'pending' 
    });

    res.json({
      success: true,
      message: 'Claim recorded successfully',
      data: claim
    });

  } catch (error) {
    logger.error('Record airdrop claim error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get airdrop statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getAirdropStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Get airdrop stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user claim history
router.get('/user/:walletAddress/claims', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    const claims = await db.getUserClaimHistory(walletAddress);
    
    res.json({
      success: true,
      data: claims
    });

  } catch (error) {
    logger.error('Get user claim history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;