const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Suppress non-critical filter errors from ethers.js
// These occur when event filters expire and are automatically recreated
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Intercept console.log to filter out @TODO filter errors and network errors
console.log = function(...args) {
  const message = args.join(' ');
  // Check if it's a non-critical error (filter errors, network connection resets, RPC timeouts)
  const isNonCriticalError = 
    (message.includes('@TODO') && (
      message.includes('filter not found') || 
      message.includes('UNKNOWN_ERROR') ||
      message.includes('ECONNRESET') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ETIMEDOUT') ||
      message.includes('ENOTFOUND') ||
      message.includes('getaddrinfo') ||
      message.includes('SERVER_ERROR') ||
      message.includes('500 Internal Server Error') ||
      message.includes('server response 500') ||
      message.includes('server response 522') ||
      message.includes('522 <none>')
    )) ||
    (args[0]?.error?.message?.includes('filter not found')) ||
    (args[1]?.error?.message?.includes('filter not found')) ||
    (args[0]?.code === 'ECONNRESET') ||
    (args[0]?.code === 'ECONNREFUSED') ||
    (args[0]?.code === 'ETIMEDOUT') ||
    (args[0]?.code === 'ENOTFOUND') ||
    (args[0]?.code === 'SERVER_ERROR') ||
    (message.includes('JsonRpcProvider failed to detect network')) ||
    (message.includes('server response 500')) ||
    (message.includes('server response 522')) ||
    (args[0]?.info?.responseStatus === '500 Internal Server Error') ||
    (args[0]?.info?.responseStatus === '522 <none>') ||
    (args[0]?.info?.responseBody === 'error code: 522');
  
  if (isNonCriticalError) {
    // Silently ignore - these are non-critical network/RPC errors
    // ethers.js will automatically retry connections
    return;
  }
  originalConsoleLog.apply(console, args);
};

// Intercept console.error to filter out RPC server errors
console.error = function(...args) {
  const message = args.join(' ');
  const errorObj = args[0];
  
  // Check if it's a non-critical RPC error (including 522 Cloudflare timeout errors)
  const isNonCriticalRpcError = 
    (message.includes('@TODO') && (
      message.includes('SERVER_ERROR') ||
      message.includes('500 Internal Server Error') ||
      message.includes('server response 500') ||
      message.includes('server response 522') ||
      message.includes('522 <none>')
    )) ||
    (errorObj?.code === 'SERVER_ERROR') ||
    (errorObj?.info?.responseStatus === '500 Internal Server Error') ||
    (errorObj?.info?.responseStatus === '522 <none>') ||
    (errorObj?.info?.responseBody === 'error code: 522') ||
    (errorObj?.shortMessage?.includes('server response 500')) ||
    (errorObj?.shortMessage?.includes('server response 522')) ||
    (message.includes('ethereum-sepolia-rpc.publicnode.com') && message.includes('500')) ||
    (message.includes('rpc.sepolia.org') && (message.includes('522') || message.includes('500')));
  
  if (isNonCriticalRpcError) {
    // Silently ignore - RPC endpoints can be temporarily unavailable
    // ethers.js will automatically retry connections
    return;
  }
  originalConsoleError.apply(console, args);
};

// Suppress unhandled rejections for non-critical errors
process.on('unhandledRejection', (error) => {
  // Filter errors (filters expire and are auto-recreated)
  if (error?.code === 'UNKNOWN_ERROR' && error?.error?.message?.includes('filter not found')) {
    return;
  }
  
  // Network connection errors (RPC endpoints temporarily close connections)
  // These are non-critical - ethers.js automatically retries
  if (error?.code === 'ECONNRESET' || error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT' || error?.code === 'ENOTFOUND') {
    return;
  }
  
  // RPC server errors (500/522 errors from RPC endpoints - Cloudflare timeouts)
  // These are non-critical - ethers.js will retry with different endpoints
  if (error?.code === 'SERVER_ERROR' || 
      error?.info?.responseStatus === '500 Internal Server Error' ||
      error?.info?.responseStatus === '522 <none>' ||
      error?.info?.responseBody === 'error code: 522' ||
      error?.shortMessage?.includes('server response 522')) {
    return;
  }
  
  // Log other unhandled rejections (actual errors that need attention)
  originalConsoleError('Unhandled rejection:', error);
});

// Import routes
const productRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');

// Import middleware
const authMiddleware = require('./middleware/auth');
const rateLimiter = require('./middleware/rateLimiter');

// Import event listeners
const { setupEventListeners } = require('./services/eventListeners');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting - 100 requests per minute per IP/wallet
app.use('/api', rateLimiter(60000, 100));

// Routes
app.use('/api/auth', authRoutes);
// Apply auth middleware to protected routes
app.use('/api/products', authMiddleware, productRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const healthStatus = {
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: {
      port: PORT,
      contractAddress: process.env.CONTRACT_ADDRESS ? 'configured' : 'not set',
      firebase: process.env.FIREBASE_PROJECT_ID ? 'configured' : 'not set'
    }
  };
  res.status(200).json(healthStatus);
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health\n`);
  
  // Verify Firebase configuration
  if (process.env.FIREBASE_PROJECT_ID) {
    console.log(`✅ Firebase configured: ${process.env.FIREBASE_PROJECT_ID}`);
  } else {
    console.warn(`⚠️ Firebase not configured - set FIREBASE_PROJECT_ID in .env`);
  }
  
  // Verify Contract configuration
  if (process.env.CONTRACT_ADDRESS) {
    console.log(`✅ Contract configured: ${process.env.CONTRACT_ADDRESS.slice(0, 10)}...`);
  } else {
    console.warn(`⚠️ Contract not configured - set CONTRACT_ADDRESS in .env`);
  }
  
  // Set up blockchain event listeners
  try {
    // Enable event listeners to auto-sync blockchain events to Firebase
    setupEventListeners();
    console.log('✅ Blockchain event listeners initialized - auto-syncing to Firebase');
    console.log('💾 All blockchain events (ProductCreated, OwnershipTransferred, StatusUpdated) will be stored in Firebase\n');
  } catch (error) {
    console.error('❌ Failed to initialize blockchain event listeners:', error);
    console.log('⚠️ Event listeners disabled - blockchain events will not auto-sync to Firebase');
    console.log('💡 Products and status updates will still be stored via API calls\n');
  }
});