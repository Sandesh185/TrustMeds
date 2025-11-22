/**
 * Wallet-Linked PIN Authentication System
 * Each wallet address has its own PIN for secure access
 * This provides better security and audit trail compared to role-based PINs
 */

import { ethers } from 'ethers';

export type ParticipantRole = 'manufacturer' | 'distributor' | 'delivery-hub' | 'deliveryHub' | 'customer';

const AUTH_STORAGE_KEY = 'drug_supply_chain_auth';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

interface WalletAuthData {
  pinHash: string;
  lastLogin?: string;
  sessionExpiry?: number;
  role?: ParticipantRole; // Optional: remember preferred role for this wallet
}

interface AuthData {
  // Key: wallet address (lowercase), Value: wallet auth data
  [walletAddress: string]: WalletAuthData;
}

/**
 * Improved PIN hashing using Web Crypto API (better than simple hash)
 * Still client-side, but more secure than the previous implementation
 */
const hashPIN = async (pin: string): Promise<string> => {
  // Use Web Crypto API for better hashing if available
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(pin);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('Web Crypto API failed, falling back to simple hash:', error);
    }
  }
  
  // Fallback to improved simple hash (better than before)
  let hash = 0;
  const salt = 'drug_supply_chain_2024'; // Add salt for better security
  const data = pin + salt;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16) + pin.length.toString(); // Include length for extra security
};

/**
 * Get all auth data from localStorage
 */
const getAuthData = (): AuthData => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error reading auth data:', error);
    return {};
  }
};

/**
 * Save auth data to localStorage
 */
const saveAuthData = (data: AuthData) => {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving auth data:', error);
  }
};

/**
 * Normalize wallet address to lowercase for consistent storage
 */
const normalizeAddress = (address: string): string => {
  return address.toLowerCase();
};

/**
 * Check if a session is still valid (not expired)
 */
const isSessionValid = (walletAuth: WalletAuthData): boolean => {
  if (!walletAuth.sessionExpiry) {
    return false;
  }
  return Date.now() < walletAuth.sessionExpiry;
};

/**
 * Set PIN for a wallet address
 */
export const setPIN = async (walletAddress: string, pin: string, role?: ParticipantRole): Promise<boolean> => {
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    console.error('Invalid wallet address');
    return false;
  }

  if (!pin || pin.length < 4) {
    return false;
  }

  try {
    const authData = getAuthData();
    const normalizedAddr = normalizeAddress(walletAddress);
    const pinHash = await hashPIN(pin);

    authData[normalizedAddr] = {
      pinHash,
      role: role || authData[normalizedAddr]?.role, // Preserve existing role if not provided
      lastLogin: new Date().toISOString(),
    };

    saveAuthData(authData);
    return true;
  } catch (error) {
    console.error('Error setting PIN:', error);
    return false;
  }
};

/**
 * Verify PIN for a wallet address and create session
 */
export const verifyPIN = async (walletAddress: string, pin: string): Promise<boolean> => {
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return false;
  }

  const authData = getAuthData();
  const normalizedAddr = normalizeAddress(walletAddress);
  const walletAuth = authData[normalizedAddr];

  if (!walletAuth || !walletAuth.pinHash) {
    return false; // No PIN set for this wallet
  }

  try {
    const hashedPin = await hashPIN(pin);
    const isValid = walletAuth.pinHash === hashedPin;

    if (isValid) {
      // Create session with expiry
      authData[normalizedAddr] = {
        ...walletAuth,
        lastLogin: new Date().toISOString(),
        sessionExpiry: Date.now() + SESSION_TIMEOUT,
      };
      saveAuthData(authData);
    }

    return isValid;
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return false;
  }
};

/**
 * Check if a wallet address is authenticated (has valid session)
 */
export const isAuthenticated = (walletAddress: string): boolean => {
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return false;
  }

  const authData = getAuthData();
  const normalizedAddr = normalizeAddress(walletAddress);
  const walletAuth = authData[normalizedAddr];

  if (!walletAuth) {
    return false;
  }

  // Check if session is still valid
  return isSessionValid(walletAuth);
};

/**
 * Logout a wallet address (clear session)
 */
export const logout = (walletAddress: string): void => {
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return;
  }

  const authData = getAuthData();
  const normalizedAddr = normalizeAddress(walletAddress);
  const walletAuth = authData[normalizedAddr];

  if (walletAuth) {
    // Clear session but keep PIN hash (so user doesn't need to set PIN again)
    authData[normalizedAddr] = {
      ...walletAuth,
      sessionExpiry: undefined,
    };
    saveAuthData(authData);
  }
};

/**
 * Check if PIN is set for a wallet address
 */
export const hasPIN = (walletAddress: string): boolean => {
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return false;
  }

  const authData = getAuthData();
  const normalizedAddr = normalizeAddress(walletAddress);
  return !!authData[normalizedAddr]?.pinHash;
};

/**
 * Change PIN for a wallet address (requires current PIN)
 */
export const changePIN = async (walletAddress: string, currentPIN: string, newPIN: string): Promise<boolean> => {
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return false;
  }

  // Verify current PIN first
  const isValid = await verifyPIN(walletAddress, currentPIN);
  if (!isValid) {
    return false; // Current PIN incorrect
  }

  if (!newPIN || newPIN.length < 4) {
    return false; // New PIN invalid
  }

  return setPIN(walletAddress, newPIN);
};

/**
 * Get authentication status for a wallet address
 */
export const getAuthStatus = (walletAddress: string) => {
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return {
      hasPIN: false,
      isAuthenticated: false,
      lastLogin: undefined,
      sessionExpiry: undefined,
      role: undefined,
    };
  }

  const authData = getAuthData();
  const normalizedAddr = normalizeAddress(walletAddress);
  const walletAuth = authData[normalizedAddr];

  if (!walletAuth) {
    return {
      hasPIN: false,
      isAuthenticated: false,
      lastLogin: undefined,
      sessionExpiry: undefined,
      role: undefined,
    };
  }

  const sessionValid = isSessionValid(walletAuth);

  return {
    hasPIN: !!walletAuth.pinHash,
    isAuthenticated: sessionValid,
    lastLogin: walletAuth.lastLogin,
    sessionExpiry: walletAuth.sessionExpiry,
    role: walletAuth.role,
  };
};

/**
 * Set role for a wallet address (optional, for UI preferences)
 */
export const setRole = (walletAddress: string, role: ParticipantRole): boolean => {
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return false;
  }

  const authData = getAuthData();
  const normalizedAddr = normalizeAddress(walletAddress);
  
  if (authData[normalizedAddr]) {
    authData[normalizedAddr].role = role;
    saveAuthData(authData);
    return true;
  }

  return false;
};

/**
 * Get role for a wallet address
 */
export const getRole = (walletAddress: string): ParticipantRole | undefined => {
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return undefined;
  }

  const authData = getAuthData();
  const normalizedAddr = normalizeAddress(walletAddress);
  return authData[normalizedAddr]?.role;
};

/**
 * Extend session (call this periodically to keep user logged in while active)
 */
export const extendSession = (walletAddress: string): boolean => {
  if (!isAuthenticated(walletAddress)) {
    return false;
  }

  const authData = getAuthData();
  const normalizedAddr = normalizeAddress(walletAddress);
  const walletAuth = authData[normalizedAddr];

  if (walletAuth) {
    walletAuth.sessionExpiry = Date.now() + SESSION_TIMEOUT;
    saveAuthData(authData);
    return true;
  }

  return false;
};

/**
 * Clear all sessions for a wallet (logout everywhere)
 */
export const clearAllSessions = (walletAddress: string): void => {
  logout(walletAddress);
};
