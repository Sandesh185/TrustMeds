const { ethers } = require('ethers');
const dotenv = require('dotenv');
const firebaseService = require('./firebase');
dotenv.config();

// Create interface for parsing logs
let contractInterface = null;

// Define ABI directly here to avoid dependency on frontend files
const DRUG_CHAIN_ABI = [
		{
		  "inputs": [],
		  "stateMutability": "nonpayable",
		  "type": "constructor"
		},
		{
		  "anonymous": false,
		  "inputs": [
			{
			  "indexed": true,
			  "internalType": "address",
			  "name": "participant",
			  "type": "address"
			},
			{
			  "indexed": false,
			  "internalType": "string",
			  "name": "locationName",
			  "type": "string"
			},
			{
			  "indexed": false,
			  "internalType": "int256",
			  "name": "latitude",
			  "type": "int256"
			},
			{
			  "indexed": false,
			  "internalType": "int256",
			  "name": "longitude",
			  "type": "int256"
			},
			{
			  "indexed": false,
			  "internalType": "uint256",
			  "name": "radius",
			  "type": "uint256"
			},
			{
			  "indexed": false,
			  "internalType": "uint256",
			  "name": "timestamp",
			  "type": "uint256"
			}
		  ],
		  "name": "AuthorizedLocationRegistered",
		  "type": "event"
		},
		{
		  "anonymous": false,
		  "inputs": [
			{
			  "indexed": true,
			  "internalType": "string",
			  "name": "productId",
			  "type": "string"
			},
			{
			  "indexed": true,
			  "internalType": "address",
			  "name": "reporter",
			  "type": "address"
			},
			{
			  "indexed": true,
			  "internalType": "address",
			  "name": "manufacturer",
			  "type": "address"
			},
			{
			  "indexed": false,
			  "internalType": "uint256",
			  "name": "timestamp",
			  "type": "uint256"
			}
		  ],
		  "name": "CounterfeitReported",
		  "type": "event"
		},
		{
		  "anonymous": false,
		  "inputs": [
			{
			  "indexed": true,
			  "internalType": "address",
			  "name": "manufacturer",
			  "type": "address"
			},
			{
			  "indexed": false,
			  "internalType": "uint256",
			  "name": "timestamp",
			  "type": "uint256"
			}
		  ],
		  "name": "ManufacturerAuthorized",
		  "type": "event"
		},
		{
		  "anonymous": false,
		  "inputs": [
			{
			  "indexed": true,
			  "internalType": "address",
			  "name": "manufacturer",
			  "type": "address"
			},
			{
			  "indexed": false,
			  "internalType": "uint256",
			  "name": "timestamp",
			  "type": "uint256"
			}
		  ],
		  "name": "ManufacturerRevoked",
		  "type": "event"
		},
		{
		  "anonymous": false,
		  "inputs": [
			{
			  "indexed": true,
			  "internalType": "string",
			  "name": "productId",
			  "type": "string"
			},
			{
			  "indexed": true,
			  "internalType": "address",
			  "name": "from",
			  "type": "address"
			},
			{
			  "indexed": true,
			  "internalType": "address",
			  "name": "to",
			  "type": "address"
			},
			{
			  "indexed": false,
			  "internalType": "string",
			  "name": "status",
			  "type": "string"
			},
			{
			  "indexed": false,
			  "internalType": "uint256",
			  "name": "timestamp",
			  "type": "uint256"
			}
		  ],
		  "name": "OwnershipTransferred",
		  "type": "event"
		},
		{
		  "anonymous": false,
		  "inputs": [
			{
			  "indexed": true,
			  "internalType": "string",
			  "name": "productId",
			  "type": "string"
			},
			{
			  "indexed": true,
			  "internalType": "address",
			  "name": "manufacturer",
			  "type": "address"
			},
			{
			  "indexed": false,
			  "internalType": "string",
			  "name": "manufacturerName",
			  "type": "string"
			},
			{
			  "indexed": false,
			  "internalType": "string",
			  "name": "productName",
			  "type": "string"
			},
			{
			  "indexed": false,
			  "internalType": "uint256",
			  "name": "timestamp",
			  "type": "uint256"
			}
		  ],
		  "name": "ProductCreated",
		  "type": "event"
		},
		{
		  "anonymous": false,
		  "inputs": [
			{
			  "indexed": true,
			  "internalType": "string",
			  "name": "productId",
			  "type": "string"
			},
			{
			  "indexed": false,
			  "internalType": "string",
			  "name": "newStatus",
			  "type": "string"
			},
			{
			  "indexed": false,
			  "internalType": "uint256",
			  "name": "timestamp",
			  "type": "uint256"
			}
		  ],
		  "name": "StatusUpdated",
		  "type": "event"
		},
		{
		  "inputs": [
			{
			  "internalType": "address",
			  "name": "_manufacturer",
			  "type": "address"
			}
		  ],
		  "name": "authorizeManufacturer",
		  "outputs": [],
		  "stateMutability": "nonpayable",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "address",
			  "name": "",
			  "type": "address"
			},
			{
			  "internalType": "uint256",
			  "name": "",
			  "type": "uint256"
			}
		  ],
		  "name": "authorizedLocations",
		  "outputs": [
			{
			  "internalType": "address",
			  "name": "participant",
			  "type": "address"
			},
			{
			  "internalType": "string",
			  "name": "locationName",
			  "type": "string"
			},
			{
			  "internalType": "int256",
			  "name": "latitude",
			  "type": "int256"
			},
			{
			  "internalType": "int256",
			  "name": "longitude",
			  "type": "int256"
			},
			{
			  "internalType": "uint256",
			  "name": "radius",
			  "type": "uint256"
			},
			{
			  "internalType": "uint256",
			  "name": "registeredAt",
			  "type": "uint256"
			},
			{
			  "internalType": "bool",
			  "name": "exists",
			  "type": "bool"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "address",
			  "name": "",
			  "type": "address"
			}
		  ],
		  "name": "authorizedManufacturers",
		  "outputs": [
			{
			  "internalType": "bool",
			  "name": "",
			  "type": "bool"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "_productId",
			  "type": "string"
			}
		  ],
		  "name": "checkProductExists",
		  "outputs": [
			{
			  "internalType": "bool",
			  "name": "",
			  "type": "bool"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [],
		  "name": "contractOwner",
		  "outputs": [
			{
			  "internalType": "address",
			  "name": "",
			  "type": "address"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "",
			  "type": "string"
			}
		  ],
		  "name": "counterfeitReports",
		  "outputs": [
			{
			  "internalType": "string",
			  "name": "productId",
			  "type": "string"
			},
			{
			  "internalType": "address",
			  "name": "reporter",
			  "type": "address"
			},
			{
			  "internalType": "address",
			  "name": "manufacturer",
			  "type": "address"
			},
			{
			  "internalType": "uint256",
			  "name": "reportedAt",
			  "type": "uint256"
			},
			{
			  "internalType": "bool",
			  "name": "exists",
			  "type": "bool"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "_productId",
			  "type": "string"
			},
			{
			  "internalType": "string",
			  "name": "_manufacturerName",
			  "type": "string"
			},
			{
			  "internalType": "string",
			  "name": "_productName",
			  "type": "string"
			},
			{
			  "internalType": "string",
			  "name": "_productCode",
			  "type": "string"
			},
			{
			  "internalType": "string",
			  "name": "_category",
			  "type": "string"
			},
			{
			  "internalType": "uint256",
			  "name": "_price",
			  "type": "uint256"
			},
			{
			  "internalType": "int256",
			  "name": "_latitude",
			  "type": "int256"
			},
			{
			  "internalType": "int256",
			  "name": "_longitude",
			  "type": "int256"
			},
			{
			  "internalType": "uint256",
			  "name": "_expiryDate",
			  "type": "uint256"
			},
			{
			  "internalType": "string",
			  "name": "_batchNumber",
			  "type": "string"
			}
		  ],
		  "name": "createProduct",
		  "outputs": [],
		  "stateMutability": "nonpayable",
		  "type": "function"
		},
		{
		  "inputs": [],
		  "name": "getAllCounterfeitReports",
		  "outputs": [
			{
			  "components": [
				{
				  "internalType": "string",
				  "name": "productId",
				  "type": "string"
				},
				{
				  "internalType": "address",
				  "name": "reporter",
				  "type": "address"
				},
				{
				  "internalType": "address",
				  "name": "manufacturer",
				  "type": "address"
				},
				{
				  "internalType": "uint256",
				  "name": "reportedAt",
				  "type": "uint256"
				},
				{
				  "internalType": "bool",
				  "name": "exists",
				  "type": "bool"
				}
			  ],
			  "internalType": "struct DrugChain.CounterfeitReport[]",
			  "name": "",
			  "type": "tuple[]"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "address",
			  "name": "_participant",
			  "type": "address"
			}
		  ],
		  "name": "getAuthorizedLocations",
		  "outputs": [
			{
			  "components": [
				{
				  "internalType": "address",
				  "name": "participant",
				  "type": "address"
				},
				{
				  "internalType": "string",
				  "name": "locationName",
				  "type": "string"
				},
				{
				  "internalType": "int256",
				  "name": "latitude",
				  "type": "int256"
				},
				{
				  "internalType": "int256",
				  "name": "longitude",
				  "type": "int256"
				},
				{
				  "internalType": "uint256",
				  "name": "radius",
				  "type": "uint256"
				},
				{
				  "internalType": "uint256",
				  "name": "registeredAt",
				  "type": "uint256"
				},
				{
				  "internalType": "bool",
				  "name": "exists",
				  "type": "bool"
				}
			  ],
			  "internalType": "struct DrugChain.AuthorizedLocation[]",
			  "name": "",
			  "type": "tuple[]"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [],
		  "name": "getAuthorizedManufacturers",
		  "outputs": [
			{
			  "internalType": "address[]",
			  "name": "",
			  "type": "address[]"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "_productId",
			  "type": "string"
			}
		  ],
		  "name": "getCounterfeitReport",
		  "outputs": [
			{
			  "components": [
				{
				  "internalType": "string",
				  "name": "productId",
				  "type": "string"
				},
				{
				  "internalType": "address",
				  "name": "reporter",
				  "type": "address"
				},
				{
				  "internalType": "address",
				  "name": "manufacturer",
				  "type": "address"
				},
				{
				  "internalType": "uint256",
				  "name": "reportedAt",
				  "type": "uint256"
				},
				{
				  "internalType": "bool",
				  "name": "exists",
				  "type": "bool"
				}
			  ],
			  "internalType": "struct DrugChain.CounterfeitReport",
			  "name": "",
			  "type": "tuple"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "_productId",
			  "type": "string"
			}
		  ],
		  "name": "getOwnershipTransfers",
		  "outputs": [
			{
			  "components": [
				{
				  "internalType": "string",
				  "name": "productId",
				  "type": "string"
				},
				{
				  "internalType": "address",
				  "name": "from",
				  "type": "address"
				},
				{
				  "internalType": "address",
				  "name": "to",
				  "type": "address"
				},
				{
				  "internalType": "string",
				  "name": "status",
				  "type": "string"
				},
				{
				  "internalType": "uint256",
				  "name": "timestamp",
				  "type": "uint256"
				},
				{
				  "internalType": "bytes32",
				  "name": "hash",
				  "type": "bytes32"
				}
			  ],
			  "internalType": "struct DrugChain.OwnershipTransfer[]",
			  "name": "",
			  "type": "tuple[]"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "_productId",
			  "type": "string"
			}
		  ],
		  "name": "getProduct",
		  "outputs": [
			{
			  "components": [
				{
				  "internalType": "string",
				  "name": "productId",
				  "type": "string"
				},
				{
				  "internalType": "string",
				  "name": "manufacturerName",
				  "type": "string"
				},
				{
				  "internalType": "string",
				  "name": "productName",
				  "type": "string"
				},
				{
				  "internalType": "string",
				  "name": "productCode",
				  "type": "string"
				},
				{
				  "internalType": "string",
				  "name": "category",
				  "type": "string"
				},
				{
				  "internalType": "uint256",
				  "name": "price",
				  "type": "uint256"
				},
				{
				  "internalType": "int256",
				  "name": "latitude",
				  "type": "int256"
				},
				{
				  "internalType": "int256",
				  "name": "longitude",
				  "type": "int256"
				},
				{
				  "internalType": "address",
				  "name": "currentOwner",
				  "type": "address"
				},
				{
				  "internalType": "address",
				  "name": "manufacturerAddress",
				  "type": "address"
				},
				{
				  "internalType": "string",
				  "name": "status",
				  "type": "string"
				},
				{
				  "internalType": "uint256",
				  "name": "createdAt",
				  "type": "uint256"
				},
				{
				  "internalType": "uint256",
				  "name": "expiryDate",
				  "type": "uint256"
				},
				{
				  "internalType": "string",
				  "name": "batchNumber",
				  "type": "string"
				},
				{
				  "internalType": "bool",
				  "name": "exists",
				  "type": "bool"
				}
			  ],
			  "internalType": "struct DrugChain.Product",
			  "name": "",
			  "type": "tuple"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [],
		  "name": "getProductCount",
		  "outputs": [
			{
			  "internalType": "uint256",
			  "name": "",
			  "type": "uint256"
			}
		  ],
		  "stateMutability": "pure",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "_productId",
			  "type": "string"
			}
		  ],
		  "name": "getProductHistory",
		  "outputs": [
			{
			  "internalType": "bytes32[]",
			  "name": "",
			  "type": "bytes32[]"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "_productId",
			  "type": "string"
			}
		  ],
		  "name": "getProductManufacturer",
		  "outputs": [
			{
			  "internalType": "address",
			  "name": "",
			  "type": "address"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "address",
			  "name": "_manufacturer",
			  "type": "address"
			}
		  ],
		  "name": "isAuthorizedManufacturer",
		  "outputs": [
			{
			  "internalType": "bool",
			  "name": "",
			  "type": "bool"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "_productId",
			  "type": "string"
			}
		  ],
		  "name": "isReportedAsCounterfeit",
		  "outputs": [
			{
			  "internalType": "bool",
			  "name": "",
			  "type": "bool"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "uint256",
			  "name": "",
			  "type": "uint256"
			}
		  ],
		  "name": "manufacturerList",
		  "outputs": [
			{
			  "internalType": "address",
			  "name": "",
			  "type": "address"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "",
			  "type": "string"
			},
			{
			  "internalType": "uint256",
			  "name": "",
			  "type": "uint256"
			}
		  ],
		  "name": "ownershipTransfers",
		  "outputs": [
			{
			  "internalType": "string",
			  "name": "productId",
			  "type": "string"
			},
			{
			  "internalType": "address",
			  "name": "from",
			  "type": "address"
			},
			{
			  "internalType": "address",
			  "name": "to",
			  "type": "address"
			},
			{
			  "internalType": "string",
			  "name": "status",
			  "type": "string"
			},
			{
			  "internalType": "uint256",
			  "name": "timestamp",
			  "type": "uint256"
			},
			{
			  "internalType": "bytes32",
			  "name": "hash",
			  "type": "bytes32"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "",
			  "type": "string"
			},
			{
			  "internalType": "uint256",
			  "name": "",
			  "type": "uint256"
			}
		  ],
		  "name": "productHistory",
		  "outputs": [
			{
			  "internalType": "bytes32",
			  "name": "",
			  "type": "bytes32"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "",
			  "type": "string"
			}
		  ],
		  "name": "products",
		  "outputs": [
			{
			  "internalType": "string",
			  "name": "productId",
			  "type": "string"
			},
			{
			  "internalType": "string",
			  "name": "manufacturerName",
			  "type": "string"
			},
			{
			  "internalType": "string",
			  "name": "productName",
			  "type": "string"
			},
			{
			  "internalType": "string",
			  "name": "productCode",
			  "type": "string"
			},
			{
			  "internalType": "string",
			  "name": "category",
			  "type": "string"
			},
			{
			  "internalType": "uint256",
			  "name": "price",
			  "type": "uint256"
			},
			{
			  "internalType": "int256",
			  "name": "latitude",
			  "type": "int256"
			},
			{
			  "internalType": "int256",
			  "name": "longitude",
			  "type": "int256"
			},
			{
			  "internalType": "address",
			  "name": "currentOwner",
			  "type": "address"
			},
			{
			  "internalType": "address",
			  "name": "manufacturerAddress",
			  "type": "address"
			},
			{
			  "internalType": "string",
			  "name": "status",
			  "type": "string"
			},
			{
			  "internalType": "uint256",
			  "name": "createdAt",
			  "type": "uint256"
			},
			{
			  "internalType": "uint256",
			  "name": "expiryDate",
			  "type": "uint256"
			},
			{
			  "internalType": "string",
			  "name": "batchNumber",
			  "type": "string"
			},
			{
			  "internalType": "bool",
			  "name": "exists",
			  "type": "bool"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "_locationName",
			  "type": "string"
			},
			{
			  "internalType": "int256",
			  "name": "_latitude",
			  "type": "int256"
			},
			{
			  "internalType": "int256",
			  "name": "_longitude",
			  "type": "int256"
			},
			{
			  "internalType": "uint256",
			  "name": "_radius",
			  "type": "uint256"
			}
		  ],
		  "name": "registerAuthorizedLocation",
		  "outputs": [],
		  "stateMutability": "nonpayable",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "_productId",
			  "type": "string"
			}
		  ],
		  "name": "reportCounterfeit",
		  "outputs": [],
		  "stateMutability": "nonpayable",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "uint256",
			  "name": "",
			  "type": "uint256"
			}
		  ],
		  "name": "reportedProductIds",
		  "outputs": [
			{
			  "internalType": "string",
			  "name": "",
			  "type": "string"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "address",
			  "name": "_manufacturer",
			  "type": "address"
			}
		  ],
		  "name": "revokeManufacturer",
		  "outputs": [],
		  "stateMutability": "nonpayable",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "address",
			  "name": "_manufacturer",
			  "type": "address"
			},
			{
			  "internalType": "string",
			  "name": "_locationName",
			  "type": "string"
			},
			{
			  "internalType": "int256",
			  "name": "_latitude",
			  "type": "int256"
			},
			{
			  "internalType": "int256",
			  "name": "_longitude",
			  "type": "int256"
			},
			{
			  "internalType": "uint256",
			  "name": "_radius",
			  "type": "uint256"
			}
		  ],
		  "name": "setManufacturerLocation",
		  "outputs": [],
		  "stateMutability": "nonpayable",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "_productId",
			  "type": "string"
			},
			{
			  "internalType": "address",
			  "name": "_newOwner",
			  "type": "address"
			},
			{
			  "internalType": "string",
			  "name": "_status",
			  "type": "string"
			}
		  ],
		  "name": "transferOwnership",
		  "outputs": [],
		  "stateMutability": "nonpayable",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "_productId",
			  "type": "string"
			},
			{
			  "internalType": "address",
			  "name": "_newOwner",
			  "type": "address"
			},
			{
			  "internalType": "string",
			  "name": "_status",
			  "type": "string"
			},
			{
			  "internalType": "int256",
			  "name": "_latitude",
			  "type": "int256"
			},
			{
			  "internalType": "int256",
			  "name": "_longitude",
			  "type": "int256"
			}
		  ],
		  "name": "transferOwnershipWithLocation",
		  "outputs": [],
		  "stateMutability": "nonpayable",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "_productId",
			  "type": "string"
			},
			{
			  "internalType": "string",
			  "name": "_newStatus",
			  "type": "string"
			}
		  ],
		  "name": "updateStatus",
		  "outputs": [],
		  "stateMutability": "nonpayable",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "_productId",
			  "type": "string"
			},
			{
			  "internalType": "string",
			  "name": "_newStatus",
			  "type": "string"
			},
			{
			  "internalType": "int256",
			  "name": "_latitude",
			  "type": "int256"
			},
			{
			  "internalType": "int256",
			  "name": "_longitude",
			  "type": "int256"
			}
		  ],
		  "name": "updateStatusWithLocation",
		  "outputs": [],
		  "stateMutability": "nonpayable",
		  "type": "function"
		},
		{
		  "inputs": [
			{
			  "internalType": "string",
			  "name": "_productId",
			  "type": "string"
			}
		  ],
		  "name": "verifyProduct",
		  "outputs": [
			{
			  "internalType": "bool",
			  "name": "",
			  "type": "bool"
			}
		  ],
		  "stateMutability": "view",
		  "type": "function"
		}
	  ]

// Connect to Ethereum network with fallback RPCs
const getRpcUrl = () => {
  // Try environment variable first
  if (process.env.INFURA_URL && !process.env.INFURA_URL.includes('ethereum-sepolia-rpc.publicnode.com')) {
    return process.env.INFURA_URL;
  }
  // Fallback to working public RPCs (prioritize most reliable)
  const fallbackRPCs = [
    'https://rpc.sepolia.org', // Official Sepolia RPC (most reliable)
    'https://sepolia-rpc.publicnode.com', // PublicNode Sepolia (alternative)
    'https://eth-sepolia.g.alchemy.com/v2/demo', // Alchemy demo endpoint
  ];
  return fallbackRPCs[0]; // Use most reliable first
};

// Create provider with retry logic
let provider = null;
try {
  provider = new ethers.JsonRpcProvider(getRpcUrl());
} catch (error) {
  console.error('Failed to create RPC provider:', error.message);
  // Try fallback RPC
  provider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');
}

// Contract instance
const contractAddress = process.env.CONTRACT_ADDRESS;

// Helper to validate Ethereum address
const isValidEthereumAddress = (address) => {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
};

// Validate contract address and provider before creating contract
let contract = null;
// Note: contractInterface is already declared at the top of the file

if (!contractAddress) {
  console.error('❌ CONTRACT_ADDRESS environment variable is not set!');
  console.error('⚠️ Event listeners cannot be initialized without contract address.');
  console.error('💡 Please set CONTRACT_ADDRESS in your .env file.');
} else if (!isValidEthereumAddress(contractAddress)) {
  console.error(`❌ Invalid contract address format: ${contractAddress}`);
  console.error('💡 Contract address must be a valid Ethereum address (0x followed by 40 hex characters).');
} else if (!provider) {
  console.error('❌ RPC provider is not initialized!');
  console.error('⚠️ Event listeners cannot be initialized without RPC provider.');
} else {
  try {
    // Create contract instance
    contract = new ethers.Contract(contractAddress, DRUG_CHAIN_ABI, provider);
    
    // Create interface for parsing event logs (assign to existing variable)
    contractInterface = new ethers.Interface(DRUG_CHAIN_ABI);
    
    console.log(`✅ Contract instance created: ${contractAddress}`);
  } catch (error) {
    console.error('❌ Failed to create contract instance:', error.message);
    contract = null;
    contractInterface = null; // Reset interface if contract creation fails
  }
}

// Set up event listeners
const setupEventListeners = () => {
  // Check if contract is initialized
  if (!contract) {
    console.warn('⚠️ Event listeners skipped - contract not initialized');
    console.warn('💡 Check that CONTRACT_ADDRESS is set in .env and RPC provider is working');
    console.warn('💡 Current CONTRACT_ADDRESS:', process.env.CONTRACT_ADDRESS || 'NOT SET');
    return;
  }
  
  console.log('Setting up blockchain event listeners...');
  console.log(`📋 Contract Address: ${contractAddress}`);

  // Listen for ProductCreated events
  contract.on('ProductCreated', async (...args) => {
    console.log('🔔 ProductCreated event received!');
    console.log(`   Event args count: ${args.length}`);
    try {
      // ethers.js v6 passes: (indexedParams..., regularParams..., eventObject)
      // Last argument is the event object with full details
      const eventObj = args[args.length - 1];
      console.log(`   Event object:`, eventObj ? 'present' : 'missing');
      console.log(`   Event log:`, eventObj?.log ? `block ${eventObj.log.blockNumber}, tx ${eventObj.log.transactionHash?.slice(0, 10)}...` : 'missing');
      
      // Extract values - handle Indexed wrapper for indexed parameters
      let productIdStr, manufacturerStr, manufacturerNameStr, productNameStr, timestampVal;
      
      // Check if we have the event object with args
      if (eventObj && eventObj.args) {
        const eventArgs = eventObj.args;
        
        // For indexed string parameters, ethers.js v6 wraps them in Indexed objects
        // The actual string value is not in the event (only hash is stored)
        // We need to get it from the contract or use the non-indexed parameters
        
        // Extract non-indexed parameters (these have actual values)
        manufacturerNameStr = String(eventArgs[2] || '');
        productNameStr = String(eventArgs[3] || '');
        timestampVal = eventArgs[4] || Date.now();
        
        // For indexed string parameters, we can't get the actual value from the event
        // Indexed strings are hashed in Solidity events
        // The frontend API call already stores the correct productId
        // This event listener is a backup - use transaction-based identifier
        const txHash = eventObj.log?.transactionHash || eventObj.log?.hash || '';
        
        // Extract manufacturer address (indexed, but addresses can be extracted)
        if (eventArgs[1] && typeof eventArgs[1] === 'object' && eventArgs[1]._isIndexed !== undefined) {
          // Indexed address - try to extract
          manufacturerStr = String(eventArgs[1].hash || eventArgs[1] || '');
        } else {
          manufacturerStr = String(eventArgs[1] || '');
        }
        
        // Generate a temporary productId based on transaction hash
        // The real productId is stored by the frontend API call
        // This allows us to track the event even if we can't get the exact productId
        productIdStr = `tx_${txHash.slice(2, 18)}`;
        
        // Note: The actual productId will be in Firebase from the frontend API call
        // This event record serves as a backup/verification
      } else {
        // Fallback: use transaction hash
        const txHash = args[args.length - 1]?.log?.transactionHash || '';
        productIdStr = `prod_${txHash.slice(0, 16)}_${Date.now()}`;
        manufacturerStr = String(args[1] || '');
        manufacturerNameStr = String(args[2] || '');
        productNameStr = String(args[3] || '');
        timestampVal = args[4] || Date.now();
      }
      
      // Try to get actual productId from transaction receipt
      const txHash = eventObj?.log?.transactionHash || eventObj?.log?.hash || '';
      let actualProductId = productIdStr;
      
      if (txHash) {
        try {
          // Method 1: Try to decode from transaction input data
          const tx = await provider.getTransaction(txHash);
          if (tx && tx.data) {
            try {
              const iface = contract.interface;
              const decoded = iface.parseTransaction({ data: tx.data });
              if (decoded && decoded.args && decoded.args.length > 0) {
                // createProduct function signature: createProduct(string memory _productId, ...)
                // First parameter should be productId
                const decodedProductId = String(decoded.args[0] || '');
                if (decodedProductId && decodedProductId !== '' && decodedProductId !== 'undefined' && decodedProductId !== '[object Object]') {
                  actualProductId = decodedProductId.trim();
                  console.log(`✅ Extracted productId from transaction input: ${actualProductId}`);
                }
              }
            } catch (decodeError) {
              console.log(`⚠️ Could not decode transaction input data: ${decodeError.message}`);
            }
          }
          
          // Method 2: Try to get from transaction receipt logs (more reliable)
          try {
            const receipt = await provider.getTransactionReceipt(txHash);
            if (receipt && receipt.logs && receipt.logs.length > 0) {
              // Find the ProductCreated event log
              for (const log of receipt.logs) {
                try {
                  const parsedLog = contractInterface.parseLog({
                    topics: log.topics,
                    data: log.data
                  });
                  
                  if (parsedLog && parsedLog.name === 'ProductCreated') {
                    // The productId is indexed, so we can't get it directly from the event
                    // But we can decode it from the transaction input
                    // Try to decode from the transaction input again with receipt context
                    if (tx && tx.data) {
                      const iface = contract.interface;
                      const decoded = iface.parseTransaction({ data: tx.data });
                      if (decoded && decoded.args && decoded.args.length > 0) {
                        const decodedProductId = String(decoded.args[0] || '').trim();
                        if (decodedProductId && decodedProductId !== '' && decodedProductId !== 'undefined' && decodedProductId !== '[object Object]') {
                          actualProductId = decodedProductId;
                          console.log(`✅ Extracted productId from transaction receipt: ${actualProductId}`);
                          break;
                        }
                      }
                    }
                  }
                } catch (parseError) {
                  // Continue to next log
                  continue;
                }
              }
            }
          } catch (receiptError) {
            console.log(`⚠️ Could not fetch transaction receipt: ${receiptError.message}`);
          }
          
          // Method 3: Check Firebase for products with this transaction hash (fallback)
          if (actualProductId.startsWith('tx_') || actualProductId.startsWith('prod_')) {
            try {
              // Query Firebase for products with this transaction hash
              const { getDocs, query, where, collection } = require('firebase/firestore');
              const { getFirestore } = require('firebase/firestore');
              const { initializeApp } = require('firebase/app');
              
              // Get Firebase instance (reuse existing)
              const firebaseApp = require('./firebase');
              // Note: We can't directly query here, but the frontend API call should have stored it
              // So we'll use the transaction-based ID and let the frontend API update it
              console.log(`ℹ️ Using transaction-based ID: ${actualProductId} (will be updated by frontend API if available)`);
            } catch (fbError) {
              // Ignore Firebase query errors
            }
          }
        } catch (txError) {
          console.log(`⚠️ Could not fetch transaction: ${txError.message}`);
        }
      }
      
      // Final validation
      if (!actualProductId || actualProductId === 'undefined' || actualProductId === '[object Object]' || actualProductId.trim() === '') {
        console.warn('⚠️ Could not extract productId, skipping...');
        return;
      }
      
      console.log(`📦 Product Created Event Detected:`);
      console.log(`   ProductId: ${actualProductId}`);
      console.log(`   Manufacturer: ${manufacturerStr}`);
      console.log(`   Manufacturer Name: ${manufacturerNameStr}`);
      console.log(`   Product Name: ${productNameStr}`);
      console.log(`   Transaction Hash: ${txHash}`);
      console.log(`   Block Number: ${eventObj?.log?.blockNumber?.toString() || 'N/A'}`);
      
      // Store event in Firebase (with retry and error handling)
      try {
        const productData = {
          productId: actualProductId,
          manufacturer: manufacturerStr,
          manufacturerName: manufacturerNameStr,
          productName: productNameStr,
          eventType: 'ProductCreated',
          blockNumber: eventObj?.log?.blockNumber?.toString() || '',
          transactionHash: txHash,
          timestamp: timestampVal ? new Date(Number(timestampVal) * 1000) : new Date(),
          _syncedByEventListener: true, // Flag to indicate this was synced by event listener
          _eventTimestamp: new Date() // When the event was processed
        };
        
        const result = await firebaseService.storeProductMetadata(productData);
        
        if (result.success) {
          console.log(`✅ Product metadata stored in Firebase: ${actualProductId}`);
          console.log(`   Firebase document ID: ${result.productId || actualProductId}`);
        } else if (result.offline) {
          console.log(`⚠️ Firebase is offline - product will be synced when Firebase comes back online`);
        } else {
          console.error(`⚠️ Failed to store product metadata in Firebase: ${result.error || 'Unknown error'}`);
        }
      } catch (firebaseError) {
        // Non-critical error - log but continue
        console.error(`⚠️ Failed to store product metadata in Firebase for ${actualProductId}:`, firebaseError.message);
        console.error(`   Error details:`, firebaseError);
        // Event listener continues to work even if Firebase fails
      }
    } catch (error) {
      console.error('Error processing ProductCreated event:', error);
      // Don't throw - event listeners should continue working
    }
  });

  // Listen for OwnershipTransferred events
  contract.on('OwnershipTransferred', async (...args) => {
    try {
      const eventObj = args[args.length - 1];
      const txHash = eventObj?.log?.transactionHash || eventObj?.log?.hash || '';
      const blockNumber = eventObj?.log?.blockNumber?.toString() || '';
      
      if (!txHash) {
        return;
      }
      
      // Extract available data from event
      let fromAddress = '';
      let toAddress = '';
      let statusStr = '';
      let timestampVal = Date.now();
      
      // Parse event log using contract interface for better extraction
      if (eventObj && eventObj.log && contractInterface) {
        try {
          const parsedLog = contractInterface.parseLog({
            topics: eventObj.log.topics,
            data: eventObj.log.data
          });
          
          if (parsedLog && parsedLog.args) {
            // OwnershipTransferred event structure:
            // productId (indexed string - hashed, can't extract),
            // from (indexed address - CAN extract),
            // to (indexed address - CAN extract),
            // status (non-indexed string - CAN extract),
            // timestamp (non-indexed uint256 - CAN extract)
            
            // Try named properties first
            fromAddress = String(parsedLog.args.from || parsedLog.args[1] || '');
            toAddress = String(parsedLog.args.to || parsedLog.args[2] || '');
            statusStr = String(parsedLog.args.status || parsedLog.args[3] || '');
            timestampVal = parsedLog.args.timestamp || parsedLog.args[4] || Date.now();
          }
        } catch (parseError) {
          // Fallback to eventObj.args if parsing fails
          if (eventObj.args) {
            const eventArgs = eventObj.args;
            // Indexed parameters come first: productId (indexed), from (indexed), to (indexed)
            // Then non-indexed: status, timestamp
            if (eventArgs.length >= 3) {
              fromAddress = String(eventArgs[1] || eventArgs.from || '');
              toAddress = String(eventArgs[2] || eventArgs.to || '');
            }
            if (eventArgs.length >= 5) {
              statusStr = String(eventArgs[3] || eventArgs.status || '');
              timestampVal = eventArgs[4] || eventArgs.timestamp || Date.now();
            }
          }
        }
      } else if (eventObj && eventObj.args) {
        // Direct args extraction
        const eventArgs = eventObj.args;
        if (eventArgs.length >= 3) {
          fromAddress = String(eventArgs[1] || eventArgs.from || '');
          toAddress = String(eventArgs[2] || eventArgs.to || '');
        }
        if (eventArgs.length >= 5) {
          statusStr = String(eventArgs[3] || eventArgs.status || '');
          timestampVal = eventArgs[4] || eventArgs.timestamp || Date.now();
        }
      }
      
      // Try to get productId from transaction receipt
      let productId = null;
      try {
        const txReceipt = await provider.getTransactionReceipt(txHash);
        if (txReceipt && txReceipt.logs) {
          // Parse transaction input to extract productId
          const tx = await provider.getTransaction(txHash);
          if (tx && tx.data) {
            // Try to decode the transaction data
            try {
              const iface = contract.interface;
              const decoded = iface.parseTransaction({ data: tx.data });
              if (decoded && decoded.args && decoded.args.length > 0) {
                // transferOwnership function signature: transferOwnership(string memory _productId, address _to, string memory _status)
                // First parameter should be productId
                productId = String(decoded.args[0] || '');
              }
            } catch (decodeError) {
              // If decoding fails, try to query contract state
              console.log(`⚠️ Could not decode transaction data for TX: ${txHash.slice(0, 10)}...`);
            }
          }
        }
      } catch (txError) {
        console.log(`⚠️ Could not fetch transaction receipt for TX: ${txHash.slice(0, 10)}...`);
      }
      
      // If we still don't have productId, try to query contract's recent transfers
      if (!productId || productId === '' || productId === 'undefined') {
        // Store event with transaction hash - we'll update it when frontend API calls with productId
        console.log(`📝 OwnershipTransferred event detected - TX: ${txHash.slice(0, 10)}... From: ${fromAddress.slice(0, 10)}... To: ${toAddress.slice(0, 10)}...`);
        
        // Store transfer record with transaction hash as temporary identifier
        // The frontend API call will update this with the correct productId
        try {
          await firebaseService.storeTransferRecord({
            productId: `tx_${txHash.slice(2, 18)}`, // Temporary ID based on transaction hash
            from: fromAddress,
            to: toAddress,
            status: statusStr,
            transactionHash: txHash,
            blockNumber: blockNumber,
            timestamp: timestampVal ? new Date(Number(timestampVal) * 1000) : new Date(),
            eventType: 'OwnershipTransferred',
            pendingProductId: true // Flag to indicate we need to update productId later
          });
          console.log(`✅ Transfer record stored in Firebase (TX: ${txHash.slice(0, 10)}...)`);
        } catch (firebaseError) {
          console.error('Error storing transfer record:', firebaseError.message);
        }
      } else {
        // We have productId, store the transfer record
        console.log(`📝 OwnershipTransferred event detected - ProductId: ${productId}, TX: ${txHash.slice(0, 10)}...`);
        
        try {
          await firebaseService.storeTransferRecord({
            productId: productId,
            from: fromAddress,
            to: toAddress,
            status: statusStr,
            transactionHash: txHash,
            blockNumber: blockNumber,
            timestamp: timestampVal ? new Date(Number(timestampVal) * 1000) : new Date(),
            eventType: 'OwnershipTransferred'
          });
          console.log(`✅ Transfer record stored in Firebase: ${productId}`);
          
          // Also update product status and current owner in Firebase
          try {
            await firebaseService.updateProductStatus(productId, statusStr, null, {
              currentOwner: toAddress,
              lastTransferTxHash: txHash,
              lastTransferBlockNumber: blockNumber
            });
          } catch (updateError) {
            // Non-critical - log but continue
            console.warn(`⚠️ Failed to update product status in Firebase for ${productId}:`, updateError.message);
          }
        } catch (firebaseError) {
          // Non-critical error - log but continue
          console.error(`⚠️ Failed to store transfer record in Firebase for ${productId}:`, firebaseError.message);
          // Event listener continues to work even if Firebase fails
        }
      }
    } catch (error) {
      console.error('Error processing OwnershipTransferred event:', error);
    }
  });

  // Listen for StatusUpdated events
  contract.on('StatusUpdated', async (...args) => {
    try {
      const eventObj = args[args.length - 1];
      let statusStr = '';
      const txHash = eventObj?.log?.transactionHash || eventObj?.log?.hash || '';
      const blockNumber = eventObj?.log?.blockNumber?.toString() || '';
      let timestampVal = Date.now();
      
      if (!txHash) {
        return;
      }
      
      // Extract status from event args
      if (eventObj && eventObj.args) {
        const eventArgs = eventObj.args;
        // StatusUpdated event: productId (indexed, can't extract), newStatus (non-indexed), timestamp (non-indexed)
        if (eventArgs.length >= 2) {
          statusStr = String(eventArgs[1] || eventArgs.newStatus || '');
          timestampVal = eventArgs[2] || eventArgs.timestamp || Date.now();
        }
      } else if (args.length > 1) {
        statusStr = String(args[1] || '');
        if (args.length > 2) {
          timestampVal = args[2] || Date.now();
        }
      }
      
      // Try to get productId from transaction receipt
      let productId = null;
      try {
        const tx = await provider.getTransaction(txHash);
        if (tx && tx.data) {
          // Try to decode the transaction data
          try {
            const iface = contract.interface;
            const decoded = iface.parseTransaction({ data: tx.data });
            if (decoded && decoded.args && decoded.args.length > 0) {
              // updateStatus function signature: updateStatus(string memory _productId, string memory _newStatus, int256 _latitude, int256 _longitude)
              // First parameter should be productId
              productId = String(decoded.args[0] || '');
            }
          } catch (decodeError) {
            console.log(`⚠️ Could not decode transaction data for TX: ${txHash.slice(0, 10)}...`);
          }
        }
      } catch (txError) {
        console.log(`⚠️ Could not fetch transaction for TX: ${txHash.slice(0, 10)}...`);
      }
      
      if (productId && productId !== '' && productId !== 'undefined') {
        // We have productId, update the product status in Firebase
        console.log(`📝 StatusUpdated event detected - ProductId: ${productId}, Status: ${statusStr || 'N/A'}, TX: ${txHash.slice(0, 10)}...`);
        
        try {
          await firebaseService.updateProductStatus(productId, statusStr, null);
          console.log(`✅ Product status updated in Firebase: ${productId} -> ${statusStr}`);
        } catch (firebaseError) {
          // Non-critical error - log but continue
          console.error(`⚠️ Failed to update product status in Firebase for ${productId}:`, firebaseError.message);
          // Event listener continues to work even if Firebase fails
        }
      } else {
        // Store event with transaction hash for later matching
        console.log(`📝 StatusUpdated event detected - Status: ${statusStr || 'N/A'}, TX: ${txHash.slice(0, 10)}... (productId will be stored via API)`);
        // Note: Frontend API call should update the product status with the correct productId
      }
    } catch (error) {
      console.error('Error processing StatusUpdated event:', error);
      // Don't throw - event listeners should continue working
    }
  });

  // Suppress filter not found errors (they're non-critical)
  // These errors occur when filters expire and are automatically recreated by ethers.js
  // The errors are handled at the process level in server.js
  // No action needed here - filters are automatically recreated
  // Note: Individual event handlers have try-catch blocks for error handling
  // Network/provider errors are handled at the process level in server.js

  console.log('✅ Blockchain event listeners set up successfully');
  console.log('📡 Listening for events on contract:', contractAddress);
  console.log('💾 Events will be automatically synced to Firebase');
};

// Export setupEventListeners function (will be a no-op if contract is not initialized)
module.exports = { setupEventListeners };