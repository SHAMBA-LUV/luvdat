#!/usr/bin/env node

// Test script to check airdrop contract functionality
const { ethers } = require('ethers');

// Contract addresses
const AIRDROP_ADDRESS = "0x583F6D336E777c461FbfbeE3349D7D2dA9dc5e51";
const LUV_TOKEN_ADDRESS = "0x1035760d0f60B35B63660ac0774ef363eAa5456e";

// ABI for testing
const AIRDROP_ABI = [
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
  }
];

async function testContract() {
  console.log('🔍 Testing airdrop contract...');
  
  try {
    // Connect to Polygon
    const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
    
    // Create contract instance
    const airdropContract = new ethers.Contract(AIRDROP_ADDRESS, AIRDROP_ABI, provider);
    
    console.log('✅ Connected to Polygon network');
    console.log('📋 Airdrop contract address:', AIRDROP_ADDRESS);
    console.log('🪙 LUV token address:', LUV_TOKEN_ADDRESS);
    
    // Test reading airdrop stats
    try {
      console.log('\n📊 Reading airdrop stats...');
      const stats = await airdropContract.getAirdropStats(LUV_TOKEN_ADDRESS);
      console.log('✅ Airdrop stats:', {
        airdropAmount: ethers.formatEther(stats[0]),
        totalClaimed: ethers.formatEther(stats[1]),
        totalRecipients: stats[2].toString(),
        contractBalance: ethers.formatEther(stats[3]),
        isActive: stats[4]
      });
    } catch (error) {
      console.error('❌ Failed to read airdrop stats:', error.message);
    }
    
    // Check if contract has code
    const code = await provider.getCode(AIRDROP_ADDRESS);
    if (code === '0x') {
      console.error('❌ Contract has no code - not deployed!');
    } else {
      console.log('✅ Contract is deployed and has code');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testContract();
