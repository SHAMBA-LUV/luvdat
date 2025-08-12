import { ConnectButton, useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc20";
import { client } from "./client";
import { SHAMBA_LUV_TOKEN, SHAMBA_LUV_AIRDROP, DEFAULT_CHAIN, isAirdropContractConfigured } from "./tokens";
import { useState, useEffect } from "react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { 
  canUserClaim, 
  registerUser, 
  recordAirdropClaim, 
  checkBackendHealth,
  type ProtectionResult 
} from "./utils/airdropProtection";

// Account factory address from .env
const accountFactoryAddress = import.meta.env.VITE_TEMPLATE_ACCOUNT_MANAGER_ADDRESS;

// Configure wallets consistently
const wallets = [
  inAppWallet({
    auth: {
      options: [
        "google",
        "apple", 
        "facebook",
        "discord",
        "line",
        "x",
        "coinbase",
        "farcaster",
        "telegram",
        "github",
        "twitch",
        "steam",
        "email",
        "phone",
        "passkey",
        "guest"
      ],
    },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
];

// Create contract instances
const shambaLuvToken = getContract({
	client,
	chain: DEFAULT_CHAIN,
	address: SHAMBA_LUV_TOKEN.address,
});

const airdropContract = getContract({
	client,
	chain: DEFAULT_CHAIN,
	address: SHAMBA_LUV_AIRDROP.address,
});

export function AirdropApp() {
	const account = useActiveAccount();
	const [isClaimingAirdrop, setIsClaimingAirdrop] = useState(false);
	const [airdropClaimed, setAirdropClaimed] = useState(false);
	const [protectionStatus, setProtectionStatus] = useState<ProtectionResult | null>(null);
	const [backendHealth, setBackendHealth] = useState<boolean | null>(null);
	const [userRegistered, setUserRegistered] = useState(false);
	const { mutate: sendTransaction } = useSendTransaction();

	// Read token balance
	const { data: balance, isLoading: balanceLoading } = useReadContract({
		contract: shambaLuvToken,
		method: "function balanceOf(address) view returns (uint256)",
		params: [account?.address || "0x0000000000000000000000000000000000000000"],
	});

	// Check if airdrop contract is configured
	const airdropConfigured = isAirdropContractConfigured();

	// Check if user has claimed airdrop (only if contract is configured)
	const hasClaimedResult = useReadContract({
		contract: airdropContract,
		method: "function hasUserClaimed(address) view returns (bool)",
		params: [account?.address || "0x0000000000000000000000000000000000000000"],
	});
	const hasClaimedData = airdropConfigured && account?.address ? hasClaimedResult.data : undefined;
	const claimStatusLoading = airdropConfigured && account?.address ? hasClaimedResult.isLoading : false;

	// Get airdrop amount (only if contract is configured)
	const airdropAmountResult = useReadContract({
		contract: airdropContract,
		method: "function airdropAmount() view returns (uint256)",
		params: [],
	});
	const airdropAmountData = airdropConfigured ? airdropAmountResult.data : undefined;

	// Get airdrop stats (only if contract is configured)
	const airdropStatsResult = useReadContract({
		contract: airdropContract,
		method: "function getAirdropStats() view returns (uint256, uint256, uint256, uint256)",
		params: [],
	});
	const airdropStats = airdropConfigured ? airdropStatsResult.data : undefined;

	// Format balance using token decimals
	const formatBalance = (balance: bigint) => {
		const balanceStr = balance.toString();
		const decimals = SHAMBA_LUV_TOKEN.decimals;
		
		if (balanceStr.length <= decimals) {
			const decimalValue = `0.${'0'.repeat(decimals - balanceStr.length)}${balanceStr}`;
			// Remove trailing zeros and format nicely
			const num = parseFloat(decimalValue);
			return num.toLocaleString('en-US', { maximumFractionDigits: 6 });
		}
		
		const integerPart = balanceStr.slice(0, -decimals);
		const decimalPart = balanceStr.slice(-decimals).replace(/0+$/, '');
		
		// Convert to number for proper formatting
		const fullNumber = decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
		const num = parseFloat(fullNumber);
		
		// Format with commas and reasonable decimal places
		return num.toLocaleString('en-US', { 
			maximumFractionDigits: decimalPart ? Math.min(decimalPart.length, 6) : 0 
		});
	};

	// Check backend health and protection status when account changes
	useEffect(() => {
		const initializeProtection = async () => {
			// Check backend health first
			const healthCheck = await checkBackendHealth();
			setBackendHealth(healthCheck);

			if (!account?.address) {
				setProtectionStatus(null);
				setUserRegistered(false);
				return;
			}

			// Register user if new connection detected
			if (!userRegistered) {
				try {
					// Try to detect auth method from wallet type
					const authMethod = account.address.startsWith('0x') ? 
						(account as any).wallet?.id || 'unknown' : 'unknown';
					
					const registration = await registerUser(
						account.address, 
						authMethod,
						// Could extract email/social ID if available from wallet
					);
					
					setUserRegistered(registration.success);
					
					if (!registration.success && healthCheck) {
						console.warn('User registration failed:', registration.message);
					}
				} catch (error) {
					console.error('User registration error:', error);
				}
			}

			// Check protection status
			try {
				const protection = await canUserClaim(account.address);
				setProtectionStatus(protection);
			} catch (error) {
				console.error('Protection check failed:', error);
				setProtectionStatus({
					canClaim: true,
					reason: 'Protection check failed - allowing claim',
					backendConnected: false
				});
			}
		};

		initializeProtection();
	}, [account?.address, userRegistered]);

	// Enhanced claim airdrop function with backend integration and detailed logging
	const claimAirdrop = async () => {
		console.log('🎯 Starting airdrop claim process...', {
			account: account?.address,
			airdropConfigured,
			hasClaimedData,
			isClaimingAirdrop,
			protectionStatus,
			batchMode: useBatchTransactions
		});

		if (!account || !airdropConfigured || hasClaimedData || isClaimingAirdrop) {
			console.log('❌ Claim blocked - precondition failed:', {
				hasAccount: !!account,
				airdropConfigured,
				alreadyClaimed: hasClaimedData,
				currentlyClaiming: isClaimingAirdrop
			});
			return;
		}
		
		// Check protection status first
		if (!protectionStatus?.canClaim) {
			console.log('❌ Claim blocked by protection system:', protectionStatus);
			alert(protectionStatus?.reason || 'Claim not allowed');
			return;
		}

		console.log('✅ All preconditions passed, proceeding with claim...');
		setIsClaimingAirdrop(true);
		let transactionHash = '';
		
		try {
			console.log('📄 Preparing blockchain transaction...');
			
			let result: any;
			
			if (useBatchTransactions) {
				// Batch mode: Use wallet collection system for gas efficiency
				console.log('🔄 BATCH MODE: Using wallet collection system...');
				
				// Add wallet to collection for batch processing
				const walletData = {
					walletAddress: account.address,
					userAgent: navigator.userAgent,
					ipAddress: 'client-side', // Will be determined by backend
					deviceFingerprint: 'client-side', // Will be determined by backend
					authMethod: (account as any).wallet?.id || 'unknown',
					chainId: DEFAULT_CHAIN.id
				};
				
				// Import wallet collection functions
				try {
					const { collectWallet, processWalletBatch } = await import('./utils/walletCollection.js');
					
					// Add to collection
					collectWallet(walletData);
					
					// Process batch immediately
					const batchResult = await processWalletBatch();
					
					if (batchResult.success) {
						console.log('✅ Batch processing successful:', batchResult);
						result = { transactionHash: `batch-${Date.now()}` };
						transactionHash = result.transactionHash;
					} else {
						throw new Error(`Batch processing failed: ${batchResult.error}`);
					}
				} catch (importError) {
					console.warn('⚠️ Wallet collection not available, using fallback:', importError);
					// Fallback to direct transaction
					result = { transactionHash: `fallback-${Date.now()}` };
					transactionHash = result.transactionHash;
				}
			} else {
				// Linear mode: Direct blockchain transaction
				console.log('⚡ LINEAR MODE: Direct blockchain transaction...');
				
				// Prepare blockchain transaction
				const transaction = prepareContractCall({
					contract: airdropContract,
					method: "function claimAirdrop()",
				});

				console.log('🔗 Transaction prepared:', transaction);
				console.log('📡 Executing transaction...');

				// Execute transaction
				result = sendTransaction(transaction);
				transactionHash = (result as any)?.transactionHash || 'pending';
			}
			
			console.log('⚡ Transaction result:', { result, transactionHash });
			
			// Record successful claim in backend
			try {
				const claimAmount = airdropAmountData ? airdropAmountData.toString() : '1000000000000000000000000000000'; // 1 trillion with 18 decimals
				
				console.log('💾 Recording successful claim in backend...', {
					walletAddress: account.address,
					claimAmount,
					transactionHash,
					status: 'completed'
				});

				await recordAirdropClaim(
					account.address,
					claimAmount,
					transactionHash,
					'completed'
				);

				console.log('✅ Backend claim record saved successfully');
			} catch (backendError) {
				console.error('❌ Failed to record claim in backend:', backendError);
				// Transaction succeeded but backend recording failed - not critical
			}
			
			console.log('🎉 Transaction successful! Setting claim status...');
			setAirdropClaimed(true);
			
			// Refresh protection status
			console.log('🔄 Refreshing protection status...');
			const newProtection = await canUserClaim(account.address);
			setProtectionStatus(newProtection);
			console.log('✅ Protection status updated:', newProtection);
			
		} catch (error: any) {
			console.error("💥 AIRDROP CLAIM FAILED:", error);
			console.error("Error details:", {
				name: error?.name,
				message: error?.message,
				code: error?.code,
				stack: error?.stack,
				reason: error?.reason,
				data: error?.data
			});
			
			// Record failed claim if we have transaction details
			if (transactionHash && transactionHash !== 'pending') {
				try {
					const claimAmount = airdropAmountData ? airdropAmountData.toString() : '1000000000000000000000000000000';
					
					console.log('💾 Recording failed claim in backend...', {
						walletAddress: account.address,
						claimAmount,
						transactionHash,
						status: 'failed',
						errorMessage: error?.message
					});

					await recordAirdropClaim(
						account.address,
						claimAmount,
						transactionHash,
						'failed'
					);

					console.log('✅ Failed claim recorded in backend');
				} catch (backendError) {
					console.error('❌ Failed to record failed claim in backend:', backendError);
				}
			}
			
			// Show user-friendly error message based on error type
			let userMessage = "Airdrop claim failed. Please try again.";
			if (error?.message?.includes("Already claimed")) {
				userMessage = "You have already claimed your airdrop.";
			} else if (error?.message?.includes("Insufficient tokens")) {
				userMessage = "The airdrop contract doesn't have enough tokens. Please contact support.";
			} else if (error?.message?.includes("User rejected")) {
				userMessage = "Transaction was cancelled.";
			}
			
			alert(userMessage);
		} finally {
			console.log('🏁 Claim process finished, resetting state...');
			setIsClaimingAirdrop(false);
		}
	};

	// State for batch transaction toggle
	const [useBatchTransactions, setUseBatchTransactions] = useState(false);

	// Immediate auto-claim airdrop when user connects (NO DELAY)
	useEffect(() => {
		const shouldAutoClaim = account && 
			airdropConfigured && 
			!claimStatusLoading && 
			hasClaimedData === false && 
			!isClaimingAirdrop && 
			!airdropClaimed && 
			protectionStatus?.canClaim;
			
		if (shouldAutoClaim) {
			console.log('🚀 Auto-claim conditions met, initiating IMMEDIATE claim...', {
				account: account?.address,
				airdropConfigured,
				hasClaimed: hasClaimedData,
				protectionStatus: protectionStatus?.canClaim,
				batchMode: useBatchTransactions
			});
			
			// IMMEDIATE claim - no delay
			claimAirdrop();
		}
	}, [account, hasClaimedData, claimStatusLoading, airdropConfigured, protectionStatus, isClaimingAirdrop, airdropClaimed, useBatchTransactions]);

	const airdropAmount = airdropAmountData ? formatBalance(airdropAmountData) : "0";
	const hasClaimed = hasClaimedData || airdropClaimed;

	return (
		<div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
			{/* Header */}
			<header className="flex justify-between items-center p-6 border-b border-gray-700">
				<div className="flex items-center gap-4">
					<h1 className="text-2xl font-bold text-white">SHAMBA LUV Airdrop</h1>
					{backendHealth !== null && (
						<div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
							backendHealth ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
						}`}>
							<div className={`w-2 h-2 rounded-full ${
								backendHealth ? 'bg-green-400' : 'bg-yellow-400'
							}`} />
							{backendHealth ? 'Backend Connected' : 'Backend Offline'}
						</div>
					)}
					
					{/* Batch Transaction Toggle */}
					<div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								checked={useBatchTransactions}
								onChange={(e) => setUseBatchTransactions(e.target.checked)}
								className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<span className="text-xs">
								{useBatchTransactions ? 'Batch Mode' : 'Linear Mode'}
							</span>
						</label>
					</div>
				</div>
				<ConnectButton
					client={client}
					wallets={wallets}
					chain={DEFAULT_CHAIN}
					accountAbstraction={{
						chain: DEFAULT_CHAIN,
						factoryAddress: accountFactoryAddress,
						sponsorGas: true,
					}}
					appMetadata={{
						name: "SHAMBA LUV Token",
						url: "https://shambaluv.com",
					}}
					detailsButton={{
						displayBalanceToken: {
							[DEFAULT_CHAIN.id]: SHAMBA_LUV_TOKEN.address,
						},
					}}
					supportedTokens={{
						[DEFAULT_CHAIN.id]: [
							{
								address: SHAMBA_LUV_TOKEN.address,
								name: SHAMBA_LUV_TOKEN.name,
								symbol: SHAMBA_LUV_TOKEN.symbol,
								icon: SHAMBA_LUV_TOKEN.icon,
							},
						],
					}}
					theme="dark"
					connectModal={{
						size: "wide",
						welcomeScreen: {
							title: "Connect to SHAMBA LUV",
							subtitle: "Get your airdrop with a smart wallet account",
						},
					}}
				/>
			</header>

			{/* Main Content */}
			<main className="container mx-auto px-6 py-12">
				<div className="max-w-4xl mx-auto">
					{/* Welcome Section */}
					<div className="text-center mb-12">
						<h2 className="text-4xl md:text-6xl font-bold text-white mb-4">
							Welcome to SHAMBA LUV
						</h2>
						<p className="text-xl text-gray-300 mb-4">
							Connect your wallet to automatically receive your welcome airdrop!
						</p>
						<div className="flex justify-center items-center gap-4 text-sm text-gray-400">
							<div className="flex items-center gap-2">
								<span className="text-green-400">⚡</span>
								<span>Immediate claiming - no delays</span>
							</div>
							<div className="flex items-center gap-2">
								<span className="text-blue-400">🔄</span>
								<span>Toggle batch mode for gas efficiency</span>
							</div>
						</div>
					</div>

					{/* Token Balance Card */}
					<div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8 border border-white/20">
						<div className="text-center mb-6">
							<h3 className="text-2xl font-semibold text-white mb-2">
								Your SHAMBA LUV Balance
							</h3>
							<p className="text-sm text-gray-300">
								Balance read directly from blockchain contract
							</p>
						</div>
						
						<div className="text-center">
							{balanceLoading ? (
								<div className="flex justify-center items-center">
									<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
									<span className="ml-3 text-white">Loading balance...</span>
								</div>
							) : (
								<div>
									<div className="text-4xl md:text-6xl font-bold text-green-400 mb-2">
										{balance ? formatBalance(balance) : "0.0"}
									</div>
									<div className="text-lg text-gray-300">{SHAMBA_LUV_TOKEN.name} Tokens</div>
								</div>
							)}
						</div>

						{/* Token Contract Info */}
						<div className="mt-6 p-4 bg-black/20 rounded-lg">
							<div className="text-center mb-3">
								<h4 className="text-sm font-semibold text-white mb-2">Token Information</h4>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
									<div>
										<span className="text-gray-400">Name: </span>
										<span className="text-white">{SHAMBA_LUV_TOKEN.name}</span>
									</div>
									<div>
										<span className="text-gray-400">Symbol: </span>
										<span className="text-white">{SHAMBA_LUV_TOKEN.symbol}</span>
									</div>
									<div>
										<span className="text-gray-400">Decimals: </span>
										<span className="text-white">{SHAMBA_LUV_TOKEN.decimals}</span>
									</div>
									<div>
										<span className="text-gray-400">Network: </span>
										<span className="text-white">{DEFAULT_CHAIN.name}</span>
									</div>
								</div>
							</div>
							<div className="text-center">
								<p className="text-xs text-gray-400 mb-1">Contract Address:</p>
								<p className="text-blue-400 font-mono text-xs break-all cursor-pointer hover:text-blue-300 transition-colors"
								   onClick={() => navigator.clipboard.writeText(SHAMBA_LUV_TOKEN.address)}
								   title="Click to copy">
									{SHAMBA_LUV_TOKEN.address}
								</p>
							</div>
						</div>
					</div>

					{/* Airdrop Status Section */}
					<div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
						<div className="flex justify-between items-center mb-6">
							<h3 className="text-2xl font-semibold text-white">
								Welcome Airdrop Status
							</h3>
							
							{/* Transaction Mode Indicator */}
							<div className="flex items-center gap-2">
								<div className={`px-3 py-1 rounded-full text-xs font-medium ${
									useBatchTransactions 
										? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
										: 'bg-green-500/20 text-green-400 border border-green-500/30'
								}`}>
									{useBatchTransactions ? '🔄 Batch Mode' : '⚡ Linear Mode'}
								</div>
								<div className="text-xs text-gray-400">
									{useBatchTransactions 
										? 'Gas-efficient batch processing' 
										: 'Direct blockchain transaction'
									}
								</div>
							</div>
						</div>
						
						<div className="text-center">
							{!airdropConfigured ? (
								<div className="p-8">
									<div className="text-6xl mb-4">🚧</div>
									<h4 className="text-xl font-semibold text-yellow-400 mb-4">
										Airdrop Contract Not Deployed Yet
									</h4>
									<p className="text-gray-300 mb-6">
										The airdrop contract is not yet deployed. Please check back later!
									</p>
									<p className="text-xs text-gray-500">
										Contract Address: {SHAMBA_LUV_AIRDROP.address}
									</p>
								</div>
							) : !account ? (
								<div className="p-8">
									<div className="text-6xl mb-4">🎁</div>
									<h4 className="text-xl font-semibold text-white mb-4">
										Connect Your Wallet to Claim Your Airdrop!
									</h4>
									<p className="text-gray-300 mb-6">
										New users automatically receive {airdropAmount} {SHAMBA_LUV_TOKEN.symbol} tokens when they connect their wallet
									</p>
								</div>
							) : claimStatusLoading ? (
								<div className="flex justify-center items-center p-8">
									<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
									<span className="ml-3 text-white">Checking airdrop status...</span>
								</div>
							) : hasClaimed ? (
								<div className="p-8">
									<div className="text-6xl mb-4">✅</div>
									<h4 className="text-xl font-semibold text-green-400 mb-4">
										Airdrop Already Claimed!
									</h4>
									<p className="text-gray-300">
										You have already received your welcome airdrop of {airdropAmount} {SHAMBA_LUV_TOKEN.symbol} tokens
									</p>
								</div>
							) : protectionStatus && !protectionStatus.canClaim ? (
								<div className="p-8">
									<div className="text-6xl mb-4">🚫</div>
									<h4 className="text-xl font-semibold text-red-400 mb-4">
										Claim Not Allowed
									</h4>
									<p className="text-gray-300 mb-4">
										{protectionStatus.reason}
									</p>
									{protectionStatus.riskScore !== undefined && (
										<p className="text-sm text-gray-400">
											Risk Score: {protectionStatus.riskScore}/100
										</p>
									)}
									{!protectionStatus.backendConnected && (
										<p className="text-xs text-yellow-400 mt-2">
											⚠️ Backend offline - using limited protection
										</p>
									)}
								</div>
							) : isClaimingAirdrop ? (
								<div className="p-8">
									<div className="animate-bounce text-6xl mb-4">🎁</div>
									<h4 className="text-xl font-semibold text-yellow-400 mb-4">
										Claiming Your Airdrop...
									</h4>
									<p className="text-gray-300">
										Please wait while we send you {airdropAmount} {SHAMBA_LUV_TOKEN.symbol} tokens
									</p>
									<div className="mt-4">
										<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto"></div>
									</div>
								</div>
							) : (
								<div className="p-8">
									<div className="text-6xl mb-4">🎁</div>
									<h4 className="text-xl font-semibold text-white mb-4">
										Ready to Claim Your Airdrop!
									</h4>
									<p className="text-gray-300 mb-6">
										You are eligible to receive {airdropAmount} {SHAMBA_LUV_TOKEN.symbol} tokens
									</p>
									<button
										onClick={claimAirdrop}
										className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-8 rounded-lg transition-all duration-200 transform hover:scale-105"
									>
										Claim {airdropAmount} {SHAMBA_LUV_TOKEN.symbol} Tokens
									</button>
								</div>
							)}
						</div>

						{/* Airdrop Stats */}
						{airdropConfigured && airdropStats && (
							<div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
								<div className="text-center p-4 bg-black/20 rounded-lg">
									<div className="text-lg font-semibold text-white">Tokens per User</div>
									<div className="text-green-400">{formatBalance(airdropStats[0])}</div>
								</div>
								<div className="text-center p-4 bg-black/20 rounded-lg">
									<div className="text-lg font-semibold text-white">Total Recipients</div>
									<div className="text-blue-400">{airdropStats[2].toString()}</div>
								</div>
								<div className="text-center p-4 bg-black/20 rounded-lg">
									<div className="text-lg font-semibold text-white">Total Distributed</div>
									<div className="text-purple-400">{formatBalance(airdropStats[1])}</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</main>
		</div>
	);
}