# SHAMBA LUV Airdrop System

A complete airdrop system for SHAMBA LUV tokens with thirdweb account manager integration, automatic token delivery, and loyalty rewards.

## 🚀 Features

- **Automatic Airdrop**: 1 trillion LUV tokens delivered instantly when users connect
- **Thirdweb Integration**: Smart wallet creation with 16 authentication methods
- **Loyalty Rewards**: Second 1 trillion LUV claim available for loyal users
- **Zero Balance Detection**: Prioritizes users with 0 LUV tokens
- **Gasless Transactions**: Sponsored gas fees for seamless experience
- **In-Memory Backend**: No PostgreSQL required - works out of the box
- **Protection System**: Anti-abuse measures with intelligent claim detection

## 🛠️ Technology Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + In-Memory Database
- **Blockchain**: Polygon Network + Thirdweb SDK
- **Authentication**: 16 methods (Google, Apple, Facebook, Discord, etc.)
- **Smart Wallets**: Account Abstraction with gas sponsorship

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Quick Start

1. **Clone and install dependencies:**
   ```bash
git clone <repository-url>
cd LUVdat
   npm install
cd backend && npm install
```

2. **Start the backend:**
```bash
cd backend
npm start
```

3. **Start the frontend (in a new terminal):**
```bash
npm run dev
```

4. **Access the application:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api/v1/docs
- Health Check: http://localhost:3001/health

## 🎁 Airdrop System

### How It Works

1. **User Connection**: When a user connects their wallet, the system automatically detects if they have LUV tokens
2. **Zero Balance Priority**: Users with 0 LUV tokens are immediately offered the airdrop
3. **Automatic Delivery**: 1 trillion LUV tokens are sent instantly via smart contract
4. **Loyalty Rewards**: Users can claim a second 1 trillion LUV tokens for loyalty
5. **Protection**: Intelligent system prevents over-claiming while ensuring fair distribution

### Token Distribution

- **Initial Airdrop**: 1,000,000,000,000 LUV tokens (1 trillion)
- **Loyalty Reward**: Additional 1,000,000,000,000 LUV tokens
- **Total Possible**: 2,000,000,000,000 LUV tokens per user

### Smart Contract Integration

The system integrates with:
- **LUV Token Contract**: `0x1035760d0f60B35B63660ac0774ef363eAa5456e`
- **Airdrop Contract**: Configurable via environment variables
- **Account Manager**: Thirdweb smart wallet factory

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Thirdweb Configuration
VITE_TEMPLATE_ACCOUNT_MANAGER_ADDRESS=0x0000000000000000000000000000000000000000
VITE_TEMPLATE_TOKEN_CONTRACT_ADDRESS=0x1035760d0f60B35B63660ac0774ef363eAa5456e
VITE_AIRDROP_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# Backend Configuration
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

### Thirdweb Setup

1. Get your client ID from [thirdweb dashboard](https://portal.thirdweb.com)
2. Update `src/client.ts` with your client ID
3. Deploy your account manager contract and update the address

## 🧪 Testing

Run the comprehensive test suite:

```bash
node test-airdrop.js
```

This tests:
- ✅ Backend health
- ✅ User registration
- ✅ Airdrop eligibility
- ✅ Claim recording
- ✅ Statistics API
- ✅ Frontend accessibility

## 📊 API Endpoints

### Backend API (http://localhost:3001/api/v1)

#### Health Check
- `GET /health` - Backend health status

#### Users
- `POST /users/register` - Register new user
- `GET /users/:walletAddress` - Get user details
- `PUT /users/:walletAddress/ip` - Update user IP

#### Airdrops
- `POST /airdrops/check-eligibility` - Check airdrop eligibility
- `POST /airdrops/claim` - Record airdrop claim
- `GET /airdrops/stats` - Get airdrop statistics
- `GET /airdrops/user/:walletAddress/claims` - Get user claim history

#### Analytics
- `GET /analytics/dashboard` - Dashboard analytics
- `GET /analytics/protection` - Protection system stats
- `GET /analytics/realtime` - Real-time data

#### IP Management
- `GET /ips/:ipHash/claims` - Get IP claim count
- `GET /ips/stats` - Get IP statistics

## 🎯 User Experience

### New Users
1. Visit the website
2. Click "CONNECT" or "LOGIN"
3. Choose authentication method (Google, Email, etc.)
4. Smart wallet is created automatically
5. Receive 1 trillion LUV tokens instantly
6. Option to claim second 1 trillion LUV for loyalty

### Existing Users
1. Connect existing wallet
2. If balance is 0, automatically offered airdrop
3. If balance is low, offered additional tokens
4. Loyalty rewards available for active users

### Authentication Methods
- Google, Apple, Facebook
- Discord, X (Twitter), Line
- Coinbase, Farcaster, Telegram
- GitHub, Twitch, Steam
- Email, Phone, Passkey
- Guest mode

## 🔒 Security Features

- **Device Fingerprinting**: Prevents device reuse
- **IP Tracking**: Monitors suspicious IP activity
- **Rate Limiting**: Prevents abuse
- **Smart Contract Verification**: All transactions verified on-chain
- **Account Abstraction**: Enhanced security with smart wallets

## 🚀 Deployment

### Development
   ```bash
# Backend
cd backend && npm run dev

# Frontend
npm run dev
```

### Production
```bash
# Build frontend
npm run build

# Start backend
cd backend && npm start
```

## 📈 Monitoring

The system includes comprehensive monitoring:
- Real-time user activity
- Airdrop claim statistics
- Protection system effectiveness
- IP-based analytics
- Risk assessment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Documentation**: Check the docs/ folder
- **Issues**: Create an issue on GitHub
- **Community**: Join our Telegram group

## 🎉 Success Metrics

The system is designed to:
- ✅ Deliver 1 trillion LUV to new users instantly
- ✅ Provide loyalty rewards for returning users
- ✅ Prevent abuse while ensuring fair distribution
- ✅ Work without external database dependencies
- ✅ Integrate seamlessly with thirdweb account manager
- ✅ Support 16 authentication methods
- ✅ Provide gasless transactions

---

**SHAMBA LUV - LUV is Priceless ❤️**

*Phase 1 LUV is priceless. Phase 2 LUV presale. Phase 3 LUV finds value. Phase 4 global expansion. Phase 5 LUV is everywhere. Phase 6 LUV is the answer.*