// API endpoint tests
// Run with: node tests/api.test.js
// Note: These are basic connectivity tests. For full testing, use Jest with Supertest.

const http = require('http');

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';

let testsPassed = 0;
let testsFailed = 0;

function test(name, condition, expected = true) {
  if (condition === expected) {
    console.log(`✅ ${name}`);
    testsPassed++;
  } else {
    console.log(`❌ ${name} - Expected: ${expected}, Got: ${condition}`);
    testsFailed++;
  }
}

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const req = http.request(url, { method: options.method || 'GET', ...options }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Running API Tests...\n');
  console.log(`📡 Testing API at: ${API_BASE_URL}\n`);

  // Test 1: Health check
  console.log('📋 Testing Health Check Endpoint...');
  try {
    const health = await makeRequest('/api/health');
    test('Health check returns 200', health.status === 200, true);
    test('Health check has status field', health.body.status === 'ok', true);
    test('Health check has timestamp', !!health.body.timestamp, true);
  } catch (error) {
    test('Health check endpoint accessible', false, true);
    console.log(`   ⚠️ Server may not be running: ${error.message}`);
  }

  // Test 2: Invalid product ID format
  console.log('\n📋 Testing Product Validation...');
  try {
    const invalidId = await makeRequest('/api/products/invalid@product#id');
    test('Invalid product ID returns 400', invalidId.status === 400, true);
  } catch (error) {
    console.log(`   ⚠️ Could not test validation: ${error.message}`);
  }

  // Test 3: Non-existent product
  try {
    const notFound = await makeRequest('/api/products/NONEXISTENT-PRODUCT-12345');
    test('Non-existent product returns 404', notFound.status === 404, true);
  } catch (error) {
    console.log(`   ⚠️ Could not test 404: ${error.message}`);
  }

  // Test 4: Rate limiting headers
  console.log('\n📋 Testing Rate Limiting...');
  try {
    const rateLimit = await makeRequest('/api/health');
    test('Rate limit headers present', !!rateLimit.headers['x-ratelimit-limit'], true);
  } catch (error) {
    console.log(`   ⚠️ Could not test rate limiting: ${error.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
  if (testsFailed === 0) {
    console.log('✅ All API tests passed!');
  } else {
    console.log(`⚠️ ${testsFailed} test(s) failed.`);
    console.log('💡 Make sure the backend server is running: npm run dev:backend');
  }
  console.log('='.repeat(50));
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error.message);
  console.log('\n💡 Make sure the backend server is running:');
  console.log('   cd supply-chain-frontend/backend');
  console.log('   npm start');
});

