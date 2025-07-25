import { ConnectButton, ThirdwebProvider, useActiveAccount } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";
import { useState, useEffect } from "react";
import { client } from "./client";
import { AirdropApp } from "./AirdropApp";
import { DEFAULT_CHAIN, SHAMBA_LUV_TOKEN } from "./tokens";

const wallets = [
	inAppWallet({
		auth: {
			options: ["email", "google", "apple", "phone", "passkey", "farcaster"],
		},
		smartAccount: {
			chain: DEFAULT_CHAIN,
			sponsorGas: true,
		},
	}),
];

function AppContent() {
	const account = useActiveAccount();

	if (account) {
		return <AirdropApp />;
	}

	return <TrippyLandingPage />;
}

function TrippyLandingPage() {
	const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			setMousePosition({ x: e.clientX, y: e.clientY });
		};

		window.addEventListener('mousemove', handleMouseMove);
		return () => window.removeEventListener('mousemove', handleMouseMove);
	}, []);

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

				{/* Features */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto text-center">
					<div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 border border-purple-500/30 hover:border-purple-500/60 transition-all duration-300">
						<div className="text-4xl mb-4">🚀</div>
						<h3 className="text-xl font-bold text-white mb-2">Instant Rewards</h3>
						<p className="text-gray-400">Get 1 trillion LUV tokens the moment you connect your wallet</p>
					</div>
					
					<div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 border border-cyan-500/30 hover:border-cyan-500/60 transition-all duration-300">
						<div className="text-4xl mb-4">💎</div>
						<h3 className="text-xl font-bold text-white mb-2">Reflection Rewards</h3>
						<p className="text-gray-400">Earn more tokens just by holding SHAMBA LUV</p>
					</div>
					
					<div className="bg-black/30 backdrop-blur-lg rounded-2xl p-6 border border-yellow-500/30 hover:border-yellow-500/60 transition-all duration-300">
						<div className="text-4xl mb-4">🌍</div>
						<h3 className="text-xl font-bold text-white mb-2">Global Community</h3>
						<p className="text-gray-400">Join thousands spreading love worldwide</p>
					</div>
				</div>

				{/* Disclaimer */}
				<div className="text-center mt-16 max-w-2xl mx-auto">
					<p className="text-xs text-gray-500">
						By connecting your wallet, you agree to receive SHAMBA LUV tokens. 
						Airdrop is limited to one per wallet address. Built on Polygon network.
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