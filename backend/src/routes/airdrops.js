const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../utils/logger');
const { query } = require('../database/connection');
const { hashIP, detectVPN, getIPLocation } = require('../utils/security');

// Check airdrop eligibility
router.post('/check-eligibility', [
  body('walletAddress')
    .isLength({ min: 42, max: 42 })
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid wallet address'),
  body('ipAddress')
    .isIP()
    .withMessage('Invalid IP address'),
  body('deviceFingerprint')
    .isString()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Invalid device fingerprint'),
  body('userAgent')
    .optional()
    .isString()
    .isLength({ max: 1000 })
], async (req, res) => {
  try {
    logger.info('🎯 Airdrop eligibility check request:', {
      walletAddress: req.body.walletAddress,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.body
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error('❌ Validation errors in airdrop eligibility check:', errors.array());
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { walletAddress, ipAddress, deviceFingerprint, userAgent } = req.body;
    logger.info('✅ Eligibility check validation passed for wallet:', walletAddress);
    const ipHash = hashIP(ipAddress);

    // Get IP location and VPN detection
    logger.info('🌍 Getting IP location and VPN detection for:', ipAddress);
    const [ipLocation, vpnInfo] = await Promise.all([
      getIPLocation(ipAddress),
      detectVPN(ipAddress)
    ]);
    
    logger.info('📍 IP analysis results:', {
      location: ipLocation,
      vpn: vpnInfo
    });

    // Update or insert IP information
    logger.info('💾 Updating IP address information in database...');
    await query(`
      INSERT INTO ip_addresses (ip_address, ip_hash, country_code, region, city, is_vpn, is_proxy, risk_score)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (ip_hash) 
      DO UPDATE SET 
        last_seen = NOW(),
        is_vpn = $6,
        is_proxy = $7,
        risk_score = $8
    `, [
      ipAddress,
      ipHash, 
      ipLocation.country_code,
      ipLocation.region,
      ipLocation.city,
      vpnInfo.isVPN,
      vpnInfo.isProxy,
      vpnInfo.riskScore
    ]);

    // Check eligibility using database function
    logger.info('🔍 Checking airdrop eligibility using database function...');
    const eligibilityResult = await query(
      'SELECT * FROM can_user_claim_airdrop($1, $2, $3)',
      [walletAddress, ipHash, deviceFingerprint]
    );

    const eligibility = eligibilityResult.rows[0];
    logger.info('📊 Eligibility check result:', eligibility);

    // Log suspicious activity if needed
    if (eligibility.risk_score > 50) {
      await query(`
        INSERT INTO suspicious_activity (user_id, ip_address, activity_type, severity, description, metadata)
        VALUES (
          (SELECT id FROM users WHERE wallet_address = $1),
          $2, 'high_risk_claim', 
          CASE WHEN $3 > 80 THEN 'high' ELSE 'medium' END,
          'High risk airdrop claim attempt',
          $4
        )
      `, [
        walletAddress,
        ipAddress,
        eligibility.risk_score,
        JSON.stringify({
          riskScore: eligibility.risk_score,
          isVPN: vpnInfo.isVPN,
          deviceFingerprint: deviceFingerprint,
          userAgent: userAgent
        })
      ]);
    }

    res.json({
      success: true,
      canClaim: eligibility.can_claim,
      reason: eligibility.reason,
      riskScore: eligibility.risk_score,
      ipInfo: {
        location: ipLocation,
        isVPN: vpnInfo.isVPN,
        isProxy: vpnInfo.isProxy
      }
    });

  } catch (error) {
    logger.error('Error checking airdrop eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check eligibility',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Record airdrop claim attempt
router.post('/claim', [
  body('walletAddress')
    .isLength({ min: 42, max: 42 })
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid wallet address'),
  body('ipAddress')
    .isIP()
    .withMessage('Invalid IP address'),
  body('deviceFingerprint')
    .isString()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Invalid device fingerprint'),
  body('claimAmount')
    .isNumeric()
    .withMessage('Invalid claim amount'),
  body('transactionHash')
    .optional()
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid transaction hash'),
  body('status')
    .isIn(['pending', 'completed', 'failed', 'blocked'])
    .withMessage('Invalid status')
], async (req, res) => {
  try {
    logger.info('💾 Airdrop claim recording request:', {
      walletAddress: req.body.walletAddress,
      claimAmount: req.body.claimAmount,
      transactionHash: req.body.transactionHash,
      status: req.body.status,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error('❌ Validation errors in claim recording:', errors.array());
      return res.status(400).json({
        success: false,
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
      blockReason,
      userAgent
    } = req.body;

    logger.info('✅ Claim recording validation passed', {
      walletAddress,
      claimAmount,
      status
    });

    const ipHash = hashIP(ipAddress);

    // Get user ID
    logger.info('🔍 Looking up user ID for wallet:', walletAddress);
    const userResult = await query(
      'SELECT id FROM users WHERE wallet_address = $1',
      [walletAddress]
    );

    if (userResult.rows.length === 0) {
      logger.error('❌ User not found for wallet:', walletAddress);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userId = userResult.rows[0].id;
    logger.info('✅ Found user ID:', userId);

    // Check for existing claims to detect reuse
    const [ipClaims, deviceClaims] = await Promise.all([
      query('SELECT COUNT(*) as count FROM airdrop_claims WHERE ip_hash = $1 AND status = $2', [ipHash, 'completed']),
      query('SELECT COUNT(*) as count FROM airdrop_claims WHERE device_fingerprint = $1 AND status = $2', [deviceFingerprint, 'completed'])
    ]);

    const deviceReuseDetected = parseInt(deviceClaims.rows[0].count) > 0;
    const ipReuseDetected = parseInt(ipClaims.rows[0].count) > 0;

    // Get VPN detection
    const vpnInfo = await detectVPN(ipAddress);

    // Insert claim record
    logger.info('💾 Inserting claim record into database...', {
      userId,
      walletAddress,
      claimAmount,
      transactionHash,
      status,
      deviceReuseDetected,
      ipReuseDetected,
      vpnDetected: vpnInfo.isVPN
    });
    
    const claimResult = await query(`
      INSERT INTO airdrop_claims (
        user_id, wallet_address, ip_address, ip_hash, device_fingerprint,
        claim_amount, transaction_hash, status, block_reason,
        device_reuse_detected, ip_reuse_detected, vpn_detected, suspicious_activity
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, attempted_at
    `, [
      userId,
      walletAddress,
      ipAddress,
      ipHash,
      deviceFingerprint,
      claimAmount,
      transactionHash,
      status,
      blockReason,
      deviceReuseDetected,
      ipReuseDetected,
      vpnInfo.isVPN,
      deviceReuseDetected || ipReuseDetected || vpnInfo.isVPN
    ]);

    // Update completion time if successful
    if (status === 'completed' && transactionHash) {
      await query(
        'UPDATE airdrop_claims SET completed_at = NOW() WHERE id = $1',
        [claimResult.rows[0].id]
      );
    }

    // Log suspicious activity if detected
    if (deviceReuseDetected || ipReuseDetected || vpnInfo.isVPN) {
      const activityTypes = [];
      if (deviceReuseDetected) activityTypes.push('device_reuse');
      if (ipReuseDetected) activityTypes.push('ip_reuse');
      if (vpnInfo.isVPN) activityTypes.push('vpn_usage');

      await query(`
        INSERT INTO suspicious_activity (user_id, ip_address, activity_type, severity, description, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        userId,
        ipAddress,
        activityTypes.join(','),
        vpnInfo.isVPN ? 'high' : 'medium',
        `Suspicious airdrop claim: ${activityTypes.join(', ')}`,
        JSON.stringify({
          claimId: claimResult.rows[0].id,
          deviceReuseDetected,
          ipReuseDetected,
          vpnDetected: vpnInfo.isVPN,
          userAgent
        })
      ]);
    }

    const response = {
      success: true,
      claimId: claimResult.rows[0].id,
      timestamp: claimResult.rows[0].attempted_at,
      flagged: deviceReuseDetected || ipReuseDetected || vpnInfo.isVPN
    };

    logger.info('✅ Claim record saved successfully:', response);
    res.json(response);

  } catch (error) {
    logger.error('💥 ERROR RECORDING AIRDROP CLAIM:', error);
    logger.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      walletAddress: req.body?.walletAddress
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to record claim',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get airdrop statistics
router.get('/stats', async (req, res) => {
  try {
    const [totalClaims, totalAmount, uniqueUsers, recentClaims] = await Promise.all([
      query("SELECT COUNT(*) as count FROM airdrop_claims WHERE status = 'completed'"),
      query("SELECT SUM(claim_amount) as total FROM airdrop_claims WHERE status = 'completed'"),
      query("SELECT COUNT(DISTINCT user_id) as count FROM airdrop_claims WHERE status = 'completed'"),
      query(`
        SELECT COUNT(*) as count 
        FROM airdrop_claims 
        WHERE status = 'completed' 
        AND attempted_at > NOW() - INTERVAL '24 hours'
      `)
    ]);

    const suspiciousActivity = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE severity = 'high') as high_risk,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium_risk,
        COUNT(*) FILTER (WHERE reviewed = false) as unreviewed
      FROM suspicious_activity
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);

    res.json({
      success: true,
      stats: {
        totalClaims: parseInt(totalClaims.rows[0].count),
        totalAmount: parseFloat(totalAmount.rows[0].total || 0),
        uniqueUsers: parseInt(uniqueUsers.rows[0].count),
        claimsLast24Hours: parseInt(recentClaims.rows[0].count),
        suspiciousActivity: suspiciousActivity.rows[0]
      }
    });

  } catch (error) {
    logger.error('Error getting airdrop stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics'
    });
  }
});

// Get user's claim history
router.get('/user/:walletAddress/claims', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    const claims = await query(`
      SELECT 
        ac.*,
        ia.country_code,
        ia.city,
        ia.is_vpn
      FROM airdrop_claims ac
      LEFT JOIN ip_addresses ia ON ac.ip_hash = ia.ip_hash
      WHERE ac.wallet_address = $1
      ORDER BY ac.attempted_at DESC
    `, [walletAddress]);

    res.json({
      success: true,
      claims: claims.rows
    });

  } catch (error) {
    logger.error('Error getting user claims:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get claims'
    });
  }
});

module.exports = router;