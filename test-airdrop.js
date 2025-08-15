#!/usr/bin/env node

// Test script for SHAMBA LUV airdrop system
const axios = require('axios');

const BACKEND_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:5173';

async function testBackendHealth() {
  console.log('🏥 Testing backend health...');
  try {
    const response = await axios.get(`${BACKEND_URL}/health`);
    console.log('✅ Backend is healthy:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Backend health check failed:', error.message);
    return false;
  }
}

async function testUserRegistration() {
  console.log('\n👤 Testing user registration...');
  try {
    const userData = {
      walletAddress: '0x1234567890123456789012345678901234567890',
      authMethod: 'email',
      deviceFingerprint: 'test-fingerprint-123',
      ipAddress: '127.0.0.1',
      userAgent: 'Test User Agent'
    };

    const response = await axios.post(`${BACKEND_URL}/api/v1/users/register`, userData);
    console.log('✅ User registration successful:', response.data);
    return true;
  } catch (error) {
    console.error('❌ User registration failed:', error.response?.data || error.message);
    return false;
  }
}

async function testAirdropEligibility() {
  console.log('\n🎁 Testing airdrop eligibility...');
  try {
    const eligibilityData = {
      walletAddress: '0x1234567890123456789012345678901234567890',
      ipAddress: '127.0.0.1',
      deviceFingerprint: 'test-fingerprint-123'
    };

    const response = await axios.post(`${BACKEND_URL}/api/v1/airdrops/check-eligibility`, eligibilityData);
    console.log('✅ Airdrop eligibility check successful:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Airdrop eligibility check failed:', error.response?.data || error.message);
    return false;
  }
}

async function testAirdropClaim() {
  console.log('\n💰 Testing airdrop claim recording...');
  try {
    const claimData = {
      walletAddress: '0x1234567890123456789012345678901234567890',
      ipAddress: '127.0.0.1',
      deviceFingerprint: 'test-fingerprint-123',
      claimAmount: '1000000000000000000000000000000', // 1 trillion tokens
      status: 'completed',
      transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    };

    const response = await axios.post(`${BACKEND_URL}/api/v1/airdrops/claim`, claimData);
    console.log('✅ Airdrop claim recording successful:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Airdrop claim recording failed:', error.response?.data || error.message);
    return false;
  }
}

async function testAirdropStats() {
  console.log('\n📊 Testing airdrop statistics...');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/v1/airdrops/stats`);
    console.log('✅ Airdrop stats successful:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Airdrop stats failed:', error.response?.data || error.message);
    return false;
  }
}

async function testFrontendAccess() {
  console.log('\n🌐 Testing frontend access...');
  try {
    const response = await axios.get(FRONTEND_URL);
    if (response.status === 200) {
      console.log('✅ Frontend is accessible');
      return true;
    } else {
      console.error('❌ Frontend returned status:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Frontend access failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting SHAMBA LUV airdrop system tests...\n');

  const tests = [
    testBackendHealth,
    testUserRegistration,
    testAirdropEligibility,
    testAirdropClaim,
    testAirdropStats,
    testFrontendAccess
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    const result = await test();
    if (result) passedTests++;
  }

  console.log('\n📋 Test Results:');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);

  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! The airdrop system is working correctly.');
    console.log('\n🌐 You can now access the application at:');
    console.log(`   Frontend: ${FRONTEND_URL}`);
    console.log(`   Backend API: ${BACKEND_URL}/api/v1/docs`);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
  }
}

// Run the tests
runAllTests().catch(console.error);
