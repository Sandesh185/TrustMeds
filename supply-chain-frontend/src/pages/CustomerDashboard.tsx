import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { toast } from 'react-hot-toast';
import { ethers } from 'ethers';
import { blockchainService, NETWORK_CONFIG } from '../utils/blockchain';
import apiClient, { isApiAvailable } from '../utils/apiClient';
import { getProduct } from '../utils/productStorage';
import LocationMap from '../components/LocationMap';
import { useParticipantWeb3 } from '../hooks/useParticipantWeb3';
import { 
  validateLocationAgainstAuthorizedZones, 
  type LocationValidationResult,
  type AuthorizedLocation 
} from '../utils/locationValidation';
import { 
  validateChainOfCustody,
  type ChainOfCustodyResult 
} from '../utils/chainOfCustodyValidation';

interface ProductHistory {
  timestamp: string;
  action: string;
  owner: string;
  status: string;
  location?: string;
  hash: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  type?: string; // 'ProductCreated' | 'OwnershipTransferred' | 'StatusUpdated'
  from?: string; // For OwnershipTransferred events, the previous owner
}

interface ProductInfo {
  productId: string;
  manufacturerName: string;
  productName: string;
  productCode: string;
  category: string;
  price: number;
  currentOwner: string;
  status: string;
  createdAt: string;
  isAuthentic: boolean;
  history: ProductHistory[];
  latitude?: number | string | null;
  longitude?: number | string | null;
  expiryDate?: string | null;
  batchNumber?: string;
}

// Cache for authorized locations to avoid redundant fetches
const authorizedLocationsCache = new Map<string, AuthorizedLocation[]>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

// Cache for product data to avoid redundant fetches
const productDataCache = new Map<string, { data: ProductInfo; timestamp: number }>();
const PRODUCT_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Cache for verification results
const verificationCache = new Map<string, { result: any; timestamp: number }>();
const VERIFICATION_CACHE_DURATION = 1 * 60 * 1000; // 1 minute

const CustomerDashboard = () => {
  const { productId } = useParams<{ productId?: string }>();
  const { isConnected, account, connect, disconnect } = useParticipantWeb3('customer');
  const [scannedProductId, setScannedProductId] = useState<string | null>(productId || null);
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [locationValidation, setLocationValidation] = useState<LocationValidationResult | null>(null);
  const [authorizedLocations, setAuthorizedLocations] = useState<AuthorizedLocation[]>([]);
  const [chainOfCustody, setChainOfCustody] = useState<ChainOfCustodyResult | null>(null);
  const [verificationResult, setVerificationResult] = useState<{
    isAuthentic: boolean;
    isValidManufacturer: boolean;
    manufacturerAddress: string;
    existsOnChain: boolean;
  } | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [isReported, setIsReported] = useState(false);
  const [isLocationValidationComplete, setIsLocationValidationComplete] = useState(false);

  // Auto fetch product if loaded via /verify/:id
  useEffect(() => {
    if (scannedProductId) fetchProductInfo(scannedProductId);
  }, [scannedProductId]);

  // Check if product is already reported when product info is loaded
  useEffect(() => {
    if (productInfo?.productId) {
      checkIfReported(productInfo.productId);
    }
  }, [productInfo?.productId]);

  // CRITICAL: Update productInfo.isAuthentic when both verification and location validation complete
  // This keeps productInfo.isAuthentic in sync with isProductAuthentic() calculation
  useEffect(() => {
    if (!productInfo) return;
    
    // Wait for location validation to complete before updating
    if (!isLocationValidationComplete) {
      // Still validating - don't update yet
      return;
    }
    
    // Location validation complete - now calculate final authenticity
    let finalAuthentic = true;
    
    // Check location validation
    if (locationValidation && !locationValidation.isValid && locationValidation.isSuspicious) {
      finalAuthentic = false;
      console.error(`🚨 [useEffect] Location validation failed - marking product as COUNTERFEIT`);
    } else {
      // Location validation passed (null or valid)
      // Check other factors
      if (verificationResult) {
        if (verificationResult.isValidManufacturer === false) {
          finalAuthentic = false;
          console.error(`🚨 [useEffect] Manufacturer not authorized - marking product as COUNTERFEIT`);
        } else if (!verificationResult.isAuthentic) {
          finalAuthentic = false;
          console.error(`🚨 [useEffect] Verification result shows not authentic - marking product as COUNTERFEIT`);
        }
      }
      
      if (chainOfCustody && !chainOfCustody.isValid && chainOfCustody.isSuspicious) {
        finalAuthentic = false;
        console.error(`🚨 [useEffect] Chain of custody invalid - marking product as COUNTERFEIT`);
      }
    }
    
    // Update productInfo.isAuthentic if it changed
    if (productInfo.isAuthentic !== finalAuthentic) {
      setProductInfo({
        ...productInfo,
        isAuthentic: finalAuthentic
      });
      
      // Also update verification result if location validation failed
      if (!finalAuthentic && locationValidation && !locationValidation.isValid && locationValidation.isSuspicious) {
        setVerificationResult(prev => prev ? {
          ...prev,
          isAuthentic: false
        } : {
          isAuthentic: false,
          isValidManufacturer: false,
          manufacturerAddress: '',
          existsOnChain: false
        });
      }
    }
  }, [locationValidation, isLocationValidationComplete, verificationResult, chainOfCustody, productInfo]);

  const checkIfReported = async (productId: string) => {
    try {
      const reported = await blockchainService.isReportedAsCounterfeit(productId);
      setIsReported(reported);
    } catch (error) {
      console.error('Error checking report status:', error);
      setIsReported(false);
    }
  };

  // Optimized verification function that runs in background
  const verifyProductInBackground = async (
    cleanId: string, 
    productData: ProductInfo, 
    blockchainProduct?: any
  ) => {
    try {
      // Check verification cache first
      const cached = verificationCache.get(cleanId);
      const now = Date.now();
      if (cached && (now - cached.timestamp) < VERIFICATION_CACHE_DURATION) {
        console.log(`📦 Using cached verification result for ${cleanId}`);
        setVerificationResult(cached.result);
        return;
      }

      // Step 1: Verify manufacturer authorization (try API and blockchain in parallel)
      let verification: any;
      const apiReady = await isApiAvailable();
      
      // Get manufacturer address first (needed for verification)
      const manufacturerAddress = blockchainProduct?.manufacturerAddress || blockchainProduct?.manufacturer || '';
      
      const verificationPromises = [
        apiReady ? apiClient.verifyProduct(cleanId).catch(() => null) : Promise.resolve(null),
        blockchainService.verifyProductAuthenticity(cleanId).catch(() => null)
      ];
      
      const [apiVerifyResult, blockchainVerifyResult] = await Promise.allSettled(verificationPromises);
      
      // Prefer blockchain result (has detailed manufacturer authorization check)
      if (blockchainVerifyResult.status === 'fulfilled' && blockchainVerifyResult.value) {
        verification = blockchainVerifyResult.value;
        console.log('✅ Using blockchain verification result');
      } else if (apiVerifyResult.status === 'fulfilled' && apiVerifyResult.value) {
        // API result - but we need to verify manufacturer authorization separately
        const verifyResult = apiVerifyResult.value;
        
        // CRITICAL: Always check manufacturer authorization from blockchain
        // API might not have the latest authorization status
        let isValidManufacturer = false;
        if (manufacturerAddress) {
          try {
            isValidManufacturer = await blockchainService.isAuthorizedManufacturer(manufacturerAddress);
            console.log(`🔍 Manufacturer authorization check: ${manufacturerAddress} is ${isValidManufacturer ? 'AUTHORIZED' : 'NOT AUTHORIZED'}`);
          } catch (authError) {
            console.warn('Failed to check manufacturer authorization, using API result:', authError);
            isValidManufacturer = verifyResult.isAuthentic || false;
          }
        }
        
        verification = {
          isAuthentic: verifyResult.isAuthentic && isValidManufacturer,
          isValidManufacturer: isValidManufacturer, // Use actual authorization check
          manufacturerAddress: manufacturerAddress,
          existsOnChain: true
        };
        console.log('✅ Using API verification result with blockchain manufacturer check');
      } else {
        // Both failed - try to at least check manufacturer authorization
        let isValidManufacturer = false;
        if (manufacturerAddress) {
          try {
            isValidManufacturer = await blockchainService.isAuthorizedManufacturer(manufacturerAddress);
            console.log(`🔍 Manufacturer authorization check (fallback): ${manufacturerAddress} is ${isValidManufacturer ? 'AUTHORIZED' : 'NOT AUTHORIZED'}`);
          } catch (authError) {
            console.warn('Failed to check manufacturer authorization:', authError);
          }
        }
        
        verification = {
          isAuthentic: false,
          isValidManufacturer: isValidManufacturer,
          manufacturerAddress: manufacturerAddress,
          existsOnChain: false
        };
      }
      
      // Ensure verification result has correct data structure
      if (!verification.manufacturerAddress && blockchainProduct) {
        verification.manufacturerAddress = blockchainProduct.manufacturerAddress || blockchainProduct.manufacturer || '';
      }
      
      // Final check: If we have manufacturer address but haven't checked authorization, check it now
      if (verification.manufacturerAddress && verification.isValidManufacturer === undefined) {
        try {
          verification.isValidManufacturer = await blockchainService.isAuthorizedManufacturer(verification.manufacturerAddress);
          console.log(`🔍 Final manufacturer authorization check: ${verification.manufacturerAddress} is ${verification.isValidManufacturer ? 'AUTHORIZED' : 'NOT AUTHORIZED'}`);
        } catch (authError) {
          console.warn('Failed final manufacturer authorization check:', authError);
          verification.isValidManufacturer = false;
        }
      }
      
      if (verification.manufacturerAddress && !verification.existsOnChain) {
        verification.existsOnChain = true;
      }
      
      // Log final verification result for debugging
      console.log('📋 Final Verification Result:', {
        isAuthentic: verification.isAuthentic,
        isValidManufacturer: verification.isValidManufacturer,
        manufacturerAddress: verification.manufacturerAddress,
        existsOnChain: verification.existsOnChain
      });
      
      // Cache verification result
      verificationCache.set(cleanId, { result: verification, timestamp: Date.now() });
      setVerificationResult(verification);
      
      // Step 2: Validate chain of custody (simplified, non-blocking)
      const productHistory = productData?.history || [];
      const manufacturerAddrForCustody = verification.manufacturerAddress || 
        (productHistory.length > 0 && productHistory[0]?.owner ? productHistory[0].owner : '');

      if (manufacturerAddrForCustody && productHistory.length > 0) {
        const historyForValidation = productHistory.map(entry => ({
          type: entry.type,
          action: entry.action,
          status: entry.status,
          owner: entry.owner,
          from: entry.from,
          to: entry.owner,
          timestamp: new Date(entry.timestamp).getTime()
        }));
        
        const custodyResult = validateChainOfCustody(
          historyForValidation,
          manufacturerAddrForCustody,
          verification.isValidManufacturer
        );
        setChainOfCustody(custodyResult);

        // Update verification result and chain of custody
        // CRITICAL: Don't update productData.isAuthentic here - let isProductAuthentic() determine it
        // This prevents premature setting to false before location validation completes
        if (productData) {
          // Always update verificationResult - useEffect will calculate final authenticity when location validation completes
          // This prevents premature setting to false before location validation completes
          setVerificationResult({
            isAuthentic: verification.isAuthentic && custodyResult.isValid,
            isValidManufacturer: verification.isValidManufacturer || false,
            manufacturerAddress: verification.manufacturerAddress || '',
            existsOnChain: true
          });
        }
      } else if (productData) {
        // No chain of custody - similar logic
        setVerificationResult({
          isAuthentic: verification.isAuthentic,
          isValidManufacturer: verification.isValidManufacturer || false,
          manufacturerAddress: verification.manufacturerAddress || '',
          existsOnChain: true
        });
      }
    } catch (verificationError: any) {
      console.error('Error verifying product:', verificationError);
      setVerificationResult({
        isAuthentic: false,
        isValidManufacturer: false,
        manufacturerAddress: '',
        existsOnChain: false,
      });
    }
  };

  const handleReportCounterfeit = async () => {
    if (!productInfo?.productId) {
      toast.error('Product ID not found');
      return;
    }

    // Check if wallet is connected
    if (!isConnected || !account) {
      toast.error('Please connect your MetaMask wallet to report a counterfeit product.');
      return;
    }

    // Double-check that product is counterfeit (check location validation too)
    if (isProductAuthentic()) {
      toast.error('This product is authentic. Only counterfeit products can be reported.');
      return;
    }

    if (isReported) {
      toast.error('This product has already been reported as counterfeit.');
      return;
    }

    if (!window.confirm('Are you sure you want to report this product as counterfeit? This action will be recorded on the blockchain.')) {
      return;
    }

    setIsReporting(true);
    try {
      const { txHash } = await blockchainService.reportCounterfeit(productInfo.productId);
      setIsReported(true);
      toast.success(
        `✅ Product reported as counterfeit! View transaction: https://sepolia.etherscan.io/tx/${txHash}`,
        { duration: 8000 }
      );
    } catch (error: any) {
      console.error('Error reporting counterfeit:', error);
      if (error.message.includes('Product is authentic')) {
        toast.error('This product is authentic. Only counterfeit products can be reported.');
      } else if (error.message.includes('already reported')) {
        toast.error('This product has already been reported.');
        setIsReported(true);
      } else if (error.message.includes('rejected')) {
        toast.error('Transaction was rejected');
      } else {
        toast.error(error.message || 'Failed to report counterfeit product');
      }
    } finally {
      setIsReporting(false);
    }
  };

  // Initialize scanner when user clicks "Scan QR"
  useEffect(() => {
    if (showScanner) {
      initializeScanner();
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [showScanner]);

  // Helper function to format location
  const formatLocation = (product: any): string => {
    if (product.location) {
      return product.location;
    }
    if (product.latitude !== undefined && product.longitude !== undefined) {
      return `Lat: ${product.latitude.toFixed(4)}, Lon: ${product.longitude.toFixed(4)}`;
    }
    return 'N/A';
  };

  const fetchProductInfo = async (id: string) => {
    const cleanId = id.trim();
    if (!cleanId) {
      toast.error('Please enter a product ID');
      return;
    }

    setIsLoading(true);
    // CRITICAL: Clear locationValidation state when fetching a new product
    // This prevents stale validation results from a previous product from affecting the new product
    setLocationValidation(null);
    setChainOfCustody(null);
    setVerificationResult(null);
    setIsLocationValidationComplete(false);
    try {
      // Check cache first
      const cached = productDataCache.get(cleanId);
      const now = Date.now();
      if (cached && (now - cached.timestamp) < PRODUCT_CACHE_DURATION) {
        console.log(`📦 Using cached product data for ${cleanId}`);
        setProductInfo(cached.data);
        setIsLoading(false);
        // Still run verification in background to update badges
        verifyProductInBackground(cleanId, cached.data);
        
        // For cached data, location validation was already done when cache was created
        // Mark as complete immediately to avoid showing "verifying" state
        // Note: If validation state changed since cache, it will update on next fresh fetch
        setIsLocationValidationComplete(true);
        
        return;
      }

      // 1️⃣ Try API and blockchain in PARALLEL for faster response
      let blockchainProduct: any = null;
      const apiCheck = isApiAvailable();
      const blockchainCheck = blockchainService.getProduct(cleanId).catch(() => null);
      
      // Race: use whichever responds first
      try {
        const apiReady = await apiCheck;
        if (apiReady) {
          // Try API in parallel with blockchain
          const [apiProduct, bcProduct] = await Promise.allSettled([
            apiClient.getProduct(cleanId),
            blockchainCheck
          ]);

          // Prefer API if successful, otherwise use blockchain
          const apiValue = apiProduct.status === 'fulfilled' ? apiProduct.value : null;
          const chainValue = bcProduct.status === 'fulfilled' ? bcProduct.value : null;

          if (apiValue && apiValue.productId) {
            // Use API as base, but ensure critical fields fallback to blockchain when missing
            blockchainProduct = {
              ...apiValue,
              // Keep on-chain values for critical fields when API has empty/undefined
              expiryDate: apiValue.expiryDate ?? chainValue?.expiryDate ?? null,
              batchNumber: apiValue.batchNumber ?? chainValue?.batchNumber ?? '',
              createdAt: (apiValue as any).createdAt ?? (chainValue as any)?.createdAt ?? new Date().toISOString(),
            };
            blockchainProduct.exists = true;
            console.log('✅ Using API product data with on-chain fallbacks');
          } else if (chainValue) {
            blockchainProduct = chainValue;
            console.log('✅ Using blockchain product data');
          } else {
            throw new Error('Both API and blockchain failed');
          }
        } else {
          // API not available, use blockchain
          blockchainProduct = await blockchainCheck;
        }
      } catch (error) {
        // Final fallback to blockchain
        blockchainProduct = await blockchainCheck;
      }
      
      let productData: ProductInfo | null = null;

      if (blockchainProduct && (blockchainProduct.exists || blockchainProduct.productId)) {
        // Extract location coordinates from blockchain product
        const isValidCoordinate = (coord: number | null | undefined): boolean => {
          if (coord === null || coord === undefined) return false;
          const num = Number(coord);
          return num !== 0 && !isNaN(num) && isFinite(num);
        };
        
        const isValidLatitude = (lat: number | null | undefined): boolean => {
          if (!isValidCoordinate(lat)) return false;
          const num = Number(lat);
          return num >= -90 && num <= 90;
        };
        
        const isValidLongitude = (lng: number | null | undefined): boolean => {
          if (!isValidCoordinate(lng)) return false;
          const num = Number(lng);
          return num >= -180 && num <= 180;
        };
        
        let productLat: number | null = null;
        let productLng: number | null = null;
        
        if (blockchainProduct.latitude !== undefined && blockchainProduct.latitude !== null) {
          const lat = Number(blockchainProduct.latitude);
          if (isValidLatitude(lat)) {
            productLat = lat;
          }
        }
        
        if (blockchainProduct.longitude !== undefined && blockchainProduct.longitude !== null) {
          const lng = Number(blockchainProduct.longitude);
          if (isValidLongitude(lng)) {
            productLng = lng;
          }
        }

        // ✅ SET PRODUCT INFO IMMEDIATELY with basic data (like Distributor/Explorer)
        // History will be loaded in background and updated later
        productData = {
          productId: cleanId,
          manufacturerName: blockchainProduct.manufacturerName || blockchainProduct.manufacturer || 'Unknown',
          productName: blockchainProduct.productName || 'Unknown Product',
          productCode: blockchainProduct.productCode || cleanId,
          category: blockchainProduct.category || 'General',
          price: Number(blockchainProduct.price) || 0,
          currentOwner: blockchainProduct.currentOwner || blockchainProduct.owner || 'Unknown',
          status: blockchainProduct.status || 'Unknown',
          createdAt: blockchainProduct.createdAt || new Date().toISOString(),
          // Ensure expiryDate is present if available from either source
          expiryDate: blockchainProduct.expiryDate || null,
          batchNumber: blockchainProduct.batchNumber || '',
          isAuthentic: true, // Will be updated after verification
          history: [], // Start with empty history, will be loaded in background
          latitude: productLat,
          longitude: productLng,
        };

        // Cache and display product info IMMEDIATELY
        productDataCache.set(cleanId, { data: productData, timestamp: Date.now() });
        setProductInfo(productData);
        setIsLoading(false);
        toast.success('✅ Product information retrieved successfully!');

        // ✅ Load history and validations in BACKGROUND (non-blocking)
        (async () => {
          let productHistory: ProductHistory[] = [];
          try {
            // Fetch history from both sources in PARALLEL
            let transactionHistory: any[] = [];
            const apiReady = await isApiAvailable();
            
            const historyPromises = [
              blockchainService.getProductTransactionHistory(cleanId).catch(() => null),
              apiReady ? apiClient.getProductHistory(cleanId).catch(() => null) : Promise.resolve(null)
            ];
            
            const [blockchainHistory, apiHistory] = await Promise.all(historyPromises);
            
            if (blockchainHistory && Array.isArray(blockchainHistory) && blockchainHistory.length > 0) {
              transactionHistory = blockchainHistory;
              console.log('✅ Using blockchain history (complete data)');
            } else if (apiHistory && Array.isArray(apiHistory) && apiHistory.length > 0) {
              transactionHistory = apiHistory;
              console.warn('⚠️ Using API history as fallback (blockchain history unavailable)');
            }
            
            const locationStr = formatLocation(blockchainProduct);
            
            if (transactionHistory && transactionHistory.length > 0) {
              // Use event-based history (has actual transaction hashes, location data, and from fields from blockchain)
              productHistory = transactionHistory.map((tx: any) => {
              // Extract location coordinates - prefer tx.latitude/longitude (from blockchain events)
              let lat: number | null = null;
              let lng: number | null = null;
              
              if (tx.latitude !== null && tx.latitude !== undefined && 
                  tx.longitude !== null && tx.longitude !== undefined) {
                const latNum = typeof tx.latitude === 'number' ? tx.latitude : parseFloat(String(tx.latitude));
                const lngNum = typeof tx.longitude === 'number' ? tx.longitude : parseFloat(String(tx.longitude));
                if (!isNaN(latNum) && !isNaN(lngNum) && 
                    latNum >= -90 && latNum <= 90 && 
                    lngNum >= -180 && lngNum <= 180 &&
                    !(latNum === 0 && lngNum === 0)) {
                  lat = latNum;
                  lng = lngNum;
                }
              }
              
              // Build location string
              let locationStrForEntry = 'N/A';
              if (lat !== null && lng !== null) {
                locationStrForEntry = `Lat: ${lat.toFixed(6)}, Lon: ${lng.toFixed(6)}`;
              } else if (tx.location) {
                locationStrForEntry = tx.location;
              }
              
              // Extract from field - critical for OwnershipTransferred validation
              let fromAddress: string | null = null;
              if (tx.type === 'OwnershipTransferred') {
                // For OwnershipTransferred, from is the previous owner who initiated the transfer
                fromAddress = tx.from || null;
                // If from is not set but we have owner history, try to infer it
                if (!fromAddress && tx.owner) {
                  // The from address should be the previous owner
                  // We'll need to track this from the history order
                }
              }
              
              // Determine owner - for OwnershipTransferred, owner is the 'to' address
              let ownerAddress = tx.owner || tx.to || blockchainProduct.currentOwner || 'Unknown';
              
              // For ProductCreated, owner is the manufacturer
              if (tx.type === 'ProductCreated' && tx.owner === 'Unknown') {
                ownerAddress = blockchainProduct.manufacturer || blockchainProduct.manufacturerAddress || blockchainProduct.currentOwner || 'Unknown';
              }
              
              return {
                timestamp: tx.timestamp ? (typeof tx.timestamp === 'number' ? new Date(tx.timestamp).toISOString() : new Date(tx.timestamp).toISOString()) : new Date().toISOString(),
                action: tx.action || (tx.type === 'ProductCreated' ? 'Product Created' : 
                        tx.type === 'OwnershipTransferred' ? 'Ownership Transferred' : 
                        tx.type === 'StatusUpdated' ? `Status Updated: ${tx.status}` : tx.type || 'Unknown'),
                owner: ownerAddress,
                status: tx.status || blockchainProduct.status || 'Unknown',
                location: locationStrForEntry,
                hash: tx.hash || 'N/A',
                latitude: lat,
                longitude: lng,
                type: tx.type || 'Unknown', // Include type for validation
                from: fromAddress || undefined // Include from for OwnershipTransferred events - CRITICAL for validation
              };
            });
            
            // Post-process: Fill in missing 'from' fields for OwnershipTransferred events
            // by tracking previous owners in chronological order
            // CRITICAL: This MUST happen before validation to ensure correct participant identification
            for (let i = 0; i < productHistory.length; i++) {
              const entry = productHistory[i];
              if (entry.type === 'OwnershipTransferred') {
                // Check if from field is missing or invalid
                if (!entry.from || entry.from === 'Unknown' || entry.from.trim() === '' || entry.from === 'null' || entry.from === 'undefined') {
                  // Find the previous owner (should be the owner of the previous entry)
                  // For Manufacturer → Distributor: previous owner is Manufacturer
                    if (i > 0) {
                      const prevOwner = productHistory[i - 1].owner;
                      if (prevOwner && prevOwner !== 'Unknown') {
                        entry.from = prevOwner;
                        console.log(`🔍 [Post-process] Filled in missing 'from' field for OwnershipTransferred entry ${i}: ${entry.from} (previous entry owner)`);
                      } else {
                        // Fallback to manufacturer
                        const manufacturerAddr = blockchainProduct.manufacturer || blockchainProduct.manufacturerAddress || (productHistory.length > 0 ? productHistory[0].owner : null);
                        if (manufacturerAddr) {
                          entry.from = manufacturerAddr;
                          console.log(`🔍 [Post-process] Filled in missing 'from' field for OwnershipTransferred entry ${i}: ${entry.from} (manufacturer fallback)`);
                        }
                      }
                    } else {
                      // First transfer - from should be the manufacturer (first entry owner)
                      const manufacturerAddr = blockchainProduct.manufacturer || blockchainProduct.manufacturerAddress || (productHistory.length > 0 ? productHistory[0].owner : null) || blockchainProduct.currentOwner;
                    if (manufacturerAddr && manufacturerAddr !== 'Unknown') {
                      entry.from = manufacturerAddr;
                      console.log(`🔍 [Post-process] Filled in missing 'from' field for first OwnershipTransferred: ${entry.from} (manufacturer)`);
                    } else {
                      entry.from = 'Unknown';
                      console.error(`❌ [Post-process] Could not determine 'from' address for first OwnershipTransferred entry`);
                    }
                  }
                } else {
                  // Verify that from is NOT the same as owner (would be wrong)
                  if (entry.from.toLowerCase() === entry.owner?.toLowerCase()) {
                    console.error(`❌ [Post-process] ERROR: entry.from (${entry.from}) is the same as entry.owner (${entry.owner})! This is WRONG for OwnershipTransferred!`);
                    // Correct it by using previous entry's owner
                    if (i > 0 && productHistory[i - 1].owner) {
                      entry.from = productHistory[i - 1].owner;
                      console.log(`✅ [Post-process] Corrected entry.from to previous entry owner: ${entry.from}`);
                    }
                  } else {
                    console.log(`✅ [Post-process] OwnershipTransferred entry ${i} has valid 'from' field: ${entry.from} (owner: ${entry.owner})`);
                  }
                }
              }
            }
            
            // Log final history state for debugging
            console.log(`📋 [Post-process] Final history state:`, productHistory.map((e, i) => ({
              index: i,
              type: e.type,
              action: e.action,
              from: e.from || 'MISSING',
              owner: e.owner || 'MISSING',
              hasLocation: !!(e.latitude && e.longitude)
            })));
          } else {
            // Fallback to ownership transfers if events not available
            // Try both API and blockchain in parallel for faster loading
            let transfers: any[] = [];
            try {
              const transferPromises = [
                isApiAvailable().then(ready => ready ? apiClient.getOwnershipTransfers(cleanId).catch(() => null) : null),
                blockchainService.getOwnershipTransfers(cleanId).catch(() => null)
              ];
              
              const [apiTransferData, blockchainTransfers] = await Promise.all(transferPromises);
              
              if (apiTransferData) {
                transfers = apiTransferData.onChain || apiTransferData || [];
              }
              if ((!transfers || transfers.length === 0) && blockchainTransfers) {
                transfers = blockchainTransfers;
              }
            } catch (error) {
              console.warn('Failed to fetch ownership transfers:', error);
            }
            if (transfers && transfers.length > 0) {
              productHistory = transfers.map((transfer: any, index: number) => ({
                timestamp: new Date(Number(transfer.timestamp) * 1000).toISOString(),
                action: index === 0 ? 'Product Created' : 'Ownership Transferred',
                owner: transfer.to || blockchainProduct.currentOwner,
                status: transfer.status || blockchainProduct.status,
                location: locationStr,
                hash: transfer.hash || 'N/A'
              }));
            } else {
              // No history found, create initial entry with product creation info
              productHistory = [{
                timestamp: blockchainProduct.createdAt,
                action: 'Product Created',
                owner: blockchainProduct.currentOwner || 'Unknown',
                status: blockchainProduct.status,
                location: locationStr,
                hash: 'N/A'
              }];
            }
          }
          } catch (historyError: any) {
            console.warn('Could not fetch product history from blockchain:', historyError);
            // Fallback: create initial history entry
            const locationStrFallback = formatLocation(blockchainProduct);
            productHistory = [{
              timestamp: blockchainProduct.createdAt,
              action: 'Product Created',
              owner: blockchainProduct.currentOwner || 'Unknown',
              status: blockchainProduct.status,
              location: locationStrFallback,
              hash: 'N/A'
            }];
          }

          // ✅ Update productData with history (productData was already set above)
          if (productData) {
            productData.history = productHistory;
            // Update cache and state with history
            productDataCache.set(cleanId, { data: productData, timestamp: Date.now() });
            setProductInfo({ ...productData });
          }

          // Start verification in background
          if (productData) {
            verifyProductInBackground(cleanId, productData, blockchainProduct);
          }

          // Load authorized locations and validations in background (non-blocking)
          // This is needed to validate locations correctly:
          // - ProductCreated: validate against manufacturer (who created it)
          // - OwnershipTransferred: validate against FROM owner (who entered the location during transfer)
          // - StatusUpdated: validate against current owner (who updated the status)
          try {
            // Extract all unique participant addresses from history
            const allParticipants = new Set<string>();
            
            // Add current owner
            if (blockchainProduct.currentOwner) {
              allParticipants.add(blockchainProduct.currentOwner.toLowerCase());
            }
            
            // Add manufacturer address (for ProductCreated validation)
            // Get manufacturer from product data or first history entry
            const productHistoryForValidation = productData?.history || [];
            const manufacturerAddress = blockchainProduct.manufacturer || blockchainProduct.manufacturerAddress || 
              (productHistoryForValidation.length > 0 && productHistoryForValidation[0]?.type === 'ProductCreated' ? productHistoryForValidation[0].owner : null);
            if (manufacturerAddress) {
              allParticipants.add(manufacturerAddress.toLowerCase());
              console.log(`📋 Added manufacturer to participants list: ${manufacturerAddress}`);
            }
            
            // Add all owners and FROM addresses from history
            // CRITICAL: For OwnershipTransferred, we need the FROM address (who entered the location)
            productHistoryForValidation.forEach((entry: any, idx: number) => {
              if (entry.owner && entry.owner !== 'Unknown') {
                allParticipants.add(entry.owner.toLowerCase());
                console.log(`📋 Added owner from history entry ${idx}: ${entry.owner}`);
              }
              if (entry.from && entry.from !== 'Unknown') {
                allParticipants.add(entry.from.toLowerCase());
                console.log(`📋 Added FROM address from history entry ${idx} (${entry.type}): ${entry.from}`);
                } else if (entry.type === 'OwnershipTransferred' && !entry.from) {
                  // If FROM is missing, use previous entry's owner
                  if (idx > 0 && productHistoryForValidation[idx - 1]?.owner) {
                    allParticipants.add(productHistoryForValidation[idx - 1].owner.toLowerCase());
                    console.log(`📋 Added inferred FROM address from previous entry: ${productHistoryForValidation[idx - 1].owner}`);
                  }
                }
              });
            
            console.log('📋 Loading authorized locations for participants:', Array.from(allParticipants));
            console.log(`📋 Total unique participants: ${allParticipants.size}`);
            
            // Load authorized locations for all participants in PARALLEL for faster loading
            // Use cache to avoid redundant fetches - OPTIMIZED: batch cache checks first
            const allAuthLocs: AuthorizedLocation[] = [];
            const now = Date.now();
            const uncachedParticipants: string[] = [];
            
            // First pass: check cache for all participants
            for (const participant of allParticipants) {
              let normalizedParticipant = participant;
              try {
                if (ethers.isAddress(participant)) {
                  normalizedParticipant = ethers.getAddress(participant);
                }
              } catch (e) {
                // Use as-is if invalid
              }
              
              const cacheKey = normalizedParticipant.toLowerCase();
              const cached = authorizedLocationsCache.get(cacheKey);
              const cacheTime = cacheTimestamps.get(cacheKey);
              
              if (cached && cacheTime && (now - cacheTime) < CACHE_DURATION) {
                console.log(`📦 Using cached locations for ${normalizedParticipant.slice(0, 10)}...`);
                allAuthLocs.push(...cached);
              } else {
                uncachedParticipants.push(normalizedParticipant);
              }
            }
            
            // Second pass: fetch only uncached participants in parallel
            if (uncachedParticipants.length > 0) {
              const locationPromises = uncachedParticipants.map(async (participant) => {
                try {
                  const cacheKey = participant.toLowerCase();
                  
                  // Fetch from blockchain
                  const authLocs = await blockchainService.getAuthorizedLocations(participant);
                  const formatted = (authLocs || []).map((loc: any) => {
                    // Normalize participant address in the location data
                    let locParticipant = loc.participant;
                    try {
                      if (loc.participant && ethers.isAddress(loc.participant)) {
                        locParticipant = ethers.getAddress(loc.participant);
                      }
                    } catch (e) {
                      // Use as-is if invalid
                    }
                    
                    return {
                      participant: locParticipant,
                      locationName: loc.locationName,
                      latitude: typeof loc.latitude === 'number' ? loc.latitude : parseFloat(String(loc.latitude)),
                      longitude: typeof loc.longitude === 'number' ? loc.longitude : parseFloat(String(loc.longitude)),
                      radius: typeof loc.radius === 'number' ? loc.radius : parseFloat(String(loc.radius)),
                      registeredAt: loc.registeredAt,
                    };
                  });
                  
                  // Update cache
                  authorizedLocationsCache.set(cacheKey, formatted);
                  cacheTimestamps.set(cacheKey, now);
                  
                  console.log(`✅ Loaded ${formatted.length} authorized locations for ${participant.slice(0, 10)}...`);
                  return formatted;
                } catch (error: any) {
                  console.warn(`⚠️ Failed to load authorized locations for ${participant}:`, error?.message);
                  return [];
                }
              });
              
              // Wait for all location fetches to complete in parallel
              const locationResults = await Promise.all(locationPromises);
              locationResults.forEach(locs => allAuthLocs.push(...locs));
            }
            
            setAuthorizedLocations(allAuthLocs);
            console.log(`✅ Total authorized locations loaded: ${allAuthLocs.length}`);
            console.log(`✅ Authorized locations by participant:`, 
              Object.fromEntries(
                [...allParticipants].map(p => [
                  p.slice(0, 10) + '...',
                  allAuthLocs.filter(loc => loc.participant?.toLowerCase() === p.toLowerCase()).map(l => l.locationName)
                ])
              )
            );

            // CRITICAL: Validate ALL locations in history, not just the current one
            // If ANY location in the product's journey was unauthorized, the product is suspicious
            let hasInvalidLocation = false;
            let validationWarnings: string[] = [];
            
            // Validate each history entry's location
            for (let idx = 0; idx < productHistoryForValidation.length; idx++) {
              const entry = productHistoryForValidation[idx];
              let entryLocation: { lat: number; lng: number } | null = null;
              
              // Get location from entry
              if (entry.latitude !== null && entry.latitude !== undefined && 
                  entry.longitude !== null && entry.longitude !== undefined) {
                const lat = typeof entry.latitude === 'number' ? entry.latitude : parseFloat(String(entry.latitude));
                const lng = typeof entry.longitude === 'number' ? entry.longitude : parseFloat(String(entry.longitude));
                if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                  entryLocation = { lat, lng };
                }
              }
              
              // Fallback: parse from location string
              if (!entryLocation && entry.location) {
                const match = entry.location.match(/Lat:\s*([\d.-]+),\s*Lon:\s*([\d.-]+)/);
                if (match) {
                  const lat = parseFloat(match[1]);
                  const lng = parseFloat(match[2]);
                  if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    entryLocation = { lat, lng };
                  }
                }
              }
              
              // Validate this entry's location if we have coordinates
              if (entryLocation) {
                // Determine which participant's authorized zones to check
                // CRITICAL: The participant who ENTERED the location should be validated
                let participantToValidate: string | null = null;
                
                // CRITICAL: Determine which participant ENTERED the location for this event
                // This is who we need to validate against
                if (entry.type === 'ProductCreated') {
                  // For product creation, the manufacturer created and entered the location
                  // Try multiple ways to get manufacturer address
                  const manufacturerAddr = blockchainProduct.manufacturer || 
                                          blockchainProduct.manufacturerAddress || 
                                          entry.owner || 
                                          (productHistoryForValidation.length > 0 ? productHistoryForValidation[0].owner : null);
                  if (manufacturerAddr && manufacturerAddr !== 'Unknown') {
                    participantToValidate = manufacturerAddr;
                    console.log(`🔍 [Initial Validation] ProductCreated: Validating location against manufacturer (who created product): ${participantToValidate}`);
                  } else {
                    console.warn(`⚠️ [Initial Validation] ProductCreated: Could not determine manufacturer address for validation`);
                  }
                } else if (entry.type === 'OwnershipTransferred') {
                  // For ownership transfers, the FROM owner entered the location during transfer
                  // Example: Manufacturer → Distributor: validate against Manufacturer's authorized location (Mangalore)
                  // Example: Distributor → Delivery Hub: validate against Distributor's authorized location (Kochi)
                  // CRITICAL: We MUST use entry.from (the manufacturer), NOT entry.owner (the distributor)
                  
                  // Check if from field exists and is valid
                  let fromAddress = entry.from;
                  if (!fromAddress || fromAddress === 'Unknown' || fromAddress.trim() === '') {
                    // Try to infer from previous entry
                    if (idx > 0) {
                      fromAddress = productHistoryForValidation[idx - 1].owner;
                      console.log(`🔍 [Initial Validation] OwnershipTransferred (entry ${idx}): entry.from was missing, inferred from previous entry: ${fromAddress}`);
                    } else {
                      // First transfer - from should be manufacturer
                      fromAddress = blockchainProduct.manufacturer || blockchainProduct.manufacturerAddress || (productHistoryForValidation.length > 0 ? productHistoryForValidation[0].owner : null);
                      console.log(`🔍 [Initial Validation] OwnershipTransferred (entry ${idx}): entry.from was missing, using manufacturer: ${fromAddress}`);
                    }
                  }
                  
                  // CRITICAL: Use fromAddress (manufacturer), NOT entry.owner (distributor)
                  if (fromAddress && fromAddress !== 'Unknown' && fromAddress.trim() !== '') {
                    participantToValidate = fromAddress;
                    console.log(`🔍 [Initial Validation] OwnershipTransferred (entry ${idx}): Validating location against FROM owner (manufacturer): ${participantToValidate}`);
                    console.log(`🔍 [Initial Validation] Entry details: action="${entry.action}", from="${entry.from}", owner="${entry.owner}", to="${entry.owner}"`);
                    
                    // Verify we're NOT using the distributor (entry.owner) for validation
                    if (participantToValidate.toLowerCase() === entry.owner?.toLowerCase()) {
                      console.error(`❌ [Initial Validation] ERROR: Using entry.owner (distributor) instead of entry.from (manufacturer)! This is WRONG!`);
                      console.error(`❌ Entry.owner (distributor): ${entry.owner}`);
                      console.error(`❌ Entry.from (manufacturer): ${entry.from}`);
                      console.error(`❌ Previous entry owner: ${idx > 0 ? productHistoryForValidation[idx - 1].owner : 'N/A'}`);
                      // Force use of previous entry's owner if available
                      if (idx > 0 && productHistoryForValidation[idx - 1].owner) {
                        participantToValidate = productHistoryForValidation[idx - 1].owner;
                        console.log(`✅ [Initial Validation] Corrected to use previous entry owner: ${participantToValidate}`);
                      }
                    }
                  } else {
                    console.error(`❌ [Initial Validation] OwnershipTransferred (entry ${idx}): Could not determine FROM owner for validation!`);
                    console.error(`❌ Entry.from: "${entry.from}", Entry.owner: "${entry.owner}", Previous owner: "${idx > 0 ? productHistoryForValidation[idx - 1].owner : 'N/A'}"`);
                  }
                } else if (entry.type === 'StatusUpdated') {
                  // For status updates, the current owner (who updated the status) entered the location
                  // Example: Delivery Hub updates status: validate against Delivery Hub's authorized location
                  if (entry.owner && entry.owner !== 'Unknown') {
                    participantToValidate = entry.owner;
                    console.log(`🔍 [Initial Validation] StatusUpdated: Validating location against current owner (who updated status): ${participantToValidate}`);
                  } else {
                    console.warn(`⚠️ [Initial Validation] StatusUpdated: Could not determine owner for validation`);
                  }
                } else {
                  // Last resort fallback: use the current owner
                  // BUT: For OwnershipTransferred, we should NEVER use entry.owner (distributor) as fallback
                  // because that would validate against the wrong participant's location
                  if (entry.type !== 'OwnershipTransferred' && entry.owner && entry.owner !== 'Unknown') {
                    participantToValidate = entry.owner;
                    console.log(`🔍 [Initial Validation] ${entry.type || 'Unknown'}: Validating location against current owner (fallback): ${participantToValidate}`);
                  } else if (entry.type === 'OwnershipTransferred') {
                    // CRITICAL: For OwnershipTransferred, we MUST have a from address
                    // If we don't have it, we cannot validate correctly
                    console.error(`❌ [Initial Validation] OwnershipTransferred (entry ${idx}): CRITICAL ERROR - Cannot validate without FROM address!`);
                    console.error(`❌ This will cause incorrect validation. Entry details:`, {
                      action: entry.action,
                      from: entry.from,
                      owner: entry.owner,
                      type: entry.type,
                      previousEntryOwner: idx > 0 ? productHistoryForValidation[idx - 1].owner : 'N/A'
                    });
                    // Don't set participantToValidate - skip validation for this entry
                    participantToValidate = null;
                  }
                }
                
                // Validate location against the participant's authorized zones
                if (participantToValidate && participantToValidate !== 'Unknown') {
                  // Normalize addresses for comparison (case-insensitive, checksummed)
                  let normalizedParticipant = participantToValidate.toLowerCase();
                  try {
                    // Try to checksum the address for consistent comparison
                    if (ethers.isAddress(participantToValidate)) {
                      const checksummed = ethers.getAddress(participantToValidate);
                      normalizedParticipant = checksummed.toLowerCase();
                    }
                  } catch (e) {
                    // Use lowercase if checksumming fails
                    normalizedParticipant = participantToValidate.toLowerCase();
                  }
                  
                  const participantAuthLocs = allAuthLocs.filter((loc) => {
                    if (!loc.participant) return false;
                    // Normalize location participant address for comparison
                    let locParticipantNormalized = loc.participant.toLowerCase();
                    try {
                      if (ethers.isAddress(loc.participant)) {
                        locParticipantNormalized = ethers.getAddress(loc.participant).toLowerCase();
                      }
                    } catch (e) {
                      locParticipantNormalized = loc.participant.toLowerCase();
                    }
                    return locParticipantNormalized === normalizedParticipant;
                  });
                  
                  console.log(`🔍 [Initial Validation] Validating location (${entryLocation.lat}, ${entryLocation.lng}) for ${entry.type} (entry ${idx}):`, {
                    entryAction: entry.action,
                    entryFrom: entry.from || 'N/A',
                    entryOwner: entry.owner || 'N/A',
                    participantToValidate: participantToValidate,
                    authorizedLocationsCount: participantAuthLocs.length,
                    authorizedLocationNames: participantAuthLocs.map(loc => loc.locationName),
                    allAuthLocsCount: allAuthLocs.length,
                    allParticipants: [...new Set(allAuthLocs.map(loc => loc.participant))].map(addr => `${addr.slice(0, 10)}...`)
                  });
                  
                  if (participantAuthLocs.length > 0) {
                    const validation = validateLocationAgainstAuthorizedZones(
                      entryLocation.lat,
                      entryLocation.lng,
                      participantToValidate,
                      participantAuthLocs
                    );
                    
                    console.log(`🔍 [Initial Validation] Location validation result for ${entry.type} (entry ${idx}):`, {
                      isValid: validation.isValid,
                      isSuspicious: validation.isSuspicious,
                      warnings: validation.warnings,
                      distanceFromExpected: validation.distanceFromExpected ? `${(validation.distanceFromExpected / 1000).toFixed(2)} km` : 'N/A',
                      expectedLocation: validation.expectedLocation ? validation.expectedLocation.name : 'N/A',
                      expectedLocationCoords: validation.expectedLocation ? `(${validation.expectedLocation.latitude.toFixed(4)}, ${validation.expectedLocation.longitude.toFixed(4)})` : 'N/A',
                      actualLocation: `(${entryLocation.lat.toFixed(4)}, ${entryLocation.lng.toFixed(4)})`
                    });
                    
                    // If this location is invalid, mark the entire product as suspicious
                    if (!validation.isValid && validation.isSuspicious) {
                      hasInvalidLocation = true;
                      const warningMsg = validation.warnings && validation.warnings.length > 0 
                        ? validation.warnings[0] 
                        : 'Outside authorized zones';
                      validationWarnings.push(
                        `${entry.action} (${new Date(entry.timestamp).toLocaleDateString()}): Location mismatch - ${warningMsg}`
                      );
                      console.error(`🚨 [Initial Validation] INVALID location detected in history entry ${idx}: ${entry.action} at (${entryLocation.lat}, ${entryLocation.lng}) for participant ${participantToValidate}`);
                      console.error(`🚨 Expected: ${validation.expectedLocation ? validation.expectedLocation.name : 'N/A'} at (${validation.expectedLocation ? validation.expectedLocation.latitude.toFixed(4) : 'N/A'}, ${validation.expectedLocation ? validation.expectedLocation.longitude.toFixed(4) : 'N/A'})`);
                      console.error(`🚨 Distance: ${validation.distanceFromExpected ? (validation.distanceFromExpected / 1000).toFixed(2) : 'N/A'} km`);
                    } else if (validation.isValid) {
                      console.log(`✅ [Initial Validation] Location validated successfully for ${entry.type} (entry ${idx}): ${entry.action} - Matches authorized zone`);
                    }
                  } else {
                    console.warn(`⚠️ [Initial Validation] No authorized locations found for participant ${participantToValidate} (entry: ${entry.action}). Cannot validate location.`);
                    console.warn(`⚠️ Available participants with locations: ${[...new Set(allAuthLocs.map(loc => loc.participant))].join(', ')}`);
                    // Don't mark as invalid if no authorized locations are registered - this is expected for new participants
                  }
                } else {
                  console.warn(`⚠️ [Initial Validation] Cannot validate location for ${entry.type} entry ${idx}: No participant address available. entry.from="${entry.from}", entry.owner="${entry.owner}"`);
                }
              }
            }
            
            // Log summary of validation results
            console.log(`📊 [Initial Validation] Summary:`, {
              totalHistoryEntries: productHistoryForValidation.length,
              entriesWithLocations: productHistoryForValidation.filter((e: any) => e.latitude && e.longitude).length,
              hasInvalidLocation: hasInvalidLocation,
              validationWarningsCount: validationWarnings.length,
              validatedEntries: productHistoryForValidation.map((e: any, i: number) => ({
                index: i,
                type: e.type,
                action: e.action,
                from: e.from || 'N/A',
                owner: e.owner || 'N/A',
                hasLocation: !!(e.latitude && e.longitude)
              }))
            });
            
            // Set overall validation result based on ALL history locations
            if (hasInvalidLocation) {
              // Get location from product or first history entry
              let actualLat = productLat;
              let actualLng = productLng;
              
              // Fallback to first history entry location if product coordinates not available
              if ((actualLat === null || actualLng === null) && productHistoryForValidation.length > 0) {
                const firstEntry = productHistoryForValidation[0];
                if (firstEntry.latitude !== null && firstEntry.latitude !== undefined &&
                    firstEntry.longitude !== null && firstEntry.longitude !== undefined) {
                  const lat = typeof firstEntry.latitude === 'number' ? firstEntry.latitude : parseFloat(String(firstEntry.latitude));
                  const lng = typeof firstEntry.longitude === 'number' ? firstEntry.longitude : parseFloat(String(firstEntry.longitude));
                  if (!isNaN(lat) && !isNaN(lng)) {
                    actualLat = lat;
                    actualLng = lng;
                  }
                }
              }
              
              // Use product coordinates or fallback to 0,0 if no location available
              console.error(`🚨 [Initial Validation] Setting locationValidation to INVALID due to invalid locations in history`);
              console.error(`🚨 Validation warnings:`, validationWarnings);
              const invalidLocationValidation = {
                isValid: false,
                isSuspicious: true,
                warnings: validationWarnings,
                actualLocation: {
                  latitude: actualLat !== null ? actualLat : 0,
                  longitude: actualLng !== null ? actualLng : 0
                }
              };
              setLocationValidation(invalidLocationValidation);
              setIsLocationValidationComplete(true);
              
              // CRITICAL: Mark product as COUNTERFEIT if location validation fails
              // Note: useEffect will handle updating productInfo.isAuthentic when isLocationValidationComplete changes
              console.error(`🚨 [CRITICAL] Location validation failed - marking product as COUNTERFEIT`);
              
              // Also update verification result to mark as counterfeit
              setVerificationResult(prev => prev ? {
                ...prev,
                isAuthentic: false
              } : {
                isAuthentic: false,
                isValidManufacturer: false,
                manufacturerAddress: '',
                existsOnChain: false
              });
            } else {
              // All history locations are valid - explicitly clear locationValidation to prevent false positives
              // This ensures that if locationValidation was previously set to invalid, it gets cleared
              console.log(`✅ [Initial Validation] All history locations validated successfully - no invalid locations found`);
              setLocationValidation(null);
              setIsLocationValidationComplete(true);
              
              // Note: useEffect will handle updating productInfo.isAuthentic when isLocationValidationComplete changes
              // It will calculate final authenticity based on locationValidation, verificationResult, and chainOfCustody
            }
            
            // Note: We don't validate current location against current owner here
            // because the current location might be different from where the product was last transferred
            // The per-entry validation in the UI shows the correct validation for each history entry
          } catch (error: any) {
            console.error('Failed to load authorized locations:', error);
            // Don't show error to user, just log it
            // Mark location validation as complete even if it failed, so we don't hang in "verifying" state
            // If validation fails, we'll treat it as incomplete validation rather than invalid
            setIsLocationValidationComplete(true);
          }
        })(); // Run in background, don't await - loads history and validations
      } else {
        // 2️⃣ Fallback to local storage (for simulation / testing)
        const storedProduct = getProduct(cleanId);
        if (!storedProduct) {
          toast.error(`Product "${cleanId}" not found. Create it via Manufacturer Dashboard.`);
          setProductInfo(null);
          return;
        }

        const locationStr = formatLocation(storedProduct);

        productData = {
          productId: storedProduct.productId,
          manufacturerName: storedProduct.manufacturerName,
          productName: storedProduct.productName,
          productCode: storedProduct.productCode,
          category: storedProduct.category,
          price: storedProduct.price,
          currentOwner: storedProduct.owner,
          status: storedProduct.status,
          // Ensure createdAt is always populated: prefer stored value, then first history, then now
          createdAt:
            storedProduct.createdAt ||
            (storedProduct.history && storedProduct.history.length > 0
              ? storedProduct.history[0]?.timestamp
              : new Date().toISOString()),
          expiryDate: storedProduct.expiryDate || null,
          batchNumber: storedProduct.batchNumber || '',
          isAuthentic: false,
          history:
            storedProduct.history?.map((tx: any) => ({
              timestamp: tx.timestamp,
              action: tx.action,
              owner: tx.to,
              status: tx.status,
              location: tx.location || locationStr,
              hash: tx.txHash,
            })) || [],
        };
      }
    } catch (error) {
      console.error('Error fetching product info:', error);
      toast.error('Failed to fetch product information');
      setVerificationResult(null);
      setChainOfCustody(null);
      setIsLoading(false);
    }
  };

  const initializeScanner = () => {
    const el = document.getElementById('qr-reader');
    if (!el) return;

    try {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 5, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(
        (decodedText: string) => {
          try {
            const url = new URL(decodedText);
            const id = url.pathname.split('/').pop();
            if (id) setScannedProductId(id);
          } catch {
            setScannedProductId(decodedText);
          }
          stopScanner();
        },
        (error) => console.debug('Scan error:', error)
      );

      scannerRef.current = scanner;
    } catch (error) {
      console.error('Scanner init failed:', error);
      toast.error('Failed to initialize camera scanner');
      setShowScanner(false);
    }
  };

  const stopScanner = () => {
    scannerRef.current?.clear().catch(() => {});
    scannerRef.current = null;
    setShowScanner(false);
  };

  // Robust date formatter: handles ISO strings, numeric timestamps (sec/ms), Date objects, null/undefined
  const parseDate = (d: any): Date | null => {
    if (!d) return null;
    if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
    if (typeof d === 'number') {
      const ms = d < 1e12 ? d * 1000 : d; // treat <1e12 as seconds
      const dt = new Date(ms);
      return isNaN(dt.getTime()) ? null : dt;
    }
    if (typeof d === 'string') {
      const s = d.trim();
      if (!s) return null;
      if (/^\d+$/.test(s)) {
        const num = Number(s);
        const ms = s.length === 10 ? num * 1000 : num;
        const dt = new Date(ms);
        return isNaN(dt.getTime()) ? null : dt;
      }
      // Support common non-ISO formats like dd-mm-yyyy, dd/mm/yyyy, yyyy-mm-dd, mm-dd-yyyy
      // Prefer day-first interpretation when ambiguous
      const dayFirst = s.match(/^([0-3]?\d)[-\/](0?\d|1[0-2])[-\/]((?:19|20)?\d{2})$/);
      if (dayFirst) {
        const day = Number(dayFirst[1]);
        const month = Number(dayFirst[2]);
        let year = Number(dayFirst[3]);
        if (year < 100) year += 2000; // handle 2-digit year
        const dt = new Date(year, month - 1, day);
        return isNaN(dt.getTime()) ? null : dt;
      }
      const yearFirst = s.match(/^((?:19|20)\d{2})[-\/](0?\d|1[0-2])[-\/]([0-3]?\d)$/);
      if (yearFirst) {
        const year = Number(yearFirst[1]);
        const month = Number(yearFirst[2]);
        const day = Number(yearFirst[3]);
        const dt = new Date(year, month - 1, day);
        return isNaN(dt.getTime()) ? null : dt;
      }
      const monthFirst = s.match(/^(0?\d|1[0-2])[-\/]([0-3]?\d)[-\/]((?:19|20)?\d{2})$/);
      if (monthFirst) {
        const month = Number(monthFirst[1]);
        const day = Number(monthFirst[2]);
        let year = Number(monthFirst[3]);
        if (year < 100) year += 2000;
        const dt = new Date(year, month - 1, day);
        return isNaN(dt.getTime()) ? null : dt;
      }
      const dt = new Date(s);
      return isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  };
  const formatDate = (d: any) => {
    const date = parseDate(d);
    return date ? date.toLocaleString() : 'N/A';
  };
  const shortAddr = (addr: string | undefined | null) => {
    if (!addr) return 'Unknown';
    if (typeof addr !== 'string') return 'Invalid';
    if (addr.length < 10) return addr; // Too short to format
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Helper to create Etherscan link for transaction hash
  const getEtherscanTxLink = (txHash: string): string => {
    if (!txHash || txHash === 'N/A') return '#';
    const explorerUrl = NETWORK_CONFIG.blockExplorerUrls[0] || 'https://sepolia.etherscan.io';
    return `${explorerUrl}/tx/${txHash}`;
  };

  // CRITICAL: Helper to determine if product is authentic
  // Location validation failure ALWAYS marks product as counterfeit
  // IMPORTANT: Don't mark as counterfeit until location validation has completed
  const isProductAuthentic = (): boolean => {
    // Wait for location validation to complete before making final determination
    // This prevents false counterfeit warnings while validation is still in progress
    if (!isLocationValidationComplete) {
      // Location validation is still in progress - ALWAYS show as authentic/verifying until complete
      // This prevents premature counterfeit warnings while validation is running
      // Even if verificationResult says not authentic, we must wait for location validation
      return true; // Show as "Verifying..." state
    }
    
    // Location validation is complete - now we can make final determination
    // If location validation failed, product is ALWAYS counterfeit
    if (locationValidation && !locationValidation.isValid && locationValidation.isSuspicious) {
      console.log('🚨 [isProductAuthentic] Location validation failed - product is COUNTERFEIT');
      return false;
    }
    
    // Location validation passed (null or valid) - check other verification factors
    // Calculate authenticity based on all factors, not just productInfo.isAuthentic which might be stale
    if (!productInfo) {
      return false;
    }
    
    // Check manufacturer authorization
    if (verificationResult && verificationResult.isValidManufacturer === false) {
      console.log('🚨 [isProductAuthentic] Manufacturer is not authorized - product is COUNTERFEIT');
      return false;
    }
    
    // Check verification result
    if (verificationResult && !verificationResult.isAuthentic) {
      console.log('🚨 [isProductAuthentic] Verification result shows not authentic - product is COUNTERFEIT');
      return false;
    }
    
    // Check chain of custody
    if (chainOfCustody && !chainOfCustody.isValid && chainOfCustody.isSuspicious) {
      console.log('🚨 [isProductAuthentic] Chain of custody is invalid - product is COUNTERFEIT');
      return false;
    }
    
    // All checks passed - product is authentic
    // Location validation passed (null means all locations were valid)
    // Verification passed (if exists)
    // Chain of custody passed (if exists)
    return true;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Customer Dashboard</h1>
            <p className="text-gray-600">
              Scan a QR code or enter a product ID to verify authenticity and trace history.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center gap-3">
            {account && (
              <div className="text-sm text-gray-600">
                <span className="font-semibold">Wallet:</span> {shortAddr(account)}
              </div>
            )}
            <button
              onClick={isConnected ? disconnect : connect}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                isConnected
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
            >
              {isConnected ? 'Disconnect' : 'Connect Wallet'}
            </button>
          </div>
        </div>
      </div>

      {/* QR Scanner + Info */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="card">
          <h2 className="text-xl font-semibold mb-6">Product Verification</h2>
          {!showScanner ? (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={scannedProductId || ''}
                  onChange={(e) => setScannedProductId(e.target.value)}
                  className="input-field flex-1"
                  placeholder="Enter product ID or scan QR"
                />
                <button
                  onClick={() => scannedProductId && fetchProductInfo(scannedProductId)}
                  className="btn-primary"
                  disabled={!scannedProductId}
                >
                  Verify
                </button>
              </div>
              <button onClick={() => setShowScanner(true)} className="btn-secondary w-full">
                📱 Scan QR Code
              </button>
            </>
          ) : (
            <div>
              <div id="qr-reader" className="mb-4"></div>
              <button onClick={stopScanner} className="btn-secondary w-full">
                Stop Scanner
              </button>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-6">Product Information</h2>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-b-2 border-primary-600 mx-auto rounded-full"></div>
              <p className="mt-2 text-gray-600">Loading product info...</p>
            </div>
          ) : productInfo ? (
            <div className="space-y-3">
              {/* Overall Verification Badge */}
              <div
                className={`p-4 rounded-lg border-2 ${
                  !isLocationValidationComplete
                    ? 'bg-yellow-50 border-yellow-400'
                    : isProductAuthentic()
                    ? 'bg-green-50 border-green-400'
                    : 'bg-red-50 border-red-400'
                }`}
              >
                <div className="flex items-center">
                  <span className="text-3xl mr-3">
                    {!isLocationValidationComplete
                      ? '⏳'
                      : isProductAuthentic()
                      ? '✅'
                      : '🚨'}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">
                      {!isLocationValidationComplete
                        ? '⏳ Verifying Authenticity...'
                        : isProductAuthentic()
                        ? '✅ Authentic Product'
                        : '🚨 COUNTERFEIT RISK - DO NOT USE'}
                    </h3>
                    {!isLocationValidationComplete && (
                      <p className="text-sm text-yellow-700 mt-1">
                        Please wait while we validate product locations and chain of custody...
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Manufacturer Verification Badge */}
              {verificationResult && (
                <div
                  className={`p-3 rounded-lg border ${
                    verificationResult.isValidManufacturer
                      ? 'bg-green-50 border-green-300'
                      : 'bg-red-50 border-red-300'
                  }`}
                >
                  <div className="flex items-center">
                    <span className="text-xl mr-2">
                      {verificationResult.isValidManufacturer ? '✅' : '❌'}
                    </span>
                    <div>
                      <h4 className="font-semibold text-sm">
                        {verificationResult.isValidManufacturer
                          ? 'Authorized Manufacturer'
                          : '⚠️ Unauthorized Manufacturer - COUNTERFEIT!'}
                      </h4>
                      {!verificationResult.isValidManufacturer && verificationResult.manufacturerAddress && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                          <p className="text-yellow-800 font-semibold mb-1">⚠️ Troubleshooting:</p>
                          <ul className="text-yellow-700 list-disc list-inside space-y-1">
                            <li>Manufacturer address: <code className="bg-yellow-100 px-1 rounded font-mono">{verificationResult.manufacturerAddress}</code></li>
                            <li>Check the browser console (F12) for detailed verification logs</li>
                            <li>Go to <a href="/admin" className="text-blue-600 underline">Admin Dashboard</a> to verify this address is authorized</li>
                            <li>If the product was created BEFORE the manufacturer was authorized, it will show as counterfeit</li>
                            <li>Verify the address matches exactly (case-sensitive checksum format)</li>
                            <li className="mt-2 font-semibold">💡 Solution: Create a new product AFTER authorizing the manufacturer</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Report Counterfeit Section - Only show if product is counterfeit */}
              {productInfo && !isProductAuthentic() && (
                <div className="p-4 rounded-lg border-2 border-red-400 bg-red-50">
                  <h3 className="font-bold text-lg text-red-800 mb-3">
                    🚨 Report Counterfeit Product
                  </h3>
                  <p className="text-sm text-red-700 mb-3">
                    This product has been identified as counterfeit. You can report it to help prevent illegal drugs from circulating.
                  </p>
                  {isReported ? (
                    <div className="p-3 bg-green-50 border border-green-300 rounded">
                      <p className="text-sm text-green-800 font-semibold">
                        ✅ This product has been reported as counterfeit. The manufacturer will be reviewed by admin.
                      </p>
                    </div>
                  ) : !isConnected ? (
                    <div className="p-3 bg-yellow-50 border border-yellow-300 rounded mb-3">
                      <p className="text-sm text-yellow-800 font-semibold mb-2">
                        ⚠️ Wallet Connection Required
                      </p>
                      <p className="text-xs text-yellow-700 mb-3">
                        Please connect your MetaMask wallet to report this counterfeit product. The report will be recorded on the blockchain.
                      </p>
                      <button
                        onClick={connect}
                        className="w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-semibold"
                      >
                        Connect MetaMask Wallet
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleReportCounterfeit}
                      disabled={isReporting}
                      className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                    >
                      {isReporting ? 'Reporting...' : '🚨 Report as Counterfeit'}
                    </button>
                  )}
                </div>
              )}

              {/* Chain of Custody Verification Badge */}
              {chainOfCustody && (
                <div
                  className={`p-3 rounded-lg border ${
                    chainOfCustody.isValid
                      ? 'bg-green-50 border-green-300'
                      : chainOfCustody.isSuspicious
                      ? 'bg-yellow-50 border-yellow-300'
                      : 'bg-red-50 border-red-300'
                  }`}
                >
                  <div className="flex items-center">
                    <span className="text-xl mr-2">
                      {chainOfCustody.isValid ? '✅' : chainOfCustody.isSuspicious ? '⚠️' : '❌'}
                    </span>
                    <h4 className="font-semibold text-sm">
                      {chainOfCustody.isValid
                        ? 'Valid Chain of Custody'
                        : chainOfCustody.isSuspicious
                        ? 'Suspicious Chain of Custody'
                        : 'Invalid Chain of Custody'}
                    </h4>
                  </div>
                  {chainOfCustody.warnings.length > 0 && (
                    <div className="mt-2 ml-7">
                      <ul className="text-xs text-red-600 list-disc list-inside">
                        {chainOfCustody.warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Location Validation Alert */}
              {locationValidation && (
                <div
                  className={`p-4 rounded-lg border ${
                    locationValidation.isValid && !locationValidation.isSuspicious
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">
                      {locationValidation.isValid && !locationValidation.isSuspicious ? '✅' : '⚠️'}
                    </span>
                    <h3 className="font-semibold">
                      {locationValidation.isValid && !locationValidation.isSuspicious
                        ? 'Location Valid'
                        : 'Location Validation Alert'}
                    </h3>
                  </div>
                  {locationValidation.warnings && locationValidation.warnings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {locationValidation.warnings.map((warning: string, idx: number) => (
                        <p key={idx} className="text-xs text-red-700">
                          • {warning}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="divide-y divide-gray-100">
                <p><strong>ID:</strong> {productInfo.productId}</p>
                <p><strong>Name:</strong> {productInfo.productName}</p>
                <p><strong>Manufacturer:</strong> {productInfo.manufacturerName}</p>
                <p><strong>Status:</strong> {productInfo.status}</p>
                <p><strong>Owner:</strong> {shortAddr(productInfo.currentOwner)}</p>
                {(() => {
                  // Show live date-time if createdAt is missing or invalid; fallback to first history or now
                  const primary = parseDate(productInfo.createdAt);
                  const historyFirst = productInfo.history && productInfo.history.length > 0
                    ? parseDate(productInfo.history[0].timestamp)
                    : null;
                  const dt = primary || historyFirst || new Date();
                  return <p><strong>Created:</strong> {dt.toLocaleString()}</p>;
                })()}
                {productInfo.batchNumber && (
                  <p><strong>Batch/Lot Number:</strong> {productInfo.batchNumber}</p>
                )}
                {(() => {
                  if (!productInfo.expiryDate) {
                    return <p><strong>Expiry Date:</strong> <span className="text-gray-500">Not available</span></p>;
                  }
                  const expiryDate = parseDate(productInfo.expiryDate);
                  if (!expiryDate) {
                    return <p><strong>Expiry Date:</strong> <span className="text-gray-500">N/A</span></p>;
                  }
                  const isExpired = expiryDate.getTime() < Date.now();
                  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <p>
                      <strong>Expiry Date:</strong>{' '}
                      <span className={isExpired ? 'text-red-600 font-semibold' : daysUntilExpiry <= 30 ? 'text-orange-600 font-semibold' : 'text-gray-700'}>
                        {expiryDate.toLocaleDateString()}
                        {isExpired && ' ⚠️ EXPIRED'}
                        {!isExpired && daysUntilExpiry <= 30 && ` (Expires in ${daysUntilExpiry} days)`}
                      </span>
                    </p>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">🔍 Scan or enter a product ID</div>
          )}
        </div>
      </div>

      {productInfo && productInfo.history.length > 0 && (
        <div className="mt-8 card">
          <h2 className="text-xl font-semibold mb-6">Product History</h2>
          <div className="space-y-4">
            {productInfo.history.map((entry, i) => {
              // Extract location for this history entry
              const isValidCoordinate = (coord: number | null | undefined): boolean => {
                if (coord === null || coord === undefined) return false;
                const num = Number(coord);
                return num !== 0 && !isNaN(num) && isFinite(num);
              };
              
              const isValidLatitude = (lat: number | null | undefined): boolean => {
                if (!isValidCoordinate(lat)) return false;
                const num = Number(lat);
                return num >= -90 && num <= 90;
              };
              
              const isValidLongitude = (lng: number | null | undefined): boolean => {
                if (!isValidCoordinate(lng)) return false;
                const num = Number(lng);
                return num >= -180 && num <= 180;
              };
              
              let entryLocation: { lat: number; lng: number } | null = null;
              
              // First try to get location from latitude/longitude fields (from blockchain event)
              if (entry.latitude !== null && entry.latitude !== undefined && 
                  entry.longitude !== null && entry.longitude !== undefined) {
                const lat = typeof entry.latitude === 'number' ? entry.latitude : parseFloat(entry.latitude);
                const lng = typeof entry.longitude === 'number' ? entry.longitude : parseFloat(entry.longitude);
                if (!isNaN(lat) && !isNaN(lng) && isValidLatitude(lat) && isValidLongitude(lng)) {
                  entryLocation = { lat, lng };
                }
              }
              
              // Fallback: try to parse from location string
              if (!entryLocation && entry.location) {
                const match = entry.location.match(/Lat:\s*([\d.-]+),\s*Lon:\s*([\d.-]+)/);
                if (match) {
                  const lat = parseFloat(match[1]);
                  const lng = parseFloat(match[2]);
                  if (isValidLatitude(lat) && isValidLongitude(lng)) {
                    entryLocation = { lat, lng };
                  }
                }
              }
              
              // Validate location against authorized zones for this entry
              // IMPORTANT: For OwnershipTransferred events, validate against the FROM owner (who entered the location)
              // For other events, validate against the current owner
              // Note: We'll use pre-loaded authorized locations or fetch them separately
              let entryLocationValidation: any = null;
              if (entryLocation) {
                try {
                  // Determine which participant's authorized zones to check
                  let participantToValidate: string | null = null;
                  
                  // CRITICAL: The participant who ENTERED the location should be validated
                  // - ProductCreated: Manufacturer entered the location → validate against Manufacturer
                  // - OwnershipTransferred: FROM owner entered the location → validate against FROM owner
                  // - StatusUpdated: Current owner entered the location → validate against Current owner
                  
                  if (entry.type === 'ProductCreated') {
                    // For product creation, validate against manufacturer (who created and entered the location)
                    // The manufacturer is the owner of the ProductCreated event (first owner in history)
                    const manufacturerAddr = entry.owner;
                    if (manufacturerAddr && manufacturerAddr !== 'Unknown' && manufacturerAddr.trim() !== '') {
                      participantToValidate = manufacturerAddr;
                      console.log(`🔍 ProductCreated: Validating against manufacturer (who created product): ${participantToValidate}`);
                    } else {
                      console.warn(`⚠️ ProductCreated event missing manufacturer address. Cannot validate location.`);
                      participantToValidate = null;
                    }
                  } else if (entry.type === 'OwnershipTransferred') {
                    // For ownership transfers, validate against FROM owner (who entered the location during transfer)
                    // Example: Manufacturer → Distributor: validate against Manufacturer's authorized location (Mangalore)
                    // Example: Distributor → Delivery Hub: validate against Distributor's authorized location (Kochi)
                    if (entry.from && entry.from !== 'Unknown' && entry.from.trim() !== '') {
                      participantToValidate = entry.from;
                      console.log(`🔍 OwnershipTransferred: Validating location against FROM owner (manufacturer who entered location during transfer): ${participantToValidate}`);
                    } else {
                      // Fallback: Try to infer from previous history entry
                      // During rendering, use productInfo.history; during initial fetch, use history array
                      const historyArray = productInfo?.history || [];
                      const entryIndex = historyArray.findIndex((e, idx) => {
                        // Find entry by comparing timestamps, actions, and hashes
                        return e.timestamp === entry.timestamp && 
                               e.action === entry.action && 
                               (e.hash === entry.hash || e.owner === entry.owner);
                      });
                      
                      if (entryIndex > 0) {
                        const prevEntry = historyArray[entryIndex - 1];
                        if (prevEntry && prevEntry.owner) {
                          participantToValidate = prevEntry.owner;
                          console.log(`🔍 OwnershipTransferred: Inferred FROM owner from previous entry (fallback): ${participantToValidate}`);
                        } else {
                          // Try manufacturer address from product data
                          const manufacturerAddr = productInfo?.manufacturerName ? 
                            (productInfo as any).manufacturerAddress || 
                            (historyArray.length > 0 ? historyArray[0].owner : null) : null;
                          if (manufacturerAddr) {
                            participantToValidate = manufacturerAddr;
                            console.log(`🔍 OwnershipTransferred: Using manufacturer address as FROM (fallback): ${participantToValidate}`);
                          } else {
                            console.error(`❌ OwnershipTransferred: Cannot determine FROM owner. entry.from="${entry.from}", previous owner="${prevEntry?.owner}"`);
                            participantToValidate = null;
                          }
                        }
                      } else {
                        // First transfer - from should be manufacturer (first entry's owner)
                        const manufacturerAddr = historyArray.length > 0 ? historyArray[0].owner : null;
                        if (manufacturerAddr && manufacturerAddr !== 'Unknown') {
                          participantToValidate = manufacturerAddr;
                          console.log(`🔍 OwnershipTransferred: Using first entry owner as FROM (first transfer): ${participantToValidate}`);
                        } else {
                          console.error(`❌ OwnershipTransferred: Cannot determine FROM owner for first transfer. History length: ${historyArray.length}`);
                          participantToValidate = null;
                        }
                      }
                    }
                  } else if (entry.type === 'StatusUpdated' && entry.owner) {
                    // For status updates, validate against current owner (who updated status and entered location)
                    // Example: Delivery Hub updates status: validate against Delivery Hub
                    participantToValidate = entry.owner;
                    console.log(`🔍 StatusUpdated: Validating against current owner (who updated status): ${participantToValidate}`);
                  } else if (entry.owner) {
                    // Fallback: use the current owner
                    participantToValidate = entry.owner;
                    console.log(`🔍 ${entry.type || 'Unknown'}: Validating against current owner (fallback): ${participantToValidate}`);
                  }
                  
                  // Use pre-loaded authorized locations if they match the participant
                  if (participantToValidate && authorizedLocations.length > 0) {
                    const participantAuthLocs = authorizedLocations.filter(
                      (loc) => loc.participant?.toLowerCase() === participantToValidate?.toLowerCase()
                    );
                    
                    console.log(`🔍 Validating location for ${entry.type} entry:`, {
                      entryAction: entry.action,
                      participantToValidate: participantToValidate,
                      participantAuthLocsCount: participantAuthLocs.length,
                      authorizedLocationNames: participantAuthLocs.map(loc => loc.locationName),
                      enteredLocation: { lat: entryLocation.lat, lng: entryLocation.lng }
                    });
                    
                    if (participantAuthLocs.length > 0) {
                      entryLocationValidation = validateLocationAgainstAuthorizedZones(
                        entryLocation.lat,
                        entryLocation.lng,
                        participantToValidate,
                        participantAuthLocs
                      );
                      
                      console.log(`🔍 Validating ${entry.type} entry location:`, {
                        entryType: entry.type,
                        entryAction: entry.action,
                        location: { lat: entryLocation.lat, lng: entryLocation.lng },
                        participantToValidate: participantToValidate,
                        participantAuthLocsCount: participantAuthLocs.length,
                        authorizedLocations: participantAuthLocs.map(loc => ({
                          name: loc.locationName,
                          lat: loc.latitude,
                          lng: loc.longitude,
                          radius: loc.radius
                        })),
                        validationResult: {
                          isValid: entryLocationValidation.isValid,
                          isSuspicious: entryLocationValidation.isSuspicious,
                          distance: entryLocationValidation.distanceFromExpected ? `${(entryLocationValidation.distanceFromExpected / 1000).toFixed(2)} km` : 'N/A'
                        }
                      });
                    } else {
                      console.warn(`⚠️ No authorized locations found for participant ${participantToValidate} (entry type: ${entry.type})`);
                    }
                  }
                } catch (error) {
                  console.warn('Failed to validate location for history entry:', error);
                }
              }
              
              return (
                <div key={i} className={`p-4 rounded-lg border ${
                  entryLocationValidation && !entryLocationValidation.isValid && entryLocationValidation.isSuspicious
                    ? 'bg-red-50 border-red-300 border-2' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 flex items-center justify-center bg-primary-100 rounded-full font-semibold text-primary-600 flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col md:flex-row md:items-start md:gap-6">
                        <div className="md:w-64 w-full mb-4 md:mb-0">
                          {entryLocation ? (
                            <div className="space-y-3">
                              <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Location</p>
                                <p className="text-sm font-mono text-gray-800">
                                  Lat: {entryLocation.lat.toFixed(6)}
                                </p>
                                <p className="text-sm font-mono text-gray-800">
                                  Lng: {entryLocation.lng.toFixed(6)}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">
                                  Recorded during: {entry.action}
                                </p>
                              </div>
                              <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <LocationMap
                                  location={{ 
                                    lat: entryLocation.lat, 
                                    lng: entryLocation.lng, 
                                    name: entry.action 
                                  }}
                                  height="200px"
                                  zoom={15}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500">
                              Location data not available
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-2">
                            <div>
                              <span className="font-medium text-lg">{entry.action}</span>
                              <p className="text-xs text-gray-500 mt-1">{formatDate(entry.timestamp)}</p>
                            </div>
                            <div className="flex flex-col sm:items-end gap-1">
                              <span className="inline-flex items-center px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded">
                                Status: {entry.status}
                              </span>
                              <span className="text-xs text-gray-500">
                                Owner: {shortAddr(entry.owner)}
                              </span>
                            </div>
                          </div>

                          {/* Counterfeit Warning */}
                          {entryLocationValidation && !entryLocationValidation.isValid && entryLocationValidation.isSuspicious && (
                            <div className="mt-2 mb-3 p-3 bg-red-100 border-2 border-red-400 rounded-lg">
                              <div className="flex items-start">
                                <span className="text-2xl mr-2">🚨</span>
                                <div className="flex-1">
                                  <h4 className="font-bold text-red-900 mb-1">⚠️ LOCATION MISMATCH WARNING</h4>
                                  <p className="text-sm text-red-800 mb-2">
                                    {entry.type === 'ProductCreated'
                                      ? `Location entered by manufacturer ${shortAddr(entry.owner)} does NOT match their authorized zones!`
                                      : entry.type === 'OwnershipTransferred' && entry.from
                                      ? `Location entered by ${shortAddr(entry.from)} (previous owner) during transfer does NOT match their authorized zones!`
                                      : entry.type === 'StatusUpdated'
                                      ? `Location entered by ${shortAddr(entry.owner)} (current owner) does NOT match their authorized zones!`
                                      : `Location entered during this transaction does NOT match authorized zones!`}
                                  </p>
                                  {entryLocationValidation.warnings && entryLocationValidation.warnings.length > 0 && (
                                    <div className="space-y-1 mb-2">
                                      {entryLocationValidation.warnings.map((warning: string, idx: number) => (
                                        <p key={idx} className="text-xs text-red-700">
                                          • {warning}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  {entryLocationValidation.expectedLocation && (
                                    <p className="text-xs text-red-600 mt-2">
                                      <strong>Expected location:</strong> {entryLocationValidation.expectedLocation.locationName || entryLocationValidation.expectedLocation.name} 
                                      ({entryLocationValidation.expectedLocation.latitude.toFixed(4)}, {entryLocationValidation.expectedLocation.longitude.toFixed(4)})
                                    </p>
                                  )}
                                  {entryLocationValidation.distanceFromExpected && (
                                    <p className="text-xs text-red-600">
                                      <strong>Distance from authorized zone:</strong> {(entryLocationValidation.distanceFromExpected / 1000).toFixed(2)} km
                                    </p>
                                  )}
                                  {entryLocation && (
                                    <p className="text-xs text-red-600 mt-1">
                                      <strong>Actual location:</strong> ({entryLocation.lat.toFixed(4)}, {entryLocation.lng.toFixed(4)})
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Location Valid Indicator */}
                          {entryLocationValidation && entryLocationValidation.isValid && !entryLocationValidation.isSuspicious && (
                            <div className="mt-2 mb-3 p-2 bg-green-100 border border-green-300 rounded-lg">
                              <p className="text-xs text-green-800">
                                ✅ Location verified: Matches authorized zone
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                          <strong>Owner:</strong> {shortAddr(entry.owner)}
                        </p>
                        {entry.hash && entry.hash !== 'N/A' ? (
                          <a
                            href={getEtherscanTxLink(entry.hash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-xs font-mono truncate underline mt-1 inline-block"
                            title={entry.hash}
                          >
                            View Transaction: {entry.hash.substring(0, 10)}...
                          </a>
                        ) : (
                          <p className="text-xs text-gray-400 font-mono truncate mt-1">
                            Tx: {entry.hash || 'N/A'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;
