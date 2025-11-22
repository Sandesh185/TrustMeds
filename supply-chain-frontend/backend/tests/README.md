# 🧪 Testing Guide

This directory contains comprehensive tests for the Drug Supply Chain Management System.

## 📋 Test Structure

```
tests/
├── unit/              # Unit tests for individual components
│   └── validation.test.js
├── integration/       # Integration tests for API endpoints
│   ├── api.test.js
│   └── health.test.js
└── README.md         # This file
```

## 🚀 Running Tests

### Install Dependencies

```bash
cd supply-chain-frontend/backend
npm install
```

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Validation tests only
npm run test:validation

# API tests only
npm run test:api
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Generate Coverage Report

```bash
npm run test:coverage
```

This will generate a coverage report showing:
- Which files are tested
- Which lines are covered
- Coverage percentage

## 📝 Test Files

### Unit Tests

#### `validation.test.js`
Tests the validation middleware functions:
- ✅ Ethereum address validation
- ✅ Product ID validation
- ✅ Coordinate validation (latitude/longitude)
- ✅ Status string validation
- ✅ String sanitization (XSS prevention)

**Run:** `npm run test:validation`

### Integration Tests

#### `api.test.js`
Tests the API endpoints:
- ✅ GET `/api/products/:productId` - Product retrieval
- ✅ GET `/api/products/:productId/history` - History retrieval
- ✅ GET `/api/products/:productId/verify` - Verification
- ✅ Input validation and error handling
- ✅ Blockchain and Firebase integration

**Run:** `npm run test:api`

**Note:** Some tests mock the blockchain and Firebase services. For full integration testing, you may need to:
1. Start a local blockchain (Hardhat node)
2. Configure test environment variables
3. Use test Firebase project

## 🎯 Test Coverage Goals

- **Unit Tests:** 80%+ coverage for utility functions
- **Integration Tests:** All API endpoints covered
- **Smart Contract Tests:** All contract functions covered

## 🔧 Configuration

Tests use Jest as the testing framework. Configuration is in `package.json`:

```json
{
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/tests/**/*.test.js"],
    "collectCoverageFrom": ["**/*.js", "!**/node_modules/**", "!**/tests/**"]
  }
}
```

## 🚨 Important Notes

1. **Mock Services:** Integration tests mock `blockchainService` and `firebaseService` by default
2. **Test Database:** Consider using a separate test Firebase project for integration tests
3. **Cleanup:** Tests should clean up after themselves (if using real services)
4. **Isolation:** Each test should be independent and not rely on other tests

## 📚 Writing New Tests

### Unit Test Example

```javascript
describe('MyFunction', () => {
  test('should do something', () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });
});
```

### Integration Test Example

```javascript
describe('POST /api/endpoint', () => {
  test('should handle request', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .send({ data: 'test' })
      .expect(200);
    
    expect(response.body).toHaveProperty('result');
  });
});
```

## 🐛 Troubleshooting

### Tests Failing

1. **Check if backend server is running** (for integration tests)
2. **Verify environment variables** are set correctly
3. **Check mocks** are properly configured
4. **Review error messages** in test output

### Coverage Issues

1. Run `npm run test:coverage` to see which files need tests
2. Focus on critical business logic first
3. Aim for meaningful tests, not just high coverage numbers

## 📖 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Hardhat Testing Guide](https://hardhat.org/docs/guides/debugging-with-hardhat-network)

## ✅ Legacy Tests

The original test files (`validation.test.js` and `api.test.js` in the root `tests/` directory) are still available and can be run with:

```bash
npm run test:legacy
```

These use plain Node.js without Jest. New tests should use Jest for consistency.

