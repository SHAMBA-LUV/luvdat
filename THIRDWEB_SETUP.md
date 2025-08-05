# Thirdweb Setup Guide for SHAMBA LUV

## 🚀 Quick Setup

### 1. Get Your Thirdweb Client ID

1. **Go to [Thirdweb Dashboard](https://thirdweb.com/dashboard)**
2. **Sign up/Login** to your Thirdweb account
3. **Create a new project** or use existing one
4. **Go to Settings → API Keys**
5. **Copy your Client ID** (this is what you need!)

### 2. Update Environment Variables

Update your `.env` file with the real Client ID:

```bash
# Thirdweb Configuration
VITE_TEMPLATE_CLIENT_ID=your_actual_client_id_from_dashboard
VITE_TEMPLATE_SECRET_KEY=your_secret_key_here
VITE_TEMPLATE_ACCOUNT_MANAGER_ADDRESS=0x0000000000000000000000000000000000000000

# Contract Addresses
VITE_TEMPLATE_TOKEN_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
VITE_AIRDROP_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
```

## 🔧 What You Need

### Required:
- ✅ **Client ID** - From Thirdweb Dashboard (API Keys section)
- ✅ **Secret Key** - Optional for client-side, required for server-side

### Optional (for advanced features):
- 🔧 **Account Factory Address** - For smart wallet features
- 🔧 **Token Contract Address** - Your deployed token contract
- 🔧 **Airdrop Contract Address** - Your deployed airdrop contract

## 📋 Step-by-Step Instructions

### Step 1: Thirdweb Dashboard Setup

1. Visit [https://thirdweb.com/dashboard](https://thirdweb.com/dashboard)
2. Create account or sign in
3. Create new project: "SHAMBA LUV"
4. Select Polygon as your chain
5. Go to **Settings → API Keys**
6. Copy the **Client ID**

### Step 2: Environment Configuration

Replace the placeholder in your `.env` file:

```bash
# Replace this:
VITE_TEMPLATE_CLIENT_ID=your_thirdweb_client_id_here

# With your actual Client ID:
VITE_TEMPLATE_CLIENT_ID=abc123def456ghi789...
```

### Step 3: Test the Setup

1. **Restart your development server:**
   ```bash
   npm run dev
   ```

2. **Test wallet connection:**
   - Open the app in browser
   - Click "Connect Wallet"
   - Should see Thirdweb wallet options

## 🎯 What Each Variable Does

| Variable | Purpose | Required |
|----------|---------|----------|
| `VITE_TEMPLATE_CLIENT_ID` | Thirdweb client authentication | ✅ **YES** |
| `VITE_TEMPLATE_SECRET_KEY` | Server-side operations | ❌ Optional |
| `VITE_TEMPLATE_ACCOUNT_MANAGER_ADDRESS` | Smart wallet factory | ❌ Optional |
| `VITE_TEMPLATE_TOKEN_CONTRACT_ADDRESS` | Your token contract | ❌ Optional |
| `VITE_AIRDROP_CONTRACT_ADDRESS` | Your airdrop contract | ❌ Optional |

## 🔍 Troubleshooting

### "Client ID not found" error
- Make sure you copied the Client ID correctly
- Check that it starts with letters/numbers (no spaces)
- Restart the dev server after updating `.env`

### Wallet not connecting
- Verify Client ID is correct
- Check browser console for errors
- Ensure you're on HTTPS or localhost

### "Invalid Client ID" error
- Double-check the Client ID from dashboard
- Make sure you're using the right project
- Try creating a new project if issues persist

## 📚 Additional Resources

- [Thirdweb Client Configuration](https://portal.thirdweb.com/typescript/v5/client)
- [React SDK Documentation](https://portal.thirdweb.com/typescript/v5/react)
- [In-App Wallet Setup](https://portal.thirdweb.com/connect/in-app-wallet/overview)
- [Account Abstraction Guide](https://portal.thirdweb.com/connect/account-abstraction)

## 🎉 Success Indicators

When properly configured, you should see:
- ✅ Wallet connection working
- ✅ No console errors
- ✅ Thirdweb wallet options appearing
- ✅ Smooth authentication flow

---

**Need help?** Check the [Thirdweb Discord](https://discord.gg/thirdweb) for community support! 