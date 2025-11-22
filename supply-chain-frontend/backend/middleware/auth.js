// Simple authentication middleware
// In a production environment, use JWT or similar token-based authentication

const authMiddleware = (req, res, next) => {
  // For read-only endpoints (GET), authentication is optional but recommended
  // For write endpoints (POST, PUT, DELETE), authentication is required
  
  const isReadOnly = req.method === 'GET';
  const walletAddress = req.headers['x-wallet-address'];
  
  // For read-only endpoints, allow requests without wallet address
  // For write endpoints, require wallet address
  if (!isReadOnly && !walletAddress) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Wallet address is required for write operations. Please include x-wallet-address header.'
    });
  }
  
  // Add wallet address to request object if available
  if (walletAddress) {
    req.walletAddress = walletAddress;
  }
  
  // In a real implementation, you would verify the wallet address
  // and check role permissions from a database
  
  next();
};

module.exports = authMiddleware;