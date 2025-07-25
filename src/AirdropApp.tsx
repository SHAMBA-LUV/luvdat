import { ConnectButton, useActiveAccount, useReadContract, useSendTransaction } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc20";
import { client } from "./client";
import { SHAMBA_LUV_TOKEN, SHAMBA_LUV_AIRDROP, DEFAULT_CHAIN, isAirdropContractConfigured } from "./tokens";
import { useState, useEffect } from "react";
import { inAppWallet, createWallet } from "thirdweb/wallets";

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
			return `0.${'0'.repeat(decimals - balanceStr.length)}${balanceStr}`;
		}
		const integerPart = balanceStr.slice(0, -decimals);
		const decimalPart = balanceStr.slice(-decimals);
		return `${integerPart}.${decimalPart.replace(/0+$/, '') || '0'}`;
	};

	// Claim airdrop function
	const claimAirdrop = async () => {
		if (!account || !airdropConfigured || hasClaimedData || isClaimingAirdrop) return;

		setIsClaimingAirdrop(true);
		try {
			const transaction = prepareContractCall({
				contract: airdropContract,
				method: "function claimAirdrop()",
			});

			await sendTransaction(transaction);
			setAirdropClaimed(true);
		} catch (error) {
			console.error("Airdrop claim failed:", error);
			alert("Airdrop claim failed. Please try again.");
		} finally {
			setIsClaimingAirdrop(false);
		}
	};

	// Auto-claim airdrop when user connects (if they haven't claimed)
	useEffect(() => {
		if (account && airdropConfigured && !claimStatusLoading && hasClaimedData === false && !isClaimingAirdrop && !airdropClaimed) {
			// Small delay to ensure everything is loaded
			setTimeout(() => {
				claimAirdrop();
			}, 2000);
		}
	}, [account, hasClaimedData, claimStatusLoading, airdropConfigured]);

	const airdropAmount = airdropAmountData ? formatBalance(airdropAmountData) : "0";
	const hasClaimed = hasClaimedData || airdropClaimed;

	return (
		<div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
			{/* Header */}
			<header className="flex justify-between items-center p-6 border-b border-gray-700">
				<h1 className="text-2xl font-bold text-white">SHAMBA LUV Airdrop</h1>
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
						<p className="text-xl text-gray-300 mb-8">
							Connect your wallet to automatically receive your welcome airdrop!
						</p>
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
						<h3 className="text-2xl font-semibold text-white mb-6 text-center">
							Welcome Airdrop Status
						</h3>
						
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