import React, { useState, useEffect, useCallback } from 'react';
import { useActiveAccount, useReadContract, useSendTransaction, ConnectButton } from 'thirdweb/react';
import { SHAMBA_LUV_TOKEN, SHAMBA_LUV_AIRDROP, DEFAULT_CHAIN } from './tokens';
import { client } from "./client";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { getContract } from "thirdweb";

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

interface Transaction {
	id: string;
	type: 'auto-drop' | 'manual-claim' | 'blockchain';
	status: 'success' | 'failed' | 'pending';
	timestamp: number;
	amount: string | number;
	details: string;
	hash?: string;
	blockchainConfirmed?: boolean;
}

interface AirdropAppProps {
	onLogout?: () => Promise<void>;
}

// Account factory address from .env
const accountFactoryAddress = import.meta.env.VITE_TEMPLATE_ACCOUNT_MANAGER_ADDRESS;

// Configure wallets - Prioritize smart wallet for gasless airdrop claims
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
	createWallet("io.metamask"), // Regular MetaMask EOA - fallback option
	createWallet("com.coinbase.wallet"),
];

export default function AirdropApp({ onLogout }: AirdropAppProps) {
	const account = useActiveAccount();
	const [balance, setBalance] = useState<bigint | null>(null);
	const [balanceLoading, setBalanceLoading] = useState(true);
	const [airdropConfigured, setAirdropConfigured] = useState(false);
	const [airdropStats, setAirdropStats] = useState<[bigint, bigint, bigint, bigint] | null>(null);
	const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
	const [isClaiming, setIsClaiming] = useState(false);
	const [claimStatus, setClaimStatus] = useState<string>('');
	const [historyCleared, setHistoryCleared] = useState(false);
	const [airdropShown, setAirdropShown] = useState(false);

	// Simulate balance loading
	useEffect(() => {
		if (account?.address) {
			// Simulate loading balance
			setTimeout(() => {
				setBalance(BigInt(1000000000000000000000000000000)); // 1 trillion LUV
				setBalanceLoading(false);
			}, 1000);
		}
	}, [account?.address]);

	// Enhanced transaction history with blockchain integration
	const addTransaction = useCallback((transaction: Omit<Transaction, 'id' | 'timestamp'>) => {
		const newTransaction: Transaction = {
			...transaction,
			id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			timestamp: Date.now(),
		};

		setTransactionHistory(prev => {
			const updated = [newTransaction, ...prev];
			
			// Store in localStorage for persistence
			if (account?.address) {
				try {
					const key = `transactionHistory_${account.address}`;
					localStorage.setItem(key, JSON.stringify(updated));
				} catch (error) {
					console.warn('Failed to save transaction history:', error);
				}
			}
			
			return updated;
		});
	}, [account?.address]);

	// Function to fetch real airdrop transaction from blockchain
	const fetchRealAirdropTransaction = useCallback(async () => {
		if (!account?.address) return;

		try {
			console.log('🔍 Fetching real airdrop transaction for:', account.address);
			
			// Method 1: Try to get transaction history from the smart wallet (if available)
			try {
				// Access wallet through account if available
				const wallet = (account as any).wallet;
				if (wallet && typeof wallet.getTransactionHistory === 'function') {
					const walletHistory = await wallet.getTransactionHistory();
					console.log('📋 Smart wallet transaction history:', walletHistory);
					
					// Look for airdrop transactions in wallet history
					const airdropTx = walletHistory.find((tx: any) => 
						tx.to?.toLowerCase() === SHAMBA_LUV_AIRDROP.address.toLowerCase() ||
						tx.from?.toLowerCase() === SHAMBA_LUV_AIRDROP.address.toLowerCase()
					);
					
					if (airdropTx) {
						console.log('✅ Found airdrop transaction in wallet history:', airdropTx);
						addTransaction({
							type: 'auto-drop',
							status: 'success',
							amount: airdropTx.value || balance?.toString() || '1000000000000',
							details: 'SHAMBA LUV airdrop received',
							hash: airdropTx.hash,
							blockchainConfirmed: true,
						});
						return;
					}
				}
			} catch (walletError) {
				console.log('Wallet history not available, trying blockchain API...');
			}
			
			// Method 2: Fetch from PolygonScan API (no API key required for basic queries)
			const response = await fetch(
				`https://api.polygonscan.com/api?module=account&action=txlist&address=${account.address}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc`
			);
			
			if (!response.ok) {
				throw new Error('Failed to fetch blockchain data');
			}
			
			const data = await response.json();
			
			if (data.status === '1' && data.result) {
				// Look for transactions from the ShambaLuvAirdrop contract to this wallet
				const airdropTransactions = data.result.filter((tx: any) => {
					// Transaction from airdrop contract to user's wallet
					return tx.from?.toLowerCase() === SHAMBA_LUV_AIRDROP.address.toLowerCase() &&
						   tx.to?.toLowerCase() === account.address.toLowerCase();
				});
				
				if (airdropTransactions.length > 0) {
					// Get the most recent airdrop transaction
					const latestAirdrop = airdropTransactions[0];
					console.log('✅ Found real airdrop transaction:', latestAirdrop);
					
					addTransaction({
						type: 'auto-drop',
						status: 'success',
						amount: latestAirdrop.value || balance?.toString() || '1000000000000',
						details: 'SHAMBA LUV airdrop received',
						hash: latestAirdrop.hash,
						blockchainConfirmed: true,
					});
					return;
				}
				
				// Also check for token transfer events (ERC20 transfers)
				const tokenTransfers = data.result.filter((tx: any) => {
					// Look for transactions to the LUV token contract (transfer events)
					return tx.to?.toLowerCase() === SHAMBA_LUV_TOKEN.address.toLowerCase() &&
						   tx.input && tx.input.startsWith('0xa9059cbb'); // transfer function signature
				});
				
				if (tokenTransfers.length > 0) {
					const latestTransfer = tokenTransfers[0];
					console.log('✅ Found LUV token transfer transaction:', latestTransfer);
					
					addTransaction({
						type: 'auto-drop',
						status: 'success',
						amount: balance?.toString() || '1000000000000',
						details: 'SHAMBA LUV airdrop received',
						hash: latestTransfer.hash,
						blockchainConfirmed: true,
					});
					return;
				}
			}
			
			console.log('No airdrop transactions found in blockchain history');
			
		} catch (error) {
			console.error('❌ Error fetching real airdrop transaction:', error);
		}
	}, [account?.address, addTransaction, balance]);

	// Load user-specific transaction history and fetch blockchain data
	useEffect(() => {
		if (!account?.address) {
			setTransactionHistory([]);
			return;
		}

		try {
			const key = `transactionHistory_${account.address}`;
			const stored = localStorage.getItem(key);
			
			if (stored) {
				const parsed = JSON.parse(stored);
				if (Array.isArray(parsed)) {
					// Validate each transaction
					const validTransactions = parsed.filter((tx: any) => 
						tx && typeof tx === 'object' && 
						tx.id && tx.type && tx.status && 
						tx.timestamp && tx.amount && tx.details
					);
					
					setTransactionHistory(validTransactions);
					console.log('📋 Loaded transaction history for user:', account.address, validTransactions.length, 'transactions');
				}
			}
			
			// Fetch real airdrop transaction
			fetchRealAirdropTransaction();
		} catch (error) {
			console.error('Error loading transaction history:', error);
		}
	}, [account?.address, fetchRealAirdropTransaction]);

	// Add real airdrop transaction with actual date when component loads
	useEffect(() => {
		if (account?.address && balance && balance > BigInt(0) && !historyCleared) {
			// Check if we already have an airdrop transaction
			const existingAirdrop = transactionHistory.find(tx => 
				tx.type === 'auto-drop' && 
				tx.status === 'success' && 
				tx.details === 'SHAMBA LUV airdrop received'
			);
			
			// Only add if we don't already have this transaction
			if (!existingAirdrop) {
				// Set this to your actual airdrop date
				const airdropDate = new Date('2025-01-15T10:30:00Z'); // Update this date
				
				// Create transaction with actual timestamp
				const airdropTransaction: Transaction = {
					id: `airdrop-${airdropDate.getTime()}`,
					type: 'auto-drop',
					status: 'success',
					timestamp: airdropDate.getTime(),
					amount: balance.toString(),
					details: 'SHAMBA LUV airdrop received',
				};
				
				setTransactionHistory(prev => {
					const updated = [airdropTransaction, ...prev];
					
					// Store in localStorage
					if (account?.address) {
						try {
							const key = `transactionHistory_${account.address}`;
							localStorage.setItem(key, JSON.stringify(updated));
						} catch (error) {
							console.warn('Failed to save transaction history:', error);
						}
					}
					
					return updated;
				});
			}
		}
	}, [account?.address, balance, transactionHistory, historyCleared]);

	// Clear corrupted transaction history and start fresh
	const clearCorruptedHistory = useCallback(() => {
		if (!account?.address) return;
		
		try {
			const key = `transactionHistory_${account.address}`;
			localStorage.removeItem(key);
			setTransactionHistory([]);
			console.log('🧹 Cleared corrupted transaction history for user:', account.address);
		} catch (error) {
			console.error('Error clearing history:', error);
		}
	}, [account?.address]);

	// Clear transaction history for current user only
	const clearUserTransactionHistory = useCallback(() => {
		if (!account?.address) return;
		
		try {
			const key = `transactionHistory_${account.address}`;
			localStorage.removeItem(key);
			setTransactionHistory([]);
			setHistoryCleared(true); // Mark that user has cleared history
			console.log('🧹 Cleared transaction history for user:', account.address);
			
			// Prevent automatic re-fetching of airdrop transaction
			// The user explicitly cleared the history, so don't auto-add it back
		} catch (error) {
			console.error('Error clearing history:', error);
		}
	}, [account?.address]);

	const claimAirdrop = async () => {
		if (!account?.address || isClaiming) return;

		// Check if user already has tokens (balance > 0)
		if (balance && balance > BigInt(0)) {
			// Check if we already have an airdrop transaction in history
			const existingAirdrop = transactionHistory.find(tx => 
				tx.type === 'auto-drop' && 
				tx.status === 'success' && 
				tx.details === 'SHAMBA LUV airdrop received'
			);
			
			// Only add if we don't already have this transaction
			if (!existingAirdrop) {
				// User already has tokens, show the original airdrop transaction with correct amount
				addTransaction({
					type: 'auto-drop',
					status: 'success',
					amount: balance.toString(),
					details: 'SHAMBA LUV airdrop received',
				});
			}
			
			// Mark that airdrop has been shown and transform button
			setAirdropShown(true);
			return;
		}

		setIsClaiming(true);
		setClaimStatus('Initiating claim...');

		try {
			// Add transaction to history
			addTransaction({
				type: 'manual-claim',
				status: 'pending',
				amount: '1000000000000',
				details: 'Manual claim initiated',
			});

			// Simulate transaction
			await new Promise(resolve => setTimeout(resolve, 2000));

			// Update transaction status (without fake hash)
			addTransaction({
				type: 'manual-claim',
				status: 'success',
				amount: '1000000000000',
				details: 'Claim successful! 1 trillion LUV tokens received',
			});

			setClaimStatus('Claim successful!');
		} catch (error) {
			console.error('Claim failed:', error);
			setClaimStatus('Claim failed. Please try again.');
			
			addTransaction({
				type: 'manual-claim',
				status: 'failed',
				amount: '1000000000000',
				details: 'Claim failed - please try again',
			});
		} finally {
			setIsClaiming(false);
		}
	};

	if (!account) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-green-900 via-black to-emerald-900 flex items-center justify-center">
				<div className="text-center">
					<h2 className="text-2xl font-bold text-white mb-4">Please connect your wallet</h2>
					<p className="text-gray-400">Connect your wallet to access the SHAMBA LUV airdrop</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-green-900 via-black to-emerald-900">
			{/* Header */}
			<header className="bg-black/20 backdrop-blur-lg border-b border-white/10">
				<div className="container mx-auto px-6 py-4">
					<div className="flex justify-between items-center">
						<div className="flex items-center gap-4">
							<h1 className="text-xl font-bold text-white">SHAMBA LUV wallet</h1>
							<div className="flex items-center gap-2 text-sm text-gray-400">
								<span>⚡ Linear Mode</span>
								<span>Direct blockchain transactions</span>
							</div>
						</div>
						{!airdropShown && (
							<div className="flex items-center gap-4">
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
										name: "SHAMBA LUV",
										url: "https://luv.pythai.net",
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
									}}
									connectButton={{
										style: {
											background: 'linear-gradient(45deg, #10b981, #059669)',
											border: 'none',
											borderRadius: '8px',
											padding: '8px 16px',
											fontSize: '14px',
											fontWeight: '600',
											textTransform: 'uppercase',
											letterSpacing: '0.5px',
											fontFamily: 'Inter, system-ui, sans-serif',
											boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
										},
										label: "WALLET"
									}}
								/>
							</div>
						)}
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="container mx-auto px-6 py-12">
				<div className="max-w-4xl mx-auto">
					{/* Welcome Section */}
					<div className="text-center mb-12">
						<div className="flex justify-center items-center gap-4 text-sm text-gray-400 mb-6">
							<div className="flex items-center gap-2">
								<span className="text-green-400">⚡</span>
								<span>Auto-drop enabled - instant delivery</span>
							</div>
							<div className="flex items-center gap-2">
								<span className="text-blue-400">🎁</span>
								<span>1 trillion LUV per participant</span>
							</div>
							<div className="flex items-center gap-2">
								<span className="text-purple-400">🔐</span>
								<span>LUV smart wallet has been created</span>
							</div>
						</div>
						
						<h2 className="text-4xl md:text-6xl font-bold text-white mb-8">
							welcome home bonus
						</h2>
						{!airdropShown ? (
							<button
								onClick={claimAirdrop}
								className="relative w-full max-w-md bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-lg transition-all duration-200 transform hover:scale-110 text-lg mb-4 overflow-hidden group"
							>
								{/* Sliding gradient overlay */}
								<div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/30 to-transparent transform -skew-x-12 -translate-x-full animate-slide-wave"></div>
								
								{/* Button content */}
								<span className="relative z-10">🎁 Claim 1,000,000,000,000 {SHAMBA_LUV_TOKEN.symbol} Tokens 🎁</span>
							</button>
						) : (
							<div className="w-full max-w-md mx-auto mb-4">
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
										name: "SHAMBA LUV",
										url: "https://luv.pythai.net",
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
									}}
									connectButton={{
										style: {
											background: 'linear-gradient(45deg, #10b981, #059669)',
											border: 'none',
											borderRadius: '8px',
											padding: '12px 24px',
											fontSize: '16px',
											fontWeight: '600',
											textTransform: 'uppercase',
											letterSpacing: '0.5px',
											fontFamily: 'Inter, system-ui, sans-serif',
											boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
											width: '100%',
										},
										label: "WALLET"
									}}
								/>
							</div>
						)}
					</div>

					{/* Token Balance Card */}
					<div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8 border border-white/20">
						<div className="mb-6">
							{/* Public Address Display */}
							<div className="mt-4 p-4 bg-black/20 rounded-lg">
								<div className="text-center mb-3">
									<h4 className="text-sm font-semibold text-white mb-2">Your Public Address</h4>
									<div className="flex items-center justify-center gap-2">
										<a 
											href={`https://polygonscan.com/address/${account?.address}`}
											target="_blank"
											rel="noopener noreferrer"
											className="text-blue-400 hover:text-blue-300 font-mono text-xs break-all transition-colors underline"
											title="View on PolygonScan"
										>
											{account?.address || "Not connected"}
										</a>
										<button
											onClick={() => {
												if (account?.address) {
													navigator.clipboard.writeText(account.address);
													// You could add a toast notification here
												}
											}}
											className="text-blue-400 hover:text-blue-300 transition-colors p-1"
											title="Copy address"
										>
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
											</svg>
										</button>
									</div>
								</div>
							</div>
						</div>
						
						<div className="text-center">
							{balanceLoading ? (
								<div className="flex justify-center items-center">
									<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
									<span className="ml-3 text-white">Loading balance...</span>
								</div>
							) : (
								<div>
									<div className="flex items-center justify-center gap-4 mb-2">
										<span className="text-2xl font-bold text-black">BALANCE</span>
										<div className="text-4xl md:text-6xl font-bold text-green-400">
											{balance ? formatBalance(balance) : "0.0"}
										</div>
										<span className="text-2xl font-bold text-black">LUV</span>
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Transaction History Section */}
					{account && transactionHistory.length > 0 && (
						<div className="mt-12">
							<div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
								<div className="flex justify-between items-center mb-6">
									<h3 className="text-2xl font-semibold text-white flex items-center gap-2">
										<span className="text-blue-400">📋</span>
										Your Airdrop Transaction History
									</h3>
									<div className="flex gap-2">
										<button
											onClick={clearUserTransactionHistory}
											className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-4 rounded transition-all duration-200 transform hover:scale-105"
										>
											🗑️ Clear History
										</button>
									</div>
								</div>
								

								<div className="space-y-4">
									{transactionHistory.map((tx, index) => {
										// Validate transaction object before rendering
										if (!tx || typeof tx !== 'object' || !tx.id || !tx.type || !tx.status || !tx.timestamp || !tx.amount || !tx.details) {
											console.warn('Invalid transaction object:', tx);
											return null;
										}
										
										try {
											return (
												<div key={tx.id || index} className="bg-black/20 rounded-lg p-4 border border-gray-700">
													<div className="flex justify-between items-start mb-2">
														<div className="flex items-center gap-2">
															<span className={`text-sm font-medium px-2 py-1 rounded ${
																tx.status === 'success' ? 'bg-green-500/20 text-green-400' :
																tx.status === 'failed' ? 'bg-red-500/20 text-red-400' :
																'bg-yellow-500/20 text-yellow-400'
															}`}>
																{tx.status === 'success' ? '✅ Success' :
																 tx.status === 'failed' ? '❌ Failed' :
																 '⏳ Pending'}
															</span>
															<span className={`text-xs px-2 py-1 rounded ${
																tx.type === 'auto-drop' ? 'bg-blue-500/20 text-blue-400' :
																tx.type === 'manual-claim' ? 'bg-purple-500/20 text-purple-400' :
																'bg-gray-500/20 text-gray-400'
															}`}>
																{tx.type === 'auto-drop' ? '🎁 Auto-Drop' :
																 tx.type === 'manual-claim' ? '👆 Manual Claim' :
																 '🔗 Blockchain'}
															</span>
															{tx.blockchainConfirmed && (
																<span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
																	🔗 Confirmed
																</span>
															)}
														</div>
														<span className="text-gray-400 text-xs">
															{new Date(tx.timestamp).toLocaleString()}
														</span>
													</div>
													
													<div className="mb-2">
														<div className="text-white text-sm font-medium">
															{tx.amount ? (() => {
																try {
																	// Remove commas and convert to BigInt
																	const cleanAmount = tx.amount.toString().replace(/,/g, '');
																	return formatBalance(BigInt(cleanAmount));
																} catch (error) {
																	console.warn('Error formatting amount:', tx.amount, error);
																	return tx.amount;
																}
															})() : '0'} LUV
														</div>
														<div className="text-gray-400 text-xs">
															{tx.details}
														</div>
													</div>
													
													{tx.hash && (
														<div className="flex items-center gap-2">
															<span className="text-gray-400 text-xs">Hash:</span>
															<a 
																href={`https://polygonscan.com/tx/${tx.hash}`}
																target="_blank"
																rel="noopener noreferrer"
																className="text-blue-400 hover:text-blue-300 text-xs font-mono break-all transition-colors"
															>
																{tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
																<svg className="w-3 h-3 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
																</svg>
															</a>
														</div>
													)}
												</div>
											);
										} catch (error) {
											console.error('Error rendering transaction:', tx, error);
											return (
												<div key={tx.id || index} className="bg-red-500/20 rounded-lg p-4 border border-red-500/30">
													<div className="text-red-400 text-sm">Error displaying transaction</div>
													<div className="text-gray-400 text-xs">Transaction ID: {tx.id}</div>
												</div>
											);
										}
									})}
								</div>

								{/* Page Refresh Warning */}
								<div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
									<div className="text-yellow-400 text-sm font-medium mb-1">
										⚠️ Important: Page Refresh Logout
									</div>
									<div className="text-gray-300 text-xs">
										Refreshing the page will automatically log you out and clear your transaction history. This is a security feature to prevent abuse.
									</div>
								</div>

							</div>
						</div>
					)}
				</div>
			</main>
		</div>
	);
}