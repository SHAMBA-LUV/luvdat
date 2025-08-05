const crypto = require('crypto');
const axios = require('axios');
const logger = require('./logger');

// Hash IP address for privacy
const hashIP = (ip) => {
  const salt = process.env.IP_SALT || 'shamba_luv_salt_2024';
  return crypto.createHash('sha256').update(ip + salt).digest('hex');
};

// Get IP geolocation
const getIPLocation = async (ip) => {
  try {
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return {
        country_code: 'LOCAL',
        region: 'Local',
        city: 'Localhost'
      };
    }

    // For development/testing, return default values without API calls
    if (process.env.NODE_ENV === 'development' && ip === '127.0.0.1') {
      return {
        country_code: 'DEV',
        region: 'Development',
        city: 'Localhost'
      };
    }

    if (process.env.IP_GEOLOCATION_API_KEY) {
      const response = await axios.get(`${process.env.IP_API_URL}`, {
        params: {
          apiKey: process.env.IP_GEOLOCATION_API_KEY,
          ip: ip
        },
        timeout: 5000
      });

      return {
        country_code: response.data.country_code2 || 'UNKNOWN',
        region: response.data.state_prov || 'Unknown',
        city: response.data.city || 'Unknown'
      };
    } else {
      // Skip external API calls in development
      if (process.env.NODE_ENV === 'development') {
        return {
          country_code: 'DEV',
          region: 'Development',
          city: 'Development'
        };
      }
      
      // Fallback to free service (only in production)
      const response = await axios.get(`http://ip-api.com/json/${ip}`, {
        timeout: 5000
      });

      if (response.data.status === 'success') {
        return {
          country_code: response.data.countryCode || 'UNKNOWN',
          region: response.data.regionName || 'Unknown',
          city: response.data.city || 'Unknown'
        };
      }
    }

    return {
      country_code: 'UNKNOWN',
      region: 'Unknown',
      city: 'Unknown'
    };
  } catch (error) {
    logger.warn('IP geolocation failed:', error.message);
    return {
      country_code: 'UNKNOWN',
      region: 'Unknown',
      city: 'Unknown'
    };
  }
};

// Detect VPN/Proxy
const detectVPN = async (ip) => {
  try {
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return {
        isVPN: false,
        isProxy: false,
        riskScore: 0
      };
    }

    // Skip VPN detection in development to avoid external API calls
    if (process.env.NODE_ENV === 'development') {
      return {
        isVPN: false,
        isProxy: false,
        riskScore: 0
      };
    }

    if (process.env.VPN_DETECTION_API_KEY) {
      const response = await axios.get(`${process.env.VPN_API_URL}/${ip}`, {
        params: {
          key: process.env.VPN_DETECTION_API_KEY
        },
        timeout: 5000
      });

      return {
        isVPN: response.data.security?.vpn || false,
        isProxy: response.data.security?.proxy || false,
        riskScore: response.data.security?.risk_score || 0
      };
    }

    // Basic heuristic checks without API (disabled in development)
    return {
      isVPN: false,
      isProxy: false,
      riskScore: 0
    };
  } catch (error) {
    logger.warn('VPN detection failed:', error.message);
    return {
      isVPN: false,
      isProxy: false,
      riskScore: 0
    };
  }
};

// Simple check for commonly used VPN/proxy ports (basic heuristic)
const checkSuspiciousPorts = async (ip) => {
  // This is a basic check - in production you'd use proper VPN detection services
  const suspiciousPorts = [1080, 3128, 8080, 8888, 9050];
  
  try {
    // Simple timeout-based port check (very basic)
    const promises = suspiciousPorts.map(port => 
      new Promise((resolve) => {
        const socket = require('net').createConnection(port, ip);
        socket.setTimeout(1000);
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        socket.on('error', () => resolve(false));
      })
    );

    const results = await Promise.all(promises);
    return results.some(open => open);
  } catch (error) {
    return false;
  }
};

// Generate device fingerprint hash
const hashDeviceFingerprint = (fingerprint) => {
  return crypto.createHash('sha256').update(fingerprint).digest('hex');
};

// Validate wallet address
const isValidWalletAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Validate IP address
const isValidIP = (ip) => {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

// Rate limiting helper
const createRateLimit = (windowMs, maxRequests) => {
  const requests = new Map();
  
  return (identifier) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    for (const [key, timestamps] of requests.entries()) {
      const validTimestamps = timestamps.filter(ts => ts > windowStart);
      if (validTimestamps.length === 0) {
        requests.delete(key);
      } else {
        requests.set(key, validTimestamps);
      }
    }
    
    // Check current identifier
    const userRequests = requests.get(identifier) || [];
    const recentRequests = userRequests.filter(ts => ts > windowStart);
    
    if (recentRequests.length >= maxRequests) {
      return false; // Rate limited
    }
    
    recentRequests.push(now);
    requests.set(identifier, recentRequests);
    return true; // Allowed
  };
};

module.exports = {
  hashIP,
  getIPLocation,
  detectVPN,
  hashDeviceFingerprint,
  isValidWalletAddress,
  isValidIP,
  createRateLimit
};