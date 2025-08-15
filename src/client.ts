import { createThirdwebClient } from "thirdweb";
import { inAppWallet, smartWallet } from "thirdweb/wallets";
import { polygon } from "thirdweb/chains";

// Replace this with your client ID string
// refer to https://portal.thirdweb.com/typescript/v5/client on how to get a client ID
const clientId = import.meta.env.VITE_TEMPLATE_CLIENT_ID;
const secretKey = import.meta.env.VITE_TEMPLATE_SECRET_KEY;
const accountManagerAddress = import.meta.env.VITE_TEMPLATE_ACCOUNT_MANAGER_ADDRESS;

// Validate environment variables
if (!clientId) {
  console.error("VITE_TEMPLATE_CLIENT_ID is not set in environment variables");
}

if (!secretKey) {
  console.error("VITE_TEMPLATE_SECRET_KEY is not set in environment variables");
}

if (!accountManagerAddress) {
  console.error("VITE_TEMPLATE_ACCOUNT_MANAGER_ADDRESS is not set in environment variables");
}

export const client = createThirdwebClient({
  clientId: clientId || "",
  secretKey: secretKey || "",
});

// Configure in-app wallet for authentication (this will be the personal account)
export const inAppWalletConfig = inAppWallet({
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
});

// Configure smart wallet with account factory from environment
export const smartWalletConfig = smartWallet({
  chain: polygon,
  factoryAddress: accountManagerAddress || "", // Account factory from .env
  gasless: true, // Enable gasless for airdrop claims - factory pays gas
  paymaster: {
    type: "thirdweb",
  },
});
