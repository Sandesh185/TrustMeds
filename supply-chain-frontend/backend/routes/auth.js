const express = require('express');
const router = express.Router();
const firebaseService = require('../services/firebase');

// Login route with role verification
router.post('/login', async (req, res) => {
  const { address, role } = req.body;
  
  if (!address) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }
  
  if (!role || !['manufacturer', 'distributor', 'deliveryHub', 'customer'].includes(role)) {
    return res.status(400).json({ error: 'Valid role is required' });
  }
  
  try {
    // Check if user exists in Firebase
    const userExists = await firebaseService.getUserByAddress(address);
    
    if (userExists) {
      // Update user role if needed
      if (userExists.role !== role) {
        await firebaseService.updateUserRole(address, role);
      }
    } else {
      // Create new user
      await firebaseService.createUser({
        address,
        role,
        createdAt: new Date()
      });
    }
    
    // In a production environment, generate and return a JWT token
    
    res.json({
      success: true,
      message: 'Login successful',
      user: { address, role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Verify authentication route
router.get('/verify', (req, res) => {
  // In a production environment, verify the JWT token
  const address = req.headers['x-wallet-address'];
  const role = req.headers['x-user-role'];
  
  if (!address) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  res.json({
    success: true,
    message: 'Authentication valid',
    user: { address, role }
  });
});

// Get user role
router.get('/role/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const user = await firebaseService.getUserByAddress(address);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      role: user.role
    });
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ error: 'Failed to get user role' });
  }
});

module.exports = router;