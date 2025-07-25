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
} as const;

export const SHAMBA_LUV_AIRDROP = {
	address: AIRDROP_ADDRESS || "0x0000000000000000000000000000000000000000",
	abi: [
		"function claimAirdrop() external",
		"function hasUserClaimed(address user) external view returns (bool)",
		"function getAirdropStats() external view returns (uint256, uint256, uint256, uint256)",
		"function airdropAmount() external view returns (uint256)"
	]
} as const;

export const DEFAULT_CHAIN = polygon;

// Helper function to check if airdrop contract is configured
export const isAirdropContractConfigured = () => {
	return AIRDROP_ADDRESS && AIRDROP_ADDRESS !== "0x0000000000000000000000000000000000000000";
};