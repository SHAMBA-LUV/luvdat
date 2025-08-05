// API client for SHAMBA LUV backend
const API_BASE_URL = 'http://localhost:3001/api/v1';

export interface UserRegistrationData {
  walletAddress: string;
  authMethod: string;
  authIdentifier?: string;
  deviceFingerprint: string;
  userAgent?: string;
  screenResolution?: string;
  timezone?: string;
  ipAddress: string;
}

export interface AirdropEligibilityCheck {
  walletAddress: string;
  ipAddress: string;
  deviceFingerprint: string;
  userAgent?: string;
}

export interface AirdropClaimData {
  walletAddress: string;
  ipAddress: string;
  deviceFingerprint: string;
  claimAmount: string;
  transactionHash?: string;
  status: 'pending' | 'completed' | 'failed' | 'blocked';
  blockReason?: string;
  userAgent?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: any[];
}

export interface EligibilityResponse {
  canClaim: boolean;
  reason?: string;
  riskScore: number;
  ipInfo?: {
    location: {
      country_code: string;
      region: string;
      city: string;
    };
    isVPN: boolean;
    isProxy: boolean;
  };
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error(`API Error [${response.status}]:`, data);
        return {
          success: false,
          message: data.message || `HTTP ${response.status}`,
          errors: data.errors
        };
      }

      return {
        success: true,
        data: data.success ? data : { ...data, success: true }
      };
    } catch (error) {
      console.error('API Request failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  // User management
  async registerUser(userData: UserRegistrationData): Promise<ApiResponse> {
    return this.request('/users/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getUserDetails(walletAddress: string): Promise<ApiResponse> {
    return this.request(`/users/${walletAddress}`);
  }

  async updateUserIP(walletAddress: string, ipAddress: string, userAgent?: string): Promise<ApiResponse> {
    return this.request(`/users/${walletAddress}/ip`, {
      method: 'PUT',
      body: JSON.stringify({ ipAddress, userAgent }),
    });
  }

  // Airdrop management
  async checkAirdropEligibility(checkData: AirdropEligibilityCheck): Promise<ApiResponse<EligibilityResponse>> {
    return this.request('/airdrops/check-eligibility', {
      method: 'POST',
      body: JSON.stringify(checkData),
    });
  }

  async recordAirdropClaim(claimData: AirdropClaimData): Promise<ApiResponse> {
    return this.request('/airdrops/claim', {
      method: 'POST',
      body: JSON.stringify(claimData),
    });
  }

  async getAirdropStats(): Promise<ApiResponse> {
    return this.request('/airdrops/stats');
  }

  async getUserClaimHistory(walletAddress: string): Promise<ApiResponse> {
    return this.request(`/airdrops/user/${walletAddress}/claims`);
  }

  // IP management
  async getIPClaimCount(ipHash: string): Promise<ApiResponse> {
    return this.request(`/ips/${ipHash}/claims`);
  }

  async getIPStats(): Promise<ApiResponse> {
    return this.request('/ips/stats');
  }

  // Analytics
  async getDashboardAnalytics(timeframe: string = '7d'): Promise<ApiResponse> {
    return this.request(`/analytics/dashboard?timeframe=${timeframe}`);
  }

  async getProtectionAnalytics(): Promise<ApiResponse> {
    return this.request('/analytics/protection');
  }

  async getRealtimeData(): Promise<ApiResponse> {
    return this.request('/analytics/realtime');
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseURL.replace('/api/v1', '')}/health`);
      const data = await response.json();
      return {
        success: response.ok,
        data
      };
    } catch (error) {
      return {
        success: false,
        message: 'Backend not available'
      };
    }
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Utility function to get user's IP address
export const getUserIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.warn('Failed to get IP address:', error);
    return '127.0.0.1'; // Fallback for development
  }
};

// Enhanced device fingerprinting
export const getEnhancedDeviceFingerprint = (): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('SHAMBA LUV 🔍', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Device Fingerprint', 4, 45);
  }
  
  const fingerprint = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages?.join(',') || '',
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight
    },
    timezone: {
      offset: new Date().getTimezoneOffset(),
      name: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    canvas: canvas.toDataURL(),
    webgl: getWebGLFingerprint(),
    hardwareConcurrency: navigator.hardwareConcurrency,
    maxTouchPoints: navigator.maxTouchPoints,
    memory: (navigator as any).deviceMemory,
    connection: (navigator as any).connection?.effectiveType,
    timestamp: Date.now()
  };
  
  return btoa(JSON.stringify(fingerprint));
};

// WebGL fingerprinting
const getWebGLFingerprint = (): string => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no-webgl';
    
    const renderer = gl.getParameter(gl.RENDERER);
    const vendor = gl.getParameter(gl.VENDOR);
    const version = gl.getParameter(gl.VERSION);
    const shadingLanguageVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
    
    return btoa(`${vendor}|${renderer}|${version}|${shadingLanguageVersion}`);
  } catch (error) {
    return 'webgl-error';
  }
};

// Get comprehensive user context
export const getUserContext = async () => {
  const [ipAddress] = await Promise.all([
    getUserIP()
  ]);
  
  return {
    ipAddress,
    deviceFingerprint: getEnhancedDeviceFingerprint(),
    userAgent: navigator.userAgent,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: new Date().toISOString()
  };
};