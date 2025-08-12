// Wallet collection system for batch processing
// This system collects wallet data and processes airdrops in batches for gas efficiency

interface WalletData {
  walletAddress: string;
  userAgent: string;
  ipAddress: string;
  deviceFingerprint: string;
  authMethod: string;
  chainId: number;
}

interface BatchResult {
  success: boolean;
  error?: string;
  processedCount?: number;
  transactionHash?: string;
}

// In-memory wallet collection (in production, this would be stored in a database)
let walletCollection: WalletData[] = [];
let isProcessingBatch = false;

/**
 * Collect wallet data for batch processing
 * @param walletData Wallet information to collect
 */
export function collectWallet(walletData: WalletData): void {
  // Check if wallet is already in collection
  const existingIndex = walletCollection.findIndex(
    wallet => wallet.walletAddress.toLowerCase() === walletData.walletAddress.toLowerCase()
  );
  
  if (existingIndex === -1) {
    // Add new wallet to collection
    walletCollection.push(walletData);
    console.log('📥 Wallet added to collection:', walletData.walletAddress);
  } else {
    // Update existing wallet data
    walletCollection[existingIndex] = walletData;
    console.log('📝 Wallet data updated in collection:', walletData.walletAddress);
  }
}

/**
 * Process wallet batch for airdrop distribution
 * @returns Promise<BatchResult> Result of batch processing
 */
export async function processWalletBatch(): Promise<BatchResult> {
  if (isProcessingBatch) {
    return {
      success: false,
      error: 'Batch processing already in progress'
    };
  }

  if (walletCollection.length === 0) {
    return {
      success: false,
      error: 'No wallets in collection to process'
    };
  }

  isProcessingBatch = true;
  
  try {
    console.log(`🔄 Processing batch of ${walletCollection.length} wallets...`);
    
    // In a real implementation, this would:
    // 1. Send batch to backend API
    // 2. Backend would process all wallets in a single transaction
    // 3. Return transaction hash and results
    
    // Simulate batch processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const processedCount = walletCollection.length;
    const transactionHash = `batch-${Date.now()}-${processedCount}`;
    
    // Clear the collection after successful processing
    walletCollection = [];
    
    console.log(`✅ Batch processed successfully: ${processedCount} wallets`);
    
    return {
      success: true,
      processedCount,
      transactionHash
    };
    
  } catch (error) {
    console.error('❌ Batch processing failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    isProcessingBatch = false;
  }
}

/**
 * Get current collection status
 * @returns Object with collection information
 */
export function getCollectionStatus() {
  return {
    walletCount: walletCollection.length,
    isProcessing: isProcessingBatch,
    wallets: walletCollection.map(w => w.walletAddress)
  };
}

/**
 * Clear wallet collection
 */
export function clearWalletCollection(): void {
  walletCollection = [];
  console.log('🗑️ Wallet collection cleared');
}

/**
 * Get wallet data by address
 * @param walletAddress Address to look up
 * @returns WalletData | undefined
 */
export function getWalletData(walletAddress: string): WalletData | undefined {
  return walletCollection.find(
    wallet => wallet.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  );
}

/**
 * Remove wallet from collection
 * @param walletAddress Address to remove
 * @returns boolean Success status
 */
export function removeWallet(walletAddress: string): boolean {
  const initialLength = walletCollection.length;
  walletCollection = walletCollection.filter(
    wallet => wallet.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
  );
  
  const removed = initialLength !== walletCollection.length;
  if (removed) {
    console.log('🗑️ Wallet removed from collection:', walletAddress);
  }
  
  return removed;
} 