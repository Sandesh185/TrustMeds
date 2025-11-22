import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';
import { useParticipantWeb3 } from '../hooks/useParticipantWeb3';
import { blockchainService } from '../utils/blockchain';
import apiClient, { isApiAvailable } from '../utils/apiClient';
import { saveProduct, getProduct } from '../utils/productStorage';
import { 
  verifyPIN, 
  setPIN, 
  logout as authLogout,
  getAuthStatus 
} from '../utils/auth';
import LocationMap from '../components/LocationMap';
import { 
  validateLocationAgainstAuthorizedZones,
  type AuthorizedLocation 
} from '../utils/locationValidation';

interface Product {
  productId: string;
  manufacturerName: string;
  productName: string;
  productCode: string;
  category: string;
  price: number;
  currentOwner: string;
  status: string;
  createdAt: string;
}

const DistributorDashboard = () => {
  const { isConnected, account, connect, disconnect } = useParticipantWeb3('distributor');
  const [productId, setProductId] = useState('');
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [newOwner, setNewOwner] = useState('');
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [isLoadingMyProducts, setIsLoadingMyProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Authorized location registration state
  const [authorizedLocations, setAuthorizedLocations] = useState<any[]>([]);
  const [showAuthorizedLocationModal, setShowAuthorizedLocationModal] = useState(false);
  const [authorizedLocationForm, setAuthorizedLocationForm] = useState({
    locationName: '',
    latitude: '',
    longitude: '',
    radius: '5000', // Default 5km radius in meters
  });
  const [isRegisteringLocation, setIsRegisteringLocation] = useState(false);

  // Location input state for transfer ownership
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'transfer'; newOwner?: string } | null>(null);
  const [locationForm, setLocationForm] = useState({
    name: '',
    latitude: '',
    longitude: '',
  });
  const [locationValidation, setLocationValidation] = useState<any>(null);

  // PIN Authentication state
  const [pinAuth, setPinAuth] = useState({
    isAuthenticated: false,
    showPINModal: false,
    showSetupModal: false,
    pinInput: '',
    newPIN: '',
    confirmPIN: '',
  });

  // Check PIN authentication when wallet connects
  useEffect(() => {
    if (account) {
      const authStatus = getAuthStatus(account);
      if (!authStatus.hasPIN) {
        setPinAuth(prev => ({ ...prev, showSetupModal: true }));
      } else {
        if (authStatus.isAuthenticated) {
          setPinAuth(prev => ({ ...prev, isAuthenticated: true }));
        } else {
          setPinAuth(prev => ({ ...prev, showPINModal: true }));
        }
      }
    } else {
      setPinAuth(prev => ({ ...prev, isAuthenticated: false, showPINModal: false, showSetupModal: false }));
    }
  }, [account]);

  // Extend session periodically while user is active
  useEffect(() => {
    if (account && pinAuth.isAuthenticated) {
      const interval = setInterval(() => {
        const authStatus = getAuthStatus(account);
        if (authStatus.isAuthenticated) {
          import('../utils/auth').then(({ extendSession }) => extendSession(account));
        } else {
          setPinAuth(prev => ({ ...prev, isAuthenticated: false, showPINModal: true }));
        }
      }, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [account, pinAuth.isAuthenticated]);

  // Load authorized locations from blockchain
  useEffect(() => {
    if (account) {
      loadAuthorizedLocations();
      loadMyProducts();
    }
  }, [account]);

  const loadAuthorizedLocations = async () => {
    if (!account) {
      setAuthorizedLocations([]);
      return;
    }
    try {
      console.log(`📋 Loading authorized locations for distributor: ${account}`);
      const authLocs = await blockchainService.getAuthorizedLocations(account);
      console.log(`✅ Loaded ${authLocs?.length || 0} authorized locations`);
      setAuthorizedLocations(authLocs || []);
    } catch (error: any) {
      console.error('Failed to load authorized locations:', error);
      // Always set empty array - participant might not have locations registered yet
      setAuthorizedLocations([]);
      // Don't show error toast - this is expected if no locations are registered
    }
  };

  const handleRegisterAuthorizedLocation = async () => {
    if (!account) {
      toast.error('Please connect your wallet');
      return;
    }

    // Require PIN authentication for each registration
    if (!pinAuth.isAuthenticated) {
      toast.error('Please authenticate with your PIN to register location');
      setPinAuth(prev => ({ ...prev, showPINModal: true }));
      return;
    }

    // SECURITY: Prevent registration if location already exists (immutable)
    if (authorizedLocations.length > 0) {
      toast.error('Location already registered and cannot be changed for security reasons');
      setShowAuthorizedLocationModal(false);
      return;
    }

    // Prevent multiple simultaneous registrations
    if (isRegisteringLocation) {
      toast.error('Please wait for the current registration to complete');
      return;
    }

    if (!authorizedLocationForm.locationName.trim()) {
      toast.error('Please enter a location name');
      return;
    }

    const lat = parseFloat(authorizedLocationForm.latitude);
    const lon = parseFloat(authorizedLocationForm.longitude);
    const radius = parseFloat(authorizedLocationForm.radius);

    if (isNaN(lat) || isNaN(lon) || isNaN(radius)) {
      toast.error('Please enter valid coordinates and radius');
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      toast.error('Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180');
      return;
    }

    if (radius <= 0 || radius > 100000) {
      toast.error('Radius must be between 1 and 100,000 meters');
      return;
    }

    setIsRegisteringLocation(true);
    try {
      const result = await blockchainService.registerAuthorizedLocation({
        locationName: authorizedLocationForm.locationName.trim(),
        latitude: lat,
        longitude: lon,
        radius: radius,
      });

      toast.success('Authorized location registered on blockchain!');
      setAuthorizedLocationForm({
        locationName: '',
        latitude: '',
        longitude: '',
        radius: '5000',
      });
      setShowAuthorizedLocationModal(false);
      await loadAuthorizedLocations();
      // Reset form after successful registration
      setAuthorizedLocationForm({
        locationName: '',
        latitude: '',
        longitude: '',
        radius: '5000',
      });
    } catch (error: any) {
      console.error('Failed to register authorized location:', error);
      toast.error(error?.message || 'Failed to register authorized location');
    } finally {
      setIsRegisteringLocation(false);
    }
  };


  // PIN Authentication handlers
  const handlePINLogin = async () => {
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!pinAuth.pinInput || pinAuth.pinInput.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }

    const isValid = await verifyPIN(account, pinAuth.pinInput);
    if (isValid) {
      setPinAuth(prev => ({ ...prev, isAuthenticated: true, showPINModal: false, pinInput: '' }));
      toast.success('✅ Authentication successful!');
    } else {
      toast.error('❌ Invalid PIN. Please try again.');
      setPinAuth(prev => ({ ...prev, pinInput: '' }));
    }
  };

  const handlePINSetup = async () => {
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!pinAuth.newPIN || pinAuth.newPIN.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }

    if (pinAuth.newPIN !== pinAuth.confirmPIN) {
      toast.error('PINs do not match');
      return;
    }

    const success = await setPIN(account, pinAuth.newPIN, 'distributor');
    if (success) {
      setPinAuth(prev => ({ 
        ...prev, 
        isAuthenticated: true, 
        showSetupModal: false, 
        newPIN: '', 
        confirmPIN: '' 
      }));
      toast.success('✅ PIN set successfully!');
    } else {
      toast.error('Failed to set PIN');
    }
  };

  const handleLogout = () => {
    if (account) {
      authLogout(account);
    }
    setPinAuth(prev => ({ 
      ...prev, 
      isAuthenticated: false, 
      showPINModal: true, 
      pinInput: '' 
    }));
    toast.success('Logged out successfully');
  };

  const loadMyProducts = async () => {
    if (!account) return;
    setIsLoadingMyProducts(true);
    try {
      // Load from localStorage immediately (fast)
      const allProducts = await blockchainService.getAllProducts(false);
      
      // Filter products where current account is the owner
      // Normalize addresses for comparison
      const normalizedAccount = account.toLowerCase().trim();
      const myOwnedProducts = allProducts.filter((p: any) => {
        const owner = (p.currentOwner || p.owner || '').toLowerCase().trim();
        const matches = owner === normalizedAccount;
        if (matches) {
          console.log(`✅ Product ${p.productId} owned by distributor: owner=${owner}`);
        }
        return matches;
      });
      
      console.log(`📦 Distributor dashboard: Found ${myOwnedProducts.length} products owned by ${account}`);
      const mappedProducts = myOwnedProducts.map((p: any) => ({
        productId: p.productId,
        manufacturerName: p.manufacturerName,
        productName: p.productName,
        productCode: p.productCode,
        category: p.category,
        price: Number(p.price) || 0,
        currentOwner: p.currentOwner || p.owner,
        status: p.status,
        createdAt: p.createdAt,
      }));
      
      setMyProducts(mappedProducts);
      setIsLoadingMyProducts(false);
      
      // Sync with blockchain in background (non-blocking)
      blockchainService.getAllProducts(true).then(syncedProducts => {
        const normalizedAccount = account.toLowerCase().trim();
        const mySyncedProducts = syncedProducts.filter((p: any) => {
          const owner = (p.currentOwner || p.owner || '').toLowerCase().trim();
          return owner === normalizedAccount;
        });
        
        console.log(`🔄 Background sync: Found ${mySyncedProducts.length} products owned by distributor after sync`);
        const syncedMapped = mySyncedProducts.map((p: any) => ({
          productId: p.productId,
          manufacturerName: p.manufacturerName,
          productName: p.productName,
          productCode: p.productCode,
          category: p.category,
          price: Number(p.price) || 0,
          currentOwner: p.currentOwner || p.owner,
          status: p.status,
          createdAt: p.createdAt,
        }));
        setMyProducts(syncedMapped);
      }).catch(err => {
        console.debug('Background sync failed:', err);
      });
      
      // Reset selection if selected product no longer exists
      if (selectedProductId) {
        const stillExists = mappedProducts.some(p => p.productId === selectedProductId);
        if (!stillExists) {
          setSelectedProductId('');
          setSelectedProduct(null);
        } else {
          const updated = mappedProducts.find(p => p.productId === selectedProductId);
          if (updated) setSelectedProduct(updated);
        }
      }
    } catch (error: any) {
      console.error('Failed to load my products:', error);
      toast.error(error?.message || 'Failed to load your products');
      setMyProducts([]);
      setSelectedProductId('');
      setSelectedProduct(null);
      setIsLoadingMyProducts(false);
    }
  };

  const fetchProduct = async (id: string) => {
    if (!id.trim()) {
      toast.error('Please enter a product ID');
      return;
    }

    setIsLoading(true);
    try {
      let productData: any;
      
      // Always fetch from blockchain first to get the latest owner
      // This ensures we have the most up-to-date ownership information
      try {
        productData = await blockchainService.getProduct(id.trim());
        console.log(`📦 Fetched product from blockchain: ${id}, owner: ${productData.currentOwner}`);
      } catch (blockchainError) {
        console.warn('Blockchain fetch failed, trying API:', blockchainError);
        // Fallback to API if blockchain fails
        try {
          const apiReady = await isApiAvailable();
          if (apiReady) {
            productData = await apiClient.getProduct(id.trim());
          } else {
            throw new Error('API not available');
          }
        } catch (apiError) {
          throw new Error('Failed to fetch product from blockchain and API');
        }
      }

      if (!productData || (!productData.exists && !productData.productId)) {
        setScannedProduct(null);
        toast.error(`Product "${id}" not found.`);
        return;
      }

      // Normalize owner address to handle checksum format
      const normalizedOwner = productData.currentOwner ? 
        ethers.getAddress(productData.currentOwner).toLowerCase() : '';

      const product: Product = {
        productId: productData.productId,
        manufacturerName: productData.manufacturerName,
        productName: productData.productName,
        productCode: productData.productCode,
        category: productData.category,
        price: Number(productData.price) || 0,
        currentOwner: productData.currentOwner, // Keep original format for display
        status: productData.status,
        createdAt: productData.createdAt,
      };

      // Update localStorage with latest blockchain data
      const existingProduct = getProduct(id.trim());
      const updatedProduct = {
        ...(existingProduct || {}),
        ...product,
        currentOwner: productData.currentOwner,
        owner: productData.currentOwner, // Also update owner field
        status: productData.status,
        // Ensure required location fields are present for storage
        latitude: existingProduct?.latitude ?? 0,
        longitude: existingProduct?.longitude ?? 0,
        txHash: existingProduct?.txHash ?? 'N/A',
        createdAt: existingProduct?.createdAt ?? productData.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      saveProduct(updatedProduct);
      console.log(`💾 Updated localStorage with latest product data: owner=${productData.currentOwner}, status=${productData.status}`);

      setScannedProduct(product);
      toast.success('Product information retrieved');
      
      // Reload my products to update the list
      if (account) {
        await loadMyProducts();
      }
    } catch (error: any) {
      console.error('Error fetching product:', error);
      const errorMessage = error?.message || 'Unknown error';
      
      // Provide more specific error messages
      if (errorMessage.includes('RPC') || errorMessage.includes('network') || errorMessage.includes('connection')) {
        toast.error('Network error: Please check your internet connection or RPC endpoint');
      } else if (errorMessage.includes('Product does not exist') || errorMessage.includes('not found')) {
        toast.error(`Product "${id}" does not exist`);
      } else {
        toast.error(`Failed to fetch product: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!pinAuth.isAuthenticated) {
      toast.error('Please authenticate with your PIN first');
      setPinAuth(prev => ({ ...prev, showPINModal: true }));
      return;
    }

    if (!scannedProduct || !account) return;
    if (!newOwner) {
      toast.error('Please enter recipient address');
      return;
    }
    if (!ethers.isAddress(newOwner)) {
      toast.error('Invalid recipient address');
      return;
    }

    // Check if participant has registered authorized locations
    if (authorizedLocations.length === 0) {
      toast.error('Please register at least one authorized location before transferring ownership');
      return;
    }

    // Show location picker modal
    setPendingAction({ type: 'transfer', newOwner });
    setShowLocationModal(true);
  };

  const handleConfirmTransferOwnership = async () => {
    if (!pendingAction || !scannedProduct || !account || !pendingAction.newOwner) {
      toast.error('Missing required information');
      return;
    }

    // Validate form fields
    if (!locationForm.name.trim()) {
      toast.error('Please enter location name');
      return;
    }

    const lat = parseFloat(locationForm.latitude);
    const lon = parseFloat(locationForm.longitude);

    if (isNaN(lat) || isNaN(lon)) {
      toast.error('Please enter valid latitude and longitude');
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      toast.error('Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180');
      return;
    }

    // Validate location against authorized zones
    // Ensure all coordinates are properly converted to numbers
    const authLocsFormatted: AuthorizedLocation[] = authorizedLocations.map((loc: any) => {
      const latValue = typeof loc.latitude === 'number' ? loc.latitude : parseFloat(String(loc.latitude));
      const lonValue = typeof loc.longitude === 'number' ? loc.longitude : parseFloat(String(loc.longitude));
      const radiusValue = typeof loc.radius === 'number' ? loc.radius : parseFloat(String(loc.radius));
      
      // Ensure values are valid numbers
      if (isNaN(latValue) || isNaN(lonValue) || isNaN(radiusValue)) {
        console.error(`⚠️ Invalid authorized location data for "${loc.locationName}":`, loc);
        return null;
      }
      
      // Debug: Log each authorized location
      console.log(`📍 Authorized Location "${loc.locationName}":`, {
        lat: latValue,
        lon: lonValue,
        radius: radiusValue,
        participant: loc.participant,
        account: account,
        matchesAccount: loc.participant?.toLowerCase() === account?.toLowerCase()
      });
      
      return {
      participant: loc.participant,
      locationName: loc.locationName,
        latitude: latValue,
        longitude: lonValue,
        radius: radiusValue,
      registeredAt: loc.registeredAt,
      };
    }).filter((loc): loc is AuthorizedLocation => loc !== null);

    // Debug: Log what we're validating
    console.log('🔍 Validating Location for Transfer:', {
      enteredLocation: { 
        lat: lat, 
        lon: lon, 
        name: locationForm.name,
        latType: typeof lat,
        lonType: typeof lon
      },
      account: account,
      authorizedLocationsCount: authLocsFormatted.length,
      authorizedLocations: authLocsFormatted
    });

    const validation = validateLocationAgainstAuthorizedZones(
      lat,
      lon,
      account,
      authLocsFormatted
    );

    // Debug: Log validation result
    console.log('✅ Validation Result:', {
      isValid: validation.isValid,
      isSuspicious: validation.isSuspicious,
      warnings: validation.warnings,
      expectedLocation: validation.expectedLocation,
      distanceFromExpected: validation.distanceFromExpected ? `${(validation.distanceFromExpected / 1000).toFixed(2)} km` : 'N/A',
      actualLocation: validation.actualLocation
    });

    setLocationValidation(validation);

    // Validation runs in background for logging, but warnings are NOT shown in participant dashboards
    // Counterfeit warnings only appear in Customer and Explorer dashboards
    // Log validation result for debugging but don't show to user
    if (!validation.isValid && validation.isSuspicious) {
      console.log('⚠️ Location validation: Location mismatch detected (will be flagged in Customer/Explorer dashboards)', {
        warnings: validation.warnings,
        enteredLocation: { lat, lon, name: locationForm.name }
      });
    } else if (validation.isValid) {
      console.log('✅ Location validation: Location matches authorized zone');
    }

    // Prevent double-submission
    if (isTransferring) {
      toast.error('Transfer already in progress. Please wait...');
        return;
    }

    setIsTransferring(true);
    
    try {
      const newOwner = pendingAction.newOwner;
      
      // Use proper status based on recipient role
      const transferStatus = 'Transferred to Delivery Hub'; // Distributor transfers to Delivery Hub
      
      // Use the combined function which handles both operations in a single transaction
      // (or falls back to two transactions if the contract hasn't been updated yet)
      const transferReceipt = await blockchainService.transferOwnershipWithLocation(
        scannedProduct.productId,
        newOwner,
        transferStatus,
        lat,
        lon
      );

      console.log(`Ownership transferred with location: ${newOwner} - Location: ${lat}, ${lon} - TX: ${transferReceipt.txHash}`);

      // Update local state
      const updatedProduct = { 
        ...scannedProduct, 
        currentOwner: newOwner, 
        status: transferStatus,
        latitude: lat,
        longitude: lon
      };
      setScannedProduct(updatedProduct);

      // Update localStorage to sync with blockchain
      const existingProduct = getProduct(scannedProduct.productId);
      const productToSave = {
        ...scannedProduct,
        owner: newOwner,
        currentOwner: newOwner,
        status: transferStatus,
        latitude: lat, // Location from form (now on-chain)
        longitude: lon, // Location from form (now on-chain)
        txHash: transferReceipt.txHash || existingProduct?.txHash || 'N/A',
        createdAt: existingProduct?.createdAt || scannedProduct.createdAt,
      };
      
      saveProduct(productToSave);
      console.log(`Updated localStorage for product ${scannedProduct.productId} after ownership transfer with location: ${lat}, ${lon}`);

      // Store transfer record in API if available
      try {
        const apiReady = await isApiAvailable();
        if (apiReady) {
          await apiClient.transferOwnership(scannedProduct.productId, {
            from: account || '',
            to: newOwner,
            status: transferStatus,
          });
          console.log('Transfer record stored in API');
        }
      } catch (apiError) {
        console.warn('Failed to store transfer in API (non-critical):', apiError);
        // Non-critical error - transfer is already on blockchain
      }

      // Close modal and reset form
      setShowLocationModal(false);
      setLocationForm({ name: '', latitude: '', longitude: '' });
      setLocationValidation(null);

      toast.success(
        `Ownership transferred successfully!\nLocation: ${locationForm.name || 'N/A'} (${lat.toFixed(6)}, ${lon.toFixed(6)})\nTransfer TX: ${transferReceipt.txHash}`,
        { duration: 6000 }
      );
      
      setProductId('');
      setScannedProduct(null);
      setNewOwner('');
      
      // Reset state
      setPendingAction(null);
      
      // Reload my products after transfer
      await loadMyProducts();
    } catch (error: any) {
      console.error('Error transferring ownership:', error);
      toast.error(error?.message || 'Failed to transfer ownership');
      // Don't close modal on error so user can retry
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Distributor Dashboard</h1>
            <p className="text-gray-600">Manage product transfers and ownership in the supply chain.</p>
          </div>
          {pinAuth.isAuthenticated && (
            <button
              onClick={handleLogout}
              className="btn-secondary text-sm"
            >
              🔒 Logout
            </button>
          )}
        </div>
      </div>

      {/* Wallet Status Banner */}
      <div className="card bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-purple-900 mb-1">🔐 Distributor Wallet</h3>
            {account ? (
              <p className="text-sm text-purple-700">
                Address: <span className="font-mono font-semibold">{account}</span>
              </p>
            ) : (
              <p className="text-sm text-purple-700">Not connected</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {account && (
              <div className="bg-green-100 px-3 py-1 rounded-full">
                <span className="text-xs font-semibold text-green-700">✓ Active</span>
              </div>
            )}
            <button
              onClick={account ? disconnect : connect}
              className={account ? "btn-secondary text-xs" : "btn-primary text-xs"}
            >
              {account ? "Disconnect" : "Connect Wallet"}
            </button>
          </div>
        </div>
      </div>

      {!pinAuth.isAuthenticated ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">
            Please authenticate with your PIN to access the distributor dashboard.
          </p>
        </div>
      ) : !isConnected ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🔗</div>
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-6">
            Please connect your MetaMask wallet to manage product transfers.
          </p>
          <button onClick={connect} className="btn-primary">
            Connect Wallet
          </button>
        </div>
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Product Lookup */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-6">Product Lookup</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      className="input-field flex-1"
                      placeholder="Enter product ID"
                    />
                    <button
                      onClick={() => productId && fetchProduct(productId)}
                      disabled={!productId || isLoading}
                      className="btn-primary"
                    >
                      {isLoading ? 'Loading...' : 'Lookup'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Information & Actions */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-6">Product Information</h2>
              {scannedProduct ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between"><span>Product ID:</span><span>{scannedProduct.productId}</span></div>
                    <div className="flex justify-between"><span>Product Name:</span><span>{scannedProduct.productName}</span></div>
                    <div className="flex justify-between"><span>Manufacturer:</span><span>{scannedProduct.manufacturerName}</span></div>
                    <div className="flex justify-between"><span>Status:</span><span>{scannedProduct.status}</span></div>
                    <div className="flex justify-between"><span>Owner:</span><span className="font-mono text-sm">{scannedProduct.currentOwner.slice(0,6)}...{scannedProduct.currentOwner.slice(-4)}</span></div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900">Available Actions</h3>
                    
                    {scannedProduct.currentOwner && account && 
                     scannedProduct.currentOwner.toLowerCase().trim() === account.toLowerCase().trim() ? (
                      <>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">Transfer Ownership</label>
                          <label className="block text-xs text-gray-500 mb-1">Recipient Address</label>
                          <input
                            type="text"
                            value={newOwner}
                            onChange={(e) => setNewOwner(e.target.value)}
                            className="input-field w-full"
                            placeholder="0x... recipient address"
                          />
                        </div>
                        <button 
                          onClick={handleTransferOwnership} 
                          disabled={isTransferring || !newOwner} 
                          className="btn-primary w-full"
                        >
                          {isTransferring ? 'Transferring...' : 'Transfer Ownership'}
                        </button>
                      </>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-yellow-800">
                          <strong>Note:</strong> You are not the current owner of this product. 
                          Only the owner can transfer ownership.
                        </p>
                        <p className="text-xs text-yellow-700 mt-2">
                          Current Owner: {scannedProduct.currentOwner.slice(0, 10)}...{scannedProduct.currentOwner.slice(-8)}
                        </p>
                        <p className="text-xs text-yellow-700">
                          Your Address: {account?.slice(0, 10)}...{account?.slice(-8)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-4xl mb-4">🔍</div>
                  <p>Enter a product ID to view information</p>
                </div>
              )}
            </div>
          </div>

          {/* My Products Section */}
          <div className="card mt-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">📦 My Products</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Select a product to view details and manage transfers.
                </p>
              </div>
              <button
                onClick={loadMyProducts}
                className="btn-secondary text-sm"
                disabled={isLoadingMyProducts}
              >
                {isLoadingMyProducts ? 'Loading...' : '🔄 Refresh'}
              </button>
            </div>

            {isLoadingMyProducts ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading your products...</p>
              </div>
            ) : myProducts.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">📭</div>
                <p className="text-gray-500 mb-2">No products found in your wallet</p>
                <p className="text-xs text-gray-400">
                  Products will appear here after they are transferred to your address: <span className="font-mono">{account?.slice(0, 10)}...{account?.slice(-8)}</span>
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Make sure you're using the correct wallet address that received the transfer.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Product Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Product
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      const productId = e.target.value;
                      setSelectedProductId(productId);
                      const product = myProducts.find(p => p.productId === productId);
                      setSelectedProduct(product || null);
                    }}
                    className="input-field w-full"
                  >
                    <option value="">-- Select a product --</option>
                    {myProducts.map((product) => (
                      <option key={product.productId} value={product.productId}>
                        {product.productName} ({product.productId}) - {product.status || 'Unknown'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Product Details */}
                {selectedProduct && (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="font-semibold text-gray-900 text-lg">{selectedProduct.productName}</h3>
                          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
                            {selectedProduct.status || 'Unknown'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Product ID:</span>
                            <p className="text-gray-900">{selectedProduct.productId}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Product Code:</span>
                            <p className="text-gray-900">{selectedProduct.productCode}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Manufacturer:</span>
                            <p className="text-gray-900">{selectedProduct.manufacturerName}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Category:</span>
                            <p className="text-gray-900">{selectedProduct.category || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <span className="text-xs font-medium text-gray-700">Current Owner:</span>
                          <p className="text-xs text-gray-500 font-mono mt-1">
                            {selectedProduct.currentOwner}
                          </p>
                        </div>
                      </div>
                      <div className="ml-4">
                        <button
                          onClick={() => {
                            setProductId(selectedProduct.productId);
                            fetchProduct(selectedProduct.productId);
                          }}
                          className="btn-primary text-sm"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Authorized Locations Section (for fraud detection) */}
          <div className="card mt-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">🔒 Authorized Locations (Fraud Detection)</h2>
              </div>
              {authorizedLocations.length === 0 && (
                <button
                  onClick={() => {
                    if (!account) {
                      toast.error('Please connect your wallet first');
                      return;
                    }
                    if (!pinAuth.isAuthenticated) {
                      toast.error('Please authenticate with your PIN first');
                      setPinAuth(prev => ({ ...prev, showPINModal: true }));
                      return;
                    }
                    // No location exists, directly open registration modal
                    setShowAuthorizedLocationModal(true);
                  }}
                  className="btn-primary text-sm"
                  disabled={!account || !pinAuth.isAuthenticated}
                >
                  {!account 
                    ? 'Connect Wallet' 
                    : !pinAuth.isAuthenticated 
                      ? '🔒 Authenticate First' 
                      : '+ Register Location'}
                </button>
              )}
            </div>

            {authorizedLocations.length > 0 && (
              <LocationMap
                authorizedLocations={authorizedLocations.map(loc => ({
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                  radius: loc.radius,
                  locationName: loc.locationName,
                  participant: loc.participant,
                  registeredAt: loc.registeredAt,
                }))}
                height="400px"
                zoom={authorizedLocations.length === 1 ? 13 : 10}
              />
            )}
          </div>
        </>
      )}

      {/* Location Input Modal for Transfer Ownership */}
      {showLocationModal && pendingAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">
                📍 Enter Current Location - Transfer Ownership
              </h3>
              <button
                onClick={() => {
                  setShowLocationModal(false);
                  setLocationForm({ name: '', latitude: '', longitude: '' });
                  setPendingAction(null);
                  setLocationValidation(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Please enter your current location as the distributor. This location will be validated against your registered authorized locations.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location Name *
                </label>
                <input
                  type="text"
                  value={locationForm.name}
                  onChange={(e) => {
                    setLocationForm(prev => ({ ...prev, name: e.target.value }));
                    setLocationValidation(null);
                  }}
                  className="input-field"
                  placeholder="e.g., Mumbai Warehouse"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Latitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={locationForm.latitude}
                    onChange={(e) => {
                      const lat = e.target.value;
                      setLocationForm(prev => ({ ...prev, latitude: lat }));
                      // Validation runs in background but warnings are NOT shown in participant dashboards
                      // Counterfeit warnings only appear in Customer and Explorer dashboards
                      if (account && lat && locationForm.longitude) {
                        const latNum = parseFloat(lat);
                        const lonNum = parseFloat(locationForm.longitude);
                        if (!isNaN(latNum) && !isNaN(lonNum)) {
                          const authLocsFormatted: AuthorizedLocation[] = authorizedLocations.map((loc: any) => ({
                            participant: loc.participant,
                            locationName: loc.locationName,
                            latitude: loc.latitude,
                            longitude: loc.longitude,
                            radius: loc.radius,
                            registeredAt: loc.registeredAt,
                          }));
                          const validation = validateLocationAgainstAuthorizedZones(
                            latNum,
                            lonNum,
                            account,
                            authLocsFormatted
                          );
                          // Store validation but don't show warnings in participant dashboards
                          setLocationValidation(validation);
                        }
                      } else {
                        setLocationValidation(null);
                      }
                    }}
                    className="input-field"
                    placeholder="e.g., 19.0760"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Longitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={locationForm.longitude}
                    onChange={(e) => {
                      const lon = e.target.value;
                      setLocationForm(prev => ({ ...prev, longitude: lon }));
                      // Validation runs in background but warnings are NOT shown in participant dashboards
                      // Counterfeit warnings only appear in Customer and Explorer dashboards
                      if (account && locationForm.latitude && lon) {
                        const latNum = parseFloat(locationForm.latitude);
                        const lonNum = parseFloat(lon);
                        if (!isNaN(latNum) && !isNaN(lonNum)) {
                          const authLocsFormatted: AuthorizedLocation[] = authorizedLocations.map((loc: any) => ({
                            participant: loc.participant,
                            locationName: loc.locationName,
                            latitude: loc.latitude,
                            longitude: loc.longitude,
                            radius: loc.radius,
                            registeredAt: loc.registeredAt,
                          }));
                          const validation = validateLocationAgainstAuthorizedZones(
                            latNum,
                            lonNum,
                            account,
                            authLocsFormatted
                          );
                          // Store validation but don't show warnings in participant dashboards
                          setLocationValidation(validation);
                        }
                      } else {
                        setLocationValidation(null);
                      }
                    }}
                    className="input-field"
                    placeholder="e.g., 72.8777"
                    required
                  />
                </div>
              </div>

              {/* Location validation warnings removed - only shown in Customer/Explorer dashboards */}
              {/* Validation still runs in background for logging but doesn't block transactions */}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={handleConfirmTransferOwnership}
                className="btn-primary flex-1"
                disabled={!locationForm.name.trim() || !locationForm.latitude || !locationForm.longitude || isTransferring}
              >
                {isTransferring ? 'Processing...' : 'Confirm Transfer'}
              </button>
              <button
                onClick={() => {
                  setShowLocationModal(false);
                  setLocationForm({ name: '', latitude: '', longitude: '' });
                  setPendingAction(null);
                  setLocationValidation(null);
                }}
                className="btn-secondary flex-1"
                disabled={isTransferring}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Authorized Location Registration Modal */}
      {showAuthorizedLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">📍 Register Authorized Location (One-Time)</h3>
            {!pinAuth.isAuthenticated && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ PIN authentication required to register location. Please authenticate first.
                </p>
              </div>
            )}
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-semibold mb-1">⚠️ IMPORTANT: Location is IMMUTABLE</p>
              <p className="text-xs text-red-700">
                Once registered, your location <strong>CANNOT be changed</strong> for security reasons. This prevents fraud by ensuring location validation cannot be bypassed. Choose your location carefully!
              </p>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Register this location on blockchain for fraud detection. Products found outside this zone will trigger alerts.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location Name *
                </label>
                <input
                  type="text"
                  value={authorizedLocationForm.locationName}
                  onChange={(e) => setAuthorizedLocationForm(prev => ({ ...prev, locationName: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., Mumbai Warehouse"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Latitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={authorizedLocationForm.latitude}
                    onChange={(e) => setAuthorizedLocationForm(prev => ({ ...prev, latitude: e.target.value }))}
                    className="input-field"
                    placeholder="e.g., 19.0760"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Longitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={authorizedLocationForm.longitude}
                    onChange={(e) => setAuthorizedLocationForm(prev => ({ ...prev, longitude: e.target.value }))}
                    className="input-field"
                    placeholder="e.g., 72.8777"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Radius (meters) *
                </label>
                <input
                  type="number"
                  value={authorizedLocationForm.radius}
                  onChange={(e) => setAuthorizedLocationForm(prev => ({ ...prev, radius: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., 5000"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: 5000m (5km). Products within this radius are considered valid.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleRegisterAuthorizedLocation}
                  className="btn-primary flex-1"
                  disabled={isRegisteringLocation || !pinAuth.isAuthenticated}
                >
                  {isRegisteringLocation 
                    ? 'Registering...' 
                    : !pinAuth.isAuthenticated 
                      ? '🔒 Authenticate First' 
                      : 'Register on Blockchain'}
                </button>
                <button
                  onClick={() => {
                    setShowAuthorizedLocationModal(false);
                    setAuthorizedLocationForm({
                      locationName: '',
                      latitude: '',
                      longitude: '',
                      radius: '5000',
                    });
                  }}
                  className="btn-secondary flex-1"
                  disabled={isRegisteringLocation}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN Setup Modal */}
      {pinAuth.showSetupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">🔐 Set Security PIN</h3>
            <p className="text-sm text-gray-600 mb-4">
              Set a PIN for this wallet address to secure your distributor dashboard. This PIN is linked to your connected wallet.
            </p>
            {account && (
              <p className="text-xs text-gray-500 mb-4 font-mono">
                Wallet: {account.slice(0, 6)}...{account.slice(-4)}
              </p>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New PIN (min 4 digits) *
                </label>
                <input
                  type="password"
                  value={pinAuth.newPIN}
                  onChange={(e) => setPinAuth(prev => ({ ...prev, newPIN: e.target.value }))}
                  className="input-field"
                  placeholder="Enter PIN"
                  maxLength={10}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm PIN *
                </label>
                <input
                  type="password"
                  value={pinAuth.confirmPIN}
                  onChange={(e) => setPinAuth(prev => ({ ...prev, confirmPIN: e.target.value }))}
                  className="input-field"
                  placeholder="Confirm PIN"
                  maxLength={10}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handlePINSetup}
                  className="btn-primary flex-1"
                >
                  Set PIN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN Login Modal */}
      {pinAuth.showPINModal && !pinAuth.isAuthenticated && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">🔐 Distributor Authentication</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter your security PIN for this wallet address to access the distributor dashboard.
            </p>
            {account && (
              <p className="text-xs text-gray-500 mb-4 font-mono">
                Wallet: {account.slice(0, 6)}...{account.slice(-4)}
              </p>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Security PIN *
                </label>
                <input
                  type="password"
                  value={pinAuth.pinInput}
                  onChange={(e) => setPinAuth(prev => ({ ...prev, pinInput: e.target.value }))}
                  onKeyPress={(e) => e.key === 'Enter' && handlePINLogin()}
                  className="input-field"
                  placeholder="Enter your PIN"
                  maxLength={10}
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handlePINLogin}
                  className="btn-primary flex-1"
                >
                  Authenticate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributorDashboard;
