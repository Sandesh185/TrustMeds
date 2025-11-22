import { useState, useEffect } from "react";
import { blockchainService } from "../utils/blockchain";
import { useWeb3 } from "../hooks/useWeb3";
import { toast } from "react-hot-toast";

interface ManufacturerLocation {
  manufacturerAddress: string;
  locations: any[];
}

const AdminPage = () => {
  const { isConnected, account, connect } = useWeb3();
  const [contractOwner, setContractOwner] = useState<string>("");
  const [isOwner, setIsOwner] = useState(false);
  const [authorizedManufacturers, setAuthorizedManufacturers] = useState<string[]>([]);
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [loadingManufacturers, setLoadingManufacturers] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [newManufacturerAddress, setNewManufacturerAddress] = useState("");
  
  // Location management state
  const [manufacturerLocations, setManufacturerLocations] = useState<Map<string, any[]>>(new Map());
  const [loadingLocations, setLoadingLocations] = useState<Map<string, boolean>>(new Map());
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("");
  const [locationForm, setLocationForm] = useState({
    locationName: "",
    latitude: "",
    longitude: "",
    radius: "5000", // Default 5km radius in meters
  });
  const [addingLocation, setAddingLocation] = useState(false);

  // Counterfeit reports state
  const [counterfeitReports, setCounterfeitReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Load contract owner and check if current user is owner
  useEffect(() => {
    if (isConnected && account) {
      loadContractOwner();
      loadAuthorizedManufacturers();
    }
  }, [isConnected, account]);

  // Load locations for all manufacturers when manufacturers list changes
  useEffect(() => {
    if (authorizedManufacturers.length > 0 && isOwner) {
      authorizedManufacturers.forEach((address) => {
        loadManufacturerLocations(address);
      });
    }
  }, [authorizedManufacturers, isOwner]);

  // Load counterfeit reports when admin is connected
  useEffect(() => {
    if (isOwner && isConnected) {
      loadCounterfeitReports();
    }
  }, [isOwner, isConnected]);

  const loadContractOwner = async () => {
    try {
      setLoadingOwner(true);
      const owner = await blockchainService.getContractOwner();
      setContractOwner(owner);
      
      // Check if current user is the contract owner
      if (account && owner.toLowerCase() === account.toLowerCase()) {
        setIsOwner(true);
      } else {
        setIsOwner(false);
      }
    } catch (error: any) {
      console.error("Failed to load contract owner:", error);
      toast.error("Failed to load contract owner");
    } finally {
      setLoadingOwner(false);
    }
  };

  const loadAuthorizedManufacturers = async () => {
    try {
      setLoadingManufacturers(true);
      const manufacturers = await blockchainService.getAuthorizedManufacturers();
      setAuthorizedManufacturers(manufacturers);
    } catch (error: any) {
      console.error("Failed to load authorized manufacturers:", error);
      toast.error("Failed to load authorized manufacturers");
    } finally {
      setLoadingManufacturers(false);
    }
  };

  const handleAuthorizeManufacturer = async () => {
    if (!newManufacturerAddress.trim()) {
      toast.error("Please enter a manufacturer address");
      return;
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(newManufacturerAddress.trim())) {
      toast.error("Invalid Ethereum address format");
      return;
    }

    try {
      setAuthorizing(true);
      const { txHash } = await blockchainService.authorizeManufacturer(newManufacturerAddress.trim());
      
      toast.success(
        `Manufacturer authorized successfully! View transaction: https://sepolia.etherscan.io/tx/${txHash}`,
        { duration: 8000 }
      );

      // Clear input and reload list
      setNewManufacturerAddress("");
      await loadAuthorizedManufacturers();
    } catch (error: any) {
      console.error("Failed to authorize manufacturer:", error);
      if (error.message.includes("not an authorized")) {
        toast.error("You are not the contract owner. Only the contract owner can authorize manufacturers.");
      } else if (error.message.includes("rejected")) {
        toast.error("Transaction was rejected");
      } else {
        toast.error(error.message || "Failed to authorize manufacturer");
      }
    } finally {
      setAuthorizing(false);
    }
  };

  const handleRevokeManufacturer = async (manufacturerAddress: string) => {
    // Check if trying to revoke contract owner
    if (manufacturerAddress.toLowerCase() === contractOwner.toLowerCase()) {
      toast.error("Cannot revoke the contract owner. The contract owner cannot be revoked for security reasons.");
      return;
    }

    if (!window.confirm(`Are you sure you want to revoke authorization for ${manufacturerAddress}?`)) {
      return;
    }

    try {
      setRevoking(true);
      const { txHash } = await blockchainService.revokeManufacturer(manufacturerAddress);
      
      toast.success(
        `Manufacturer authorization revoked successfully! View transaction: https://sepolia.etherscan.io/tx/${txHash}`,
        { duration: 8000 }
      );

      // Reload list
      await loadAuthorizedManufacturers();
    } catch (error: any) {
      console.error("Failed to revoke manufacturer:", error);
      if (error.message.includes("cannot revoke contract owner")) {
        toast.error("Cannot revoke the contract owner. The contract owner cannot be revoked for security reasons.");
      } else if (error.message.includes("not an authorized")) {
        toast.error("You are not the contract owner. Only the contract owner can revoke manufacturers.");
      } else if (error.message.includes("rejected")) {
        toast.error("Transaction was rejected");
      } else {
        toast.error(error.message || "Failed to revoke manufacturer");
      }
    } finally {
      setRevoking(false);
    }
  };

  const loadManufacturerLocations = async (manufacturerAddress: string) => {
    try {
      setLoadingLocations((prev) => new Map(prev).set(manufacturerAddress, true));
      const locations = await blockchainService.getAuthorizedLocations(manufacturerAddress);
      setManufacturerLocations((prev) => new Map(prev).set(manufacturerAddress, locations || []));
    } catch (error: any) {
      console.error(`Failed to load locations for ${manufacturerAddress}:`, error);
      setManufacturerLocations((prev) => new Map(prev).set(manufacturerAddress, []));
    } finally {
      setLoadingLocations((prev) => new Map(prev).set(manufacturerAddress, false));
    }
  };

  const handleOpenLocationModal = (manufacturerAddress: string) => {
    setSelectedManufacturer(manufacturerAddress);
    setLocationForm({
      locationName: "",
      latitude: "",
      longitude: "",
      radius: "5000",
    });
    setShowLocationModal(true);
  };

  const handleAddLocation = async () => {
    if (!selectedManufacturer) {
      toast.error("No manufacturer selected");
      return;
    }

    if (!locationForm.locationName.trim()) {
      toast.error("Please enter a location name");
      return;
    }

    const lat = parseFloat(locationForm.latitude);
    const lon = parseFloat(locationForm.longitude);
    const radius = parseFloat(locationForm.radius);

    if (isNaN(lat) || isNaN(lon) || isNaN(radius)) {
      toast.error("Please enter valid coordinates and radius");
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      toast.error("Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180");
      return;
    }

    if (radius <= 0 || radius > 100000) {
      toast.error("Radius must be between 1 and 100,000 meters");
      return;
    }

    setAddingLocation(true);
    try {
      const { txHash } = await blockchainService.setManufacturerLocation({
        manufacturerAddress: selectedManufacturer,
        locationName: locationForm.locationName.trim(),
        latitude: lat,
        longitude: lon,
        radius: radius,
      });

      toast.success(
        `Location added successfully! View transaction: https://sepolia.etherscan.io/tx/${txHash}`,
        { duration: 8000 }
      );

      // Reload locations for this manufacturer
      await loadManufacturerLocations(selectedManufacturer);
      
      // Close modal and reset form
      setShowLocationModal(false);
      setLocationForm({
        locationName: "",
        latitude: "",
        longitude: "",
        radius: "5000",
      });
    } catch (error: any) {
      console.error("Failed to add location:", error);
      if (error.message.includes("rejected")) {
        toast.error("Transaction was rejected");
      } else {
        toast.error(error.message || "Failed to add location");
      }
    } finally {
      setAddingLocation(false);
    }
  };

  const loadCounterfeitReports = async () => {
    try {
      setLoadingReports(true);
      const reports = await blockchainService.getAllCounterfeitReports();
      setCounterfeitReports(reports || []);
    } catch (error: any) {
      console.error("Failed to load counterfeit reports:", error);
      toast.error("Failed to load counterfeit reports");
      setCounterfeitReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleRevokeFromReport = async (manufacturerAddress: string, productId: string) => {
    // Check if trying to revoke contract owner
    if (manufacturerAddress.toLowerCase() === contractOwner.toLowerCase()) {
      toast.error("Cannot revoke the contract owner. The contract owner cannot be revoked for security reasons.");
      return;
    }

    if (!window.confirm(
      `Are you sure you want to revoke authorization for ${manufacturerAddress}?\n\n` +
      `This manufacturer created a counterfeit product (${productId}) that was reported by a customer.`
    )) {
      return;
    }

    try {
      setRevoking(true);
      const { txHash } = await blockchainService.revokeManufacturer(manufacturerAddress);
      
      toast.success(
        `Manufacturer authorization revoked successfully! View transaction: https://sepolia.etherscan.io/tx/${txHash}`,
        { duration: 8000 }
      );

      // Reload manufacturers and reports
      await loadAuthorizedManufacturers();
      await loadCounterfeitReports();
    } catch (error: any) {
      console.error("Failed to revoke manufacturer:", error);
      if (error.message.includes("cannot revoke contract owner")) {
        toast.error("Cannot revoke the contract owner. The contract owner cannot be revoked for security reasons.");
      } else if (error.message.includes("not an authorized")) {
        toast.error("You are not the contract owner. Only the contract owner can revoke manufacturers.");
      } else if (error.message.includes("rejected")) {
        toast.error("Transaction was rejected");
      } else {
        toast.error(error.message || "Failed to revoke manufacturer");
      }
    } finally {
      setRevoking(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Admin Dashboard</h1>
          <p className="text-gray-600 mb-6">Please connect your wallet to access the admin dashboard.</p>
          <button
            onClick={connect}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (loadingOwner && !contractOwner) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Admin Dashboard</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800">
              <strong>Access Denied:</strong> Only the contract owner can access this page.
            </p>
            <p className="text-yellow-700 mt-2 text-sm">
              Contract Owner: <code className="bg-yellow-100 px-2 py-1 rounded">{contractOwner}</code>
            </p>
            <p className="text-yellow-700 mt-2 text-sm">
              Your Address: <code className="bg-yellow-100 px-2 py-1 rounded">{account}</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
        
        {/* Contract Owner Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800">
            <strong>Contract Owner:</strong> <code className="bg-blue-100 px-2 py-1 rounded">{contractOwner}</code>
          </p>
          <p className="text-blue-700 mt-2 text-sm">
            Connected as: <code className="bg-blue-100 px-2 py-1 rounded">{account}</code>
          </p>
        </div>

        {/* Authorize New Manufacturer */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Authorize New Manufacturer</h2>
          <div className="flex gap-4">
            <input
              type="text"
              value={newManufacturerAddress}
              onChange={(e) => setNewManufacturerAddress(e.target.value)}
              placeholder="0x..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={handleAuthorizeManufacturer}
              disabled={authorizing || !newManufacturerAddress.trim()}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {authorizing ? "Authorizing..." : "Authorize"}
            </button>
          </div>
          <p className="text-gray-500 text-sm mt-2">
            Enter the Ethereum address of the manufacturer to authorize.
          </p>
        </div>

        {/* Authorized Manufacturers List */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Authorized Manufacturers ({authorizedManufacturers.length})
          </h2>
          
          {loadingManufacturers ? (
            <p className="text-gray-600">Loading manufacturers...</p>
          ) : authorizedManufacturers.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-600">No authorized manufacturers yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {authorizedManufacturers.map((address, index) => {
                const locations = manufacturerLocations.get(address) || [];
                const isLoading = loadingLocations.get(address) || false;
                
                return (
                  <div
                    key={index}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                          Authorized
                        </div>
                        <code className="text-gray-800">{address}</code>
                        {address.toLowerCase() === contractOwner.toLowerCase() && (
                          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
                            Contract Owner
                          </span>
                        )}
                        <a
                          href={`https://sepolia.etherscan.io/address/${address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 text-sm"
                        >
                          View on Etherscan
                        </a>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenLocationModal(address)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Add Location
                        </button>
                        <button
                          onClick={() => handleRevokeManufacturer(address)}
                          disabled={revoking || address.toLowerCase() === contractOwner.toLowerCase()}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                          title={address.toLowerCase() === contractOwner.toLowerCase() ? "Cannot revoke contract owner" : ""}
                        >
                          {revoking ? "Revoking..." : "Revoke"}
                        </button>
                      </div>
                    </div>
                    
                    {/* Authorized Locations for this Manufacturer */}
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        Authorized Locations ({locations.length})
                      </h3>
                      {isLoading ? (
                        <p className="text-sm text-gray-500">Loading locations...</p>
                      ) : locations.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No locations authorized yet. Add a location to allow this manufacturer to create products.</p>
                      ) : (
                        <div className="space-y-2">
                          {locations.map((loc, locIndex) => (
                            <div
                              key={locIndex}
                              className="bg-white border border-gray-200 rounded p-2 text-sm"
                            >
                              <div className="font-medium text-gray-800">{loc.locationName}</div>
                              <div className="text-gray-600 text-xs mt-1">
                                📍 {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)} | Radius: {loc.radius.toFixed(0)}m
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Counterfeit Reports Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-900">
              🚨 Counterfeit Reports ({counterfeitReports.length})
            </h2>
            <button
              onClick={loadCounterfeitReports}
              disabled={loadingReports}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
            >
              {loadingReports ? "Loading..." : "🔄 Refresh"}
            </button>
          </div>
          
          {loadingReports ? (
            <p className="text-gray-600">Loading reports...</p>
          ) : counterfeitReports.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-600">No counterfeit reports yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {counterfeitReports.map((report, index) => (
                <div
                  key={index}
                  className="bg-red-50 border-2 border-red-300 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🚨</span>
                        <h3 className="font-bold text-red-900">Counterfeit Product Reported</h3>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold text-gray-700">Product ID:</span>
                          <code className="ml-2 bg-white px-2 py-1 rounded font-mono text-gray-800">
                            {report.productId}
                          </code>
                        </div>
                        
                        <div>
                          <span className="font-semibold text-gray-700">Manufacturer:</span>
                          <code className="ml-2 bg-white px-2 py-1 rounded font-mono text-gray-800">
                            {report.manufacturer}
                          </code>
                          <a
                            href={`https://sepolia.etherscan.io/address/${report.manufacturer}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-500 hover:text-blue-700 text-xs"
                          >
                            View on Etherscan
                          </a>
                        </div>
                        
                        <div>
                          <span className="font-semibold text-gray-700">Reported by:</span>
                          <code className="ml-2 bg-white px-2 py-1 rounded font-mono text-gray-800">
                            {report.reporter}
                          </code>
                        </div>
                        
                        <div>
                          <span className="font-semibold text-gray-700">Reported at:</span>
                          <span className="ml-2 text-gray-600">
                            {new Date(report.reportedAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {!authorizedManufacturers.some(
                      (addr) => addr.toLowerCase() === report.manufacturer.toLowerCase()
                    ) ? (
                      <div className="ml-4 flex flex-col items-end">
                        <span className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap">
                          ✓ Manufacturer Revoked
                        </span>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRevokeFromReport(report.manufacturer, report.productId)}
                          disabled={revoking || report.manufacturer.toLowerCase() === contractOwner.toLowerCase()}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm whitespace-nowrap ml-4"
                          title={report.manufacturer.toLowerCase() === contractOwner.toLowerCase() ? "Cannot revoke contract owner" : ""}
                        >
                          {revoking ? "Revoking..." : "Revoke Manufacturer"}
                        </button>
                        {report.manufacturer.toLowerCase() === contractOwner.toLowerCase() && (
                          <span className="ml-2 text-xs text-gray-500 italic">
                            (Contract Owner - Cannot be revoked)
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-red-200">
                    <p className="text-xs text-red-700">
                      {!authorizedManufacturers.some(
                        (addr) => addr.toLowerCase() === report.manufacturer.toLowerCase()
                      ) ? (
                        <>
                          ✓ <strong>Status:</strong> This manufacturer has been revoked for creating a counterfeit product.
                        </>
                      ) : (
                        <>
                          ⚠️ <strong>Action Required:</strong> This manufacturer created a counterfeit product. 
                          Review the report and revoke their authorization if confirmed.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Add Authorized Location</h3>
              <button
                onClick={() => {
                  setShowLocationModal(false);
                  setLocationForm({
                    locationName: "",
                    latitude: "",
                    longitude: "",
                    radius: "5000",
                  });
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manufacturer Address
              </label>
              <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                {selectedManufacturer}
              </code>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location Name *
              </label>
              <input
                type="text"
                value={locationForm.locationName}
                onChange={(e) => setLocationForm({ ...locationForm, locationName: e.target.value })}
                placeholder="e.g., Main Factory, Warehouse A"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Radius (meters) *
              </label>
              <input
                type="number"
                value={locationForm.radius}
                onChange={(e) => setLocationForm({ ...locationForm, radius: e.target.value })}
                placeholder="5000"
                min="1"
                max="100000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Default: 5000m (5km). Maximum: 100,000m</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location Coordinates *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Latitude</label>
                  <input
                    type="number"
                    value={locationForm.latitude}
                    onChange={(e) => setLocationForm({ ...locationForm, latitude: e.target.value })}
                    placeholder="19.0760"
                    step="any"
                    min="-90"
                    max="90"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Longitude</label>
                  <input
                    type="number"
                    value={locationForm.longitude}
                    onChange={(e) => setLocationForm({ ...locationForm, longitude: e.target.value })}
                    placeholder="72.8777"
                    step="any"
                    min="-180"
                    max="180"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowLocationModal(false);
                  setLocationForm({
                    locationName: "",
                    latitude: "",
                    longitude: "",
                    radius: "5000",
                  });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLocation}
                disabled={addingLocation || !locationForm.locationName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {addingLocation ? "Adding..." : "Add Location"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;

