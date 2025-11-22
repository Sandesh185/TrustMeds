/**
 * Chain of Custody Validation Utility
 * Validates the complete supply chain journey of a product
 */

export interface ChainOfCustodyStep {
  step: string;
  status: 'valid' | 'missing' | 'invalid' | 'suspicious';
  address?: string;
  timestamp?: number;
  details?: string;
}

export interface ChainOfCustodyResult {
  isValid: boolean;
  isSuspicious: boolean;
  steps: ChainOfCustodyStep[];
  warnings: string[];
  expectedSteps: string[];
  actualSteps: string[];
}

/**
 * Validate chain of custody for a product
 * Expected flow: Manufacturer → Distributor → Delivery Hub → Customer
 */
export function validateChainOfCustody(
  history: Array<{
    type?: string;
    action: string;
    status: string;
    owner?: string;
    from?: string;
    to?: string;
    timestamp: number;
  }>,
  manufacturerAddress: string,
  isAuthorizedManufacturer: boolean
): ChainOfCustodyResult {
  const warnings: string[] = [];
  const steps: ChainOfCustodyStep[] = [];
  
  // Expected steps in the supply chain
  const expectedSteps = [
    'Product Created',
    'Transferred to Distributor',
    'Transferred to Delivery Hub',
    'Delivered'
  ];

  // Track actual steps found
  const actualSteps: string[] = [];

  // Step 1: Verify Product Creation by Authorized Manufacturer
  const creationStep: ChainOfCustodyStep = {
    step: 'Product Created',
    status: isAuthorizedManufacturer ? 'valid' : 'invalid',
    address: manufacturerAddress,
    details: isAuthorizedManufacturer 
      ? `Product created by authorized manufacturer: ${manufacturerAddress.slice(0, 6)}...${manufacturerAddress.slice(-4)}`
      : `⚠️ Product created by UNAUTHORIZED manufacturer: ${manufacturerAddress.slice(0, 6)}...${manufacturerAddress.slice(-4)} - COUNTERFEIT RISK!`
  };

  if (!isAuthorizedManufacturer) {
    warnings.push('Product created by unauthorized manufacturer - COUNTERFEIT RISK!');
  }

  steps.push(creationStep);
  actualSteps.push('Product Created');

  // Step 2: Find Manufacturer to Distributor Transfer
  // Look for OwnershipTransferred events with status/action containing "distributor"
  // Also check if it's the first transfer after creation (from manufacturer)
  const allTransfers = history.filter(entry => entry.type === 'OwnershipTransferred');
  console.log('🔍 Chain of Custody - All OwnershipTransferred events:', allTransfers.length);
  console.log('🔍 Chain of Custody - Full history:', history.map(e => ({ type: e.type, action: e.action, status: e.status, from: e.from, to: e.to, owner: e.owner })));
  
  const distributorTransfer = history.find(
    entry => {
      const statusLower = entry.status?.toLowerCase() || '';
      const actionLower = entry.action?.toLowerCase() || '';
      const isDistributorTransfer = statusLower.includes('distributor') || actionLower.includes('distributor');
      
      // Check if it's an OwnershipTransferred event OR if status/action indicates distributor transfer
      if (entry.type === 'OwnershipTransferred' && isDistributorTransfer) {
        return true;
      }
      
      // Also check if it's the first transfer and status indicates distributor
      if (isDistributorTransfer && allTransfers.length > 0 && allTransfers[0] === entry) {
        return true;
      }
      
      return false;
    }
  );

  if (distributorTransfer) {
    console.log('✅ Found distributor transfer:', distributorTransfer);
    steps.push({
      step: 'Transferred to Distributor',
      status: 'valid',
      address: distributorTransfer.owner || distributorTransfer.to || distributorTransfer.from,
      timestamp: distributorTransfer.timestamp,
      details: `Ownership transferred to distributor at ${new Date(distributorTransfer.timestamp).toLocaleString()}`
    });
    actualSteps.push('Transferred to Distributor');
  } else {
    console.log('⚠️ No distributor transfer found. Checking first transfer...');
    // Check if there are any transfers at all - if yes, maybe the first one is to distributor
    if (allTransfers.length > 0) {
      const firstTransfer = allTransfers[0];
      // If first transfer exists and manufacturer is the 'from', assume it's to distributor
      if (firstTransfer.from?.toLowerCase() === manufacturerAddress.toLowerCase()) {
        steps.push({
          step: 'Transferred to Distributor',
          status: 'valid',
          address: firstTransfer.owner || firstTransfer.to,
          timestamp: firstTransfer.timestamp,
          details: `Ownership transferred to distributor at ${new Date(firstTransfer.timestamp).toLocaleString()}`
        });
        actualSteps.push('Transferred to Distributor');
      } else {
        steps.push({
          step: 'Transferred to Distributor',
          status: 'missing',
          details: 'No transfer to distributor found in history'
        });
        warnings.push('Missing transfer to distributor - suspicious chain of custody');
      }
    } else {
      steps.push({
        step: 'Transferred to Distributor',
        status: 'missing',
        details: 'No transfer to distributor found in history'
      });
      warnings.push('Missing transfer to distributor - suspicious chain of custody');
    }
  }

  // Step 3: Find Distributor to Delivery Hub Transfer
  // Look for OwnershipTransferred events with status/action containing "delivery hub" or "delivery"
  // This should be the second transfer (after distributor transfer)
  const deliveryHubTransfer = history.find(
    entry => {
      const statusLower = entry.status?.toLowerCase() || '';
      const actionLower = entry.action?.toLowerCase() || '';
      const isDeliveryHubTransfer = statusLower.includes('delivery hub') || 
                                     statusLower.includes('delivered to delivery') ||
                                     actionLower.includes('delivery hub') ||
                                     actionLower.includes('transferred to delivery');
      
      // Check if it's an OwnershipTransferred event with delivery hub indicators
      if (entry.type === 'OwnershipTransferred' && isDeliveryHubTransfer) {
        return true;
      }
      
      // Also check if it's the second transfer (after distributor)
      if (isDeliveryHubTransfer && allTransfers.length > 1) {
        const transferIndex = allTransfers.findIndex(t => t === entry);
        if (transferIndex === 1) {
          return true;
        }
      }
      
      return false;
    }
  );

  if (deliveryHubTransfer) {
    console.log('✅ Found delivery hub transfer:', deliveryHubTransfer);
    steps.push({
      step: 'Transferred to Delivery Hub',
      status: 'valid',
      address: deliveryHubTransfer.owner || deliveryHubTransfer.to || deliveryHubTransfer.from,
      timestamp: deliveryHubTransfer.timestamp,
      details: `Ownership transferred to delivery hub at ${new Date(deliveryHubTransfer.timestamp).toLocaleString()}`
    });
    actualSteps.push('Transferred to Delivery Hub');
  } else {
    // Check if there's a second transfer that might be to delivery hub
    if (allTransfers.length > 1) {
      const secondTransfer = allTransfers[1];
      console.log('✅ Using second transfer as delivery hub transfer:', secondTransfer);
      steps.push({
        step: 'Transferred to Delivery Hub',
        status: 'valid',
        address: secondTransfer.owner || secondTransfer.to,
        timestamp: secondTransfer.timestamp,
        details: `Ownership transferred to delivery hub at ${new Date(secondTransfer.timestamp).toLocaleString()}`
      });
      actualSteps.push('Transferred to Delivery Hub');
    } else {
      console.log('⚠️ No delivery hub transfer found. Total transfers:', allTransfers.length);
      steps.push({
        step: 'Transferred to Delivery Hub',
        status: 'missing',
        details: 'No transfer to delivery hub found in history'
      });
      warnings.push('Missing transfer to delivery hub - suspicious chain of custody');
    }
  }

  // Step 4: Find Delivery Status
  // Look for StatusUpdated or OwnershipTransferred with "delivered" status
  const deliveredStatus = history.find(
    entry => {
      const statusLower = entry.status?.toLowerCase() || '';
      const actionLower = entry.action?.toLowerCase() || '';
      return statusLower.includes('delivered') || 
             actionLower.includes('delivered') ||
             statusLower === 'delivered' ||
             actionLower === 'delivered';
    }
  );

  if (deliveredStatus) {
    console.log('✅ Found delivered status:', deliveredStatus);
    steps.push({
      step: 'Delivered',
      status: 'valid',
      address: deliveredStatus.owner,
      timestamp: deliveredStatus.timestamp,
      details: `Product delivered at ${new Date(deliveredStatus.timestamp).toLocaleString()}`
    });
    actualSteps.push('Delivered');
  } else {
    console.log('⚠️ No delivered status found');
    steps.push({
      step: 'Delivered',
      status: 'missing',
      details: 'No delivery status found in history'
    });
    // Delivery might not have happened yet, so this is a warning, not a critical error
    if (history.length > 0) {
      warnings.push('Product not yet delivered - may still be in transit');
    }
  }

  // Check for unexpected transfers (e.g., manufacturer directly to customer)
  const unexpectedTransfers = history.filter(
    entry => entry.type === 'OwnershipTransferred' &&
    entry.from?.toLowerCase() === manufacturerAddress.toLowerCase() &&
    !entry.status?.toLowerCase().includes('distributor')
  );

  if (unexpectedTransfers.length > 0) {
    warnings.push('Unexpected transfer detected: Manufacturer transferred directly without going through distributor');
    steps.forEach(step => {
      if (step.step === 'Transferred to Distributor') {
        step.status = 'suspicious';
        step.details = 'Manufacturer may have bypassed distributor';
      }
    });
  }

  // Determine overall validity
  const hasInvalidSteps = steps.some(step => step.status === 'invalid');
  const hasMissingCriticalSteps = steps.some(
    step => step.status === 'missing' && 
    (step.step === 'Transferred to Distributor' || step.step === 'Transferred to Delivery Hub')
  );
  const hasSuspiciousSteps = steps.some(step => step.status === 'suspicious');

  const isValid = !hasInvalidSteps && !hasMissingCriticalSteps && !hasSuspiciousSteps;
  const isSuspicious = hasMissingCriticalSteps || hasSuspiciousSteps || warnings.length > 0;

  return {
    isValid,
    isSuspicious,
    steps,
    warnings,
    expectedSteps,
    actualSteps,
  };
}

