import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { ethers } from 'ethers';
import { blockchainService } from '../utils/blockchain';
import apiClient, { isApiAvailable } from '../utils/apiClient';
import { useParticipantWeb3 } from '../hooks/useParticipantWeb3';
import { saveProduct, getProduct } from '../utils/productStorage';
import { 
  getLocations, 
  addLocation, 
  updateLocation, 
  deleteLocation,
  type Location 
} from '../utils/locationStorage';
import { 
  verifyPIN, 
  setPIN, 
  isAuthenticated as isAuth, 
  hasPIN, 
  logout as authLogout,
  getAuthStatus 
} from '../utils/auth';
import LocationPickerWrapper from '../components/LocationPickerWrapper';
import LocationMap from '../components/LocationMap';
import { 
  validateRecipient, 
  getTransferStatus, 
  getRecipientsByRole,
  addAuthorizedRecipient,
  type RecipientRole 
} from '../utils/recipientValidation';

interface ProductForm {
  productId: string;
  manufacturerName: string;
  productName: string;
  productCode: string;
  category: string;
  price: string;
  locationId: string;
  expiryDate: string;
  batchNumber: string;
}

const ManufacturerDashboard = () => {
  const { isConnected, account, connect, disconnect } = useParticipantWeb3('manufacturer');
  const [formData, setFormData] = useState<ProductForm>({
    productId: '',
    manufacturerName: '',
    productName: '',
    productCode: '',
    category: '',
    price: '',
    locationId: '',
    expiryDate: '',
    batchNumber: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [createdProduct, setCreatedProduct] = useState<any>(null);
  
  // Transfer ownership state
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [isLoadingMyProducts, setIsLoadingMyProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedProductForTransfer, setSelectedProductForTransfer] = useState<any>(null);
  const [distributorAddress, setDistributorAddress] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [newRecipient, setNewRecipient] = useState({
    address: '',
    role: 'distributor' as 'distributor' | 'delivery_hub',
    name: '',
  });
  
  // Location management state
  const [locations, setLocations] = useState<Location[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locationForm, setLocationForm] = useState({
    name: '',
    latitude: '',
    longitude: '',
  });


  // Authorized locations (set by admin - read-only for manufacturer)
  const [authorizedLocations, setAuthorizedLocations] = useState<any[]>([]);

  // PIN Authentication state
  const [pinAuth, setPinAuth] = useState({
    isAuthenticated: false,
    showPINModal: false,
    showSetupModal: false,
    pinInput: '',
    newPIN: '',
    confirmPIN: '',
  });

  // Load locations on mount
  useEffect(() => {
    setLocations(getLocations());
  }, []);

  // Load my products (products where I am the owner)
  useEffect(() => {
    if (account) {
      console.log('🔄 useEffect triggered: account available, loading products...');
      loadMyProducts();
    } else {
      console.log('⚠️ useEffect: account not available yet');
      setMyProducts([]);
    }
  }, [account]);
  
  // Also try to load products on mount if account is already available
  // This handles cases where account is available before the first useEffect runs
  useEffect(() => {
    const timer = setTimeout(() => {
      if (account && myProducts.length === 0) {
        console.log('🔄 Mount effect: Loading products on mount (delayed check)...');
        loadMyProducts();
      }
    }, 500); // Small delay to ensure account is loaded
    
    return () => clearTimeout(timer);
  }, []); // Run once on mount

  // Load authorized locations from blockchain
  useEffect(() => {
    if (account) {
      loadAuthorizedLocations();
    }
  }, [account]);

  const loadAuthorizedLocations = async () => {
    if (!account) {
      setAuthorizedLocations([]);
      return;
    }
    try {
      console.log(`📋 Loading authorized locations for manufacturer: ${account}`);
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



  // Check PIN authentication when wallet connects
  useEffect(() => {
    if (account) {
      const authStatus = getAuthStatus(account);
      if (!authStatus.hasPIN) {
        // Show setup modal if PIN not set for this wallet
        setPinAuth(prev => ({ ...prev, showSetupModal: true }));
      } else {
        // Check if already authenticated
        if (authStatus.isAuthenticated) {
          setPinAuth(prev => ({ ...prev, isAuthenticated: true }));
        } else {
          // Show login modal
          setPinAuth(prev => ({ ...prev, showPINModal: true }));
        }
      }
    } else {
      // Reset auth state when wallet disconnects
      setPinAuth(prev => ({ ...prev, isAuthenticated: false, showPINModal: false, showSetupModal: false }));
    }
  }, [account]);

  // Extend session periodically while user is active
  useEffect(() => {
    if (account && pinAuth.isAuthenticated) {
      const interval = setInterval(() => {
        const authStatus = getAuthStatus(account);
        if (authStatus.isAuthenticated) {
          // Session still valid, extend it
          import('../utils/auth').then(({ extendSession }) => extendSession(account));
        } else {
          // Session expired, require re-authentication
          setPinAuth(prev => ({ ...prev, isAuthenticated: false, showPINModal: true }));
        }
      }, 5 * 60 * 1000); // Check every 5 minutes

      return () => clearInterval(interval);
    }
  }, [account, pinAuth.isAuthenticated]);

  const resetForm = () => {
    setFormData({
      productId: '',
      manufacturerName: '',
      productName: '',
      productCode: '',
      category: '',
      price: '',
      locationId: '',
      expiryDate: '',
      batchNumber: '',
    });
  };

  // Location management functions
  const handleAddLocation = () => {
    setEditingLocation(null);
    setLocationForm({ name: '', latitude: '', longitude: '' });
    setShowLocationModal(true);
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setLocationForm({
      name: location.name,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
    });
    setShowLocationModal(true);
  };

  const handleSaveLocation = () => {
    if (!locationForm.name.trim()) {
      toast.error('Location name is required');
      return;
    }

    const lat = parseFloat(locationForm.latitude) || 0;
    const lon = parseFloat(locationForm.longitude) || 0;

    if (editingLocation) {
      updateLocation(editingLocation.id, {
        name: locationForm.name.trim(),
        latitude: lat,
        longitude: lon,
      });
      toast.success('Location updated successfully');
    } else {
      addLocation({
        name: locationForm.name.trim(),
        latitude: lat,
        longitude: lon,
      });
      toast.success('Location added successfully');
    }

    setLocations(getLocations());
    setShowLocationModal(false);
    setLocationForm({ name: '', latitude: '', longitude: '' });
    setEditingLocation(null);
  };

  const handleDeleteLocation = (id: string) => {
    if (window.confirm('Are you sure you want to delete this location?')) {
      deleteLocation(id);
      setLocations(getLocations());
      
      // Clear form location if deleted location was selected
      if (formData.locationId === id) {
        setFormData(prev => ({ ...prev, locationId: '' }));
      }
      
      toast.success('Location deleted successfully');
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const generateProductId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const productId = `DRUG-${timestamp}-${random}`.toUpperCase();
    setFormData(prev => ({ ...prev, productId }));
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

    const success = await setPIN(account, pinAuth.newPIN, 'manufacturer');
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
    if (!account) {
      setMyProducts([]);
      return;
    }
    setIsLoadingMyProducts(true);
    
    try {
      // Load from localStorage immediately (fast - no blockchain queries)
      const allProducts = await blockchainService.getAllProducts(false);
      
      console.log(`📦 Loading products for manufacturer: ${account}`);
      console.log(`📦 Total products in storage: ${allProducts.length}`);
      
      // Log all products for debugging
      console.log(`📦 All products in localStorage (${allProducts.length} total):`);
      allProducts.forEach((p: any, idx: number) => {
        const owner = p.currentOwner || p.owner || 'MISSING';
        const manufacturer = p.manufacturer || 'MISSING';
        const createdBy = p.createdBy || 'MISSING';
        console.log(`  ${idx + 1}. ${p.productId}: owner=${owner}, manufacturer=${manufacturer}, createdBy=${createdBy}`);
      });
      console.log(`📦 Current account: ${account} (normalized: ${account.toLowerCase()})`);
      
      // Normalize account address for comparison (handle both checksum and lowercase)
      const normalizedAccount = account.toLowerCase();
      
      // Show ALL products created by this manufacturer
      // Strategy: Show products where:
      // 1. Current owner is this manufacturer (still owns it) - ALWAYS show
      // 2. Manufacturer field matches - ALWAYS show (even if ownership transferred)
      // 3. CreatedBy field matches - ALWAYS show (even if ownership transferred)
      // This ensures we show all products until ownership is transferred
      const myCreatedProducts = allProducts.filter((p: any) => {
        const owner = (p.currentOwner || p.owner || '').toLowerCase();
        const manufacturer = (p.manufacturer || '').toLowerCase();
        const createdBy = (p.createdBy || '').toLowerCase();
        
        // Product belongs to this manufacturer if:
        // 1. Current owner is this manufacturer (still owns it) - ALWAYS show
        // 2. Manufacturer field matches (created by this manufacturer) - ALWAYS show
        // 3. CreatedBy field matches (created by this manufacturer) - ALWAYS show
        // 4. Owner matches but manufacturer/createdBy missing (legacy products) - show and update
        
        const isOwner = owner === normalizedAccount;
        const isManufacturer = manufacturer === normalizedAccount && manufacturer !== '';
        const isCreatedBy = createdBy === normalizedAccount && createdBy !== '';
        
        // Show if any of these match
        // IMPORTANT: Show products owned by manufacturer OR created by manufacturer
        const shouldShow = isOwner || isManufacturer || isCreatedBy;
        
        if (shouldShow) {
          console.log(`✅ Product ${p.productId} INCLUDED: owner=${owner}, manufacturer=${manufacturer || 'MISSING'}, createdBy=${createdBy || 'MISSING'}`);
        } else {
          console.log(`❌ Product ${p.productId} EXCLUDED: owner=${owner}, manufacturer=${manufacturer || 'MISSING'}, createdBy=${createdBy || 'MISSING'}, account=${normalizedAccount}`);
        }
        
        return shouldShow;
      });
      
      // Sort: owned products first, then transferred products (but still show both)
      const ownedProducts = myCreatedProducts.filter((p: any) => {
        const owner = (p.currentOwner || p.owner || '').toLowerCase();
        return owner === normalizedAccount;
      });
      const transferredProducts = myCreatedProducts.filter((p: any) => {
        const owner = (p.currentOwner || p.owner || '').toLowerCase();
        return owner !== normalizedAccount;
      });
      
      console.log(`✅ Final result: ${ownedProducts.length} owned products and ${transferredProducts.length} transferred products (total: ${myCreatedProducts.length})`);
      
      // If no products found by manufacturer/createdBy, but we have products owned by account, show those
      // This handles edge cases where manufacturer field might be missing
      if (myCreatedProducts.length === 0 && allProducts.length > 0) {
        console.log('⚠️ No products found by manufacturer field, trying fallback: showing all products owned by account');
        const fallbackProducts = allProducts.filter((p: any) => {
          const owner = (p.currentOwner || p.owner || '').toLowerCase();
          return owner === normalizedAccount;
        });
        
        if (fallbackProducts.length > 0) {
          console.log(`✅ Fallback: Found ${fallbackProducts.length} products owned by account`);
          // Update these products with manufacturer field
          const updatedFallback = fallbackProducts.map((p: any) => ({
            ...p,
            manufacturer: normalizedAccount,
            createdBy: normalizedAccount,
          }));
          
          // Save updated products back to localStorage
          const allProductsUpdated = JSON.parse(localStorage.getItem("drug_supply_chain_products") || "[]");
          updatedFallback.forEach((updated: any) => {
            const index = allProductsUpdated.findIndex((p: any) => p.productId === updated.productId);
            if (index !== -1) {
              allProductsUpdated[index] = updated;
            }
          });
          localStorage.setItem("drug_supply_chain_products", JSON.stringify(allProductsUpdated));
          
          setMyProducts(updatedFallback);
          setIsLoadingMyProducts(false);
          return;
        }
      }
      
      // Show ALL products created by manufacturer (owned + transferred, until ownership changes)
      setMyProducts([...ownedProducts, ...transferredProducts]);
      setIsLoadingMyProducts(false);
      
      // Sync with blockchain in background (non-blocking)
      // This will update products with latest blockchain data and preserve manufacturer field
      blockchainService.getAllProducts(true).then(async (syncedProducts) => {
        const normalizedAccount = account.toLowerCase();
        
        console.log(`🔄 Background sync completed: ${syncedProducts.length} products synced`);
        
        // Update products missing manufacturer field
        const productsToUpdate = syncedProducts.filter((p: any) => {
          const owner = (p.currentOwner || p.owner || '').toLowerCase();
          const isOwner = owner === normalizedAccount;
          const hasManufacturer = !!(p.manufacturer || p.createdBy);
          return isOwner && !hasManufacturer;
        });
        
        // Fetch manufacturer from blockchain for products missing it
        for (const product of productsToUpdate) {
          try {
            const manufacturerAddress = await blockchainService.getProductManufacturer(product.productId);
            if (manufacturerAddress) {
              // Update product in localStorage
              const allProducts = JSON.parse(localStorage.getItem("drug_supply_chain_products") || "[]");
              const index = allProducts.findIndex((p: any) => p.productId === product.productId);
              if (index !== -1) {
                allProducts[index].manufacturer = manufacturerAddress;
                allProducts[index].createdBy = manufacturerAddress;
                localStorage.setItem("drug_supply_chain_products", JSON.stringify(allProducts));
                console.log(`✅ Updated manufacturer field for product ${product.productId}: ${manufacturerAddress}`);
              }
            }
          } catch (error: any) {
            // If product doesn't exist on blockchain, skip it silently
            if (error?.name === 'PRODUCT_NOT_FOUND' || 
                error?.message?.includes('does not exist')) {
              // Product doesn't exist - skip silently
              continue;
            }
            console.debug(`Could not fetch manufacturer for ${product.productId}:`, error);
          }
        }
        
        // Reload products after updating manufacturer fields
        const updatedProducts = JSON.parse(localStorage.getItem("drug_supply_chain_products") || "[]");
        
        const mySyncedProducts = updatedProducts.filter((p: any) => {
          const owner = (p.currentOwner || p.owner || '').toLowerCase();
          const manufacturer = (p.manufacturer || '').toLowerCase();
          const createdBy = (p.createdBy || '').toLowerCase();
          
          const isOwner = owner === normalizedAccount;
          const isManufacturer = manufacturer === normalizedAccount;
          const isCreatedBy = createdBy === normalizedAccount;
          
          return isOwner || isManufacturer || isCreatedBy || 
                 (isOwner && !manufacturer && !createdBy);
        });
        
        const ownedSynced = mySyncedProducts.filter((p: any) => {
          const owner = (p.currentOwner || p.owner || '').toLowerCase();
          return owner === normalizedAccount;
        });
        const transferredSynced = mySyncedProducts.filter((p: any) => {
          const owner = (p.currentOwner || p.owner || '').toLowerCase();
          return owner !== normalizedAccount;
        });
        
        console.log(`✅ After sync: ${ownedSynced.length} owned, ${transferredSynced.length} transferred (total: ${mySyncedProducts.length})`);
        setMyProducts([...ownedSynced, ...transferredSynced]);
      }).catch(err => {
        console.debug('Background sync failed:', err);
      });
      
      // Reset selection if selected product no longer exists
      if (selectedProductId) {
        const stillExists = myCreatedProducts.some(
          (p: any) => p.productId === selectedProductId
        );
        if (!stillExists) {
          setSelectedProductId('');
          setSelectedProduct(null);
        } else {
          const updated = myCreatedProducts.find(
            (p: any) => p.productId === selectedProductId
          );
          if (updated) setSelectedProduct(updated);
        }
      }
    } catch (error: any) {
      console.error('Failed to load products:', error);
      setMyProducts([]);
      setSelectedProductId('');
      setSelectedProduct(null);
      setIsLoadingMyProducts(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check wallet connection and PIN authentication
    if (!isConnected || !account) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!pinAuth.isAuthenticated) {
      toast.error('Please authenticate with your PIN first');
      setPinAuth(prev => ({ ...prev, showPINModal: true }));
      return;
    }

    // Check if manufacturer has authorized locations
    if (authorizedLocations.length === 0) {
      toast.error('❌ No authorized locations set. Please contact admin to set authorized locations for your manufacturer address.');
      setIsLoading(false);
      return;
    }

    if (!formData.locationId) {
      toast.error('Please select an authorized location');
      return;
    }

    // Find the selected authorized location
    const selectedLocation = authorizedLocations.find((loc: any, index: number) => 
      `auth-loc-${index}` === formData.locationId
    );
    
    if (!selectedLocation) {
      toast.error('Selected location not found');
      return;
    }

    setIsLoading(true);

    try {
      // Show immediate feedback
      toast.loading('Preparing transaction...', { id: 'product-create' });

      // Request account (non-blocking if already connected)
      await blockchainService.requestAccount();

      // ✅ OPTIMIZED: Run checks in PARALLEL for faster response
      // Only check product existence on blockchain (faster than API check)
      toast.loading('Validating product...', { id: 'product-create' });
      
      const [isAuthorized, blockchainProductCheck] = await Promise.allSettled([
        blockchainService.isAuthorizedManufacturer(account),
        blockchainService.checkProductExists(formData.productId)
      ]);

      // Check authorization
      const authorized = isAuthorized.status === 'fulfilled' && isAuthorized.value === true;
      if (!authorized) {
        toast.error('❌ You are not an authorized manufacturer. Only authorized manufacturers can create products. Please contact the contract owner to get authorized.');
        setIsLoading(false);
        return;
      }

      // Check if product exists (only blockchain check - faster)
      const exists = blockchainProductCheck.status === 'fulfilled' && blockchainProductCheck.value === true;
      
      if (exists) {
        toast.dismiss('product-create');
        toast.error('Product ID already exists');
        setIsLoading(false);
        return;
      }

      // Validate expiry date
      if (!formData.expiryDate) {
        toast.error('Please enter an expiry date');
        setIsLoading(false);
        return;
      }

      const expiryDate = new Date(formData.expiryDate).getTime();
      if (expiryDate <= Date.now()) {
        toast.error('Expiry date must be in the future');
        setIsLoading(false);
        return;
      }

      // Validate batch number
      if (!formData.batchNumber || formData.batchNumber.trim() === '') {
        toast.error('Please enter a batch number');
        setIsLoading(false);
        return;
      }

      // ✅ OPTIMIZED: Submit transaction and get hash immediately (don't wait for confirmation)
      toast.loading('Submitting transaction to blockchain...', { id: 'product-create' });
      
      const { txHash } = await blockchainService.createProduct({
        productId: formData.productId,
        manufacturerName: formData.manufacturerName,
        productName: formData.productName,
        productCode: formData.productCode,
        category: formData.category,
        price: parseFloat(formData.price),
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        expiryDate: expiryDate,
        batchNumber: formData.batchNumber.trim(),
      });

      // Normalize account address to ensure consistent format
      const normalizedAccountForSave = account ? account.toLowerCase() : '';
      
      // Prepare product data with actual txHash
      const newProduct = {
        productId: formData.productId,
        manufacturerName: formData.manufacturerName,
        productName: formData.productName,
        productCode: formData.productCode,
        category: formData.category,
        price: parseFloat(formData.price),
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        location: selectedLocation.name, // Store location name
        owner: normalizedAccountForSave,
        currentOwner: normalizedAccountForSave,
        manufacturer: normalizedAccountForSave, // Store manufacturer address (normalized)
        createdBy: normalizedAccountForSave, // Track who created it (normalized)
        status: "Manufactured",
        expiryDate: formData.expiryDate.trim(),
        batchNumber: formData.batchNumber.trim(),
        txHash: txHash, // Transaction hash (confirmation happens in background)
        createdAt: new Date().toISOString(),
      };
      
      console.log(`💾 Saving product ${newProduct.productId} with manufacturer: ${normalizedAccountForSave}`);

      // ✅ Save to localStorage IMMEDIATELY (optimistic update)
      saveProduct(newProduct);

      // ✅ Update UI IMMEDIATELY - add product to state right away
      setCreatedProduct(newProduct);
      setGeneratedQR(`https://yourdomain.com/verify/${formData.productId}`);
      
      // ✅ Add product to myProducts state IMMEDIATELY (optimistic update)
      setMyProducts(prev => {
        const exists = prev.some(p => p.productId === newProduct.productId);
        if (!exists) {
          return [newProduct, ...prev];
        }
        return prev;
      });

      // ✅ Clear loading state IMMEDIATELY (transaction submitted, confirmation in background)
      setIsLoading(false);
      toast.dismiss('product-create');
      toast.success(`✅ Product created! Transaction: ${txHash.slice(0, 10)}...`);
      resetForm();
      
      // Store metadata in API/Firebase in background (non-blocking)
      // Don't wait for confirmation - store immediately with txHash
      (async () => {
        try {
          const apiReady = await isApiAvailable();
          if (apiReady) {
            await apiClient.createProductMetadata(formData.productId, {
              ...newProduct,
              txHash: txHash, // Use the txHash we already have
              createdAt: new Date().toISOString(),
            });
            console.log(`✅ Product metadata synced to Firebase: ${formData.productId}`);
          }
        } catch (apiError) {
          // Silently fail - non-critical
          console.debug('Background API sync failed:', apiError);
        }
      })();

      // Reload my products in background (non-blocking) to sync with blockchain
      loadMyProducts().catch(err => {
        console.debug('Background product reload failed:', err);
      });
    } catch (error: any) {
      console.error("Error:", error);
      const msg = error?.reason || error?.message || "Transaction failed";
      toast.error(msg);
      setIsLoading(false);
    }
  };

  const handleTransferToDistributor = (product: any) => {
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!pinAuth.isAuthenticated) {
      toast.error('Please authenticate with your PIN first');
      setPinAuth(prev => ({ ...prev, showPINModal: true }));
      return;
    }

    // Verify manufacturer is the owner
    const owner = product.currentOwner || product.owner || '';
    const normalizedOwner = owner ? owner.toLowerCase().trim() : '';
    const normalizedAccount = account ? account.toLowerCase().trim() : '';
    
    console.log(`🔍 Frontend owner check: owner="${normalizedOwner}", account="${normalizedAccount}", match=${normalizedOwner === normalizedAccount}`);
    
    if (!normalizedOwner || normalizedOwner !== normalizedAccount) {
      console.error(`❌ Frontend owner mismatch: owner="${normalizedOwner}", account="${normalizedAccount}"`);
      toast.error(`You are not the owner of this product. Current Owner: ${owner.slice(0, 6)}...${owner.slice(-4)}, Your Address: ${account.slice(0, 6)}...${account.slice(-4)}`);
      return;
    }

    setSelectedProductForTransfer(product);
    setDistributorAddress('');
    setShowTransferModal(true);
  };

  const handleConfirmTransfer = async () => {
    if (!selectedProductForTransfer || !account || !distributorAddress.trim()) {
      toast.error('Missing required information');
      return;
    }

    // Validate recipient address format
    if (!ethers.isAddress(distributorAddress)) {
      toast.error('Invalid distributor address format');
      return;
    }

    // Validate recipient (with role check)
    const validation = validateRecipient(distributorAddress, 'distributor', false);
    
    if (validation.errors.length > 0) {
      toast.error(validation.errors[0]);
      return;
    }

    // Show warnings if any
    if (validation.warnings.length > 0) {
      const proceed = window.confirm(
        `⚠️ Transfer Warning:\n\n${validation.warnings.join('\n')}\n\nDo you want to proceed?`
      );
      if (!proceed) {
        return;
      }
    }

    setIsTransferring(true);
    
    try {
      await blockchainService.requestAccount();

      // Get appropriate status
      const transferStatus = getTransferStatus('manufacturer', 'distributor');

      // Transfer ownership
      const receipt = await blockchainService.transferOwnership(
        selectedProductForTransfer.productId,
        ethers.getAddress(distributorAddress), // Checksummed address
        transferStatus
      );

      // Update localStorage with new status and owner immediately
      const existingProduct = getProduct(selectedProductForTransfer.productId);
      const updatedProduct = {
        ...selectedProductForTransfer,
        owner: ethers.getAddress(distributorAddress),
        currentOwner: ethers.getAddress(distributorAddress),
        status: transferStatus, // "Transferred to Distributor"
        txHash: receipt.txHash || existingProduct?.txHash || 'N/A',
        createdAt: existingProduct?.createdAt || selectedProductForTransfer.createdAt,
        updatedAt: new Date().toISOString(),
      };
      
      saveProduct(updatedProduct);

      // Update UI immediately (optimistic update)
      setMyProducts(prev => prev.map(p => 
        p.productId === selectedProductForTransfer.productId 
          ? { ...p, currentOwner: updatedProduct.currentOwner, status: updatedProduct.status }
          : p
      ));

      // Clear loading state immediately
      setIsTransferring(false);
      
      toast.success(`✅ Ownership transferred to distributor! TX: ${receipt.txHash.slice(0, 10)}...`);
      
      // Close modal immediately
      setShowTransferModal(false);
      setSelectedProductForTransfer(null);
      setDistributorAddress('');

      // Store transfer record in API in background (non-blocking)
      (async () => {
        try {
          const apiReady = await isApiAvailable();
          if (apiReady) {
            await apiClient.transferOwnership(selectedProductForTransfer.productId, {
              from: account || '',
              to: ethers.getAddress(distributorAddress),
              status: transferStatus,
            });
          }
        } catch (apiError) {
          console.debug('Background API sync failed:', apiError);
        }
      })();

      // Reload products in background (non-blocking) to sync with blockchain
      loadMyProducts().catch(err => {
        console.debug('Background product reload failed:', err);
      });
    } catch (error: any) {
      console.error('Error transferring ownership:', error);
      setIsTransferring(false);
      toast.error(error?.message || 'Failed to transfer ownership');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleAddRecipient = () => {
    if (!newRecipient.address.trim() || !ethers.isAddress(newRecipient.address)) {
      toast.error('Please enter a valid address');
      return;
    }

    if (!newRecipient.name.trim()) {
      toast.error('Please enter recipient name');
      return;
    }

    const success = addAuthorizedRecipient({
      address: newRecipient.address,
      role: newRecipient.role,
      name: newRecipient.name.trim(),
      verified: true,
    });

    if (success) {
      toast.success('✅ Recipient added to authorized list');
      setNewRecipient({ address: '', role: 'distributor', name: '' });
      setShowRecipientModal(false);
    } else {
      toast.error('Recipient already exists or invalid address');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Manufacturer Dashboard
        </h1>
        <p className="text-gray-600">
          Create new products and generate QR codes for blockchain tracking.
        </p>
      </div>

      {/* Wallet Banner */}
      <div className="card mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              🔐 Manufacturer Wallet
            </h3>
            {account ? (
              <p className="text-sm text-blue-700">
                Address: <span className="font-mono">{account}</span>
              </p>
            ) : (
              <p className="text-sm text-blue-700">Not connected</p>
            )}
          </div>

          <button
            onClick={account ? disconnect : connect}
            className={account ? "btn-secondary text-xs" : "btn-primary text-xs"}
          >
            {account ? "Disconnect" : "Connect Wallet"}
          </button>
        </div>
      </div>

      {pinAuth.isAuthenticated && isConnected && account ? (
        <>
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Form */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-6">Create New Product</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product ID
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    name="productId"
                    className="input-field"
                    value={formData.productId}
                    onChange={handleInputChange}
                    required
                  />
                  <button type="button" className="btn-secondary" onClick={generateProductId}>
                    Generate
                  </button>
                </div>

                {[
                  ["manufacturerName", "Manufacturer Name"],
                  ["productName", "Product Name"],
                  ["productCode", "Product Code"],
                  ["price", "Price (ETH)"],
                  ["batchNumber", "Batch/Lot Number"],
                ].map(([name, label]) => (
                  <div key={name}>
                    <label className="block text-sm mb-1">{label}</label>
                    <input
                      type="text"
                      name={name}
                      required
                      className="input-field"
                      value={(formData as any)[name]}
                      onChange={handleInputChange}
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-sm mb-1">Expiry Date</label>
                  <input
                    type="date"
                    name="expiryDate"
                    required
                    className="input-field"
                    value={formData.expiryDate}
                    onChange={handleInputChange}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-xs text-gray-500 mt-1">Select a future date</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Authorized Location *
                  </label>
                  {authorizedLocations.length === 0 ? (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-2">
                      <p className="text-sm text-yellow-800">
                        ⚠️ No authorized locations set. Please contact admin to set authorized locations for your manufacturer address.
                      </p>
                    </div>
                  ) : (
                    <>
                      <select
                        name="locationId"
                        required
                        value={formData.locationId}
                        onChange={handleInputChange}
                        className="input-field mb-2"
                      >
                        <option value="">Select an authorized location</option>
                        {authorizedLocations.map((loc: any, index: number) => (
                          <option key={index} value={`auth-loc-${index}`}>
                            {loc.locationName} ({loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mb-2">
                        These are the locations authorized by admin. You can only create products at these locations.
                      </p>
                    </>
                  )}
                  
                  {/* Show preview of selected authorized location on map */}
                  {formData.locationId && (
                    <div className="mt-2">
                      {(() => {
                        const selectedIndex = parseInt(formData.locationId.replace('auth-loc-', ''));
                        const selectedLoc = authorizedLocations[selectedIndex];
                        if (selectedLoc) {
                          return (
                            <LocationMap
                              location={{
                                lat: selectedLoc.latitude,
                                lng: selectedLoc.longitude,
                                name: selectedLoc.locationName,
                              }}
                              height="200px"
                              zoom={15}
                            />
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>

                <label className="block text-sm mb-1">Category</label>
                <select
                  name="category"
                  required
                  value={formData.category}
                  onChange={handleInputChange}
                  className="input-field"
                >
                  <option value="">Select category</option>
                  <option value="Medicine">Medicine</option>
                  <option value="Vaccine">Vaccine</option>
                  <option value="Medical Device">Medical Device</option>
                  <option value="Pharmaceutical">Pharmaceutical</option>
                </select>

                <button className="btn-primary w-full" disabled={isLoading}>
                  {isLoading ? "Processing..." : "Create Product"}
                </button>
              </form>
            </div>

            {/* QR + Info */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-6">Generated QR Code</h2>

              {generatedQR ? (
                <div className="text-center">
                  <QRCodeSVG value={generatedQR} size={200} />
                  <p className="text-xs mt-3">{generatedQR}</p>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-16">
                  Create a product to generate QR
                </p>
              )}

              {createdProduct && (
                <div className="mt-4 bg-green-50 p-3 rounded-lg">
                  <h3 className="font-bold text-green-800 mb-1">
                    ✅ Product Created!
                  </h3>
                  <p className="text-sm">
                    Product ID: {createdProduct.productId}
                  </p>
                  <p className="text-sm">
                    Transaction: {createdProduct.txHash}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Authorized Locations Section (set by admin) */}
          <div className="card mt-8">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">📍 Authorized Locations</h2>
              <p className="text-sm text-gray-600 mt-1">
                These locations are set by admin. You can only create products at these authorized locations.
              </p>
            </div>

            {authorizedLocations.length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ No authorized locations set. Please contact admin to set authorized locations for your manufacturer address.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {authorizedLocations.map((loc: any, index: number) => (
                    <div key={index} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="font-medium text-gray-800">{loc.locationName}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        📍 {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)} | Radius: {loc.radius.toFixed(0)}m
                      </div>
                    </div>
                  ))}
                </div>
                <LocationMap
                  authorizedLocations={authorizedLocations.map((loc: any) => ({
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
              </>
            )}
          </div>

          {/* My Products & Transfer Section */}
          <div className="card mt-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">📦 My Products</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Select a product to view details and transfer ownership.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRecipientModal(true)}
                  className="btn-secondary text-sm"
                >
                  + Add Recipient
                </button>
                <button
                  onClick={loadMyProducts}
                  className="btn-secondary text-sm"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            {isLoadingMyProducts ? (
              <p className="text-gray-500 text-center py-8">
                Loading products...
              </p>
            ) : myProducts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">
                  No products found. Create a product to see it here.
                </p>
                {account && (
                  <button
                    onClick={loadMyProducts}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Click here to refresh
                  </button>
                )}
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
                      const product = myProducts.find((p: any) => p.productId === productId);
                      setSelectedProduct(product || null);
                    }}
                    className="input-field w-full"
                  >
                    <option value="">-- Select a product --</option>
                    {myProducts.map((product: any) => (
                      <option key={product.productId} value={product.productId}>
                        {product.productName} ({product.productId}) - {product.status || 'Manufactured'}
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
                          <span className={`text-xs px-2 py-1 rounded ${
                            selectedProduct.status === 'Transferred to Distributor' 
                              ? 'bg-green-100 text-green-800' 
                              : selectedProduct.status === 'Manufactured'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {selectedProduct.status || 'Manufactured'}
                          </span>
                          {(selectedProduct.currentOwner || selectedProduct.owner)?.toLowerCase() !== account?.toLowerCase() && (
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                              Transferred
                            </span>
                          )}
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
                            <span className="font-medium text-gray-700">Category:</span>
                            <p className="text-gray-900">{selectedProduct.category}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Price:</span>
                            <p className="text-gray-900">{selectedProduct.price || 'N/A'} ETH</p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <span className="text-xs font-medium text-gray-700">Current Owner:</span>
                          <p className="text-xs text-gray-500 font-mono mt-1">
                            {selectedProduct.currentOwner || selectedProduct.owner}
                          </p>
                        </div>
                      </div>
                      <div className="ml-4">
                        {(selectedProduct.currentOwner || selectedProduct.owner)?.toLowerCase() === account?.toLowerCase() ? (
                          <button
                            onClick={() => handleTransferToDistributor(selectedProduct)}
                            className="btn-primary text-sm"
                            disabled={!pinAuth.isAuthenticated}
                          >
                            Transfer to Distributor
                          </button>
                        ) : (
                          <div className="text-xs text-gray-500 text-right">
                            <p className="font-medium mb-1">Owned by:</p>
                            <p className="font-mono">{((selectedProduct.currentOwner || selectedProduct.owner) || '').slice(0, 10)}...{((selectedProduct.currentOwner || selectedProduct.owner) || '').slice(-8)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Location Management Section */}
          <div className="card mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Manage Locations</h2>
              <button
                onClick={handleAddLocation}
                className="btn-primary text-sm"
              >
                + Add New Location
              </button>
            </div>

            {locations.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No locations added yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {locations.map(loc => (
                  <div
                    key={loc.id}
                    className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{loc.name}</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditLocation(loc)}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(loc.id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      Lat: {loc.latitude.toFixed(4)}, Lon: {loc.longitude.toFixed(4)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card text-center py-10">
          <p>Please connect your wallet to continue.</p>
        </div>
      )}

      {/* Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">
              {editingLocation ? 'Edit Location' : 'Add New Location'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location Name *
                </label>
                <input
                  type="text"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., Mumbai Warehouse"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Latitude (optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={locationForm.latitude}
                    onChange={(e) => setLocationForm(prev => ({ ...prev, latitude: e.target.value }))}
                    className="input-field"
                    placeholder="e.g., 19.0760"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Longitude (optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={locationForm.longitude}
                    onChange={(e) => setLocationForm(prev => ({ ...prev, longitude: e.target.value }))}
                    className="input-field"
                    placeholder="e.g., 72.8777"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveLocation}
                  className="btn-primary flex-1"
                >
                  {editingLocation ? 'Update' : 'Add'} Location
                </button>
                <button
                  onClick={() => {
                    setShowLocationModal(false);
                    setLocationForm({ name: '', latitude: '', longitude: '' });
                    setEditingLocation(null);
                  }}
                  className="btn-secondary flex-1"
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
              Set a PIN for this wallet address to secure your manufacturer dashboard. This PIN is linked to your connected wallet.
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
            <h3 className="text-xl font-semibold mb-4">🔐 Manufacturer Authentication</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter your security PIN for this wallet address to access the manufacturer dashboard.
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

      {/* Transfer to Distributor Modal */}
      {showTransferModal && selectedProductForTransfer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">🔄 Transfer to Distributor</h3>
            <p className="text-sm text-gray-600 mb-4">
              Transfer ownership of <strong>{selectedProductForTransfer.productName}</strong> to a distributor.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Distributor Address *
                </label>
                <input
                  type="text"
                  value={distributorAddress}
                  onChange={(e) => setDistributorAddress(e.target.value)}
                  className="input-field"
                  placeholder="0x..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the Ethereum address of the distributor
                </p>
              </div>

              {/* Show authorized distributors */}
              {getRecipientsByRole('distributor').length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-900 mb-2">Authorized Distributors:</p>
                  <div className="space-y-1">
                    {getRecipientsByRole('distributor').map((recipient) => (
                      <button
                        key={recipient.address}
                        onClick={() => setDistributorAddress(recipient.address)}
                        className="block w-full text-left text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-100 p-2 rounded"
                      >
                        {recipient.name} - {recipient.address.slice(0, 10)}...{recipient.address.slice(-8)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleConfirmTransfer}
                  className="btn-primary flex-1"
                  disabled={isTransferring || !distributorAddress.trim()}
                >
                  {isTransferring ? 'Transferring...' : 'Transfer Ownership'}
                </button>
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setSelectedProductForTransfer(null);
                    setDistributorAddress('');
                  }}
                  className="btn-secondary flex-1"
                  disabled={isTransferring}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Recipient Modal */}
      {showRecipientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">➕ Add Authorized Recipient</h3>
            <p className="text-sm text-gray-600 mb-4">
              Add a recipient address to the authorized whitelist for secure transfers.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Name *
                </label>
                <input
                  type="text"
                  value={newRecipient.name}
                  onChange={(e) => setNewRecipient(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., ABC Distributors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ethereum Address *
                </label>
                <input
                  type="text"
                  value={newRecipient.address}
                  onChange={(e) => setNewRecipient(prev => ({ ...prev, address: e.target.value }))}
                  className="input-field"
                  placeholder="0x..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  value={newRecipient.role}
                  onChange={(e) => setNewRecipient(prev => ({ ...prev, role: e.target.value as any }))}
                  className="input-field"
                >
                  <option value="distributor">Distributor</option>
                  <option value="delivery_hub">Delivery Hub</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddRecipient}
                  className="btn-primary flex-1"
                >
                  Add Recipient
                </button>
                <button
                  onClick={() => {
                    setShowRecipientModal(false);
                    setNewRecipient({ address: '', role: 'distributor', name: '' });
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManufacturerDashboard;
