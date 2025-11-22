/**
 * Recipient Validation Service
 * 
 * Validates recipient addresses for secure supply chain transfers
 * Prevents unauthorized transfers to unknown addresses
 */

import { ethers } from 'ethers';

export interface RecipientRole {
  address: string;
  role: 'distributor' | 'delivery_hub';
  name?: string;
  verified?: boolean;
}

// Whitelist of authorized recipient addresses (can be loaded from config or API)
// In production, this should be stored in a database or on-chain registry
const AUTHORIZED_RECIPIENTS: RecipientRole[] = [
  // Add authorized addresses here
  // Example:
  // { address: '0x...', role: 'distributor', name: 'ABC Distributors', verified: true },
  // { address: '0x...', role: 'delivery_hub', name: 'XYZ Delivery Hub', verified: true },
];

// Load from localStorage if available
let cachedRecipients: RecipientRole[] = [];

export function loadAuthorizedRecipients(): RecipientRole[] {
  try {
    const stored = localStorage.getItem('drug_supply_chain_authorized_recipients');
    if (stored) {
      cachedRecipients = JSON.parse(stored);
      return cachedRecipients;
    }
  } catch (error) {
    console.error('Failed to load authorized recipients:', error);
  }
  return AUTHORIZED_RECIPIENTS;
}

export function saveAuthorizedRecipients(recipients: RecipientRole[]): void {
  try {
    localStorage.setItem('drug_supply_chain_authorized_recipients', JSON.stringify(recipients));
    cachedRecipients = recipients;
  } catch (error) {
    console.error('Failed to save authorized recipients:', error);
  }
}

export function addAuthorizedRecipient(recipient: RecipientRole): boolean {
  if (!ethers.isAddress(recipient.address)) {
    return false;
  }
  
  const recipients = loadAuthorizedRecipients();
  const checksummedAddress = ethers.getAddress(recipient.address);
  
  // Check if already exists
  const exists = recipients.some(
    r => ethers.getAddress(r.address).toLowerCase() === checksummedAddress.toLowerCase()
  );
  
  if (exists) {
    return false;
  }
  
  recipients.push({
    ...recipient,
    address: checksummedAddress,
  });
  
  saveAuthorizedRecipients(recipients);
  return true;
}

export interface RecipientValidationResult {
  isValid: boolean;
  isAuthorized: boolean;
  recipient?: RecipientRole;
  warnings: string[];
  errors: string[];
}

/**
 * Validate recipient address for transfer
 */
export function validateRecipient(
  recipientAddress: string,
  expectedRole?: 'distributor' | 'delivery_hub',
  allowUnknown: boolean = false
): RecipientValidationResult {
  const result: RecipientValidationResult = {
    isValid: false,
    isAuthorized: false,
    warnings: [],
    errors: [],
  };

  // 1. Validate address format
  if (!ethers.isAddress(recipientAddress)) {
    result.errors.push('Invalid Ethereum address format');
    return result;
  }

  const checksummedAddress = ethers.getAddress(recipientAddress);
  result.isValid = true;

  // 2. Check if address is in whitelist
  const recipients = loadAuthorizedRecipients();
  const recipient = recipients.find(
    r => ethers.getAddress(r.address).toLowerCase() === checksummedAddress.toLowerCase()
  );

  if (recipient) {
    result.isAuthorized = true;
    result.recipient = recipient;

    // 3. Check role match if expected role provided
    if (expectedRole && recipient.role !== expectedRole) {
      result.warnings.push(
        `⚠️ Expected ${expectedRole}, but recipient is registered as ${recipient.role}`
      );
    }

    // 4. Check verification status
    if (!recipient.verified) {
      result.warnings.push('⚠️ Recipient address is not verified');
    }
  } else {
    // Address not in whitelist
    if (allowUnknown) {
      result.warnings.push(
        '⚠️ Recipient address is not in authorized list. Proceed with caution.'
      );
      result.isAuthorized = false; // Still not authorized, but allowed
    } else {
      result.errors.push(
        'Recipient address is not authorized. Please add to whitelist first.'
      );
      result.isAuthorized = false;
    }
  }

  return result;
}

/**
 * Get appropriate status for transfer based on role
 */
export function getTransferStatus(
  fromRole: 'manufacturer' | 'distributor' | 'delivery_hub',
  toRole?: 'distributor' | 'delivery_hub'
): string {
  if (fromRole === 'manufacturer' && toRole === 'distributor') {
    return 'Transferred to Distributor';
  }
  if (fromRole === 'distributor' && toRole === 'delivery_hub') {
    return 'Transferred to Delivery Hub';
  }
  // Fallback statuses
  if (fromRole === 'manufacturer') {
    return 'Transferred to Distributor';
  }
  if (fromRole === 'distributor') {
    return 'Transferred to Delivery Hub';
  }
  if (fromRole === 'delivery_hub') {
    return 'Delivered to Customer'; // Status update, not ownership transfer
  }
  return 'Transferred';
}

/**
 * Get all authorized recipients by role
 */
export function getRecipientsByRole(role: 'distributor' | 'delivery_hub'): RecipientRole[] {
  const recipients = loadAuthorizedRecipients();
  return recipients.filter(r => r.role === role && r.verified !== false);
}

