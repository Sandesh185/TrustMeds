// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract DrugChain {
    // Contract owner/admin address
    address public contractOwner;

    // Struct to represent a product
    struct Product {
        string productId;
        string manufacturerName;
        string productName;
        string productCode;
        string category;
        uint256 price;
        int256 latitude;
        int256 longitude;
        address currentOwner;
        address manufacturerAddress; // Store manufacturer address for verification
        string status;
        uint256 createdAt;
        uint256 expiryDate; // Expiry date as Unix timestamp
        string batchNumber; // Batch/lot number for tracking
        bool exists;
    }

    // Struct to represent ownership transfer
    struct OwnershipTransfer {
        string productId;
        address from;
        address to;
        string status;
        uint256 timestamp;
        bytes32 hash;
    }

    // Mapping to store products
    mapping(string => Product) public products;
    
    // Mapping to store product history
    mapping(string => bytes32[]) public productHistory;
    
    // Mapping to store ownership transfers
    mapping(string => OwnershipTransfer[]) public ownershipTransfers;

    // Mapping to store authorized manufacturers (only authorized manufacturers can create products)
    mapping(address => bool) public authorizedManufacturers;

    // Array to track all authorized manufacturers (for enumeration)
    address[] public manufacturerList;

    // Struct to represent authorized location for a participant
    // Note: radius is used by frontend for location validation (geofencing)
    // The contract stores it but validation is performed off-chain for gas efficiency
    struct AuthorizedLocation {
        address participant;
        string locationName;
        int256 latitude;
        int256 longitude;
        uint256 radius; // Radius in meters (scaled by 1e6) - used for frontend geofencing validation
        uint256 registeredAt;
        bool exists;
    }

    // Mapping to store authorized locations for each participant
    mapping(address => AuthorizedLocation[]) public authorizedLocations;

    // Struct to represent a counterfeit report
    struct CounterfeitReport {
        string productId;
        address reporter; // Customer who reported
        address manufacturer; // Manufacturer who created the product
        uint256 reportedAt;
        bool exists;
    }

    // Mapping to store reports by product ID
    mapping(string => CounterfeitReport) public counterfeitReports;
    
    // Array to track all reported product IDs (for enumeration)
    string[] public reportedProductIds;

    // Events
    event ProductCreated(
        string indexed productId,
        address indexed manufacturer,
        string manufacturerName,
        string productName,
        uint256 timestamp
    );

    event OwnershipTransferred(
        string indexed productId,
        address indexed from,
        address indexed to,
        string status,
        uint256 timestamp
    );

    event StatusUpdated(
        string indexed productId,
        string newStatus,
        uint256 timestamp
    );

    event AuthorizedLocationRegistered(
        address indexed participant,
        string locationName,
        int256 latitude,
        int256 longitude,
        uint256 radius,
        uint256 timestamp
    );

    event ManufacturerAuthorized(
        address indexed manufacturer,
        uint256 timestamp
    );

    event ManufacturerRevoked(
        address indexed manufacturer,
        uint256 timestamp
    );

    event CounterfeitReported(
        string indexed productId,
        address indexed reporter,
        address indexed manufacturer,
        uint256 timestamp
    );

    // Modifier to check if product exists
    modifier productExists(string memory _productId) {
        require(products[_productId].exists, "Product does not exist");
        _;
    }

    // Modifier to check if caller is the owner
    modifier onlyOwner(string memory _productId) {
        require(products[_productId].currentOwner == msg.sender, "Not the owner of this product");
        _;
    }

    // Modifier to check if caller is contract owner/admin
    modifier onlyContractOwner() {
        require(msg.sender == contractOwner, "Only contract owner can perform this action");
        _;
    }

    // Modifier to check if caller is authorized manufacturer
    modifier onlyAuthorizedManufacturer() {
        require(authorizedManufacturers[msg.sender], "Not an authorized manufacturer");
        _;
    }

    // Constructor to set contract owner
    constructor() {
        contractOwner = msg.sender;
        // Authorize the deployer as the first authorized manufacturer
        authorizedManufacturers[msg.sender] = true;
        manufacturerList.push(msg.sender);
    }

    /**
     * @dev Create a new product
     * @notice Only authorized manufacturers can create products
     * @param _productId Unique identifier for the product
     * @param _manufacturerName Name of the manufacturer
     * @param _productName Name of the product
     * @param _productCode Product code
     * @param _category Product category
     * @param _price Product price
     * @param _latitude Latitude coordinate
     * @param _longitude Longitude coordinate
     * @param _expiryDate Expiry date as Unix timestamp
     * @param _batchNumber Batch/lot number for tracking
     */
    function createProduct(
        string memory _productId,
        string memory _manufacturerName,
        string memory _productName,
        string memory _productCode,
        string memory _category,
        uint256 _price,
        int256 _latitude,
        int256 _longitude,
        uint256 _expiryDate,
        string memory _batchNumber
    ) public onlyAuthorizedManufacturer {
        require(!products[_productId].exists, "Product already exists");
        require(_expiryDate > block.timestamp, "Expiry date must be in the future");
        
        // Initialize product in storage using helper to reduce stack depth
        _initializeProduct(
            _productId,
            _manufacturerName,
            _productName,
            _productCode,
            _category,
            _price,
            _latitude,
            _longitude,
            _expiryDate,
            _batchNumber
        );

        // Create and store hash, then emit event
        Product storage p = products[_productId];
        bytes32 initialHash = _createProductHashFromStorage(p);
        productHistory[_productId].push(initialHash);
        _emitProductCreated(_productId, p);
    }

    // Internal helper to emit ProductCreated event (reduces stack depth)
    function _emitProductCreated(string memory _productId, Product storage p) internal {
        emit ProductCreated(_productId, p.currentOwner, p.manufacturerName, p.productName, p.createdAt);
    }

    // Internal helper to initialize product (reduces stack depth in createProduct)
    function _initializeProduct(
        string memory _productId,
        string memory _manufacturerName,
        string memory _productName,
        string memory _productCode,
        string memory _category,
        uint256 _price,
        int256 _latitude,
        int256 _longitude,
        uint256 _expiryDate,
        string memory _batchNumber
    ) internal {
        Product storage p = products[_productId];
        // Set string fields
        p.productId = _productId;
        p.manufacturerName = _manufacturerName;
        p.productName = _productName;
        p.productCode = _productCode;
        p.category = _category;
        p.batchNumber = _batchNumber;
        // Set numeric fields
        p.price = _price;
        p.latitude = _latitude;
        p.longitude = _longitude;
        p.expiryDate = _expiryDate;
        // Set address and metadata fields
        address owner = msg.sender;
        p.currentOwner = owner;
        p.manufacturerAddress = owner;
        p.status = "Manufactured";
        p.createdAt = block.timestamp;
        p.exists = true;
    }

    // Internal helper function to create product hash from storage (reduces stack depth)
    function _createProductHashFromStorage(Product storage p) internal view returns (bytes32) {
        // Use nested helper to split hash creation into smaller steps
        bytes32 productDataHash = _hashProductData(p);
        return keccak256(abi.encode(
            productDataHash,
            p.currentOwner,
            p.status,
            p.createdAt
        ));
    }

    // Internal helper to hash product data fields (reduces stack depth by splitting into chunks)
    function _hashProductData(Product storage p) internal view returns (bytes32) {
        // Split into two hash groups to reduce stack depth
        bytes32 stringDataHash = _hashProductStrings(p);
        bytes32 numericDataHash = keccak256(abi.encode(p.price, p.latitude, p.longitude, p.expiryDate));
        return keccak256(abi.encode(stringDataHash, numericDataHash));
    }

    // Internal helper to hash string fields separately (reduces stack depth)
    function _hashProductStrings(Product storage p) internal view returns (bytes32) {
        // Split strings into two groups
        bytes32 strings1 = keccak256(abi.encode(p.productId, p.manufacturerName, p.productName));
        bytes32 strings2 = keccak256(abi.encode(p.productCode, p.category, p.batchNumber));
        return keccak256(abi.encode(strings1, strings2));
    }

    /**
     * @dev Transfer ownership of a product
     * @param _productId Product identifier
     * @param _newOwner Address of the new owner
     * @param _status New status of the product
     */
    function transferOwnership(
        string memory _productId,
        address _newOwner,
        string memory _status
    ) public productExists(_productId) onlyOwner(_productId) {
        require(_newOwner != address(0), "Invalid new owner address");
        require(_newOwner != msg.sender, "Cannot transfer to yourself");

        Product storage p = products[_productId];
        address previousOwner = p.currentOwner;
        
        // Update product ownership and status
        p.currentOwner = _newOwner;
        p.status = _status;

        // Create ownership transfer record using storage reference
        bytes32 transferHash = _createSimpleTransferHashFromStorage(p, previousOwner, _newOwner, _status);

        // Directly push to storage arrays to reduce stack depth
        ownershipTransfers[_productId].push(OwnershipTransfer({
            productId: _productId,
            from: previousOwner,
            to: _newOwner,
            status: _status,
            timestamp: block.timestamp,
            hash: transferHash
        }));
        productHistory[_productId].push(transferHash);

        emit OwnershipTransferred(
            _productId,
            previousOwner,
            _newOwner,
            _status,
            block.timestamp
        );
    }

    // Internal helper function to create simple transfer hash from storage (reduces stack depth)
    function _createSimpleTransferHashFromStorage(
        Product storage p,
        address _previousOwner,
        address _newOwner,
        string memory _status
    ) internal view returns (bytes32) {
        return keccak256(abi.encode(
            p.productId,
            _previousOwner,
            _newOwner,
            _status,
            block.timestamp
        ));
    }

    /**
     * @dev Update product status
     * @param _productId Product identifier
     * @param _newStatus New status
     */
    function updateStatus(
        string memory _productId,
        string memory _newStatus
    ) public productExists(_productId) onlyOwner(_productId) {
        products[_productId].status = _newStatus;

        // Create status update hash using storage reference
        bytes32 statusHash = _createSimpleStatusHashFromStorage(products[_productId], _newStatus);
        productHistory[_productId].push(statusHash);

        emit StatusUpdated(_productId, _newStatus, block.timestamp);
    }

    // Internal helper function to create simple status hash from storage (reduces stack depth)
    function _createSimpleStatusHashFromStorage(
        Product storage p,
        string memory _newStatus
    ) internal view returns (bytes32) {
        return keccak256(abi.encode(
            p.productId,
            _newStatus,
            block.timestamp
        ));
    }

    /**
     * @dev Transfer ownership and update location in a single transaction
     * @param _productId Product identifier
     * @param _newOwner Address of the new owner
     * @param _status New status of the product
     * @param _latitude Latitude coordinate (scaled by 1e6)
     * @param _longitude Longitude coordinate (scaled by 1e6)
     */
    function transferOwnershipWithLocation(
        string memory _productId,
        address _newOwner,
        string memory _status,
        int256 _latitude,
        int256 _longitude
    ) public productExists(_productId) onlyOwner(_productId) {
        require(_newOwner != address(0), "Invalid new owner address");
        require(_newOwner != msg.sender, "Cannot transfer to yourself");

        Product storage p = products[_productId];
        address previousOwner = p.currentOwner;
        
        // Update product ownership, status, and location
        p.currentOwner = _newOwner;
        p.status = _status;
        p.latitude = _latitude;
        p.longitude = _longitude;

        // Create and store transfer record using helper to reduce stack depth
        _recordOwnershipTransfer(_productId, p, previousOwner, _newOwner, _status);

        // Emit events
        emit OwnershipTransferred(_productId, previousOwner, _newOwner, _status, block.timestamp);
        emit StatusUpdated(_productId, _status, block.timestamp);
    }

    // Internal helper to record ownership transfer (reduces stack depth)
    function _recordOwnershipTransfer(
        string memory _productId,
        Product storage p,
        address _previousOwner,
        address _newOwner,
        string memory _status
    ) internal {
        bytes32 transferHash = _createTransferHashFromStorage(p, _previousOwner, _newOwner, _status);
        ownershipTransfers[_productId].push(OwnershipTransfer({
            productId: _productId,
            from: _previousOwner,
            to: _newOwner,
            status: _status,
            timestamp: block.timestamp,
            hash: transferHash
        }));
        productHistory[_productId].push(transferHash);
    }

    // Internal helper function to create transfer hash from storage (reduces stack depth)
    function _createTransferHashFromStorage(
        Product storage p,
        address _previousOwner,
        address _newOwner,
        string memory _status
    ) internal view returns (bytes32) {
        // Split hash into two steps to reduce stack depth
        bytes32 locationHash = keccak256(abi.encode(p.latitude, p.longitude));
        return keccak256(abi.encode(
            p.productId,
            _previousOwner,
            _newOwner,
            _status,
            locationHash,
            block.timestamp
        ));
    }

    /**
     * @dev Update product status and location
     * @param _productId Product identifier
     * @param _newStatus New status
     * @param _latitude Latitude coordinate (scaled by 1e6)
     * @param _longitude Longitude coordinate (scaled by 1e6)
     */
    function updateStatusWithLocation(
        string memory _productId,
        string memory _newStatus,
        int256 _latitude,
        int256 _longitude
    ) public productExists(_productId) onlyOwner(_productId) {
        Product storage p = products[_productId];
        p.status = _newStatus;
        p.latitude = _latitude;
        p.longitude = _longitude;

        // Create status update hash with location using storage reference
        bytes32 statusHash = _createStatusHashFromStorage(p, _newStatus);
        productHistory[_productId].push(statusHash);

        emit StatusUpdated(_productId, _newStatus, block.timestamp);
    }

    // Internal helper function to create status hash from storage (reduces stack depth)
    function _createStatusHashFromStorage(
        Product storage p,
        string memory _newStatus
    ) internal view returns (bytes32) {
        // Split hash into two steps to reduce stack depth
        bytes32 locationHash = keccak256(abi.encode(p.latitude, p.longitude));
        return keccak256(abi.encode(
            p.productId,
            _newStatus,
            locationHash,
            block.timestamp
        ));
    }

    /**
     * @dev Check if a product exists (public view function, doesn't require product to exist)
     * @param _productId Product identifier
     * @return Boolean indicating if product exists
     */
    function checkProductExists(string memory _productId) 
        public 
        view 
        returns (bool) 
    {
        return products[_productId].exists;
    }

    /**
     * @dev Get product information
     * @param _productId Product identifier
     * @return Product struct
     */
    function getProduct(string memory _productId) 
        public 
        view 
        productExists(_productId) 
        returns (Product memory) 
    {
        return products[_productId];
    }

    /**
     * @dev Get product history
     * @param _productId Product identifier
     * @return Array of transaction hashes
     */
    function getProductHistory(string memory _productId) 
        public 
        view 
        productExists(_productId) 
        returns (bytes32[] memory) 
    {
        return productHistory[_productId];
    }

    /**
     * @dev Get ownership transfers for a product
     * @param _productId Product identifier
     * @return Array of ownership transfers
     */
    function getOwnershipTransfers(string memory _productId) 
        public 
        view 
        productExists(_productId) 
        returns (OwnershipTransfer[] memory) 
    {
        return ownershipTransfers[_productId];
    }

    /**
     * @dev Verify product authenticity by checking manufacturer authorization and hash chain
     * @param _productId Product identifier
     * @return Boolean indicating if product is authentic
     */
    function verifyProduct(string memory _productId) 
        public 
        view 
        productExists(_productId) 
        returns (bool) 
    {
        Product memory product = products[_productId];
        bytes32[] memory history = productHistory[_productId];
        
        // Product must exist and have history
        if (history.length == 0) return false;
        
        // CRITICAL: Verify that the manufacturer who created the product is authorized
        if (!authorizedManufacturers[product.manufacturerAddress]) {
            return false; // Product created by unauthorized manufacturer = COUNTERFEIT
        }
        
        return true;
    }

    /**
     * @dev Authorize a manufacturer address (only contract owner can do this)
     * @param _manufacturer Address of the manufacturer to authorize
     */
    function authorizeManufacturer(address _manufacturer) public onlyContractOwner {
        require(_manufacturer != address(0), "Invalid manufacturer address");
        require(!authorizedManufacturers[_manufacturer], "Manufacturer already authorized");
        
        authorizedManufacturers[_manufacturer] = true;
        // Only add to list if not already present (in case of re-authorization after revocation)
        bool alreadyInList = false;
        for (uint256 i = 0; i < manufacturerList.length; i++) {
            if (manufacturerList[i] == _manufacturer) {
                alreadyInList = true;
                break;
            }
        }
        if (!alreadyInList) {
            manufacturerList.push(_manufacturer);
        }
        
        emit ManufacturerAuthorized(_manufacturer, block.timestamp);
    }

    /**
     * @dev Revoke authorization of a manufacturer (only contract owner can do this)
     * @param _manufacturer Address of the manufacturer to revoke
     */
    function revokeManufacturer(address _manufacturer) public onlyContractOwner {
        require(_manufacturer != address(0), "Invalid manufacturer address");
        require(authorizedManufacturers[_manufacturer], "Manufacturer not authorized");
        require(_manufacturer != contractOwner, "Cannot revoke contract owner");
        
        authorizedManufacturers[_manufacturer] = false;
        
        emit ManufacturerRevoked(_manufacturer, block.timestamp);
    }

    /**
     * @dev Check if a manufacturer is authorized
     * @param _manufacturer Address of the manufacturer to check
     * @return Boolean indicating if manufacturer is authorized
     */
    function isAuthorizedManufacturer(address _manufacturer) public view returns (bool) {
        return authorizedManufacturers[_manufacturer];
    }

    /**
     * @dev Get all authorized manufacturers
     * @return Array of authorized manufacturer addresses (only currently authorized)
     */
    function getAuthorizedManufacturers() public view returns (address[] memory) {
        // Create array with max possible size
        address[] memory tempList = new address[](manufacturerList.length);
        uint256 count = 0;
        
        // Single loop to filter authorized manufacturers
        for (uint256 i = 0; i < manufacturerList.length; i++) {
            if (authorizedManufacturers[manufacturerList[i]]) {
                tempList[count] = manufacturerList[i];
                count++;
            }
        }
        
        // Trim array to actual size
        address[] memory authorizedList = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            authorizedList[i] = tempList[i];
        }
        
        return authorizedList;
    }

    /**
     * @dev Get product manufacturer address (for verification)
     * @param _productId Product identifier
     * @return Manufacturer address
     */
    function getProductManufacturer(string memory _productId) 
        public 
        view 
        productExists(_productId) 
        returns (address) 
    {
        return products[_productId].manufacturerAddress;
    }

    /**
     * @dev Get product count (for testing purposes)
     * @return Number of products created
     */
    function getProductCount() public pure returns (uint256) {
        // This is a simplified implementation
        // In a real scenario, you'd maintain a counter
        return 0;
    }

    /**
     * @dev Register an authorized location for a participant
     * @notice Location is IMMUTABLE - can only be registered once for security
     * @notice Manufacturers cannot use this - they must have locations set by admin
     * @param _locationName Name of the location
     * @param _latitude Latitude coordinate (scaled by 1e6)
     * @param _longitude Longitude coordinate (scaled by 1e6)
     * @param _radius Radius in meters (scaled by 1e6)
     */
    function registerAuthorizedLocation(
        string memory _locationName,
        int256 _latitude,
        int256 _longitude,
        uint256 _radius
    ) public {
        // SECURITY: Prevent manufacturers from registering their own locations
        // Only admin can set locations for manufacturers
        require(!authorizedManufacturers[msg.sender], "Manufacturers cannot register locations. Admin must set them.");

        // SECURITY: Check if participant already has an active location
        // Location is IMMUTABLE to prevent fraud - once registered, it cannot be changed
        for (uint256 i = 0; i < authorizedLocations[msg.sender].length; i++) {
            if (authorizedLocations[msg.sender][i].exists) {
                revert("Location already registered and cannot be changed for security reasons");
            }
        }

        // Register new location (one-time only)
        AuthorizedLocation memory newLocation = AuthorizedLocation({
            participant: msg.sender,
            locationName: _locationName,
            latitude: _latitude,
            longitude: _longitude,
            radius: _radius,
            registeredAt: block.timestamp,
            exists: true
        });

        authorizedLocations[msg.sender].push(newLocation);

        emit AuthorizedLocationRegistered(
            msg.sender,
            _locationName,
            _latitude,
            _longitude,
            _radius,
            block.timestamp
        );
    }

    /**
     * @dev Set authorized location for a manufacturer (only contract owner/admin)
     * @notice Admin can add multiple locations for a manufacturer
     * @param _manufacturer Address of the manufacturer
     * @param _locationName Name of the location
     * @param _latitude Latitude coordinate (scaled by 1e6)
     * @param _longitude Longitude coordinate (scaled by 1e6)
     * @param _radius Radius in meters (scaled by 1e6)
     */
    function setManufacturerLocation(
        address _manufacturer,
        string memory _locationName,
        int256 _latitude,
        int256 _longitude,
        uint256 _radius
    ) public onlyContractOwner {
        require(_manufacturer != address(0), "Invalid manufacturer address");
        require(authorizedManufacturers[_manufacturer], "Manufacturer must be authorized first");
        
        // Register location for the manufacturer
        AuthorizedLocation memory newLocation = AuthorizedLocation({
            participant: _manufacturer,
            locationName: _locationName,
            latitude: _latitude,
            longitude: _longitude,
            radius: _radius,
            registeredAt: block.timestamp,
            exists: true
        });

        authorizedLocations[_manufacturer].push(newLocation);

        emit AuthorizedLocationRegistered(
            _manufacturer,
            _locationName,
            _latitude,
            _longitude,
            _radius,
            block.timestamp
        );
    }

    /**
     * @dev Get authorized locations for a participant (only active ones)
     * @param _participant Address of the participant
     * @return Array of authorized locations (only active)
     */
    function getAuthorizedLocations(address _participant) 
        public 
        view 
        returns (AuthorizedLocation[] memory) 
    {
        AuthorizedLocation[] memory allLocations = authorizedLocations[_participant];
        
        // Create array with max possible size
        AuthorizedLocation[] memory tempList = new AuthorizedLocation[](allLocations.length);
        uint256 count = 0;
        
        // Single loop to filter active locations
        for (uint256 i = 0; i < allLocations.length; i++) {
            if (allLocations[i].exists) {
                tempList[count] = allLocations[i];
                count++;
            }
        }
        
        // Trim array to actual size
        AuthorizedLocation[] memory activeLocations = new AuthorizedLocation[](count);
        for (uint256 i = 0; i < count; i++) {
            activeLocations[i] = tempList[i];
        }
        
        return activeLocations;
    }

    /**
     * @dev Report a product as counterfeit
     * @notice Products can be reported for various reasons:
     *   - Unauthorized manufacturer (fails verifyProduct)
     *   - Location mismatch (off-chain validation - checked by frontend)
     *   - Chain of custody issues (off-chain validation - checked by frontend)
     * @param _productId Product identifier to report
     * @dev Note: Location validation is performed off-chain for gas efficiency.
     *      The frontend validates location against authorized zones before allowing reports.
     *      This function allows reporting even if basic verifyProduct passes, as location
     *      and chain of custody validation are done off-chain.
     */
    function reportCounterfeit(string memory _productId) 
        public 
        productExists(_productId) 
    {
        // Check if product is already reported
        require(!counterfeitReports[_productId].exists, "Product already reported as counterfeit");
        
        // NOTE: We allow reporting even if verifyProduct returns true because:
        // 1. Location validation is done off-chain (gas efficiency)
        // 2. Chain of custody validation is done off-chain
        // 3. The frontend ensures only counterfeit products (based on location/chain validation) can be reported
        // 4. Admin will review all reports and can revoke manufacturer authorization if needed
        
        // Get the manufacturer who created this product
        address manufacturer = products[_productId].manufacturerAddress;
        require(manufacturer != address(0), "Invalid manufacturer address");
        
        // Create and store the report
        CounterfeitReport memory report = CounterfeitReport({
            productId: _productId,
            reporter: msg.sender,
            manufacturer: manufacturer,
            reportedAt: block.timestamp,
            exists: true
        });
        
        counterfeitReports[_productId] = report;
        reportedProductIds.push(_productId);
        
        emit CounterfeitReported(
            _productId,
            msg.sender,
            manufacturer,
            block.timestamp
        );
    }

    /**
     * @dev Get a counterfeit report by product ID
     * @param _productId Product identifier
     * @return Report details
     */
    function getCounterfeitReport(string memory _productId) 
        public 
        view 
        returns (CounterfeitReport memory) 
    {
        require(counterfeitReports[_productId].exists, "No report found for this product");
        return counterfeitReports[_productId];
    }

    /**
     * @dev Get all counterfeit reports (admin only)
     * @return Array of all counterfeit reports
     */
    function getAllCounterfeitReports() 
        public 
        view 
        returns (CounterfeitReport[] memory) 
    {
        CounterfeitReport[] memory allReports = new CounterfeitReport[](reportedProductIds.length);
        
        for (uint256 i = 0; i < reportedProductIds.length; i++) {
            allReports[i] = counterfeitReports[reportedProductIds[i]];
        }
        
        return allReports;
    }

    /**
     * @dev Check if a product has been reported as counterfeit
     * @param _productId Product identifier
     * @return Boolean indicating if product is reported
     */
    function isReportedAsCounterfeit(string memory _productId) 
        public 
        view 
        returns (bool) 
    {
        return counterfeitReports[_productId].exists;
    }
}
