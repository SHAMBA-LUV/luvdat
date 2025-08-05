const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../utils/logger');
const { query } = require('../database/connection');
const { hashIP } = require('../utils/security');

// Get IP claim count
router.get('/:ipHash/claims', async (req, res) => {
  try {
    const { ipHash } = req.params;
    
    if (!ipHash.match(/^[a-fA-F0-9]{64}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid IP hash format'
      });
    }

    const result = await query(
      'SELECT get_ip_claim_count($1) as claim_count',
      [ipHash]
    );

    const claimCount = parseInt(result.rows[0].claim_count);

    // Get additional IP info
    const ipInfo = await query(`
      SELECT country_code, region, city, is_vpn, is_banned, risk_score, total_users
      FROM ip_addresses 
      WHERE ip_hash = $1
    `, [ipHash]);

    res.json({
      success: true,
      claimCount,
      ipInfo: ipInfo.rows[0] || null
    });

  } catch (error) {
    logger.error('Error getting IP claims:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get IP claims'
    });
  }
});

// Ban IP address
router.post('/ban', [
  body('ipAddress')
    .isIP()
    .withMessage('Invalid IP address'),
  body('reason')
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('Ban reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { ipAddress, reason } = req.body;
    const ipHash = hashIP(ipAddress);

    // Update IP as banned
    const result = await query(`
      UPDATE ip_addresses 
      SET is_banned = true, banned_at = NOW(), ban_reason = $1
      WHERE ip_hash = $2
      RETURNING id
    `, [reason, ipHash]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'IP address not found'
      });
    }

    // Log the ban action
    await query(`
      INSERT INTO suspicious_activity (ip_address, activity_type, severity, description, auto_detected)
      VALUES ($1, 'ip_ban', 'critical', $2, false)
    `, [ipAddress, `IP banned: ${reason}`]);

    logger.info(`IP address banned: ${ipAddress} - ${reason}`);

    res.json({
      success: true,
      message: 'IP address banned successfully'
    });

  } catch (error) {
    logger.error('Error banning IP address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ban IP address'
    });
  }
});

// Unban IP address
router.post('/unban', [
  body('ipAddress')
    .isIP()
    .withMessage('Invalid IP address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { ipAddress } = req.body;
    const ipHash = hashIP(ipAddress);

    // Update IP as unbanned
    const result = await query(`
      UPDATE ip_addresses 
      SET is_banned = false, banned_at = NULL, ban_reason = NULL
      WHERE ip_hash = $1
      RETURNING id
    `, [ipHash]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'IP address not found'
      });
    }

    logger.info(`IP address unbanned: ${ipAddress}`);

    res.json({
      success: true,
      message: 'IP address unbanned successfully'
    });

  } catch (error) {
    logger.error('Error unbanning IP address:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unban IP address'
    });
  }
});

// Get suspicious IP activity
router.get('/suspicious', async (req, res) => {
  try {
    const { limit = 50, severity = 'all' } = req.query;

    let whereClause = '';
    let params = [parseInt(limit)];

    if (severity !== 'all') {
      whereClause = 'WHERE sa.severity = $2';
      params.push(severity);
    }

    const suspiciousIPs = await query(`
      SELECT 
        sa.ip_address,
        ia.ip_hash,
        ia.country_code,
        ia.city,
        ia.is_banned,
        COUNT(*) as incident_count,
        MAX(sa.created_at) as last_incident,
        array_agg(DISTINCT sa.activity_type) as activity_types,
        array_agg(DISTINCT sa.severity) as severities,
        SUM(CASE WHEN sa.reviewed = false THEN 1 ELSE 0 END) as unreviewed_count
      FROM suspicious_activity sa
      LEFT JOIN ip_addresses ia ON sa.ip_address = ia.ip_address
      ${whereClause}
      AND sa.created_at > NOW() - INTERVAL '30 days'
      GROUP BY sa.ip_address, ia.ip_hash, ia.country_code, ia.city, ia.is_banned
      ORDER BY incident_count DESC, last_incident DESC
      LIMIT $1
    `, params);

    res.json({
      success: true,
      suspiciousIPs: suspiciousIPs.rows
    });

  } catch (error) {
    logger.error('Error getting suspicious IPs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get suspicious IP activity'
    });
  }
});

// Get IP statistics
router.get('/stats', async (req, res) => {
  try {
    const [totalIPs, bannedIPs, vpnIPs, highRiskIPs] = await Promise.all([
      query('SELECT COUNT(*) as count FROM ip_addresses'),
      query('SELECT COUNT(*) as count FROM ip_addresses WHERE is_banned = true'),
      query('SELECT COUNT(*) as count FROM ip_addresses WHERE is_vpn = true'),
      query('SELECT COUNT(*) as count FROM ip_addresses WHERE risk_score > 70')
    ]);

    const topCountries = await query(`
      SELECT country_code, COUNT(*) as user_count
      FROM ip_addresses 
      WHERE country_code != 'UNKNOWN'
      GROUP BY country_code
      ORDER BY user_count DESC
      LIMIT 10
    `);

    const recentActivity = await query(`
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as new_ips
      FROM ip_addresses
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
    `);

    res.json({
      success: true,
      stats: {
        totalIPs: parseInt(totalIPs.rows[0].count),
        bannedIPs: parseInt(bannedIPs.rows[0].count),
        vpnIPs: parseInt(vpnIPs.rows[0].count),
        highRiskIPs: parseInt(highRiskIPs.rows[0].count),
        topCountries: topCountries.rows,
        recentActivity: recentActivity.rows
      }
    });

  } catch (error) {
    logger.error('Error getting IP stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get IP statistics'
    });
  }
});

module.exports = router;