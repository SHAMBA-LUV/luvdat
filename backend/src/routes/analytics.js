const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { query } = require('../database/connection');

// Dashboard analytics
router.get('/dashboard', async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '7d'; // 1d, 7d, 30d
    
    let interval = '1 day';
    let dateFormat = 'YYYY-MM-DD';
    
    switch (timeframe) {
      case '1d':
        interval = '1 day';
        dateFormat = 'YYYY-MM-DD HH24:00';
        break;
      case '7d':
        interval = '7 days';
        dateFormat = 'YYYY-MM-DD';
        break;
      case '30d':
        interval = '30 days';
        dateFormat = 'YYYY-MM-DD';
        break;
    }

    // User statistics
    const [totalUsers, newUsers, activeUsers] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users'),
      query(`SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '${interval}'`),
      query(`SELECT COUNT(DISTINCT user_id) as count FROM auth_events WHERE created_at > NOW() - INTERVAL '${interval}'`)
    ]);

    // Airdrop statistics
    const [totalClaims, successfulClaims, totalDistributed, failedClaims] = await Promise.all([
      query('SELECT COUNT(*) as count FROM airdrop_claims'),
      query("SELECT COUNT(*) as count FROM airdrop_claims WHERE status = 'completed'"),
      query("SELECT SUM(claim_amount) as total FROM airdrop_claims WHERE status = 'completed'"),
      query("SELECT COUNT(*) as count FROM airdrop_claims WHERE status = 'failed'")
    ]);

    // Protection statistics
    const [blockedClaims, suspiciousActivity, bannedIPs, vpnAttempts] = await Promise.all([
      query("SELECT COUNT(*) as count FROM airdrop_claims WHERE status = 'blocked'"),
      query(`SELECT COUNT(*) as count FROM suspicious_activity WHERE created_at > NOW() - INTERVAL '${interval}'`),
      query('SELECT COUNT(*) as count FROM ip_addresses WHERE is_banned = true'),
      query('SELECT COUNT(*) as count FROM airdrop_claims WHERE vpn_detected = true')
    ]);

    // Time series data for charts
    const userRegistrations = await query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('day', created_at), '${dateFormat}') as date,
        COUNT(*) as registrations
      FROM users
      WHERE created_at > NOW() - INTERVAL '${interval}'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date
    `);

    const claimActivity = await query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('day', attempted_at), '${dateFormat}') as date,
        COUNT(*) as claims,
        COUNT(*) FILTER (WHERE status = 'completed') as successful,
        COUNT(*) FILTER (WHERE status = 'blocked') as blocked
      FROM airdrop_claims
      WHERE attempted_at > NOW() - INTERVAL '${interval}'
      GROUP BY DATE_TRUNC('day', attempted_at)
      ORDER BY date
    `);

    // Geographic distribution
    const geoDistribution = await query(`
      SELECT 
        ia.country_code,
        ia.region,
        COUNT(DISTINCT u.id) as users,
        COUNT(ac.id) as claims
      FROM users u
      LEFT JOIN ip_addresses ia ON u.current_ip = ia.ip_address
      LEFT JOIN airdrop_claims ac ON u.id = ac.user_id
      WHERE ia.country_code IS NOT NULL AND ia.country_code != 'UNKNOWN'
      GROUP BY ia.country_code, ia.region
      ORDER BY users DESC
      LIMIT 20
    `);

    // Auth method distribution
    const authMethods = await query(`
      SELECT 
        auth_method,
        COUNT(*) as user_count,
        COUNT(ac.id) as claim_count
      FROM users u
      LEFT JOIN airdrop_claims ac ON u.id = ac.user_id
      GROUP BY auth_method
      ORDER BY user_count DESC
    `);

    res.json({
      success: true,
      timeframe,
      overview: {
        users: {
          total: parseInt(totalUsers.rows[0].count),
          new: parseInt(newUsers.rows[0].count),
          active: parseInt(activeUsers.rows[0].count)
        },
        airdrops: {
          totalClaims: parseInt(totalClaims.rows[0].count),
          successful: parseInt(successfulClaims.rows[0].count),
          failed: parseInt(failedClaims.rows[0].count),
          totalDistributed: parseFloat(totalDistributed.rows[0].total || 0)
        },
        protection: {
          blocked: parseInt(blockedClaims.rows[0].count),
          suspicious: parseInt(suspiciousActivity.rows[0].count),
          bannedIPs: parseInt(bannedIPs.rows[0].count),
          vpnAttempts: parseInt(vpnAttempts.rows[0].count)
        }
      },
      timeSeries: {
        userRegistrations: userRegistrations.rows,
        claimActivity: claimActivity.rows
      },
      distributions: {
        geographic: geoDistribution.rows,
        authMethods: authMethods.rows
      }
    });

  } catch (error) {
    logger.error('Error getting dashboard analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics'
    });
  }
});

// Protection system statistics
router.get('/protection', async (req, res) => {
  try {
    // Protection effectiveness metrics
    const protectionMetrics = await query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_claims,
        COUNT(*) FILTER (WHERE status = 'blocked') as blocked_claims,
        COUNT(*) FILTER (WHERE device_reuse_detected = true) as device_reuse,
        COUNT(*) FILTER (WHERE ip_reuse_detected = true) as ip_reuse,
        COUNT(*) FILTER (WHERE vpn_detected = true) as vpn_detected,
        COUNT(*) FILTER (WHERE suspicious_activity = true) as suspicious_flagged
      FROM airdrop_claims
      WHERE attempted_at > NOW() - INTERVAL '30 days'
    `);

    // Top suspicious activities
    const suspiciousTypes = await query(`
      SELECT 
        activity_type,
        severity,
        COUNT(*) as incident_count,
        COUNT(*) FILTER (WHERE reviewed = false) as unreviewed
      FROM suspicious_activity
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY activity_type, severity
      ORDER BY incident_count DESC
    `);

    // Risk score distribution
    const riskDistribution = await query(`
      SELECT 
        CASE 
          WHEN risk_score = 0 THEN 'No Risk (0)'
          WHEN risk_score <= 30 THEN 'Low (1-30)'
          WHEN risk_score <= 60 THEN 'Medium (31-60)'
          WHEN risk_score <= 80 THEN 'High (61-80)'
          ELSE 'Critical (81-100)'
        END as risk_category,
        COUNT(*) as count
      FROM ip_addresses
      GROUP BY 
        CASE 
          WHEN risk_score = 0 THEN 'No Risk (0)'
          WHEN risk_score <= 30 THEN 'Low (1-30)'
          WHEN risk_score <= 60 THEN 'Medium (31-60)'
          WHEN risk_score <= 80 THEN 'High (61-80)'
          ELSE 'Critical (81-100)'
        END
      ORDER BY 
        CASE 
          WHEN risk_score = 0 THEN 0
          WHEN risk_score <= 30 THEN 1
          WHEN risk_score <= 60 THEN 2
          WHEN risk_score <= 80 THEN 3
          ELSE 4
        END
    `);

    // Recent protection actions
    const recentActions = await query(`
      SELECT 
        sa.activity_type,
        sa.severity,
        sa.description,
        sa.created_at,
        u.wallet_address,
        ia.country_code
      FROM suspicious_activity sa
      LEFT JOIN users u ON sa.user_id = u.id
      LEFT JOIN ip_addresses ia ON sa.ip_address = ia.ip_address
      ORDER BY sa.created_at DESC
      LIMIT 50
    `);

    // Protection rules effectiveness
    const rulesEffectiveness = await query(`
      SELECT 
        pr.rule_name,
        pr.rule_type,
        pr.rule_value,
        pr.is_active,
        COUNT(ac.id) as blocked_claims
      FROM protection_rules pr
      LEFT JOIN airdrop_claims ac ON ac.status = 'blocked' 
        AND ac.block_reason LIKE '%' || pr.rule_name || '%'
      GROUP BY pr.id, pr.rule_name, pr.rule_type, pr.rule_value, pr.is_active
      ORDER BY blocked_claims DESC
    `);

    res.json({
      success: true,
      protection: {
        metrics: protectionMetrics.rows[0],
        suspiciousTypes: suspiciousTypes.rows,
        riskDistribution: riskDistribution.rows,
        recentActions: recentActions.rows,
        rulesEffectiveness: rulesEffectiveness.rows
      }
    });

  } catch (error) {
    logger.error('Error getting protection analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get protection analytics'
    });
  }
});

// Real-time monitoring data
router.get('/realtime', async (req, res) => {
  try {
    const [activeUsers, recentClaims, recentSuspicious] = await Promise.all([
      // Active users in last hour
      query(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM auth_events
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `),
      
      // Recent claims
      query(`
        SELECT 
          ac.*,
          u.auth_method,
          ia.country_code
        FROM airdrop_claims ac
        LEFT JOIN users u ON ac.user_id = u.id
        LEFT JOIN ip_addresses ia ON ac.ip_hash = ia.ip_hash
        WHERE ac.attempted_at > NOW() - INTERVAL '1 hour'
        ORDER BY ac.attempted_at DESC
        LIMIT 20
      `),
      
      // Recent suspicious activity
      query(`
        SELECT 
          sa.*,
          u.wallet_address,
          ia.country_code
        FROM suspicious_activity sa
        LEFT JOIN users u ON sa.user_id = u.id
        LEFT JOIN ip_addresses ia ON sa.ip_address = ia.ip_address
        WHERE sa.created_at > NOW() - INTERVAL '1 hour'
        ORDER BY sa.created_at DESC
        LIMIT 10
      `)
    ]);

    res.json({
      success: true,
      realtime: {
        activeUsers: parseInt(activeUsers.rows[0].count),
        recentClaims: recentClaims.rows,
        recentSuspicious: recentSuspicious.rows,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error getting realtime analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get realtime data'
    });
  }
});

module.exports = router;