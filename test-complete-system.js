#!/usr/bin/env node

const axios = require('axios');

const BACKEND_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:5173';

async function testCompleteSystem() {
  console.log('🧪 Testing SHAMBA LUV Complete System\n');
  
  const results = {
    backend: false,
    frontend: false,
    database: false,
    protection: false
  };

  // Test 1: Backend Health
  console.log('1️⃣ Testing Backend Health...');
  try {
    const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    console.log('✅ Backend is healthy:', response.data);
    results.backend = true;
  } catch (error) {
    console.log('❌ Backend health check failed:', error.message);
  }

  // Test 2: Frontend Accessibility
  console.log('\n2️⃣ Testing Frontend Accessibility...');
  try {
    const response = await axios.get(FRONTEND_URL, { timeout: 5000 });
    console.log('✅ Frontend is accessible');
    results.frontend = true;
  } catch (error) {
    console.log('❌ Frontend accessibility check failed:', error.message);
  }

  // Test 3: Database Connection via API
  console.log('\n3️⃣ Testing Database Connection...');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/v1/analytics/dashboard`, { timeout: 10000 });
    console.log('✅ Database connection working');
    results.database = true;
  } catch (error) {
    console.log('❌ Database connection test failed:', error.message);
  }

  // Test 4: Protection System
  console.log('\n4️⃣ Testing Protection System...');
  try {
    const testWallet = '0x1234567890123456789012345678901234567890';
    const testData = {
      walletAddress: testWallet,
      ipAddress: '127.0.0.1',
      deviceFingerprint: 'test-fingerprint-12345',
      userAgent: 'Test Agent'
    };

    const response = await axios.post(`${BACKEND_URL}/api/v1/airdrops/check-eligibility`, testData, { 
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ Protection system working:', response.data);
    results.protection = true;
  } catch (error) {
    console.log('❌ Protection system test failed:', error.message);
    if (error.response) {
      console.log('Response data:', error.response.data);
    }
  }

  // Test 5: User Registration
  console.log('\n5️⃣ Testing User Registration...');
  try {
    const testUser = {
      walletAddress: '0x9876543210987654321098765432109876543210',
      authMethod: 'test',
      deviceFingerprint: 'test-device-67890',
      userAgent: 'Test Registration Agent',
      screenResolution: '1920x1080',
      timezone: 'UTC',
      ipAddress: '127.0.0.1'
    };

    const response = await axios.post(`${BACKEND_URL}/api/v1/users/register`, testUser, { 
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ User registration working:', response.data);
  } catch (error) {
    console.log('⚠️ User registration test failed (might be expected if user exists):', error.message);
  }

  // Summary
  console.log('\n📊 System Test Summary:');
  console.log('======================');
  console.log(`Backend Health: ${results.backend ? '✅' : '❌'}`);
  console.log(`Frontend: ${results.frontend ? '✅' : '❌'}`);
  console.log(`Database: ${results.database ? '✅' : '❌'}`);
  console.log(`Protection: ${results.protection ? '✅' : '❌'}`);
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All systems operational! Ready for production.');
  } else {
    console.log('⚠️ Some systems need attention before production deployment.');
  }

  // Additional Info
  console.log('\n📋 System URLs:');
  console.log(`Frontend: ${FRONTEND_URL}`);
  console.log(`Backend API: ${BACKEND_URL}/api/v1/docs`);
  console.log(`Health Check: ${BACKEND_URL}/health`);
  
  return results;
}

// Run the test
testCompleteSystem().catch(console.error);