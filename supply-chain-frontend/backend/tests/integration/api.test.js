// Comprehensive API integration tests using Jest and Supertest

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const productsRouter = require('../../routes/products');
const { validateProductId } = require('../../middleware/validation');

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/products', productsRouter);

// Mock blockchain service
jest.mock('../../services/blockchain', () => ({
  getProduct: jest.fn(),
  getOwnershipTransfers: jest.fn(),
  getProductHistory: jest.fn(),
  getProductTransactionHistory: jest.fn(),
  verifyProduct: jest.fn(),
}));

// Mock Firebase service
jest.mock('../../services/firebase', () => ({
  getProductMetadata: jest.fn(),
  getProductHistory: jest.fn(),
}));

const blockchainService = require('../../services/blockchain');
const firebaseService = require('../../services/firebase');

describe('API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/products/:productId', () => {
    test('should return 400 for invalid product ID format', async () => {
      const response = await request(app)
        .get('/api/products/invalid@product#id')
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.message).toContain('Product ID');
    });

    test('should return 404 for non-existent product', async () => {
      blockchainService.getProduct.mockRejectedValue({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product does not exist'
      });

      const response = await request(app)
        .get('/api/products/NONEXISTENT-PRODUCT-12345')
        .expect(404);

      expect(response.body.error).toBe('Product not found');
    });

    test('should return 503 for RPC service unavailable', async () => {
      blockchainService.getProduct.mockRejectedValue({
        code: 'SERVER_ERROR',
        info: { responseStatus: '522 <none>' }
      });

      const response = await request(app)
        .get('/api/products/PROD-123')
        .expect(503);

      expect(response.body.error).toContain('unavailable');
    });

    test('should return product data when exists', async () => {
      const mockProduct = {
        productId: 'PROD-123',
        productName: 'Test Product',
        manufacturerName: 'Test Manufacturer',
        status: 'Manufactured',
        currentOwner: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        exists: true
      };

      blockchainService.getProduct.mockResolvedValue(mockProduct);
      firebaseService.getProductMetadata.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/products/PROD-123')
        .expect(200);

      expect(response.body.productId).toBe('PROD-123');
      expect(response.body.productName).toBe('Test Product');
    });

    test('should combine blockchain and Firebase data', async () => {
      const mockBlockchainProduct = {
        productId: 'PROD-123',
        productName: 'Test Product',
        exists: true
      };

      const mockFirebaseData = {
        additionalInfo: 'From Firebase',
        extraData: { key: 'value' }
      };

      blockchainService.getProduct.mockResolvedValue(mockBlockchainProduct);
      firebaseService.getProductMetadata.mockResolvedValue(mockFirebaseData);

      const response = await request(app)
        .get('/api/products/PROD-123')
        .expect(200);

      expect(response.body.productId).toBe('PROD-123');
      expect(response.body.additionalInfo).toBe('From Firebase');
    });
  });

  describe('GET /api/products/:productId/history', () => {
    test('should return 400 for invalid product ID', async () => {
      const response = await request(app)
        .get('/api/products/invalid@id/history')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('should return 404 for non-existent product history', async () => {
      blockchainService.getProductHistory.mockResolvedValue([]);
      blockchainService.getOwnershipTransfers.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/products/NONEXISTENT/history')
        .expect(404);

      expect(response.body.error).toBe('Product history not found');
    });

    test('should return product history when exists', async () => {
      const mockHistoryHashes = ['0x123', '0x456'];
      const mockTransfers = [
        {
          productId: 'PROD-123',
          from: '0x111',
          to: '0x222',
          status: 'Manufactured',
          timestamp: Date.now()
        }
      ];

      blockchainService.getProductHistory.mockResolvedValue(mockHistoryHashes);
      blockchainService.getOwnershipTransfers.mockResolvedValue(mockTransfers);

      const response = await request(app)
        .get('/api/products/PROD-123/history')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/products/:productId/verify', () => {
    test('should return 400 for invalid product ID', async () => {
      const response = await request(app)
        .get('/api/products/invalid@id/verify')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('should return verification result', async () => {
      blockchainService.verifyProduct.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/products/PROD-123/verify')
        .expect(200);

      expect(response.body.isAuthentic).toBe(true);
      expect(response.body.exists).toBe(true);
    });
  });

  describe('Input Validation', () => {
    test('should sanitize product IDs', async () => {
      // Product ID with potential XSS - using URL encoding to test
      // Express will decode it, and validation should reject it
      const xssId = encodeURIComponent('PROD<script>alert(1)</script>123');

      const response = await request(app)
        .get(`/api/products/${xssId}`)
        .expect(400); // Should be rejected by validation

      expect(response.body.error).toBeDefined();
      expect(response.body.message).toContain('Product ID');
    });

    test('should handle very long product IDs', async () => {
      const longId = 'A'.repeat(201);
      
      const response = await request(app)
        .get(`/api/products/${longId}`)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Suppress expected error logs for this test
      const originalError = console.error;
      console.error = jest.fn();
      
      blockchainService.getProduct.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .get('/api/products/PROD-123')
        .expect(500);

      expect(response.body.error).toBeDefined();
      
      // Restore console.error
      console.error = originalError;
    });

    test('should handle missing required fields', async () => {
      blockchainService.getProduct.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/products/PROD-123')
        .expect(404);
    });
  });
});

