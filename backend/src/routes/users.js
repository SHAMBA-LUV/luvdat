const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../utils/logger');
const { query } = require('../database/connection');
const { hashIP, getIPLocation, detectVPN, hashDeviceFingerprint } = require('../utils/security');

// Register new user/wallet
router.post('/register', [
  body('walletAddress')
    .isLength({ min: 42, max: 42 })
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid wallet address'),
  body('authMethod')
    .isIn(['google', 'apple', 'facebook', 'discord', 'line', 'x', 'coinbase', 'farcaster', 'telegram', 'github', 'twitch', 'steam', 'email', 'phone', 'passkey', 'guest', 'metamask', 'coinbase_wallet', 'unknown'])
    .withMessage('Invalid auth method'),
  body('authIdentifier')
    .optional()
    .isString()
    .isLength({ max: 255 }),
  body('deviceFingerprint')
    .isString()
    .isLength({ min: 1, max: 50000 })
    .withMessage('Invalid device fingerprint'),
  body('userAgent')
    .optional()
    .isString()
    .isLength({ max: 1000 }),
  body('screenResolution')
    .optional()
    .matches(/^\d+x\d+$/)
    .withMessage('Invalid screen resolution'),
  body('timezone')
    .optional()
    .isString()
    .isLength({ max: 50 }),
  body('ipAddress')
    .isIP()
    .withMessage('Invalid IP address')
], async (req, res) => {
  try {
    // Log the incoming request for debugging
    logger.info('User registration request received:', {
      body: req.body,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error('Validation errors in user registration:', errors.array());
      return res.status(400).json({
        success: false,
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

    // Truncate device fingerprint to avoid database index size limit (2704 bytes max)
    const truncatedFingerprint = deviceFingerprint ? deviceFingerprint.substring(0, 2000) : null;

    const ipHash = hashIP(ipAddress);

    // Check if wallet already exists
    const existingUser = await query(
      'SELECT id, wallet_address FROM users WHERE wallet_address = $1',
      [walletAddress]
    );

    if (existingUser.rows.length > 0) {
      // Update existing user's IP and timestamp
      await query(`
        UPDATE users SET 
          current_ip = $1, 
          updated_at = NOW(),
          user_agent = $2
        WHERE wallet_address = $3
      `, [ipAddress, userAgent, walletAddress]);

      // Log the auth event
      await query(`
        INSERT INTO auth_events (user_id, wallet_address, auth_method, auth_identifier, ip_address, device_fingerprint, user_agent, event_type, success)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'login', true)
      `, [
        existingUser.rows[0].id,
        walletAddress,
        authMethod,
        authIdentifier,
        ipAddress,
        truncatedFingerprint,
        userAgent,
      ]);

      return res.json({
        success: true,
        message: 'User login recorded',
        userId: existingUser.rows[0].id,
        isNewUser: false
      });
    }

    // Get IP location and VPN info
    const [ipLocation, vpnInfo] = await Promise.all([
      getIPLocation(ipAddress),
      detectVPN(ipAddress)
    ]);

    // Insert or update IP address info
    await query(`
      INSERT INTO ip_addresses (ip_address, ip_hash, country_code, region, city, is_vpn, is_proxy, risk_score, total_users)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
      ON CONFLICT (ip_hash) 
      DO UPDATE SET 
        last_seen = NOW(),
        total_users = ip_addresses.total_users + 1,
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

    // Create new user
    const userResult = await query(`
      INSERT INTO users (
        wallet_address, auth_method, auth_identifier, device_fingerprint, 
        user_agent, screen_resolution, timezone, first_seen_ip, current_ip
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, created_at
    `, [
      walletAddress,
      authMethod,
      authIdentifier,
      truncatedFingerprint,
      userAgent,
      screenResolution,
      timezone,
      ipAddress,
      ipAddress
    ]);

    const newUser = userResult.rows[0];

    // Log the registration event
    await query(`
      INSERT INTO auth_events (user_id, wallet_address, auth_method, auth_identifier, ip_address, device_fingerprint, user_agent, event_type, success)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'wallet_creation', true)
    `, [
      newUser.id,
      walletAddress,
      authMethod,
      authIdentifier,
      ipAddress,
      truncatedFingerprint,
      userAgent
    ]);

    // Insert initial IP history record
    await query(`
      INSERT INTO user_ip_history (user_id, ip_address, ip_hash)
      VALUES ($1, $2, $3)
    `, [newUser.id, ipAddress, ipHash]);

    // Check for suspicious patterns with new user
    const suspiciousChecks = await Promise.all([
      // Check if this IP has many recent registrations
      query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE first_seen_ip = $1 
        AND created_at > NOW() - INTERVAL '1 hour'
      `, [ipAddress]),
      
      // Check if this device fingerprint has been used recently
      query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE device_fingerprint = $1 
        AND created_at > NOW() - INTERVAL '1 hour'
      `, [truncatedFingerprint])
    ]);

    const ipRegistrations = parseInt(suspiciousChecks[0].rows[0].count);
    const deviceRegistrations = parseInt(suspiciousChecks[1].rows[0].count);

    // Log suspicious activity if detected
    if (ipRegistrations > 3 || deviceRegistrations > 2 || vpnInfo.riskScore > 70) {
      const suspiciousReasons = [];
      if (ipRegistrations > 3) suspiciousReasons.push(`${ipRegistrations} registrations from IP in 1 hour`);
      if (deviceRegistrations > 2) suspiciousReasons.push(`${deviceRegistrations} registrations from device in 1 hour`);
      if (vpnInfo.riskScore > 70) suspiciousReasons.push(`High VPN risk score: ${vpnInfo.riskScore}`);

      await query(`
        INSERT INTO suspicious_activity (user_id, ip_address, activity_type, severity, description, metadata)
        VALUES ($1, $2, 'rapid_registration', $3, $4, $5)
      `, [
        newUser.id,
        ipAddress,
        vpnInfo.riskScore > 80 ? 'high' : 'medium',
        `Suspicious registration pattern: ${suspiciousReasons.join(', ')}`,
        JSON.stringify({
          ipRegistrations,
          deviceRegistrations,
          vpnRiskScore: vpnInfo.riskScore,
          authMethod,
          ipLocation
        })
      ]);
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      userId: newUser.id,
      isNewUser: true,
      createdAt: newUser.created_at,
      riskInfo: {
        isVPN: vpnInfo.isVPN,
        riskScore: vpnInfo.riskScore,
        location: ipLocation
      }
    });

  } catch (error) {
    logger.error('Error registering user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register user'
    });
  }
});

// Get user details
router.get('/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    const userResult = await query(`
      SELECT 
        u.*,
        ia.country_code,
        ia.region,
        ia.city,
        ia.is_vpn,
        ia.risk_score
      FROM users u
      LEFT JOIN ip_addresses ia ON u.current_ip = ia.ip_address
      WHERE u.wallet_address = $1
    `, [walletAddress]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Get user's IP history
    const ipHistory = await query(`
      SELECT 
        uih.*,
        ia.country_code,
        ia.city
      FROM user_ip_history uih
      LEFT JOIN ip_addresses ia ON uih.ip_hash = ia.ip_hash
      WHERE uih.user_id = $1
      ORDER BY uih.changed_at DESC
      LIMIT 10
    `, [user.id]);

    // Get recent auth events
    const authEvents = await query(`
      SELECT event_type, auth_method, success, created_at, ip_address
      FROM auth_events
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [user.id]);

    res.json({
      success: true,
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        authMethod: user.auth_method,
        screenResolution: user.screen_resolution,
        timezone: user.timezone,
        location: {
          country: user.country_code,
          region: user.region,
          city: user.city
        },
        isVPN: user.is_vpn,
        riskScore: user.risk_score,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        ipHistory: ipHistory.rows,
        authEvents: authEvents.rows
      }
    });

  } catch (error) {
    logger.error('Error getting user details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user details'
    });
  }
});

// Update user IP address
router.put('/:walletAddress/ip', [
  body('ipAddress')
    .isIP()
    .withMessage('Invalid IP address'),
  body('userAgent')
    .optional()
    .isString()
    .isLength({ max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { walletAddress } = req.params;
    const { ipAddress, userAgent } = req.body;

    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wallet address'
      });
    }

    const ipHash = hashIP(ipAddress);

    // Get user
    const userResult = await query(
      'SELECT id, current_ip FROM users WHERE wallet_address = $1',
      [walletAddress]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];
    const oldIP = user.current_ip;

    // Check if IP actually changed
    if (oldIP === ipAddress) {
      return res.json({
        success: true,
        message: 'IP address unchanged'
      });
    }

    // Get location info for new IP
    const [ipLocation, vpnInfo] = await Promise.all([
      getIPLocation(ipAddress),
      detectVPN(ipAddress)
    ]);

    // Update or insert new IP info
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

    // Update user's current IP
    await query(`
      UPDATE users SET 
        current_ip = $1, 
        updated_at = NOW(),
        user_agent = $2
      WHERE id = $3
    `, [ipAddress, userAgent, user.id]);

    // Get old IP location for comparison
    const oldIPLocation = await getIPLocation(oldIP);
    const locationChanged = oldIPLocation.country_code !== ipLocation.country_code;
    const suspiciousChange = locationChanged && vpnInfo.riskScore > 50;

    // Insert IP history record
    await query(`
      INSERT INTO user_ip_history (user_id, ip_address, ip_hash, location_changed, suspicious_change)
      VALUES ($1, $2, $3, $4, $5)
    `, [user.id, ipAddress, ipHash, locationChanged, suspiciousChange]);

    // Log suspicious IP changes
    if (suspiciousChange) {
      await query(`
        INSERT INTO suspicious_activity (user_id, ip_address, activity_type, severity, description, metadata)
        VALUES ($1, $2, 'ip_change', 'medium', $3, $4)
      `, [
        user.id,
        ipAddress,
        `Suspicious IP change from ${oldIPLocation.country_code} to ${ipLocation.country_code}`,
        JSON.stringify({
          oldIP: oldIP,
          newIP: ipAddress,
          oldLocation: oldIPLocation,
          newLocation: ipLocation,
          vpnRiskScore: vpnInfo.riskScore
        })
      ]);
    }

    res.json({
      success: true,
      message: 'IP address updated',
      locationChanged,
      suspiciousChange,
      newLocation: ipLocation,
      riskScore: vpnInfo.riskScore
    });

  } catch (error) {
    logger.error('Error updating user IP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update IP address'
    });
  }
});

module.exports = router;