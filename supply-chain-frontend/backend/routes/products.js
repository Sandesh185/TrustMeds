const express = require('express');
const router = express.Router();
const blockchainService = require('../services/blockchain');
const firebaseService = require('../services/firebase');
const { 
  validateProductId, 
  validateProductData, 
  validateTransferData, 
  validateStatusUpdate 
} = require('../middleware/validation');

// Get product details (combines blockchain and off-chain data)
router.get('/:productId', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Get on-chain data
    let blockchainProduct;
    try {
      blockchainProduct = await blockchainService.getProduct(productId);
    } catch (error) {
      // Check if product doesn't exist (expected case - handle gracefully)
      if (
        error?.code === 'PRODUCT_NOT_FOUND' ||
        error?.message?.includes('Product does not exist') || 
        error?.message?.includes('does not exist') ||
        error?.reason === 'Product does not exist'
      ) {
        // Product doesn't exist - return 404 without logging error
        return res.status(404).json({ error: 'Product not found' });
      }
      
      // Check if it's a non-critical RPC error (522 timeout, 500 server error, etc.)
      const isNonCriticalRpcError = 
        error?.code === 'SERVER_ERROR' ||
        error?.info?.responseStatus === '522 <none>' ||
        error?.info?.responseBody === 'error code: 522' ||
        error?.shortMessage?.includes('server response 522') ||
        error?.shortMessage?.includes('server response 500');
      
      if (isNonCriticalRpcError) {
        // RPC endpoint temporarily unavailable - return 503 (Service Unavailable)
        // Don't log as error - these are expected with public RPC endpoints
        return res.status(503).json({ 
          error: 'Blockchain service temporarily unavailable',
          message: 'Please try again in a moment'
        });
      }
      
      // For unexpected errors, log and throw
      console.error('Error fetching product from blockchain:', error);
      throw error;
    }
    
    // Get off-chain metadata
    let metadata = null;
    try {
      metadata = await firebaseService.getProductMetadata(productId);
      // If Firebase is offline, getProductMetadata returns null (handled gracefully)
      // No need to log warnings for offline scenarios
    } catch (firebaseError) {
      // Only log non-offline errors
      const isOfflineError = 
        firebaseError?.code === 'unavailable' ||
        firebaseError?.message?.toLowerCase().includes('offline') ||
        firebaseError?.message?.toLowerCase().includes('network');
      
      if (!isOfflineError) {
        console.warn('Failed to fetch product metadata from Firebase:', firebaseError.message);
      }
    }
    
    // Check if product exists
    if (!blockchainProduct || blockchainProduct.exists === false) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Combine data ensuring blockchain fields take precedence over metadata
    // This prevents empty/undefined metadata values from overwriting on-chain data
    const product = {
      ...(metadata || {}),
      ...blockchainProduct,
    };
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ 
      error: 'Failed to fetch product details',
      message: error?.message || 'Unknown error'
    });
  }
});

// Create/update product metadata (off-chain)
router.post('/:productId/metadata', validateProductId, validateProductData, async (req, res) => {
  const { productId } = req.params || {};
  
  // Ensure we have a productId
  if (!productId) {
    return res.status(400).json({ error: 'Product ID is required' });
  }
  
  try {
    const metadata = req.body;
    
    // Store metadata in Firebase
    const result = await firebaseService.storeProductMetadata({
      productId,
      ...metadata,
      updatedAt: new Date()
    });
    
    if (!result) {
      throw new Error('Firebase service returned undefined result');
    }
    
    // Send response based on result - only if headers not already sent
    if (res.headersSent) {
      return; // Response already sent, don't try again
    }
    
    if (result.success) {
      console.log(`✅ Product created: ${productId}`);
      return res.json({ success: true, productId, ...result });
    } else if (result.offline) {
      console.log(`⚠️ Firebase offline - will sync later: ${productId}`);
      return res.json({ success: false, offline: true, productId, ...result });
    } else if (result.skipped) {
      console.error(`❌ Skipped: ${productId} - ${result.error || 'Unknown reason'}`);
      return res.status(400).json({ success: false, skipped: true, productId, ...result });
    } else {
      console.error(`❌ Failed: ${productId} - ${result.error || 'Unknown error'}`);
      return res.status(500).json({ success: false, productId, ...result });
    }
  } catch (error) {
    // Only send error response if headers not already sent
    if (!res.headersSent) {
      console.error(`❌ Error storing product ${productId || 'unknown'}: ${error.message}`);
      return res.status(500).json({ 
        error: 'Failed to store product metadata',
        message: error?.message || 'Unknown error'
      });
    } else {
      // Headers already sent, just log the error
      console.error(`❌ Error after response sent for product ${productId || 'unknown'}: ${error.message}`);
    }
  }
});

// Update product status (off-chain)
router.put('/:productId/status', validateProductId, validateStatusUpdate, async (req, res) => {
  try {
    const { productId } = req.params;
    const { status, location } = req.body;
    
    console.log(`🔄 Updating product status in Firebase: ${productId}`);
    console.log(`   New Status: ${status}`);
    console.log(`   Location: ${location || 'N/A'}`);
    
    // Update status in Firebase
    const result = await firebaseService.updateProductStatus(productId, status, location);
    
    if (result.success) {
      console.log(`✅ Product status updated successfully in Firebase: ${productId} -> ${status}`);
    } else if (result.offline) {
      console.log(`⚠️ Firebase is offline - status will be synced when Firebase comes back online`);
    } else {
      console.error(`❌ Failed to update product status: ${result.error || 'Unknown error'}`);
    }
    
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Error updating product status:', error);
    res.status(500).json({ 
      error: 'Failed to update product status',
      message: error?.message || 'Unknown error'
    });
  }
});

// Get product history (blockchain) - returns product history hashes
router.get('/:productId/history', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Get product history from blockchain (array of hashes)
    let history = [];
    try {
      history = await blockchainService.getProductHistory(productId);
    } catch (error) {
      // Check if product doesn't exist (expected case - handle gracefully)
      if (
        error?.code === 'PRODUCT_NOT_FOUND' ||
        error?.message?.includes('Product does not exist') || 
        error?.message?.includes('does not exist') ||
        error?.reason === 'Product does not exist'
      ) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      // Check if it's a non-critical RPC error
      const isNonCriticalRpcError = 
        error?.code === 'SERVER_ERROR' ||
        error?.info?.responseStatus === '522 <none>' ||
        error?.info?.responseBody === 'error code: 522' ||
        error?.shortMessage?.includes('server response 522') ||
        error?.shortMessage?.includes('server response 500');
      
      if (isNonCriticalRpcError) {
        // Return empty history instead of error - RPC temporarily unavailable
        return res.json({ historyHashes: [], transfers: [] });
      }
      
      throw error;
    }
    
    // Get ownership transfers for more detailed history
    let transfers = [];
    try {
      transfers = await blockchainService.getOwnershipTransfers(productId);
    } catch (transferError) {
      // Non-critical - log but continue
      console.warn('Failed to fetch ownership transfers for history:', transferError.message);
    }
    
    // Check if history is empty - return 404
    const historyHashes = history || [];
    const transferList = transfers || [];
    
    if (historyHashes.length === 0 && transferList.length === 0) {
      return res.status(404).json({ error: 'Product history not found' });
    }
    
    // Return array format for compatibility with tests
    // Combine history hashes with transfer details into a single array
    const combinedHistory = [
      ...historyHashes.map(hash => ({ type: 'hash', value: hash })),
      ...transferList.map(transfer => ({ type: 'transfer', ...transfer }))
    ];
    
    res.json(combinedHistory);
  } catch (error) {
    // Check if it's a non-critical RPC error
    const isNonCriticalRpcError = 
      error?.code === 'SERVER_ERROR' ||
      error?.info?.responseStatus === '522 <none>' ||
      error?.info?.responseBody === 'error code: 522' ||
      error?.shortMessage?.includes('server response 522') ||
      error?.shortMessage?.includes('server response 500');
    
    if (isNonCriticalRpcError) {
      // Return empty history instead of error
      return res.json({ historyHashes: [], transfers: [] });
    }
    
    console.error('Error fetching product history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch product history', 
      message: error?.message || 'Unknown error'
    });
  }
});

// Get ownership transfers (combines blockchain and off-chain data)
router.get('/:productId/transfers', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Get on-chain transfers
    let blockchainTransfers = [];
    try {
      blockchainTransfers = await blockchainService.getOwnershipTransfers(productId);
    } catch (error) {
      // Check if product doesn't exist (expected case - handle gracefully)
      if (
        error?.code === 'PRODUCT_NOT_FOUND' ||
        error?.message?.includes('Product does not exist') || 
        error?.message?.includes('does not exist') ||
        error?.reason === 'Product does not exist'
      ) {
        return res.status(404).json({ error: 'Product not found' });
      }
      // Check if it's a non-critical RPC error
      const isNonCriticalRpcError = 
        error?.code === 'SERVER_ERROR' ||
        error?.info?.responseStatus === '522 <none>' ||
        error?.info?.responseBody === 'error code: 522' ||
        error?.shortMessage?.includes('server response 522') ||
        error?.shortMessage?.includes('server response 500');
      
      if (!isNonCriticalRpcError) {
        // Only log non-RPC errors
        console.warn('Failed to fetch blockchain transfers:', error.message);
      }
    }
    
    // Get off-chain transfer details
    let offChainTransfers = [];
    try {
      offChainTransfers = await firebaseService.getTransferHistory(productId);
    } catch (firebaseError) {
      // Non-critical error - log but continue
      console.warn('Failed to fetch transfer history from Firebase:', firebaseError.message);
    }
    
    // Combine data (in a real implementation, you would match these by transaction hash)
    res.json({
      onChain: blockchainTransfers || [],
      offChain: offChainTransfers || []
    });
  } catch (error) {
    console.error('Error fetching ownership transfers:', error);
    res.status(500).json({ 
      error: 'Failed to fetch ownership transfers',
      message: error?.message || 'Unknown error'
    });
  }
});

// Record transfer (off-chain details)
router.post('/:productId/transfers', validateProductId, validateTransferData, async (req, res) => {
  try {
    const { productId } = req.params;
    const transferData = req.body;
    
    console.log(`📤 Storing transfer record in Firebase: ${productId}`);
    console.log(`   From: ${transferData.from || 'N/A'}`);
    console.log(`   To: ${transferData.to || 'N/A'}`);
    console.log(`   Status: ${transferData.status || 'N/A'}`);
    
    // Store transfer record in Firebase
    const result = await firebaseService.storeTransferRecord({
      productId,
      ...transferData,
      timestamp: new Date()
    });
    
    if (result.success) {
      console.log(`✅ Transfer record stored successfully in Firebase: ${productId}`);
    } else if (result.offline) {
      console.log(`⚠️ Firebase is offline - transfer will be synced when Firebase comes back online`);
    } else {
      console.error(`❌ Failed to store transfer record: ${result.error || 'Unknown error'}`);
    }
    
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Error recording transfer:', error);
    res.status(500).json({ 
      error: 'Failed to record transfer',
      message: error?.message || 'Unknown error'
    });
  }
});

// Verify product authenticity
router.get('/:productId/verify', validateProductId, async (req, res) => {
  try {
    const { productId } = req.params;
    
    let isAuthentic = false;
    try {
      isAuthentic = await blockchainService.verifyProduct(productId);
    } catch (error) {
      // Check if product doesn't exist (expected case - handle gracefully)
      if (
        error?.code === 'PRODUCT_NOT_FOUND' ||
        error?.message?.includes('Product does not exist') || 
        error?.message?.includes('does not exist') ||
        error?.reason === 'Product does not exist'
      ) {
        return res.json({ productId, isAuthentic: false, exists: false });
      }
      // Check if it's a non-critical RPC error
      const isNonCriticalRpcError = 
        error?.code === 'SERVER_ERROR' ||
        error?.info?.responseStatus === '522 <none>' ||
        error?.info?.responseBody === 'error code: 522' ||
        error?.shortMessage?.includes('server response 522') ||
        error?.shortMessage?.includes('server response 500');
      
      if (isNonCriticalRpcError) {
        // Return false for verification if RPC is unavailable
        return res.json({ productId, isAuthentic: false, exists: false });
      }
      
      throw error;
    }
    
    res.json({ productId, isAuthentic, exists: true });
  } catch (error) {
    // Check if it's a non-critical RPC error
    const isNonCriticalRpcError = 
      error?.code === 'SERVER_ERROR' ||
      error?.info?.responseStatus === '522 <none>' ||
      error?.info?.responseBody === 'error code: 522' ||
      error?.shortMessage?.includes('server response 522') ||
      error?.shortMessage?.includes('server response 500');
    
    if (isNonCriticalRpcError) {
      // Return false for verification if RPC is unavailable
      return res.json({ productId, isAuthentic: false, exists: false });
    }
    
    console.error('Error verifying product:', error);
    res.status(500).json({ 
      error: 'Failed to verify product',
      message: error?.message || 'Unknown error'
    });
  }
});

module.exports = router;