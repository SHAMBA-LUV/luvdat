import { polygon } from "thirdweb/chains";

// Validate environment variables
const TOKEN_ADDRESS = import.meta.env.VITE_TEMPLATE_TOKEN_CONTRACT_ADDRESS;
const AIRDROP_ADDRESS = import.meta.env.VITE_AIRDROP_CONTRACT_ADDRESS;

if (!TOKEN_ADDRESS) {
	throw new Error("VITE_TEMPLATE_TOKEN_CONTRACT_ADDRESS is not set in environment variables");
}

if (!AIRDROP_ADDRESS) {
	console.warn("VITE_AIRDROP_CONTRACT_ADDRESS is not set - airdrop functionality will not work");
}

export const SHAMBA_LUV_TOKEN = {
	address: TOKEN_ADDRESS,
	name: "SHAMBA LUV",
	symbol: "LUV",
	decimals: 18,
	chain: polygon,
	icon: "❤️",
	// Enhanced ABI for improved contract
	abi: [
		// Standard ERC20 functions
		"function name() view returns (string)",
		"function symbol() view returns (string)",
		"function decimals() view returns (uint8)",
		"function totalSupply() view returns (uint256)",
		"function balanceOf(address) view returns (uint256)",
		"function transfer(address, uint256) returns (bool)",
		"function transferFrom(address, address, uint256) returns (bool)",
		"function approve(address, uint256) returns (bool)",
		"function allowance(address, address) view returns (uint256)",
		
		// Reflection functions
		"function claimReflections() external",
		"function getReflectionBalance(address) view returns (uint256)",
		"function forceReflectionUpdate() external",
		"function getReflectionStats() view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
		
		// Fee and exemption functions
		"function getFeePercentage() view returns (uint256)",
		"function setFeeExemption(address, bool) external",
		"function setWalletToWalletFeeExempt(bool) external",
		"function getWalletToWalletFeeExemptStatus() view returns (bool, string)",
		
		// Router and swap functions
		"function getRouterConfig() view returns (address, address, bool, uint256, uint256)",
		"function getRouterStatus() view returns (address, uint256, uint256)",
		"function getSwapStatus() view returns (bool, uint256, uint256, uint256)",
		
		// Security and admin functions
		"function getSecuritySettings() view returns (uint256, uint256, uint256, uint256, uint256)",
		"function getSlippageProtectionInfo(uint256) view returns (uint256, uint256, uint256, uint256)",
		"function getTimelockDelayInfo() view returns (uint256, uint256, uint256, uint256)",
		
		// Gas optimization functions
		"function getGasOptimizationStats() view returns (uint256, uint256, uint256, uint256)",
		"function localTotalSupply() view returns (uint256)",
		
		// Burn functions
		"function manualBurn(uint256 amount) external",
		"function burnFromContract(uint256 amount) external",
		
		// Events
		"event ReflectionDistributed(address indexed holder, uint256 amount)",
		"event WalletToWalletFeeExemptTransfer(address indexed from, address indexed to, uint256 amount)",
		"event ReflectionBatchProcessed(uint256 totalFees, uint256 newIndex)",
		"event TokensBurned(address indexed burner, uint256 amount, address indexed deadAddress)"
	]
} as const;

export const SHAMBA_LUV_AIRDROP = {
	address: AIRDROP_ADDRESS || "0x0000000000000000000000000000000000000000",
	abi: [
		// Core airdrop functions - exact ABI from working luvdrop implementation
		{
			"inputs": [],
			"name": "claimAirdrop",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{ "internalType": "address", "name": "token", "type": "address" }
			],
			"name": "claimAirdropForToken",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{ "internalType": "address", "name": "token", "type": "address" },
				{ "internalType": "address", "name": "user", "type": "address" }
			],
			"name": "hasUserClaimed",
			"outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{ "internalType": "address", "name": "user", "type": "address" }
			],
			"name": "hasUserClaimed",
			"outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
			"stateMutability": "view",
			"type": "function"
		},
		
		// View functions
		{
			"inputs": [
				{ "internalType": "address", "name": "token", "type": "address" }
			],
			"name": "getAirdropStats",
			"outputs": [
				{ "internalType": "uint256", "name": "airdropAmount", "type": "uint256" },
				{ "internalType": "uint256", "name": "totalClaimed", "type": "uint256" },
				{ "internalType": "uint256", "name": "totalRecipients", "type": "uint256" },
				{ "internalType": "uint256", "name": "contractBalance", "type": "uint256" },
				{ "internalType": "bool", "name": "isActive", "type": "bool" }
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "getAirdropStats",
			"outputs": [
				{ "internalType": "uint256", "name": "airdropAmount", "type": "uint256" },
				{ "internalType": "uint256", "name": "totalClaimed", "type": "uint256" },
				{ "internalType": "uint256", "name": "totalRecipients", "type": "uint256" },
				{ "internalType": "uint256", "name": "contractBalance", "type": "uint256" },
				{ "internalType": "bool", "name": "isActive", "type": "bool" }
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "defaultToken",
			"outputs": [{ "internalType": "address", "name": "", "type": "address" }],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{ "internalType": "address", "name": "token", "type": "address" }
			],
			"name": "getTokenBalance",
			"outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "getTokenBalance",
			"outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{ "internalType": "address", "name": "token", "type": "address" }
			],
			"name": "isAirdropActive",
			"outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "isAirdropActive",
			"outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
			"stateMutability": "view",
			"type": "function"
		}
	]
} as const;

export const DEFAULT_CHAIN = polygon;

// Helper function to check if airdrop contract is configured
export const isAirdropContractConfigured = () => {
	return AIRDROP_ADDRESS && AIRDROP_ADDRESS !== "0x0000000000000000000000000000000000000000";
};