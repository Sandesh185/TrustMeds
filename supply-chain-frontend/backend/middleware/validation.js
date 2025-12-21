// Input validation middleware

/**
 * Validate Ethereum address
 */
const isValidAddress = (address) => {
  if (!address || typeof address !== 'string') return false;
  // Basic Ethereum address validation (42 characters, starts with 0x)
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * Validate product ID
 */
const isValidProductId = (productId) => {
  if (!productId || typeof productId !== 'string') return false;
  const trimmed = productId.trim();
  // Product ID should not be empty, reasonable length, and alphanumeric with dashes/underscores
  if (trimmed.length === 0 || trimmed.length > 200) return false;
  // Allow alphanumeric, dashes, underscores, and dots
  return /^[a-zA-Z0-9._-]+$/.test(trimmed);
};

/**
 * Sanitize string input (prevent XSS)
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  // Remove HTML tags and dangerous characters
  return str.trim()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Validate coordinates
 */
const isValidCoordinate = (coord, isLatitude = false) => {
  const num = Number(coord);
  if (isNaN(num) || !isFinite(num)) return false;
  if (isLatitude) {
    return num >= -90 && num <= 90;
  }
  return num >= -180 && num <= 180;
};

/**
 * Validate status string
 */
const isValidStatus = (status) => {
  if (!status || typeof status !== 'string') return false;
  const validStatuses = [
    'Manufactured',
    'Transferred to Distributor',
    'Transferred to Delivery Hub',
    'In Transit',
    'Delivered',
    'Received',
    'Shipped',
    'Out for Delivery'
  ];
  const normalizedStatus = status.trim();
  // Allow any status but validate format
  return normalizedStatus.length > 0 && normalizedStatus.length <= 100;
};

/**
 * Middleware to validate product ID parameter
 */
const validateProductId = (req, res, next) => {
  const { productId } = req.params;
  
  if (!isValidProductId(productId)) {
    return res.status(400).json({ 
      error: 'Invalid product ID',
      message: 'Product ID must be a non-empty string'
    });
  }
  
  // Sanitize product ID
  req.params.productId = sanitizeString(productId);
  next();
};

/**
 * Middleware to validate wallet address
 */
const validateAddress = (req, res, next) => {
  const address = req.body.address || req.headers['x-wallet-address'] || req.params.address;
  
  if (address && !isValidAddress(address)) {
    return res.status(400).json({ 
      error: 'Invalid Ethereum address',
      message: 'Address must be a valid Ethereum address (0x followed by 40 hex characters)'
    });
  }
  
  next();
};

/**
 * Middleware to validate product creation data
 */
const validateProductData = (req, res, next) => {
  // productId comes from URL params, not body (for POST /:productId/metadata route)
  const productId = req.params.productId || req.body.productId;
  const { manufacturerName, productName, price, expiryDate } = req.body;
  
  // Required fields - but make manufacturerName and productName optional for metadata updates
  if (!isValidProductId(productId)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }
  
  // manufacturerName and productName are optional for metadata updates (may already exist)
  if (manufacturerName !== undefined) {
    if (typeof manufacturerName !== 'string' || manufacturerName.trim().length === 0) {
      return res.status(400).json({ error: 'Manufacturer name must be a non-empty string if provided' });
    }
    if (manufacturerName.trim().length > 200) {
      return res.status(400).json({ error: 'Manufacturer name must be 200 characters or less' });
    }
  }
  
  if (productName !== undefined) {
    if (typeof productName !== 'string' || productName.trim().length === 0) {
      return res.status(400).json({ error: 'Product name must be a non-empty string if provided' });
    }
    if (productName.trim().length > 200) {
      return res.status(400).json({ error: 'Product name must be 200 characters or less' });
    }
  }
  
  // Validate price
  if (price !== undefined) {
    const priceNum = Number(price);
    if (isNaN(priceNum) || !isFinite(priceNum) || priceNum < 0 || priceNum > 1e18) {
      return res.status(400).json({ error: 'Invalid price. Must be a number between 0 and 1e18' });
    }
  }
  
  // Validate expiry date
  if (expiryDate !== undefined) {
    const expiryNum = typeof expiryDate === 'string' ? new Date(expiryDate).getTime() : Number(expiryDate);
    if (isNaN(expiryNum)) {
      return res.status(400).json({ error: 'Invalid expiry date format' });
    }
  }
  
  // Sanitize string fields (only if they exist)
  if (productId) req.body.productId = sanitizeString(productId);
  if (manufacturerName) req.body.manufacturerName = sanitizeString(manufacturerName);
  if (productName) req.body.productName = sanitizeString(productName);
  
  next();
  
  if (req.body.productCode) {
    req.body.productCode = sanitizeString(req.body.productCode);
  }
  if (req.body.category) {
    req.body.category = sanitizeString(req.body.category);
  }
  if (req.body.batchNumber) {
    const batchNumber = sanitizeString(req.body.batchNumber);
    if (batchNumber.length > 100) {
      return res.status(400).json({ error: 'Batch number must be 100 characters or less' });
    }
    req.body.batchNumber = batchNumber;
  }
  
  if (req.body.productCode && sanitizeString(req.body.productCode).length > 100) {
    return res.status(400).json({ error: 'Product code must be 100 characters or less' });
  }
  
  if (req.body.category && sanitizeString(req.body.category).length > 100) {
    return res.status(400).json({ error: 'Category must be 100 characters or less' });
  }
  
  // Validate coordinates if provided
  if (req.body.latitude !== undefined) {
    if (!isValidCoordinate(req.body.latitude, true)) {
      return res.status(400).json({ error: 'Invalid latitude. Must be between -90 and 90' });
    }
  }
  
  if (req.body.longitude !== undefined) {
    if (!isValidCoordinate(req.body.longitude, false)) {
      return res.status(400).json({ error: 'Invalid longitude. Must be between -180 and 180' });
    }
  }
  
  next();
};

/**
 * Middleware to validate transfer data
 */
const validateTransferData = (req, res, next) => {
  const { from, to, status } = req.body;
  
  if (from && !isValidAddress(from)) {
    return res.status(400).json({ error: 'Invalid from address' });
  }
  
  if (!to || !isValidAddress(to)) {
    return res.status(400).json({ error: 'Invalid to address' });
  }
  
  if (!status || !isValidStatus(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  // Sanitize status
  req.body.status = sanitizeString(status);
  
  next();
};

/**
 * Middleware to validate status update
 */
const validateStatusUpdate = (req, res, next) => {
  const { status } = req.body;
  
  if (!status || !isValidStatus(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  // Sanitize status
  req.body.status = sanitizeString(status);
  
  // Validate location if provided
  if (req.body.location) {
    req.body.location = sanitizeString(req.body.location);
  }
  
  next();
};

module.exports = {
  validateProductId,
  validateAddress,
  validateProductData,
  validateTransferData,
  validateStatusUpdate,
  isValidAddress,
  isValidProductId,
  isValidCoordinate,
  isValidStatus,
  sanitizeString
};

