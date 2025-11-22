// Validation tests for the validation middleware
// Run with: node tests/validation.test.js

const {
  isValidAddress,
  isValidProductId,
  isValidCoordinate,
  isValidStatus,
  sanitizeString
} = require('../middleware/validation');

// Test results tracking
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

console.log('🧪 Running Validation Tests...\n');

// Test isValidAddress
console.log('📋 Testing isValidAddress...');
test('Valid address (42 chars)', isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'), true);
test('Invalid address (too short)', isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'), false);
test('Invalid address (not hex)', isValidAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG'), false);
test('Invalid address (empty)', isValidAddress(''), false);
test('Invalid address (null)', isValidAddress(null), false);

// Test isValidProductId
console.log('\n📋 Testing isValidProductId...');
test('Valid product ID (alphanumeric)', isValidProductId('PROD-001'), true);
test('Valid product ID (with dashes)', isValidProductId('product-123'), true);
test('Valid product ID (with underscores)', isValidProductId('product_123'), true);
test('Valid product ID (with dots)', isValidProductId('product.123'), true);
test('Invalid product ID (empty)', isValidProductId(''), false);
test('Invalid product ID (null)', isValidProductId(null), false);
test('Invalid product ID (special chars)', isValidProductId('product@123'), false);
test('Invalid product ID (too long)', isValidProductId('a'.repeat(201)), false);

// Test isValidCoordinate
console.log('\n📋 Testing isValidCoordinate...');
test('Valid latitude (45.5)', isValidCoordinate(45.5, true), true);
test('Valid latitude (boundary -90)', isValidCoordinate(-90, true), true);
test('Valid latitude (boundary 90)', isValidCoordinate(90, true), true);
test('Valid longitude (-120.5)', isValidCoordinate(-120.5, false), true);
test('Valid longitude (boundary -180)', isValidCoordinate(-180, false), true);
test('Valid longitude (boundary 180)', isValidCoordinate(180, false), true);
test('Invalid latitude (too high)', isValidCoordinate(100, true), false);
test('Invalid latitude (too low)', isValidCoordinate(-100, true), false);
test('Invalid longitude (too high)', isValidCoordinate(200, false), false);
test('Invalid longitude (too low)', isValidCoordinate(-200, false), false);
test('Invalid coordinate (NaN)', isValidCoordinate(NaN, true), false);

// Test isValidStatus
console.log('\n📋 Testing isValidStatus...');
test('Valid status (Manufactured)', isValidStatus('Manufactured'), true);
test('Valid status (In Transit)', isValidStatus('In Transit'), true);
test('Valid status (long status)', isValidStatus('A'.repeat(50)), true);
test('Invalid status (empty)', isValidStatus(''), false);
test('Invalid status (null)', isValidStatus(null), false);
test('Invalid status (too long)', isValidStatus('A'.repeat(101)), false);

// Test sanitizeString
console.log('\n📋 Testing sanitizeString...');
const xssTest = sanitizeString('<script>alert("xss")</script>');
test('XSS prevention (removes script tags)', !xssTest.includes('<script>') && !xssTest.includes('</script>'), true);
const trimmed = sanitizeString('  hello world  ');
test('String trimming', trimmed === 'hello world', true);
const nonString = sanitizeString(123);
test('Non-string input', nonString === '', true);
const jsInjection = sanitizeString('javascript:alert(1)');
test('JavaScript injection prevention', !jsInjection.includes('javascript:'), true);
const eventHandler = sanitizeString('onclick=alert(1)');
test('Event handler prevention', !eventHandler.includes('onclick='), true);

// Summary
console.log('\n' + '='.repeat(50));
console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
if (testsFailed === 0) {
  console.log('✅ All validation tests passed!');
} else {
  console.log(`⚠️ ${testsFailed} test(s) failed. Please review.`);
}
console.log('='.repeat(50));

