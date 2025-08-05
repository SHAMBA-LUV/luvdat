import { ConnectButton, ThirdwebProvider, useActiveAccount, useReadContract } from "thirdweb/react";
import { useState, useEffect } from "react";
import { client } from "./client";
import { AirdropApp } from "./AirdropApp";
import { DEFAULT_CHAIN, SHAMBA_LUV_TOKEN, SHAMBA_LUV_AIRDROP, isAirdropContractConfigured } from "./tokens";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { getContract } from "thirdweb";
import { registerUser } from "./utils/airdropProtection";

// Account factory address from .env
const accountFactoryAddress = import.meta.env.VITE_TEMPLATE_ACCOUNT_MANAGER_ADDRESS;

// Configure wallets like the working example
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

function AppContent() {
	const account = useActiveAccount();
	const [userRegistered, setUserRegistered] = useState(false);

	// Register user when account connects
	useEffect(() => {
		const initializeUser = async () => {
			if (account?.address && !userRegistered) {
				try {
					// Try to detect auth method from wallet type
					const authMethod = account.address.startsWith('0x') ? 
						(account as any).wallet?.id || 'unknown' : 'unknown';
					
					const registration = await registerUser(
						account.address, 
						authMethod
					);
					
					setUserRegistered(registration.success);
					
					if (!registration.success) {
						console.warn('User registration failed:', registration.message);
					}
				} catch (error) {
					console.error('User registration error:', error);
				}
			}
		};

		initializeUser();
	}, [account?.address, userRegistered]);

	if (account) {
		return <AirdropApp />;
	}

	return <TrippyLandingPage />;
}

// Live statistics component
function LiveStats() {
	// Create contract instances
	const tokenContract = getContract({
		client,
		chain: DEFAULT_CHAIN,
		address: SHAMBA_LUV_TOKEN.address,
	});

	const airdropContract = getContract({
		client,
		chain: DEFAULT_CHAIN,
		address: SHAMBA_LUV_AIRDROP.address,
	});

	// Read token total supply
	const { data: totalSupply } = useReadContract({
		contract: tokenContract,
		method: "function totalSupply() view returns (uint256)",
		params: [],
	});

	// Read reflection stats
	const { data: reflectionStats } = useReadContract({
		contract: tokenContract,
		method: "function getReflectionStats() view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
		params: [],
	});

	// Read airdrop stats (only if contract is configured)
	const airdropStatsQuery = useReadContract({
		contract: airdropContract,
		method: "function getAirdropStats() view returns (uint256, uint256, uint256, uint256)",
		params: [],
	});
	
	const airdropStats = isAirdropContractConfigured() ? airdropStatsQuery.data : undefined;

	// Format large numbers
	const formatLargeNumber = (num: bigint) => {
		if (!num) return "0";
		const numStr = num.toString();
		const decimals = SHAMBA_LUV_TOKEN.decimals;
		
		if (numStr.length <= decimals) {
			return "0";
		}
		
		const integerPart = numStr.slice(0, -decimals);
		const length = integerPart.length;
		
		if (length > 15) {
			return `${integerPart.slice(0, -15)}Q`; // Quadrillion
		} else if (length > 12) {
			return `${integerPart.slice(0, -12)}T`; // Trillion
		} else if (length > 9) {
			return `${integerPart.slice(0, -9)}B`; // Billion
		} else if (length > 6) {
			return `${integerPart.slice(0, -6)}M`; // Million
		} else if (length > 3) {
			return `${integerPart.slice(0, -3)}K`; // Thousand
		}
		
		return integerPart;
	};

	return (
		<div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-12">
			<div className="bg-black/40 backdrop-blur-lg rounded-xl p-4 border border-purple-500/30 text-center">
				<div className="text-2xl font-bold text-purple-400">
					{totalSupply ? formatLargeNumber(totalSupply) : "100Q"}
				</div>
				<div className="text-xs text-gray-400">Total Supply</div>
			</div>
			
			<div className="bg-black/40 backdrop-blur-lg rounded-xl p-4 border border-green-500/30 text-center">
				<div className="text-2xl font-bold text-green-400">
					{reflectionStats ? formatLargeNumber(reflectionStats[1]) : "0"}
				</div>
				<div className="text-xs text-gray-400">Reflections Paid</div>
			</div>
			
			<div className="bg-black/40 backdrop-blur-lg rounded-xl p-4 border border-yellow-500/30 text-center">
				<div className="text-2xl font-bold text-yellow-400">
					{airdropStats ? airdropStats[2].toString() : "0"}
				</div>
				<div className="text-xs text-gray-400">Airdrops Claimed</div>
			</div>
			
			<div className="bg-black/40 backdrop-blur-lg rounded-xl p-4 border border-blue-500/30 text-center">
				<div className="text-2xl font-bold text-blue-400">
					{airdropStats ? formatLargeNumber(airdropStats[3]) : "∞"}
				</div>
				<div className="text-xs text-gray-400">Available</div>
			</div>
		</div>
	);
}

function TrippyLandingPage() {
	const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
	const [copiedAddress, setCopiedAddress] = useState(false);

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			setMousePosition({ x: e.clientX, y: e.clientY });
		};

		window.addEventListener('mousemove', handleMouseMove);
		return () => window.removeEventListener('mousemove', handleMouseMove);
	}, []);

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		setCopiedAddress(true);
		setTimeout(() => setCopiedAddress(false), 2000);
	};

	return (
		<div className="min-h-screen overflow-hidden relative bg-black">
			{/* Animated Background */}
			<div className="absolute inset-0">
				{/* Moving gradient background */}
				<div 
					className="absolute inset-0 opacity-30"
					style={{
						background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, #ff006e, #8338ec, #3a86ff, #06ffa5, #ffbe0b)`,
						animation: 'pulse 4s ease-in-out infinite alternate'
					}}
				/>
				
				{/* Floating particles */}
				<div className="absolute inset-0">
					{Array.from({ length: 50 }).map((_, i) => (
						<div
							key={i}
							className="absolute w-1 h-1 bg-white rounded-full opacity-70 animate-float"
							style={{
								left: `${Math.random() * 100}%`,
								top: `${Math.random() * 100}%`,
								animationDelay: `${Math.random() * 5}s`
							}}
						/>
					))}
				</div>

				{/* Animated geometric shapes */}
				<div className="absolute inset-0 overflow-hidden">
					<div className="absolute top-1/4 left-1/4 w-32 h-32 border-2 border-pink-500 rotate-45 animate-spin-slow opacity-20" />
					<div className="absolute top-3/4 right-1/4 w-24 h-24 border-2 border-cyan-400 animate-pulse opacity-30" />
					<div className="absolute top-1/2 left-1/2 w-40 h-40 border-2 border-yellow-400 rounded-full animate-ping opacity-20" />
				</div>
			</div>

			{/* Main Content */}
			<div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8">
				{/* Logo */}
				<div className="mb-12 relative">
					<div className="text-8xl md:text-9xl animate-bounce-slow">❤️</div>
					<div className="absolute inset-0 text-8xl md:text-9xl animate-pulse opacity-50">💖</div>
				</div>

				{/* Main Title */}
				<div className="text-center mb-16 relative">
					<h1 className="text-4xl md:text-8xl font-black tracking-wider mb-4 relative">
						<span 
							className="bg-gradient-to-r from-pink-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent animate-gradient-x"
							style={{
								backgroundSize: '200% 200%'
							}}
						>
							SHAMBA LUV
						</span>
					</h1>
					<div className="text-xl md:text-3xl font-bold text-white mb-8 opacity-90">
						<span className="inline-block animate-pulse">✨</span>
						<span className="mx-2 text-gradient bg-gradient-to-r from-yellow-400 to-pink-400 bg-clip-text text-transparent">
							The Love Token
						</span>
						<span className="inline-block animate-pulse">✨</span>
					</div>
				</div>

				{/* Live Statistics */}
				<LiveStats />

				{/* Airdrop CTA */}
				<div className="text-center mb-12 relative">
					<div className="bg-black/40 backdrop-blur-lg rounded-3xl p-8 border border-pink-500/30 hover:border-pink-500/60 transition-all duration-300">
						<h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
							🎁 FREE AIRDROP AVAILABLE 🎁
						</h2>
						<p className="text-lg md:text-xl text-gray-300 mb-6 max-w-lg mx-auto">
							Connect your wallet now and automatically receive{" "}
							<span className="text-yellow-400 font-bold">1 TRILLION LUV</span>{" "}
							tokens instantly!
						</p>
						<div className="text-sm text-gray-400 mb-8">
							💝 One-time airdrop per wallet • No fees • Instant delivery
						</div>
					</div>
				</div>

				{/* Token Economics */}
				<div className="mb-16 max-w-6xl mx-auto">
					<div className="text-center mb-8">
						<h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
							💰 Token Economics
						</h2>
						<p className="text-gray-300 text-lg">
							Built for holders with automatic rewards and community growth
						</p>
					</div>
					
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
						<div className="bg-black/40 backdrop-blur-lg rounded-2xl p-6 border border-green-500/30 hover:border-green-500/60 transition-all duration-300">
							<div className="text-4xl mb-4">💎</div>
							<h3 className="text-xl font-bold text-green-400 mb-2">3% Reflections</h3>
							<p className="text-gray-400 text-sm">
								Automatic token rewards distributed to all holders from every transaction
							</p>
						</div>
						
						<div className="bg-black/40 backdrop-blur-lg rounded-2xl p-6 border border-blue-500/30 hover:border-blue-500/60 transition-all duration-300">
							<div className="text-4xl mb-4">🌊</div>
							<h3 className="text-xl font-bold text-blue-400 mb-2">1% Liquidity</h3>
							<p className="text-gray-400 text-sm">
								Grows the liquidity pool for better price stability and trading
							</p>
						</div>
						
						<div className="bg-black/40 backdrop-blur-lg rounded-2xl p-6 border border-purple-500/30 hover:border-purple-500/60 transition-all duration-300">
							<div className="text-4xl mb-4">🚀</div>
							<h3 className="text-xl font-bold text-purple-400 mb-2">1% Development</h3>
							<p className="text-gray-400 text-sm">
								Funds marketing, development, and community initiatives
							</p>
						</div>
						
						<div className="bg-black/40 backdrop-blur-lg rounded-2xl p-6 border border-pink-500/30 hover:border-pink-500/60 transition-all duration-300">
							<div className="text-4xl mb-4">💝</div>
							<h3 className="text-xl font-bold text-pink-400 mb-2">0% P2P Fees</h3>
							<p className="text-gray-400 text-sm">
								Send tokens between wallets with zero fees - share the love!
							</p>
						</div>
					</div>
				</div>

				{/* Connect Button */}
				<div className="relative mb-16">
					<div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl blur-xl opacity-50 animate-pulse" />
					<div className="relative bg-gradient-to-r from-pink-500 to-purple-600 p-1 rounded-2xl hover:scale-105 transition-transform duration-300">
						<div className="bg-black rounded-xl p-4">
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
								}}
								connectButton={{
									style: {
										background: 'linear-gradient(45deg, #ff006e, #8338ec)',
										border: 'none',
										borderRadius: '12px',
										padding: '16px 32px',
										fontSize: '18px',
										fontWeight: 'bold',
										textTransform: 'uppercase',
										letterSpacing: '1px',
									}
								}}
							/>
						</div>
					</div>
				</div>

				{/* Technical Details */}
				<div className="mb-16 max-w-4xl mx-auto">
					<div className="text-center mb-8">
						<h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
							🔧 Technical Details
						</h2>
						<p className="text-gray-300 text-lg">
							Built on cutting-edge blockchain technology
						</p>
					</div>
					
					<div className="bg-black/40 backdrop-blur-lg rounded-2xl p-8 border border-gray-500/30">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div className="space-y-4">
								<div className="flex items-center gap-3">
									<div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
										<span className="text-purple-400 text-sm">🏗️</span>
									</div>
									<div>
										<div className="text-white font-semibold">Network</div>
										<div className="text-gray-400 text-sm">Polygon - Fast & Low Cost</div>
									</div>
								</div>
								
								<div className="flex items-center gap-3">
									<div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
										<span className="text-green-400 text-sm">✅</span>
									</div>
									<div>
										<div className="text-white font-semibold">Security</div>
										<div className="text-gray-400 text-sm">Verified Contract + ReentrancyGuard</div>
									</div>
								</div>
								
								<div className="flex items-center gap-3">
									<div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
										<span className="text-blue-400 text-sm">⛽</span>
									</div>
									<div>
										<div className="text-white font-semibold">Gas Sponsorship</div>
										<div className="text-gray-400 text-sm">All transactions are gasless</div>
									</div>
								</div>
							</div>
							
							<div className="space-y-4">
								<div className="flex items-center gap-3">
									<div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
										<span className="text-yellow-400 text-sm">🔐</span>
									</div>
									<div>
										<div className="text-white font-semibold">Smart Accounts</div>
										<div className="text-gray-400 text-sm">Account Abstraction Enabled</div>
									</div>
								</div>
								
								<div className="flex items-center gap-3">
									<div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center">
										<span className="text-pink-400 text-sm">🎯</span>
									</div>
									<div>
										<div className="text-white font-semibold">16 Auth Methods</div>
										<div className="text-gray-400 text-sm">Email, Social, Passkey & More</div>
									</div>
								</div>
								
								<div className="flex items-center gap-3">
									<div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
										<span className="text-cyan-400 text-sm">📱</span>
									</div>
									<div>
										<div className="text-white font-semibold">Mobile First</div>
										<div className="text-gray-400 text-sm">Optimized for all devices</div>
									</div>
								</div>
							</div>
						</div>
						
						{/* Contract Address */}
						<div className="mt-8 pt-6 border-t border-gray-700">
							<div className="text-center">
								<div className="text-sm text-gray-400 mb-2">Contract Address</div>
								<div className="flex items-center justify-center gap-3">
									<code className="bg-black/50 px-4 py-2 rounded-lg text-sm text-blue-400 font-mono break-all">
										{SHAMBA_LUV_TOKEN.address}
									</code>
									<button
										onClick={() => copyToClipboard(SHAMBA_LUV_TOKEN.address)}
										className="bg-blue-500/20 hover:bg-blue-500/30 px-3 py-2 rounded-lg transition-colors"
									>
										{copiedAddress ? (
											<span className="text-green-400 text-sm">✅ Copied!</span>
										) : (
											<span className="text-blue-400 text-sm">📋 Copy</span>
										)}
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Enhanced Features */}
				<div className="mb-16 max-w-6xl mx-auto">
					<div className="text-center mb-8">
						<h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
							✨ Platform Features
						</h2>
						<p className="text-gray-300 text-lg">
							Everything you need for the ultimate token experience
						</p>
					</div>
					
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						<div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 border border-purple-500/30 hover:border-purple-500/60 transition-all duration-300">
							<div className="text-4xl mb-4">🎁</div>
							<h3 className="text-xl font-bold text-white mb-2">Instant Airdrop</h3>
							<p className="text-gray-400">Get 1 trillion LUV tokens the moment you connect your wallet</p>
						</div>
						
						<div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 border border-cyan-500/30 hover:border-cyan-500/60 transition-all duration-300">
							<div className="text-4xl mb-4">💎</div>
							<h3 className="text-xl font-bold text-white mb-2">Auto Reflections</h3>
							<p className="text-gray-400">Earn rewards automatically from every transaction - no staking required</p>
						</div>
						
						<div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 border border-yellow-500/30 hover:border-yellow-500/60 transition-all duration-300">
							<div className="text-4xl mb-4">⛽</div>
							<h3 className="text-xl font-bold text-white mb-2">Zero Gas Fees</h3>
							<p className="text-gray-400">All transactions sponsored - never pay gas fees again</p>
						</div>
						
						<div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 border border-green-500/30 hover:border-green-500/60 transition-all duration-300">
							<div className="text-4xl mb-4">🔐</div>
							<h3 className="text-xl font-bold text-white mb-2">Smart Security</h3>
							<p className="text-gray-400">Advanced account abstraction with multiple authentication options</p>
						</div>
						
						<div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 border border-pink-500/30 hover:border-pink-500/60 transition-all duration-300">
							<div className="text-4xl mb-4">🌍</div>
							<h3 className="text-xl font-bold text-white mb-2">Global Access</h3>
							<p className="text-gray-400">Login with Google, Email, Phone, or any wallet worldwide</p>
						</div>
						
						<div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 border border-blue-500/30 hover:border-blue-500/60 transition-all duration-300">
							<div className="text-4xl mb-4">📱</div>
							<h3 className="text-xl font-bold text-white mb-2">Mobile First</h3>
							<p className="text-gray-400">Perfect experience on desktop, tablet, and mobile devices</p>
						</div>
					</div>
				</div>

				{/* FAQ Section */}
				<div className="mb-16 max-w-4xl mx-auto">
					<div className="text-center mb-8">
						<h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
							❓ Frequently Asked Questions
						</h2>
						<p className="text-gray-300 text-lg">
							Everything you need to know about SHAMBA LUV
						</p>
					</div>
					
					<div className="space-y-6">
						<div className="bg-black/40 backdrop-blur-lg rounded-2xl p-6 border border-gray-500/30">
							<h3 className="text-xl font-bold text-white mb-3">💎 How do reflections work?</h3>
							<p className="text-gray-300">
								Every time someone buys or sells SHAMBA LUV tokens, 3% of that transaction is automatically 
								distributed to all token holders proportionally. The more tokens you hold, the more reflections you earn!
							</p>
						</div>
						
						<div className="bg-black/40 backdrop-blur-lg rounded-2xl p-6 border border-gray-500/30">
							<h3 className="text-xl font-bold text-white mb-3">🏗️ Why Polygon Network?</h3>
							<p className="text-gray-300">
								Polygon offers lightning-fast transactions with extremely low fees (often under $0.01). 
								This makes it perfect for frequent micro-transactions and ensures you keep more of your tokens!
							</p>
						</div>
						
						<div className="bg-black/40 backdrop-blur-lg rounded-2xl p-6 border border-gray-500/30">
							<h3 className="text-xl font-bold text-white mb-3">⛽ What makes gas sponsorship special?</h3>
							<p className="text-gray-300">
								Through Account Abstraction technology, all your transactions are sponsored. 
								You never need to worry about having MATIC for gas fees - everything is completely free for users!
							</p>
						</div>
						
						<div className="bg-black/40 backdrop-blur-lg rounded-2xl p-6 border border-gray-500/30">
							<h3 className="text-xl font-bold text-white mb-3">🚀 How can I earn more tokens?</h3>
							<p className="text-gray-300">
								Simply hold your SHAMBA LUV tokens and earn automatic reflections from every transaction. 
								You can also refer friends to claim their airdrop, growing the community and increasing trading volume!
							</p>
						</div>
						
						<div className="bg-black/40 backdrop-blur-lg rounded-2xl p-6 border border-gray-500/30">
							<h3 className="text-xl font-bold text-white mb-3">🔐 Is SHAMBA LUV safe?</h3>
							<p className="text-gray-300">
								Yes! Our smart contract is verified on PolygonScan, includes ReentrancyGuard protection, 
								and has been audited for security. Plus, with Account Abstraction, your wallet is more secure than ever.
							</p>
						</div>
						
						<div className="bg-black/40 backdrop-blur-lg rounded-2xl p-6 border border-gray-500/30">
							<h3 className="text-xl font-bold text-white mb-3">💝 What's special about wallet-to-wallet transfers?</h3>
							<p className="text-gray-300">
								When you send SHAMBA LUV tokens directly to another wallet (not through an exchange), 
								there are 0% fees! This encourages sharing and community growth - literally share the love!
							</p>
						</div>
					</div>
				</div>

				{/* Disclaimer */}
				<div className="text-center mt-16 max-w-2xl mx-auto">
					<p className="text-xs text-gray-500">
						By connecting your wallet, you agree to receive SHAMBA LUV tokens. 
						Airdrop is limited to one per wallet address. Built on Polygon network.
						Smart contract verified on PolygonScan. Not financial advice.
					</p>
				</div>
			</div>
		</div>
	);
}

export function App() {
	return (
		<ThirdwebProvider>
			<AppContent />
		</ThirdwebProvider>
	);
}