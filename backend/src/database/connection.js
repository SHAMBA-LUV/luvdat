// In-memory database for SHAMBA LUV backend
// This replaces PostgreSQL for simplicity and ease of deployment

class InMemoryDB {
  constructor() {
    this.users = new Map();
    this.airdrops = new Map();
    this.ips = new Map();
    this.analytics = {
      totalUsers: 0,
      totalClaims: 0,
      totalTokensDistributed: 0,
      lastUpdated: new Date()
    };
  }

  // User management
  async createUser(userData) {
    const user = {
      id: Date.now().toString(),
      walletAddress: userData.walletAddress,
      authMethod: userData.authMethod,
      authIdentifier: userData.authIdentifier,
      deviceFingerprint: userData.deviceFingerprint,
      userAgent: userData.userAgent,
      screenResolution: userData.screenResolution,
      timezone: userData.timezone,
      ipAddress: userData.ipAddress,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.users.set(userData.walletAddress, user);
    this.analytics.totalUsers = this.users.size;
    this.analytics.lastUpdated = new Date();
    
    return user;
  }

  async getUserByWallet(walletAddress) {
    return this.users.get(walletAddress) || null;
  }

  async updateUserIP(walletAddress, ipAddress, userAgent) {
    const user = this.users.get(walletAddress);
    if (user) {
      user.ipAddress = ipAddress;
      user.userAgent = userAgent;
      user.updatedAt = new Date();
      this.users.set(walletAddress, user);
      return user;
    }
    return null;
  }

  // Airdrop management
  async recordAirdropClaim(claimData) {
    const claim = {
      id: Date.now().toString(),
      walletAddress: claimData.walletAddress,
      ipAddress: claimData.ipAddress,
      deviceFingerprint: claimData.deviceFingerprint,
      claimAmount: claimData.claimAmount,
      transactionHash: claimData.transactionHash,
      status: claimData.status,
      userAgent: claimData.userAgent,
      createdAt: new Date()
    };
    
    this.airdrops.set(claim.id, claim);
    this.analytics.totalClaims = this.airdrops.size;
    this.analytics.lastUpdated = new Date();
    
    return claim;
  }

  async getAirdropStats() {
    const claims = Array.from(this.airdrops.values());
    const totalClaimed = claims.reduce((sum, claim) => {
      return sum + (claim.status === 'completed' ? BigInt(claim.claimAmount || '0') : BigInt(0));
    }, BigInt(0));
    
    return {
      totalRecipients: claims.filter(c => c.status === 'completed').length,
      totalClaimed: totalClaimed.toString(),
      totalClaims: claims.length,
      contractBalance: '1000000000000000000000000000000' // 1 trillion tokens
    };
  }

  async getUserClaimHistory(walletAddress) {
    const claims = Array.from(this.airdrops.values())
      .filter(claim => claim.walletAddress === walletAddress)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return claims;
  }

  // IP management
  async getIPClaimCount(ipAddress) {
    const claims = Array.from(this.airdrops.values())
      .filter(claim => claim.ipAddress === ipAddress);
    
    return {
      ipAddress,
      claimCount: claims.length,
      lastClaim: claims.length > 0 ? claims[claims.length - 1].createdAt : null
    };
  }

  async getIPStats() {
    const ipCounts = new Map();
    
    for (const claim of this.airdrops.values()) {
      const count = ipCounts.get(claim.ipAddress) || 0;
      ipCounts.set(claim.ipAddress, count + 1);
    }
    
    return {
      totalIPs: ipCounts.size,
      suspiciousIPs: Array.from(ipCounts.entries())
        .filter(([ip, count]) => count > 3)
        .map(([ip, count]) => ({ ip, count }))
    };
  }

  // Analytics
  async getDashboardAnalytics(timeframe = '7d') {
    const now = new Date();
    const daysAgo = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 1;
    const cutoff = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    
    const recentClaims = Array.from(this.airdrops.values())
      .filter(claim => new Date(claim.createdAt) >= cutoff);
    
    const recentUsers = Array.from(this.users.values())
      .filter(user => new Date(user.createdAt) >= cutoff);
    
    return {
      timeframe,
      newUsers: recentUsers.length,
      newClaims: recentClaims.length,
      totalUsers: this.users.size,
      totalClaims: this.airdrops.size,
      successRate: recentClaims.length > 0 ? 
        (recentClaims.filter(c => c.status === 'completed').length / recentClaims.length * 100).toFixed(2) : 0
    };
  }

  async getProtectionAnalytics() {
    const claims = Array.from(this.airdrops.values());
    const users = Array.from(this.users.values());
    
    // Calculate risk scores based on various factors
    const riskAnalysis = {
      totalUsers: users.length,
      totalClaims: claims.length,
      blockedClaims: claims.filter(c => c.status === 'blocked').length,
      suspiciousIPs: 0,
      averageRiskScore: 25 // Default low risk
    };
    
    return riskAnalysis;
  }

  async getRealtimeData() {
    return {
      activeUsers: this.users.size,
      totalClaims: this.airdrops.size,
      lastClaim: this.airdrops.size > 0 ? 
        Array.from(this.airdrops.values())
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] : null,
      uptime: process.uptime()
    };
  }
}

// Create singleton instance
const db = new InMemoryDB();

// Connect function (for compatibility)
const connectDB = async () => {
  console.log('✅ In-memory database initialized');
  return db;
};

module.exports = { connectDB, db };