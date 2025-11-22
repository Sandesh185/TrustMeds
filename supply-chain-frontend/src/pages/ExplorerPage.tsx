import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { getProduct } from '../utils/productStorage';
import { blockchainService, NETWORK_CONFIG } from '../utils/blockchain';
import LocationMap from '../components/LocationMap';
import { 
  validateLocationAgainstAuthorizedZones, 
  type LocationValidationResult,
  type AuthorizedLocation 
} from '../utils/locationValidation';

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
  latitude?: number | null;
  longitude?: number | null;
  // Optional fields used in UI
  batchNumber?: string;
  expiryDate?: string | number | null;
}

const ExplorerPage = () => {
  const [searchId, setSearchId] = useState('');
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name?: string } | null>(null);
  const [showLocationMap, setShowLocationMap] = useState(false);
  const [locationValidation, setLocationValidation] = useState<LocationValidationResult | null>(null);
  const [authorizedLocations, setAuthorizedLocations] = useState<AuthorizedLocation[]>([]);
  
  // Debug: View all stored products
  const viewAllStoredProducts = () => {
    const allProducts = JSON.parse(localStorage.getItem('drug_supply_chain_products') || '[]');
    console.log('All stored products:', allProducts);
    alert(`Found ${allProducts.length} products in storage:\n\n${allProducts.map((p: any) => `ID: ${p.productId}\nName: ${p.productName}\nManufacturer: ${p.manufacturerName}`).join('\n\n')}`);
  };

  // Helper function to format location
  const formatLocation = (product: any): string => {
    if (product.location) {
      return product.location;
    }
    const latRaw = product?.latitude;
    const lngRaw = product?.longitude;
    if (latRaw !== undefined && latRaw !== null && lngRaw !== undefined && lngRaw !== null) {
      const lat = typeof latRaw === 'number' ? latRaw : parseFloat(String(latRaw));
      const lng = typeof lngRaw === 'number' ? lngRaw : parseFloat(String(lngRaw));
      if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
        return `Lat: ${lat.toFixed(4)}, Lon: ${lng.toFixed(4)}`;
      }
    }
    return 'N/A';
  };

  const searchProduct = async (productId: string) => {
    if (!productId.trim()) {
      toast.error('Please enter a product ID');
      return;
    }

    setIsLoading(true);
    const cleanId = productId.trim();
    
    try {
      // 1️⃣ Try fetching from blockchain first
      let blockchainProduct = null;
      try {
        blockchainProduct = await blockchainService.getProduct(cleanId);
      } catch (error: any) {
        // Product might not exist on blockchain, that's okay - try localStorage
        console.log('Product not found on blockchain, checking localStorage:', error?.message);
      }

      let productData: ProductInfo | null = null;

      // If product exists on blockchain, use that data
      if (blockchainProduct && blockchainProduct.exists) {
        // Get complete transaction history from blockchain events
        let history: ProductHistory[] = [];
        const locationStr = formatLocation(blockchainProduct);
        
        try {
          // First try to get complete transaction history from events
          const transactionHistory = await blockchainService.getProductTransactionHistory(cleanId);
          
          if (transactionHistory && transactionHistory.length > 0) {
            // Use event-based history (has actual transaction hashes)
            history = transactionHistory.map((tx: any) => {
              // Build location string from latitude/longitude if available
              let locationStrForEntry = locationStr;
              if (tx.latitude !== null && tx.latitude !== undefined && tx.longitude !== null && tx.longitude !== undefined) {
                const lat = typeof tx.latitude === 'number' ? tx.latitude : parseFloat(tx.latitude);
                const lon = typeof tx.longitude === 'number' ? tx.longitude : parseFloat(tx.longitude);
                if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
                  locationStrForEntry = `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`;
                }
              }
              
              return {
                timestamp: new Date(tx.timestamp).toISOString(),
                action: tx.action || tx.type,
                owner: tx.owner || tx.to || blockchainProduct.currentOwner,
                status: tx.status || blockchainProduct.status,
                location: locationStrForEntry,
                hash: tx.hash || 'N/A',
                latitude: tx.latitude,
                longitude: tx.longitude,
                type: tx.type, // Include type for validation
                from: tx.from // Include from for OwnershipTransferred events
              };
            });
          } else {
            // Fallback to ownership transfers if events not available
            const transfers = await blockchainService.getOwnershipTransfers(cleanId);
            if (transfers && transfers.length > 0) {
              history = transfers.map((transfer: any, index: number) => ({
                timestamp: new Date(Number(transfer.timestamp) * 1000).toISOString(),
                action: index === 0 ? 'Product Created' : 'Ownership Transferred',
                owner: transfer.to,
                status: transfer.status,
                location: locationStr,
                hash: transfer.hash || 'N/A'
              }));
            } else {
              // No history found, create initial entry
              history = [{
                timestamp: blockchainProduct.createdAt,
                action: 'Product Created',
                owner: blockchainProduct.currentOwner,
                status: blockchainProduct.status,
                location: locationStr,
                hash: 'N/A'
              }];
            }
          }
        } catch (historyError: any) {
          console.warn('Could not fetch product history:', historyError);
          // Fallback: create initial history entry
          history = [{
            timestamp: blockchainProduct.createdAt,
            action: 'Product Created',
            owner: blockchainProduct.currentOwner,
            status: blockchainProduct.status,
            location: locationStr,
            hash: 'N/A'
          }];
        }

        // Extract location coordinates from blockchain product and validate
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

        productData = {
          productId: cleanId,
          manufacturerName: blockchainProduct.manufacturerName || 'Unknown',
          productName: blockchainProduct.productName,
          productCode: blockchainProduct.productCode || 'N/A',
          category: blockchainProduct.category || 'General',
          price: Number(blockchainProduct.price) || 0,
          currentOwner: blockchainProduct.currentOwner || 'Unknown',
          status: blockchainProduct.status,
          createdAt: blockchainProduct.createdAt || (history[0]?.timestamp ?? new Date().toISOString()),
          expiryDate: blockchainProduct.expiryDate || null,
          isAuthentic: true,
          history,
          latitude: productLat,
          longitude: productLng,
        };

        // Load authorized locations for ALL participants in the history
        // This is needed to validate locations for OwnershipTransferred events (which use FROM owner)
        try {
          // Extract all unique participant addresses from history
          const allParticipants = new Set<string>();
          
          // Add current owner
          if (blockchainProduct.currentOwner) {
            allParticipants.add(blockchainProduct.currentOwner.toLowerCase());
          }
          
          // Add all owners and FROM addresses from history
          history.forEach((entry: any) => {
            if (entry.owner) {
              allParticipants.add(entry.owner.toLowerCase());
            }
            if (entry.from) {
              allParticipants.add(entry.from.toLowerCase());
            }
          });
          
          console.log('📋 Loading authorized locations for participants:', Array.from(allParticipants));
          
          // Load authorized locations for all participants
          const allAuthLocs: AuthorizedLocation[] = [];
          for (const participant of allParticipants) {
            try {
              const authLocs = await blockchainService.getAuthorizedLocations(participant);
              const formatted = (authLocs || []).map((loc: any) => ({
                participant: loc.participant,
                locationName: loc.locationName,
                latitude: typeof loc.latitude === 'number' ? loc.latitude : parseFloat(String(loc.latitude)),
                longitude: typeof loc.longitude === 'number' ? loc.longitude : parseFloat(String(loc.longitude)),
                radius: typeof loc.radius === 'number' ? loc.radius : parseFloat(String(loc.radius)),
                registeredAt: loc.registeredAt,
              }));
              allAuthLocs.push(...formatted);
              console.log(`✅ Loaded ${formatted.length} authorized locations for ${participant.slice(0, 10)}...`);
            } catch (error: any) {
              console.warn(`⚠️ Failed to load authorized locations for ${participant}:`, error?.message);
            }
          }
          
          setAuthorizedLocations(allAuthLocs);
          console.log(`✅ Total authorized locations loaded: ${allAuthLocs.length}`);

          // CRITICAL: Validate ALL locations in history, not just the current one
          // If ANY location in the product's journey was unauthorized, the product is suspicious
          let hasInvalidLocation = false;
          let validationWarnings: string[] = [];
          
          // Validate each history entry's location
          for (const entry of history) {
            let entryLocation: { lat: number; lng: number } | null = null;
            
            // Get location from entry
            if (entry.latitude !== null && entry.latitude !== undefined && 
                entry.longitude !== null && entry.longitude !== undefined) {
              const lat = typeof entry.latitude === 'number' ? entry.latitude : parseFloat(entry.latitude);
              const lng = typeof entry.longitude === 'number' ? entry.longitude : parseFloat(entry.longitude);
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
              let participantToValidate: string | null = null;
              
              if (entry.type === 'OwnershipTransferred' && entry.from) {
                // For ownership transfers, validate against FROM owner (who entered the location)
                participantToValidate = entry.from;
              } else if (entry.owner) {
                // For other events, use the current owner
                participantToValidate = entry.owner;
              }
              
              if (participantToValidate) {
                const participantAuthLocs = allAuthLocs.filter(
                  (loc) => loc.participant?.toLowerCase() === participantToValidate?.toLowerCase()
                );
                
                if (participantAuthLocs.length > 0) {
                  const validation = validateLocationAgainstAuthorizedZones(
                    entryLocation.lat,
                    entryLocation.lng,
                    participantToValidate,
                    participantAuthLocs
                  );
                  
                  // If this location is invalid, mark the entire product as suspicious
                  if (!validation.isValid && validation.isSuspicious) {
                    hasInvalidLocation = true;
                    validationWarnings.push(
                      `${entry.action} (${new Date(entry.timestamp).toLocaleDateString()}): Location mismatch - ${validation.warnings[0] || 'Outside authorized zones'}`
                    );
                    console.log(`🚨 Invalid location detected in history: ${entry.action} at (${entryLocation.lat}, ${entryLocation.lng})`);
                  }
                } else {
                  console.warn(`⚠️ No authorized locations found for participant ${participantToValidate} for entry: ${entry.action}`);
                }
              }
            }
          }
          
          // Set overall validation result based on ALL history locations
          if (hasInvalidLocation) {
            setLocationValidation({
              isValid: false,
              isSuspicious: true,
              warnings: validationWarnings,
              actualLocation: {
                latitude: productLat ?? 0,
                longitude: productLng ?? 0
              }
            });
          } else if (productLat !== null && productLng !== null && blockchainProduct.currentOwner) {
            // If all history locations are valid, also validate current location
            const currentOwnerAuthLocs = allAuthLocs.filter(
              (loc) => loc.participant?.toLowerCase() === blockchainProduct.currentOwner?.toLowerCase()
            );
            
            const validation = validateLocationAgainstAuthorizedZones(
              productLat,
              productLng,
              blockchainProduct.currentOwner,
              currentOwnerAuthLocs
            );
            setLocationValidation(validation);
          }
        } catch (error: any) {
          console.error('Failed to load authorized locations:', error);
          // Don't show error to user, just log it
        }
      } else {
        // 2️⃣ Fallback to localStorage if not on blockchain
        const storedProduct = getProduct(cleanId);
        
        if (!storedProduct) {
          setProductInfo(null);
          toast.error(`Product "${cleanId}" not found in blockchain.`);
          return;
        }
        
        const locationStr = formatLocation(storedProduct);
        
        // Convert stored product to ProductInfo format
        productData = {
          productId: storedProduct.productId,
          manufacturerName: storedProduct.manufacturerName,
          productName: storedProduct.productName,
          productCode: storedProduct.productCode,
          category: storedProduct.category,
          price: storedProduct.price,
          currentOwner: storedProduct.owner,
          status: storedProduct.status,
          createdAt: storedProduct.createdAt || (storedProduct.history?.[0]?.timestamp ?? new Date().toISOString()),
          expiryDate: storedProduct.expiryDate || null,
          batchNumber: storedProduct.batchNumber || '',
          isAuthentic: true,
          history: storedProduct.history && storedProduct.history.length > 0
            ? storedProduct.history.map((tx: any) => ({
                timestamp: tx.timestamp,
                action: tx.action,
                owner: tx.to, // Current owner after transaction
                status: tx.status,
                location: tx.location || locationStr,
                hash: tx.txHash
              }))
            : [
                {
                  timestamp: storedProduct.createdAt,
                  action: 'Product Created',
                  owner: storedProduct.owner,
                  status: storedProduct.status,
                  location: locationStr,
                  hash: storedProduct.txHash || 'N/A'
                }
              ]
        };
      }
      
      if (productData) {
        setProductInfo(productData);
        toast.success('Product information retrieved successfully!');
      }
      
    } catch (error: any) {
      console.error('Error fetching product info:', error);
      toast.error(error?.message || 'Failed to fetch product information');
    } finally {
      setIsLoading(false);
    }
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
      const dayFirst = s.match(/^([0-3]?\d)[-\/](0?\d|1[0-2])[-\/]((?:19|20)?\d{2})$/);
      if (dayFirst) {
        const day = Number(dayFirst[1]);
        const month = Number(dayFirst[2]);
        let year = Number(dayFirst[3]);
        if (year < 100) year += 2000;
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

  const formatAddress = (address: string | undefined | null) => {
    if (!address) return 'Unknown';
    if (typeof address !== 'string') return 'Invalid';
    if (address.length < 10) return address; // Too short to format
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Helper to create Etherscan link for transaction hash
  const getEtherscanTxLink = (txHash: string): string => {
    if (!txHash || txHash === 'N/A') return '#';
    const explorerUrl = NETWORK_CONFIG.blockExplorerUrls[0] || 'https://sepolia.etherscan.io';
    return `${explorerUrl}/tx/${txHash}`;
  };

  // Helper to create Etherscan link for address
  const getEtherscanAddressLink = (address: string): string => {
    if (!address) return '#';
    const explorerUrl = NETWORK_CONFIG.blockExplorerUrls[0] || 'https://sepolia.etherscan.io';
    return `${explorerUrl}/address/${address}`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Blockchain Explorer</h1>
        <p className="text-gray-600">
          Search for products and view their complete blockchain history and authenticity.
        </p>
        <button 
          onClick={viewAllStoredProducts}
          className="text-sm text-blue-600 hover:text-blue-800 mt-2"
        >
          Debug: View All Stored Products
        </button>
      </div>

      {/* Search Section */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold mb-6">Search Product</h2>
        
        <div className="flex gap-4">
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            className="input-field flex-1"
            placeholder="Enter product ID to search blockchain history"
            onKeyPress={(e) => e.key === 'Enter' && searchProduct(searchId)}
          />
          <button
            onClick={() => searchProduct(searchId)}
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Product Information */}
      {productInfo && (
        <div className="space-y-8">
          {/* Product Overview */}
          <div className="card">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {productInfo.productName}
                </h2>
                <p className="text-gray-600">
                  Product ID: {productInfo.productId}
                </p>
              </div>
              
              {/* Authenticity Status */}
              <div className={`p-4 rounded-lg ${
                productInfo.isAuthentic 
                  ? 'bg-success-50 border border-success-200' 
                  : 'bg-danger-50 border border-danger-200'
              }`}>
                <div className="flex items-center">
                  <span className={`text-2xl mr-2 ${
                    productInfo.isAuthentic ? 'text-success-600' : 'text-danger-600'
                  }`}>
                    {productInfo.isAuthentic ? '✅' : '❌'}
                  </span>
                  <div>
                    <h3 className={`font-semibold ${
                      productInfo.isAuthentic ? 'text-success-800' : 'text-danger-800'
                    }`}>
                      {productInfo.isAuthentic ? 'Authentic' : 'Tampered'}
                    </h3>
                    <p className={`text-sm ${
                      productInfo.isAuthentic ? 'text-success-700' : 'text-danger-700'
                    }`}>
                      Blockchain Verified
                    </p>
                  </div>
                </div>
              </div>

              {/* Location Validation Alert */}
              {locationValidation && (
                <div className={`p-4 rounded-lg border ${
                  locationValidation.isValid && !locationValidation.isSuspicious
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start">
                    <span className="text-2xl mr-2">
                      {locationValidation.isValid && !locationValidation.isSuspicious ? '✅' : '⚠️'}
                    </span>
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {locationValidation.isValid && !locationValidation.isSuspicious
                          ? 'Location Valid'
                          : 'Location Validation Alert'}
                      </h3>
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
                  </div>
                </div>
              )}
            </div>

            {/* Product Details Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Product Information</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Manufacturer:</span>
                    <p className="text-sm text-gray-900">{productInfo.manufacturerName}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Product Code:</span>
                    <p className="text-sm text-gray-900">{productInfo.productCode}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Category:</span>
                    <p className="text-sm text-gray-900">{productInfo.category}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Price:</span>
                    <p className="text-sm text-gray-900">{productInfo.price} ETH</p>
                  </div>
                  {productInfo.batchNumber && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Batch/Lot Number:</span>
                      <p className="text-sm text-gray-900">{productInfo.batchNumber}</p>
                    </div>
                  )}
                  {(() => {
                    const raw = productInfo.expiryDate;
                    if (!raw) {
                      return (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Expiry Date:</span>
                          <p className="text-sm text-gray-500">Not available</p>
                        </div>
                      );
                    }
                    const expiryDate = parseDate(raw);
                    if (!expiryDate) {
                      return (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Expiry Date:</span>
                          <p className="text-sm text-gray-900">N/A</p>
                        </div>
                      );
                    }
                    const isExpired = expiryDate.getTime() < Date.now();
                    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div>
                        <span className="text-sm font-medium text-gray-700">Expiry Date:</span>
                        <p className={`text-sm ${isExpired ? 'text-red-600 font-semibold' : daysUntilExpiry <= 30 ? 'text-orange-600 font-semibold' : 'text-gray-900'}`}>
                          {expiryDate.toLocaleDateString()} {expiryDate.toLocaleTimeString()}
                          {isExpired && ' ⚠️ EXPIRED'}
                          {!isExpired && daysUntilExpiry <= 30 && ` (Expires in ${daysUntilExpiry} days)`}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Current Status</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Status:</span>
                    <p className="text-sm text-gray-900">{productInfo.status}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Current Owner:</span>
                    <p className="text-sm text-gray-900 font-mono">
                      {formatAddress(productInfo.currentOwner)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Created:</span>
                    <p className="text-sm text-gray-900">
                      {formatDate(productInfo.createdAt || productInfo.history[0]?.timestamp || Date.now())}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Blockchain Info</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Chain:</span>
                    <p className="text-sm text-gray-900">Ethereum Mainnet</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Transactions:</span>
                    <p className="text-sm text-gray-900">{productInfo.history.length}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Last Updated:</span>
                    <p className="text-sm text-gray-900">
                      {formatDate(productInfo.history[productInfo.history.length - 1]?.timestamp || productInfo.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Location Map Display */}
          {(() => {
            // Helper function to validate real-world coordinates
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
            
            let locationData: { lat: number; lng: number; name?: string } | null = null;
            
            // Validate coordinates from productInfo
            if (isValidLatitude(productInfo.latitude) && isValidLongitude(productInfo.longitude)) {
              locationData = {
                lat: Number(productInfo.latitude),
                lng: Number(productInfo.longitude),
                name: productInfo.productName,
              };
            } else {
              // Fallback to stored product (validate coordinates)
              const storedProduct = getProduct(productInfo.productId);
              if (storedProduct && 
                  isValidLatitude(storedProduct.latitude) && 
                  isValidLongitude(storedProduct.longitude)) {
                locationData = {
                  lat: Number(storedProduct.latitude),
                  lng: Number(storedProduct.longitude),
                  name: storedProduct.location || productInfo.productName,
                };
              } else if (productInfo.history && productInfo.history.length > 0) {
                // Validate parsed coordinates from history
                const firstEntry = productInfo.history[0];
                if (firstEntry.location) {
                  const match = firstEntry.location.match(/Lat:\s*([\d.-]+),\s*Lon:\s*([\d.-]+)/);
                  if (match) {
                    const lat = parseFloat(match[1]);
                    const lng = parseFloat(match[2]);
                    if (isValidLatitude(lat) && isValidLongitude(lng)) {
                      locationData = {
                        lat,
                        lng,
                        name: productInfo.productName,
                      };
                    }
                  }
                }
              }
            }

            if (locationData) {
              // Function to get color based on action/status type
              const getColorForAction = (action: string, status: string): string => {
                const actionLower = action.toLowerCase();
                const statusLower = status.toLowerCase();
                
                // Product Created
                if (actionLower.includes('created') || actionLower.includes('manufactured')) {
                  return '#3b82f6'; // Blue
                }
                
                // Ownership Transferred
                if (actionLower.includes('ownership transferred') || actionLower.includes('transferred')) {
                  if (statusLower.includes('distributor')) {
                    return '#8b5cf6'; // Purple
                  }
                  if (statusLower.includes('delivery hub') || statusLower.includes('delivery')) {
                    return '#ec4899'; // Pink
                  }
                  return '#a855f7'; // Purple variant
                }
                
                // Status Updated
                if (actionLower.includes('status updated') || actionLower.includes('updated')) {
                  if (statusLower.includes('transit') || statusLower.includes('in transit')) {
                    return '#f59e0b'; // Amber/Orange
                  }
                  if (statusLower.includes('warehouse') || statusLower.includes('at warehouse')) {
                    return '#10b981'; // Green
                  }
                  if (statusLower.includes('preparing')) {
                    return '#06b6d4'; // Cyan
                  }
                  return '#6366f1'; // Indigo (default for status updates)
                }
                
                // Default colors for other statuses
                if (statusLower.includes('delivered') || statusLower.includes('delivery')) {
                  return '#14b8a6'; // Teal
                }
                
                // Default fallback color
                return '#6b7280'; // Gray
              };
              
              const locationHistory = productInfo.history
                .map(entry => {
                  // First try to get location from latitude/longitude fields if available
                  if (entry.latitude !== null && entry.latitude !== undefined && 
                      entry.longitude !== null && entry.longitude !== undefined) {
                    const lat = typeof entry.latitude === 'number' ? entry.latitude : parseFloat(entry.latitude);
                    const lng = typeof entry.longitude === 'number' ? entry.longitude : parseFloat(entry.longitude);
                    if (!isNaN(lat) && !isNaN(lng) && isValidLatitude(lat) && isValidLongitude(lng)) {
                      return {
                        lat,
                        lng,
                        name: entry.action,
                        productId: productInfo.productId,
                        timestamp: entry.timestamp,
                        color: getColorForAction(entry.action, entry.status),
                      };
                    }
                  }
                  
                  // Fallback: try to parse from location string
                  if (entry.location) {
                    const match = entry.location.match(/Lat:\s*([\d.-]+),\s*Lon:\s*([\d.-]+)/);
                    if (match) {
                      const lat = parseFloat(match[1]);
                      const lng = parseFloat(match[2]);
                      // Only include if coordinates are valid
                      if (isValidLatitude(lat) && isValidLongitude(lng)) {
                        return {
                          lat,
                          lng,
                          name: entry.action,
                          productId: productInfo.productId,
                          timestamp: entry.timestamp,
                          color: getColorForAction(entry.action, entry.status),
                        };
                      }
                    }
                  }
                  
                  return null;
                })
                .filter((loc): loc is NonNullable<typeof loc> => loc !== null);

              return (
                <div className="card" data-location-map>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">📍 Product Location</h2>
                    <button
                      onClick={() => setShowLocationMap(!showLocationMap)}
                      className="btn-secondary text-sm"
                    >
                      {showLocationMap ? 'Hide Map' : 'Show Map'}
                    </button>
                  </div>
                  {showLocationMap && (
                    <LocationMap
                      location={selectedLocation || locationData}
                      multipleLocations={locationHistory.length > 1 ? locationHistory : []}
                      height="500px"
                      zoom={locationHistory.length > 1 ? 10 : 15}
                    />
                  )}
                  {!showLocationMap && (
                    <div className="p-4 bg-gray-50 rounded">
                      <p className="text-sm text-gray-600">
                        📍 Location: <span className="font-mono">{locationData.lat.toFixed(6)}, {locationData.lng.toFixed(6)}</span>
                      </p>
                      <button
                        onClick={() => setShowLocationMap(true)}
                        className="text-sm text-blue-600 hover:text-blue-800 mt-2"
                      >
                        Click to view on map →
                      </button>
                    </div>
                  )}
                  {locationHistory.length > 1 && showLocationMap && (
                    <div className="mt-4 space-y-3">
                      <div className="p-3 bg-blue-50 rounded">
                        <p className="text-sm text-blue-700">
                          <strong>Location History:</strong> Showing {locationHistory.length} location points on the map
                        </p>
                      </div>
                      {/* Color Legend */}
                      <div className="p-3 bg-gray-50 rounded border">
                        <p className="text-xs font-semibold text-gray-700 mb-2">📍 Location Color Legend:</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow"></div>
                            <span className="text-gray-600">Product Created</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white shadow"></div>
                            <span className="text-gray-600">Transferred to Distributor</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-pink-500 border-2 border-white shadow"></div>
                            <span className="text-gray-600">Transferred to Delivery Hub</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-amber-500 border-2 border-white shadow"></div>
                            <span className="text-gray-600">In Transit</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow"></div>
                            <span className="text-gray-600">At Warehouse</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-cyan-500 border-2 border-white shadow"></div>
                            <span className="text-gray-600">Preparing</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            return null;
          })()}

          {/* Key Milestones Summary */}
          {productInfo.history.length > 0 && (() => {
            const keyMilestones = productInfo.history
              .map((entry, idx) => {
                const actionLower = entry.action.toLowerCase();
                const statusLower = entry.status.toLowerCase();
                const isKeyMilestone = (
                  actionLower.includes('product created') ||
                  actionLower.includes('created') ||
                  (actionLower.includes('ownership transferred') && statusLower.includes('distributor')) ||
                  (actionLower.includes('ownership transferred') && (statusLower.includes('delivery hub') || statusLower.includes('delivery'))) ||
                  statusLower.includes('delivered') ||
                  statusLower === 'delivered'
                );
                
                if (!isKeyMilestone) return null;
                
                let entryLocation: { lat: number; lng: number } | null = null;
                if (entry.latitude !== null && entry.latitude !== undefined && 
                    entry.longitude !== null && entry.longitude !== undefined) {
                  const lat = typeof entry.latitude === 'number' ? entry.latitude : parseFloat(entry.latitude);
                  const lng = typeof entry.longitude === 'number' ? entry.longitude : parseFloat(entry.longitude);
                  if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    entryLocation = { lat, lng };
                  }
                }
                
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
                
                return { entry, location: entryLocation, index: idx };
              })
              .filter((item): item is NonNullable<typeof item> => item !== null && item.location !== null);
            
            if (keyMilestones.length > 0) {
              return (
                <div className="card mb-6">
                  <h2 className="text-xl font-semibold mb-4">⭐ Key Milestones & Locations</h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {keyMilestones.map((milestone, idx) => {
                      const getMilestoneLabel = (action: string, status: string): string => {
                        const actionLower = action.toLowerCase();
                        const statusLower = status.toLowerCase();
                        if (actionLower.includes('product created') || actionLower.includes('created')) {
                          return 'Product Created';
                        }
                        if (actionLower.includes('ownership transferred') && statusLower.includes('distributor')) {
                          return 'Transferred to Distributor';
                        }
                        if (actionLower.includes('ownership transferred') && (statusLower.includes('delivery hub') || statusLower.includes('delivery'))) {
                          return 'Transferred to Delivery Hub';
                        }
                        if (statusLower.includes('delivered') || statusLower === 'delivered') {
                          return 'Delivered';
                        }
                        return action;
                      };
                      
                      return (
                        <div key={idx} className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">⭐</span>
                            <h3 className="font-semibold text-blue-900 text-sm">
                              {getMilestoneLabel(milestone.entry.action, milestone.entry.status)}
                            </h3>
                          </div>
                          {milestone.location && (
                            <div className="space-y-1">
                              <p className="text-xs text-blue-700 font-mono">
                                Lat: {milestone.location.lat.toFixed(6)}
                              </p>
                              <p className="text-xs text-blue-700 font-mono">
                                Lng: {milestone.location.lng.toFixed(6)}
                              </p>
                              <p className="text-xs text-blue-600 mt-1">
                                {formatDate(milestone.entry.timestamp)}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Transaction History */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-6">Complete Transaction History</h2>
            
            <div className="space-y-6">
              {productInfo.history.map((entry, index) => {
                // Check if this is a key milestone status
                const isKeyMilestone = (action: string, status: string): boolean => {
                  const actionLower = action.toLowerCase();
                  const statusLower = status.toLowerCase();
                  return (
                    actionLower.includes('product created') ||
                    actionLower.includes('created') ||
                    (actionLower.includes('ownership transferred') && statusLower.includes('distributor')) ||
                    (actionLower.includes('ownership transferred') && (statusLower.includes('delivery hub') || statusLower.includes('delivery'))) ||
                    statusLower.includes('delivered') ||
                    statusLower === 'delivered'
                  );
                };
                
                const isMilestone = isKeyMilestone(entry.action, entry.status);
                
                // Extract location for this history entry
                let entryLocation: { lat: number; lng: number } | null = null;
                
                // First try to get location from latitude/longitude fields (from blockchain event)
                if (entry.latitude !== null && entry.latitude !== undefined && 
                    entry.longitude !== null && entry.longitude !== undefined) {
                  const lat = typeof entry.latitude === 'number' ? entry.latitude : parseFloat(entry.latitude);
                  const lng = typeof entry.longitude === 'number' ? entry.longitude : parseFloat(entry.longitude);
                  if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    entryLocation = { lat, lng };
                  }
                }
                
                // Fallback: try to parse from location string
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
                
                // Validate location against authorized zones for this entry
                // IMPORTANT: For OwnershipTransferred events, validate against the FROM owner (who entered the location)
                // For other events, validate against the current owner
                // Note: This validation will be done asynchronously, so we'll use a state or effect for it
                // For now, we'll validate against the pre-loaded authorizedLocations if available
                let entryLocationValidation: any = null;
                if (entryLocation) {
                  try {
                    // Determine which participant's authorized zones to check
                    let participantToValidate: string | null = null;
                    
                    // CRITICAL: For OwnershipTransferred events, the location was entered by the FROM owner
                    // (e.g., when Distributor transfers to Delivery Hub, Distributor entered the location)
                    if (entry.type === 'OwnershipTransferred') {
                      // Check if 'from' exists and is not 'Unknown'
                      if (entry.from && entry.from !== 'Unknown' && entry.from.trim() !== '') {
                        participantToValidate = entry.from;
                        console.log(`🔍 OwnershipTransferred: Validating against FROM owner (who entered location): ${participantToValidate}`);
                      } else {
                        // Fallback: if from is missing or 'Unknown', try to infer from the action/status
                        // For "Transferred to Delivery Hub", the FROM should be the Distributor
                        // But we can't reliably determine this, so log a warning
                        console.warn(`⚠️ OwnershipTransferred event missing valid 'from' field (got: "${entry.from}"). Cannot validate location - entry.from is required.`);
                        // Don't validate if we can't determine who entered the location
                        participantToValidate = null;
                      }
                    } else if (entry.owner) {
                      // For other events (ProductCreated, StatusUpdated), use the current owner
                      participantToValidate = entry.owner;
                      console.log(`🔍 ${entry.type}: Validating against current owner: ${participantToValidate}`);
                    }
                    
                    // Use pre-loaded authorized locations if they match the participant
                    if (participantToValidate && authorizedLocations.length > 0) {
                      const participantAuthLocs = authorizedLocations.filter(
                        (loc) => loc.participant?.toLowerCase() === participantToValidate?.toLowerCase()
                      );
                      
                      console.log(`🔍 Found ${participantAuthLocs.length} authorized locations for participant ${participantToValidate.slice(0, 10)}...`);
                      
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
                  <div key={index} className="relative">
                    {/* Timeline line */}
                    {index < productInfo.history.length - 1 && (
                      <div className="absolute left-4 top-8 w-0.5 h-full bg-gray-200"></div>
                    )}
                    
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 text-sm font-semibold">
                            {index + 1}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className={`rounded-lg p-4 ${
                          entryLocationValidation && !entryLocationValidation.isValid && entryLocationValidation.isSuspicious
                            ? 'bg-red-50 border-2 border-red-300' 
                            : isMilestone
                            ? 'bg-blue-50 border-2 border-blue-300'
                            : 'bg-gray-50'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {isMilestone && (
                                <span className="text-lg">⭐</span>
                              )}
                              <h3 className={`text-sm font-semibold ${
                                isMilestone ? 'text-blue-900' : 'text-gray-900'
                              }`}>
                                {entry.action}
                              </h3>
                            </div>
                            <span className="text-xs text-gray-500">
                              {formatDate(entry.timestamp)}
                            </span>
                          </div>
                          
                          {isMilestone && (
                            <div className="mb-2 px-2 py-1 bg-blue-100 rounded text-xs font-medium text-blue-800 inline-block">
                              Key Milestone
                            </div>
                          )}
                          
                          {/* Counterfeit Warning */}
                          {entryLocationValidation && !entryLocationValidation.isValid && entryLocationValidation.isSuspicious && (
                            <div className="mb-3 p-3 bg-red-100 border-2 border-red-400 rounded-lg">
                              <div className="flex items-start">
                                <span className="text-2xl mr-2">🚨</span>
                                <div className="flex-1">
                                  <h4 className="font-bold text-red-900 mb-1">⚠️ COUNTERFEIT DRUG WARNING</h4>
                                  <p className="text-sm text-red-800 mb-2">
                                    {entry.type === 'OwnershipTransferred' && entry.from
                                      ? `Location entered by ${formatAddress(entry.from)} (Distributor) does NOT match their authorized zones!`
                                      : entry.type === 'OwnershipTransferred'
                                      ? `Location entered during ownership transfer does NOT match authorized zones!`
                                      : `Location entered during this transaction does NOT match authorized zones!`}
                                  </p>
                                  {entryLocationValidation.warnings.map((warning: string, idx: number) => (
                                    <p key={idx} className="text-xs text-red-700 mb-1">
                                      {warning}
                                    </p>
                                  ))}
                                  {entryLocationValidation.expectedLocation && (
                                    <p className="text-xs text-red-600 mt-2">
                                      <strong>Expected:</strong> {entryLocationValidation.expectedLocation.name} 
                                      ({entryLocationValidation.expectedLocation.latitude.toFixed(4)}, {entryLocationValidation.expectedLocation.longitude.toFixed(4)})
                                    </p>
                                  )}
                                  {entryLocationValidation.distanceFromExpected && (
                                    <p className="text-xs text-red-600">
                                      <strong>Distance from authorized zone:</strong> {(entryLocationValidation.distanceFromExpected / 1000).toFixed(2)} km
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Location Valid Indicator */}
                          {entryLocationValidation && entryLocationValidation.isValid && !entryLocationValidation.isSuspicious && (
                            <div className="mb-3 p-2 bg-green-100 border border-green-300 rounded-lg">
                              <p className="text-xs text-green-800">
                                ✅ Location verified: Matches authorized zone
                              </p>
                            </div>
                          )}
                          
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Owner:</span>
                              {entry.owner && entry.owner !== 'Unknown' ? (
                                <a
                                  href={getEtherscanAddressLink(entry.owner)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 font-mono text-xs underline"
                                  title={entry.owner}
                                >
                                  {formatAddress(entry.owner)}
                                </a>
                              ) : (
                                <p className="text-gray-900 font-mono">{formatAddress(entry.owner)}</p>
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Status:</span>
                              <p className="text-gray-900">{entry.status}</p>
                            </div>
                            {entryLocation && (
                              <div className={`md:col-span-2 ${isMilestone ? 'bg-blue-50 p-3 rounded-lg border border-blue-200' : ''}`}>
                                <span className={`font-medium ${isMilestone ? 'text-blue-900' : 'text-gray-700'}`}>
                                  📍 Location {isMilestone ? '(Key Milestone)' : `(Entered during ${entry.action})`}:
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className={`font-mono text-xs ${isMilestone ? 'text-blue-800 font-semibold' : 'text-gray-900'}`}>
                                    Lat: {entryLocation.lat.toFixed(6)}, Lng: {entryLocation.lng.toFixed(6)}
                                  </p>
                                  <button
                                    onClick={() => {
                                      setSelectedLocation({ lat: entryLocation!.lat, lng: entryLocation!.lng, name: entry.action });
                                      setShowLocationMap(true);
                                      setTimeout(() => {
                                        const mapSection = document.querySelector('[data-location-map]');
                                        if (mapSection) {
                                          mapSection.scrollIntoView({ behavior: 'smooth' });
                                        }
                                      }, 100);
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                                  >
                                    🗺️ View on Map
                                  </button>
                                </div>
                              </div>
                            )}
                            {entry.location && !entryLocation && (
                              <div className="md:col-span-2">
                                <span className="font-medium text-gray-700">Location:</span>
                                <p className="text-gray-900">{entry.location}</p>
                              </div>
                            )}
                            <div className="md:col-span-2">
                              <span className="font-medium text-gray-700">Transaction Hash:</span>
                              {entry.hash && entry.hash !== 'N/A' ? (
                                <a
                                  href={getEtherscanTxLink(entry.hash)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 font-mono text-xs break-all underline"
                                >
                                  {entry.hash}
                                </a>
                              ) : (
                                <p className="text-gray-500 font-mono text-xs">N/A</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* No Results */}
      {!productInfo && !isLoading && (
        <div className="card text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Search for a Product</h3>
          <p className="text-gray-600">
            Enter a product ID above to view its complete blockchain history and verify authenticity.
          </p>
        </div>
      )}
    </div>
  );
};

export default ExplorerPage;
