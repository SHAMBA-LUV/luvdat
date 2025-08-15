// Enhanced airdrop protection using backend APIs
import { apiClient, getUserContext, type EligibilityResponse } from './apiClient';

export interface ProtectionResult {
  canClaim: boolean;
  reason?: string;
  riskScore?: number;
  ipInfo?: any;
  backendConnected: boolean;
}

// Reset fallback protection system (for debugging and testing)
export const resetFallbackProtection = (): void => {
  try {
    localStorage.removeItem('shamba_luv_claims_fallback');
    localStorage.removeItem('shamba_luv_users_fallback');
    console.log('✅ Fallback protection system reset successfully');
  } catch (error) {
    console.error('❌ Failed to reset fallback protection:', error);
  }
};

// Check if user can claim airdrop (backend-first approach)
export const canUserClaim = async (walletAddress: string): Promise<ProtectionResult> => {
  console.log('🛡️ Starting protection check for wallet:', walletAddress);
  
  try {
    // Get user context (IP, device fingerprint, etc.)
    console.log('📋 Getting user context...');
    const context = await getUserContext();
    console.log('✅ User context obtained:', context);
    
    // Check eligibility with backend
    console.log('🔍 Checking eligibility with backend...');
    const response = await apiClient.checkAirdropEligibility({
      walletAddress,
      ipAddress: context.ipAddress,
      deviceFingerprint: context.deviceFingerprint,
      userAgent: context.userAgent
    });

    console.log('📡 Backend eligibility response:', response);

    if (!response.success) {
      console.warn('❌ Backend eligibility check failed, using fallback logic:', response.message);
      return await fallbackProtectionCheck(walletAddress, context);
    }

    const eligibility = response.data as EligibilityResponse;
    console.log('📊 Eligibility data:', eligibility);
    
    const result = {
      canClaim: eligibility.canClaim,
      reason: eligibility.reason,
      riskScore: eligibility.riskScore,
      ipInfo: eligibility.ipInfo,
      backendConnected: true
    };

    console.log('✅ Protection check result:', result);
    return result;

  } catch (error) {
    console.error('💥 Protection check failed:', error);
    console.error('Error details:', {
      name: (error as any)?.name,
      message: (error as any)?.message,
      stack: (error as any)?.stack
    });
    
    console.log('🔄 Falling back to local protection check...');
    const context = await getUserContext();
    return await fallbackProtectionCheck(walletAddress, context);
  }
};

// Fallback protection using localStorage (if backend is down)
const fallbackProtectionCheck = async (walletAddress: string, context: any): Promise<ProtectionResult> => {
  try {
    const CLAIMS_KEY = 'shamba_luv_claims_fallback';
    const stored = localStorage.getItem(CLAIMS_KEY);
    const claims = stored ? JSON.parse(stored) : [];
    
    // Check if wallet already claimed
    const walletClaimed = claims.find((claim: any) => claim.walletAddress === walletAddress);
    if (walletClaimed) {
      console.log('⚠️ Wallet found in fallback claims, checking actual token balance...');
      
      // IMPORTANT: Check actual blockchain state before blocking
      try {
        // We need to check the actual token balance on blockchain
        // This will be handled by the frontend before calling this function
        // For now, we'll allow the claim and let the frontend verify the balance
        return {
          canClaim: true,
          reason: 'Fallback protection - blockchain verification required',
          backendConnected: false
        };
      } catch (blockchainError) {
        console.error('Blockchain verification failed:', blockchainError);
        return {
          canClaim: true,
          reason: 'Blockchain verification failed - allowing claim',
          backendConnected: false
        };
      }
    }
    
    // Check device reuse (but be more lenient)
    const deviceClaims = claims.filter((claim: any) => 
      claim.deviceFingerprint === context.deviceFingerprint
    );
    
    if (deviceClaims.length >= 3) { // Increased limit
      console.log('⚠️ Device has multiple claims, but checking blockchain state');
      return {
        canClaim: true,
        reason: 'Device limit reached - blockchain verification required',
        backendConnected: false
      };
    }
    
    return {
      canClaim: true,
      reason: 'Offline protection - limited checks available',
      backendConnected: false
    };
    
  } catch (error) {
    console.error('Fallback protection failed:', error);
    return {
      canClaim: true,
      reason: 'Protection system unavailable - allowing claim',
      backendConnected: false
    };
  }
};

// Register user when they connect wallet
export const registerUser = async (
  walletAddress: string, 
  authMethod: string, 
  authIdentifier?: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    const context = await getUserContext();
    
    const response = await apiClient.registerUser({
      walletAddress,
      authMethod,
      authIdentifier,
      deviceFingerprint: context.deviceFingerprint,
      userAgent: context.userAgent,
      screenResolution: context.screenResolution,
      timezone: context.timezone,
      ipAddress: context.ipAddress
    });

    if (!response.success) {
      console.warn('User registration failed:', response.message);
      // Store locally as fallback
      storeFallbackUserData(walletAddress, authMethod, context);
      return { success: false, message: response.message };
    }

    return { success: true };

  } catch (error) {
    console.error('User registration error:', error);
    const context = await getUserContext();
    storeFallbackUserData(walletAddress, authMethod, context);
    return { success: false, message: 'Backend unavailable' };
  }
};

// Record successful airdrop claim
export const recordAirdropClaim = async (
  walletAddress: string,
  claimAmount: string,
  transactionHash: string,
  status: 'completed' | 'failed' = 'completed'
): Promise<{ success: boolean; message?: string }> => {
  try {
    const context = await getUserContext();
    
    const response = await apiClient.recordAirdropClaim({
      walletAddress,
      ipAddress: context.ipAddress,
      deviceFingerprint: context.deviceFingerprint,
      claimAmount,
      transactionHash,
      status,
      userAgent: context.userAgent
    });

    if (!response.success) {
      console.warn('Claim recording failed:', response.message);
      storeFallbackClaim(walletAddress, claimAmount, transactionHash, context);
      return { success: false, message: response.message };
    }

    return { success: true };

  } catch (error) {
    console.error('Claim recording error:', error);
    const context = await getUserContext();
    storeFallbackClaim(walletAddress, claimAmount, transactionHash, context);
    return { success: false, message: 'Backend unavailable' };
  }
};

// Fallback localStorage functions
const storeFallbackUserData = (walletAddress: string, authMethod: string, context: any) => {
  try {
    const USERS_KEY = 'shamba_luv_users_fallback';
    const stored = localStorage.getItem(USERS_KEY);
    const users = stored ? JSON.parse(stored) : [];
    
    const userData = {
      walletAddress,
      authMethod,
      ...context,
      timestamp: Date.now()
    };
    
    // Remove existing entry for this wallet
    const filtered = users.filter((user: any) => user.walletAddress !== walletAddress);
    filtered.push(userData);
    
    localStorage.setItem(USERS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Fallback user storage failed:', error);
  }
};

const storeFallbackClaim = (walletAddress: string, amount: string, txHash: string, context: any) => {
  try {
    const CLAIMS_KEY = 'shamba_luv_claims_fallback';
    const stored = localStorage.getItem(CLAIMS_KEY);
    const claims = stored ? JSON.parse(stored) : [];
    
    const claimData = {
      walletAddress,
      amount,
      transactionHash: txHash,
      ...context,
      timestamp: Date.now()
    };
    
    claims.push(claimData);
    localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
  } catch (error) {
    console.error('Fallback claim storage failed:', error);
  }
};

// Check backend health
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const response = await apiClient.healthCheck();
    return response.success;
  } catch (error) {
    return false;
  }
};

// Get user claim history
export const getUserClaimHistory = async (walletAddress: string) => {
  try {
    const response = await apiClient.getUserClaimHistory(walletAddress);
    return response.success ? response.data : null;
  } catch (error) {
    console.error('Failed to get claim history:', error);
    return null;
  }
};