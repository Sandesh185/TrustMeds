// Comprehensive validation unit tests using Jest

const {
  isValidAddress,
  isValidProductId,
  isValidCoordinate,
  isValidStatus,
  sanitizeString
} = require('../../middleware/validation');

describe('Validation Middleware', () => {
  describe('isValidAddress', () => {
    test('should validate correct Ethereum address', () => {
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')).toBe(true);
      expect(isValidAddress('0x742d35cc6634c0532925a3b844bc9e7595f0beb0')).toBe(true);
      expect(isValidAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')).toBe(true);
    });

    test('should reject invalid addresses', () => {
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb')).toBe(false); // too short
      expect(isValidAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toBe(false); // not hex
      expect(isValidAddress('')).toBe(false); // empty
      expect(isValidAddress(null)).toBe(false); // null
      expect(isValidAddress(undefined)).toBe(false); // undefined
      expect(isValidAddress('0x123')).toBe(false); // too short
      expect(isValidAddress('742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')).toBe(false); // no 0x
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb00')).toBe(false); // too long
    });
  });

  describe('isValidProductId', () => {
    test('should validate correct product IDs', () => {
      expect(isValidProductId('PROD-001')).toBe(true);
      expect(isValidProductId('product-123')).toBe(true);
      expect(isValidProductId('product_123')).toBe(true);
      expect(isValidProductId('product.123')).toBe(true);
      expect(isValidProductId('DRUG-1763496743339-JP5OTD')).toBe(true);
      expect(isValidProductId('a1b2c3')).toBe(true);
    });

    test('should reject invalid product IDs', () => {
      expect(isValidProductId('')).toBe(false); // empty
      expect(isValidProductId(null)).toBe(false); // null
      expect(isValidProductId(undefined)).toBe(false); // undefined
      expect(isValidProductId('product@123')).toBe(false); // special chars
      expect(isValidProductId('product#123')).toBe(false); // special chars
      expect(isValidProductId('product 123')).toBe(false); // spaces
      expect(isValidProductId('a'.repeat(201))).toBe(false); // too long
    });
  });

  describe('isValidCoordinate', () => {
    describe('latitude validation', () => {
      test('should validate correct latitudes', () => {
        expect(isValidCoordinate(45.5, true)).toBe(true);
        expect(isValidCoordinate(-45.5, true)).toBe(true);
        expect(isValidCoordinate(0, true)).toBe(true);
        expect(isValidCoordinate(90, true)).toBe(true); // boundary
        expect(isValidCoordinate(-90, true)).toBe(true); // boundary
      });

      test('should reject invalid latitudes', () => {
        expect(isValidCoordinate(100, true)).toBe(false); // too high
        expect(isValidCoordinate(-100, true)).toBe(false); // too low
        expect(isValidCoordinate(NaN, true)).toBe(false); // NaN
        expect(isValidCoordinate(Infinity, true)).toBe(false); // Infinity
        expect(isValidCoordinate(-Infinity, true)).toBe(false); // -Infinity
      });
    });

    describe('longitude validation', () => {
      test('should validate correct longitudes', () => {
        expect(isValidCoordinate(-120.5, false)).toBe(true);
        expect(isValidCoordinate(120.5, false)).toBe(true);
        expect(isValidCoordinate(0, false)).toBe(true);
        expect(isValidCoordinate(180, false)).toBe(true); // boundary
        expect(isValidCoordinate(-180, false)).toBe(true); // boundary
      });

      test('should reject invalid longitudes', () => {
        expect(isValidCoordinate(200, false)).toBe(false); // too high
        expect(isValidCoordinate(-200, false)).toBe(false); // too low
        expect(isValidCoordinate(NaN, false)).toBe(false); // NaN
        expect(isValidCoordinate(Infinity, false)).toBe(false); // Infinity
      });
    });
  });

  describe('isValidStatus', () => {
    test('should validate correct status strings', () => {
      expect(isValidStatus('Manufactured')).toBe(true);
      expect(isValidStatus('In Transit')).toBe(true);
      expect(isValidStatus('Delivered')).toBe(true);
      expect(isValidStatus('Transferred to Distributor')).toBe(true);
      expect(isValidStatus('A'.repeat(50))).toBe(true); // reasonable length
      expect(isValidStatus('Custom Status')).toBe(true);
    });

    test('should reject invalid status strings', () => {
      expect(isValidStatus('')).toBe(false); // empty
      expect(isValidStatus(null)).toBe(false); // null
      expect(isValidStatus(undefined)).toBe(false); // undefined
      expect(isValidStatus('A'.repeat(101))).toBe(false); // too long
      expect(isValidStatus(123)).toBe(false); // not string
    });
  });

  describe('sanitizeString', () => {
    test('should sanitize XSS attempts', () => {
      const xss1 = sanitizeString('<script>alert("xss")</script>');
      expect(xss1).not.toContain('<script>');
      expect(xss1).not.toContain('</script>');

      const xss2 = sanitizeString('javascript:alert(1)');
      expect(xss2).not.toContain('javascript:');

      const xss3 = sanitizeString('onclick=alert(1)');
      expect(xss3).not.toContain('onclick=');

      const xss4 = sanitizeString('<img src=x onerror=alert(1)>');
      expect(xss4).not.toContain('<img');
      expect(xss4).not.toContain('onerror=');
    });

    test('should trim whitespace', () => {
      expect(sanitizeString('  hello world  ')).toBe('hello world');
      expect(sanitizeString('\n\ttest\n\t')).toBe('test');
    });

    test('should handle edge cases', () => {
      expect(sanitizeString(123)).toBe(''); // non-string
      expect(sanitizeString(null)).toBe(''); // null
      expect(sanitizeString(undefined)).toBe(''); // undefined
      expect(sanitizeString('')).toBe(''); // empty
    });

    test('should escape special characters', () => {
      const result = sanitizeString('Test & "quote\'');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
      expect(result).toContain('&#x27;');
    });

    test('should preserve safe content', () => {
      expect(sanitizeString('Product Name 123')).toBe('Product Name 123');
      expect(sanitizeString('ABC-DEF_123.xyz')).toBe('ABC-DEF_123.xyz');
    });
  });
});

