// Simple rate limiting middleware
// For production, use express-rate-limit package

// Store request counts per IP
const requestCounts = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (now - value.resetTime > 0) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiter middleware
 * @param {number} windowMs - Time window in milliseconds (default: 1 minute)
 * @param {number} maxRequests - Maximum requests per window (default: 100)
 */
const rateLimiter = (windowMs = 60000, maxRequests = 100) => {
  return (req, res, next) => {
    // Get client identifier (IP address or wallet address)
    const identifier = req.headers['x-wallet-address'] || 
                      req.ip || 
                      req.connection.remoteAddress ||
                      'unknown';
    
    const now = Date.now();
    const key = `${identifier}-${Math.floor(now / windowMs)}`;
    
    const current = requestCounts.get(key) || { count: 0, resetTime: now + windowMs };
    
    if (current.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      });
    }
    
    current.count++;
    requestCounts.set(key, current);
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current.count));
    res.setHeader('X-RateLimit-Reset', new Date(current.resetTime).toISOString());
    
    next();
  };
};

module.exports = rateLimiter;

