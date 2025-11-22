import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useParticipantWeb3 } from '../hooks/useParticipantWeb3';
import { blockchainService } from '../utils/blockchain';
import apiClient, { isApiAvailable } from '../utils/apiClient';
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

interface Shipment {
  id: string;
  productId: string;
  productName: string;
  from: string;
  to: string;
  status: 'Pending' | 'In Transit' | 'Delivered' | 'Failed';
  createdAt: string;
  estimatedDelivery: string;
}

const DeliveryHubDashboard = () => {
  const { isConnected, account, connect, disconnect } = useParticipantWeb3('deliveryHub');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoadingShipments, setIsLoadingShipments] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

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

  // Location input state for status updates
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ shipmentId: string; newStatus: Shipment['status'] } | null>(null);
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

  useEffect(() => {
    if (pinAuth.isAuthenticated && isConnected) loadShipments(false); // Don't show toast on initial load
  }, [isConnected, pinAuth.isAuthenticated]);

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
      console.log(`📋 Loading authorized locations for delivery hub: ${account}`);
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

    const success = await setPIN(account, pinAuth.newPIN, 'delivery-hub');
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

  const loadShipments = async (showToast: boolean = false) => {
    if (!account) {
      setShipments([]);
      return;
    }

    setIsLoadingShipments(true);
    try {
      // Get all products from localStorage immediately (fast)
      const allProducts = await blockchainService.getAllProducts(false);
      
      console.log(`Loading shipments for Delivery Hub: ${account}`);
      console.log(`Total products retrieved: ${allProducts.length}`);

      // SECURITY: Only show products that are:
      // 1. Owned by this Delivery Hub wallet address (ownership transferred)
      // 2. Status indicates transfer to Delivery Hub or in transit
      const deliveryHubProducts = allProducts.filter((p: any) => {
        const owner = (p.currentOwner || p.owner || '').toLowerCase();
        const deliveryHubAddress = account.toLowerCase();
        const status = String(p?.status || '').toLowerCase().trim();
        
        // Check 1: Ownership must be transferred to this Delivery Hub
        const isOwnedByDeliveryHub = owner === deliveryHubAddress;
        
        // Check 2: Status must indicate transfer to Delivery Hub
        // Accept: "Transferred to Delivery Hub" or any status after transfer
        const hasValidStatus = status.includes('transferred to delivery hub') ||
                               status.includes('transferred to delivery') ||
                               status.includes('in transit') ||
                               status.includes('at warehouse') ||
                               status.includes('delivered') ||
                               status === 'transferred to delivery hub';
        
        const isValid = isOwnedByDeliveryHub && hasValidStatus;
        
        if (isValid) {
          console.log(`✅ Product ${p.productId}: Owner=${owner.slice(0, 10)}..., Status="${status}"`);
        } else {
          console.log(`❌ Product ${p.productId} filtered out: Owner=${owner.slice(0, 10)}... (expected ${deliveryHubAddress.slice(0, 10)}...), Status="${status}"`);
        }
        
        return isValid;
      });

      if (deliveryHubProducts.length === 0) {
        console.log('No products found owned by this Delivery Hub.');
        console.log(`Delivery Hub Address: ${account}`);
        console.log('All products from blockchain:', allProducts.map((p: any) => ({
          id: p.productId,
          owner: (p.currentOwner || p.owner || '').slice(0, 10) + '...',
          status: p.status
        })));
        
        if (showToast) {
          toast.error(
            'No shipments found. Products will appear here after:\n' +
            '1. Distributor transfers ownership to your Delivery Hub address\n' +
            '2. Status is set to "Transferred to Delivery Hub"\n\n' +
            `Your address: ${account.slice(0, 10)}...${account.slice(-8)}`,
            { duration: 8000 }
          );
        }
      } else {
        console.log(`Found ${deliveryHubProducts.length} product(s) owned by Delivery Hub:`, deliveryHubProducts);
      }

      const shipmentList: Shipment[] = deliveryHubProducts.map((p: any) => {
        // Map blockchain status to shipment status
        const statusStr = (p.status || '').toLowerCase();
        let shipmentStatus: Shipment['status'] = 'Pending';
        
        if (statusStr.includes('in transit') || statusStr.includes('transferred')) {
          shipmentStatus = 'In Transit';
        } else if (statusStr.includes('delivered')) {
          shipmentStatus = 'Delivered';
        } else if (statusStr.includes('failed')) {
          shipmentStatus = 'Failed';
        }

        return {
          id: p.productId,
          productId: p.productId,
          productName: p.productName || p.productId,
          from: p.manufacturerName || 'Unknown',
          to: 'Delivery Location',
          status: shipmentStatus,
          createdAt: p.createdAt || new Date().toISOString(),
          estimatedDelivery: new Date(
            new Date(p.createdAt || Date.now()).getTime() + 2 * 24 * 60 * 60 * 1000
          ).toISOString(),
        };
      });

      setShipments(shipmentList);
      setIsLoadingShipments(false);
      
      // Only show toast on manual refresh, not on automatic load
      if (showToast && shipmentList.length > 0) {
        toast.success(`Loaded ${shipmentList.length} shipment(s)`);
      }

      // Sync with blockchain in background (non-blocking)
      blockchainService.getAllProducts(true).then(syncedProducts => {
        const syncedDeliveryHubProducts = syncedProducts.filter((p: any) => {
          const owner = (p.currentOwner || p.owner || '').toLowerCase();
          const deliveryHubAddress = account.toLowerCase();
          const status = String(p?.status || '').toLowerCase().trim();
          const isOwnedByDeliveryHub = owner === deliveryHubAddress;
          const hasValidStatus = status.includes('transferred to delivery hub') ||
                                 status.includes('transferred to delivery') ||
                                 status.includes('in transit') ||
                                 status.includes('at warehouse') ||
                                 status.includes('delivered') ||
                                 status === 'transferred to delivery hub';
          return isOwnedByDeliveryHub && hasValidStatus;
        });

        const syncedShipmentList: Shipment[] = syncedDeliveryHubProducts.map((p: any) => {
          const statusStr = (p.status || '').toLowerCase();
          let shipmentStatus: Shipment['status'] = 'Pending';
          if (statusStr.includes('in transit') || statusStr.includes('transferred')) {
            shipmentStatus = 'In Transit';
          } else if (statusStr.includes('delivered')) {
            shipmentStatus = 'Delivered';
          } else if (statusStr.includes('failed')) {
            shipmentStatus = 'Failed';
          }
          return {
            id: p.productId,
            productId: p.productId,
            productName: p.productName || p.productId,
            from: p.manufacturerName || 'Unknown',
            to: 'Delivery Location',
            status: shipmentStatus,
            createdAt: p.createdAt || new Date().toISOString(),
            estimatedDelivery: new Date(
              new Date(p.createdAt || Date.now()).getTime() + 2 * 24 * 60 * 60 * 1000
            ).toISOString(),
          };
        });
        setShipments(syncedShipmentList);
      }).catch(err => {
        console.debug('Background sync failed:', err);
      });
    } catch (error: any) {
      console.error('Error loading shipments:', error);
      setIsLoadingShipments(false);
      toast.error(error?.message || 'Failed to load shipments');
    }
  };

  const updateShipmentStatus = async (shipmentId: string, newStatus: Shipment['status']) => {
    if (!account) {
      toast.error('Connect your wallet first');
      return;
    }

    if (!pinAuth.isAuthenticated) {
      toast.error('Please authenticate with your PIN first');
      setPinAuth(prev => ({ ...prev, showPINModal: true }));
      return;
    }

    // Check if participant has registered authorized locations
    if (authorizedLocations.length === 0) {
      toast.error('Please register at least one authorized location before updating status');
      return;
    }

    // Reset form and show location input modal
    setLocationForm({ name: '', latitude: '', longitude: '' });
    setLocationValidation(null);
    setPendingStatusUpdate({ shipmentId, newStatus });
    setShowLocationModal(true);
  };

  const handleConfirmStatusUpdate = async () => {
    console.log('handleConfirmStatusUpdate called', { locationForm, pendingStatusUpdate, account });
    
    if (!pendingStatusUpdate || !account) {
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

    const { shipmentId, newStatus } = pendingStatusUpdate;

    // Validate location against authorized zones
    const authLocsFormatted: AuthorizedLocation[] = authorizedLocations.map((loc: any) => ({
      participant: loc.participant,
      locationName: loc.locationName,
      latitude: loc.latitude,
      longitude: loc.longitude,
      radius: loc.radius,
      registeredAt: loc.registeredAt,
    }));

    const validation = validateLocationAgainstAuthorizedZones(
      lat,
      lon,
      account,
      authLocsFormatted
    );

    setLocationValidation(validation);

    // Validation runs in background for logging, but warnings are NOT shown in participant dashboards
    // Counterfeit warnings only appear in Customer and Explorer dashboards
    // Log validation result for debugging but don't block transactions
    if (!validation.isValid) {
      console.log('⚠️ Location validation: Location mismatch detected (will be flagged in Customer/Explorer dashboards)', {
        warnings: validation.warnings,
        enteredLocation: { lat, lon, name: locationForm.name }
      });
    }

    setIsUpdating(shipmentId);
    setShowLocationModal(false);
    
    try {
      console.log(`Updating product ${shipmentId} to status: ${newStatus} with location`);
      const receipt = await blockchainService.updateStatusWithLocation(
        shipmentId,
        newStatus,
        lat,
        lon
      );
      console.log(`Transaction successful. TX: ${receipt.txHash}`);
      
      // Store status update in API if available
      try {
        const apiReady = await isApiAvailable();
        if (apiReady) {
          await apiClient.updateStatus(shipmentId, {
            status: newStatus,
            location: `${lat},${lon}`,
          });
          console.log('Status update stored in API');
        }
      } catch (apiError) {
        console.warn('Failed to store status update in API (non-critical):', apiError);
        // Non-critical error - update is already on blockchain
      }
      
      // Wait a moment for transaction to be mined and propagated
      toast.success(`Shipment updated to ${newStatus} with location. TX: ${receipt.txHash}`);
      
      // Wait 2 seconds for blockchain to update
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update localStorage with new status and location
      const storedProducts = JSON.parse(localStorage.getItem('drug_supply_chain_products') || '[]');
      const productIndex = storedProducts.findIndex((p: any) => p.productId === shipmentId);
      if (productIndex !== -1) {
        storedProducts[productIndex].status = newStatus;
        storedProducts[productIndex].latitude = lat;
        storedProducts[productIndex].longitude = lon;
        localStorage.setItem('drug_supply_chain_products', JSON.stringify(storedProducts));
        console.log(`Updated localStorage status and location for ${shipmentId} to ${newStatus}`);
      }
      
      // Force refresh from blockchain
      console.log('Refreshing shipments from blockchain...');
      await loadShipments(false); // Don't show toast on auto-refresh after update
      
      // Log the updated shipments
      const updatedProducts = await blockchainService.getAllProducts();
      const updatedProduct = updatedProducts.find((p: any) => p.productId === shipmentId);
      console.log(`After update - Product ${shipmentId} status on blockchain:`, updatedProduct?.status);
      
      // Reset state
      setLocationForm({ name: '', latitude: '', longitude: '' });
      setPendingStatusUpdate(null);
      setLocationValidation(null);
    } catch (error: any) {
      console.error('Error updating shipment status:', error);
      toast.error(error?.message || 'Failed to update status');
    } finally {
      setIsUpdating(null);
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
      const dt = new Date(s);
      return isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  };
  const formatDate = (d: any) => {
    const date = parseDate(d);
    return date ? date.toLocaleString() : 'N/A';
  };
  const getStatusColor = (status: Shipment['status']) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'In Transit': return 'bg-blue-100 text-blue-800';
      case 'Delivered': return 'bg-green-100 text-green-800';
      case 'Failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Delivery Hub Dashboard</h1>
            <p className="text-gray-600">Track shipments and update delivery status.</p>
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

      <div className="card bg-gradient-to-r from-green-50 to-teal-50 border-2 border-green-200 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-green-900 mb-1">🔐 Delivery Hub Wallet</h3>
            {account ? (
              <p className="text-sm text-green-700 font-mono">Address: {account}</p>
            ) : (
              <p className="text-sm text-green-700">Not connected</p>
            )}
          </div>
          <button
            onClick={account ? disconnect : connect}
            className={account ? 'btn-secondary text-xs' : 'btn-primary text-xs'}
          >
            {account ? 'Disconnect' : 'Connect Wallet'}
          </button>
        </div>
      </div>

      {!pinAuth.isAuthenticated ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">
            Please authenticate with your PIN to access the delivery hub dashboard.
          </p>
        </div>
      ) : !isConnected ? (
        <div className="card text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <button onClick={connect} className="btn-primary">Connect Wallet</button>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <div className="card text-center">
              <div className="text-2xl font-bold">{shipments.length}</div>
              <div className="text-sm text-gray-600">Total Shipments</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-blue-600">
                {shipments.filter(s => s.status === 'In Transit').length}
              </div>
              <div className="text-sm text-gray-600">In Transit</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-green-600">
                {shipments.filter(s => s.status === 'Delivered').length}
              </div>
              <div className="text-sm text-gray-600">Delivered</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {shipments.filter(s => s.status === 'Pending').length}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Active Shipments</h2>
              <button
                onClick={() => loadShipments(true)}
                className="btn-secondary text-sm"
                disabled={isUpdating !== null}
              >
                🔄 Refresh
              </button>
            </div>
            <div className="space-y-4">
              {shipments.map(s => (
                <div key={s.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{s.productName}</h3>
                      <p className="text-sm text-gray-600">Product ID: {s.productId}</p>
                      <p className="text-sm text-gray-600">From: {s.from} → To: {s.to}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(s.status)}`}>{s.status}</span>
                      <p className="text-xs text-gray-500 mt-1">Created: {formatDate(s.createdAt)}</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Estimated Delivery</p>
                      <p className="text-sm text-gray-600">{formatDate(s.estimatedDelivery)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Shipment ID</p>
                      <p className="text-sm text-gray-600 font-mono">{s.id}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {s.status === 'Pending' && (
                      <button
                        onClick={() => updateShipmentStatus(s.id, 'In Transit')}
                        disabled={isUpdating === s.id}
                        className="btn-primary text-sm"
                      >
                        {isUpdating === s.id ? 'Updating...' : 'Start Delivery'}
                      </button>
                    )}
                    {s.status === 'In Transit' && (
                      <>
                        <button
                          onClick={() => updateShipmentStatus(s.id, 'Delivered')}
                          disabled={isUpdating === s.id}
                          className="btn-primary text-sm"
                        >
                          {isUpdating === s.id ? 'Updating...' : 'Mark Delivered'}
                        </button>
                        <button
                          onClick={() => updateShipmentStatus(s.id, 'Failed')}
                          disabled={isUpdating === s.id}
                          className="btn-secondary text-sm"
                        >
                          {isUpdating === s.id ? 'Updating...' : 'Mark Failed'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {shipments.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No shipments available.</p>
                </div>
              )}
            </div>
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

      {/* Location Input Modal for Status Updates */}
      {showLocationModal && pendingStatusUpdate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">
                📍 Enter Current Location - {pendingStatusUpdate.newStatus}
              </h3>
              <button
                onClick={() => {
                  setShowLocationModal(false);
                  setLocationForm({ name: '', latitude: '', longitude: '' });
                  setPendingStatusUpdate(null);
                  setLocationValidation(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Please enter your current location as the delivery hub. This location will be validated against your registered authorized locations.
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
                      // Validate location when coordinates are entered
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
                      // Validate location when coordinates are entered
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

            <div className="mt-4">
              {/* Debug info - remove this later */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mb-2 text-xs text-gray-500 p-2 bg-gray-100 rounded">
                  Debug: name={locationForm.name ? '✓' : '✗'}, 
                  lat={locationForm.latitude ? '✓' : '✗'}, 
                  lon={locationForm.longitude ? '✓' : '✗'},
                  latValid={locationForm.latitude && !isNaN(parseFloat(locationForm.latitude)) ? '✓' : '✗'},
                  lonValid={locationForm.longitude && !isNaN(parseFloat(locationForm.longitude)) ? '✓' : '✗'},
                  updating={isUpdating !== null ? 'yes' : 'no'}
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Button clicked', { locationForm, pendingStatusUpdate });
                    if (!locationForm.name.trim() || !locationForm.latitude || !locationForm.longitude) {
                      toast.error('Please fill in all fields');
                      return;
                    }
                    const lat = parseFloat(locationForm.latitude);
                    const lon = parseFloat(locationForm.longitude);
                    if (isNaN(lat) || isNaN(lon)) {
                      toast.error('Please enter valid numbers for latitude and longitude');
                      return;
                    }
                    handleConfirmStatusUpdate();
                  }}
                  className="btn-primary flex-1"
                  disabled={isUpdating !== null}
                >
                  {isUpdating !== null 
                    ? 'Processing...' 
                    : `Confirm ${pendingStatusUpdate?.newStatus || 'Update'}`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationModal(false);
                    setLocationForm({ name: '', latitude: '', longitude: '' });
                    setPendingStatusUpdate(null);
                    setLocationValidation(null);
                  }}
                  className="btn-secondary flex-1"
                  disabled={isUpdating !== null}
                >
                  Cancel
                </button>
              </div>
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
              Set a PIN for this wallet address to secure your delivery hub dashboard. This PIN is linked to your connected wallet.
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
            <h3 className="text-xl font-semibold mb-4">🔐 Delivery Hub Authentication</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter your security PIN for this wallet address to access the delivery hub dashboard.
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

export default DeliveryHubDashboard;
