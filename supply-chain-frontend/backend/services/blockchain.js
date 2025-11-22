const { ethers } = require('ethers');
const dotenv = require('dotenv');
dotenv.config();

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
  // Try environment variable first (but avoid problematic endpoints)
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
if (!contractAddress) {
  console.error('❌ CONTRACT_ADDRESS environment variable is not set!');
  console.error('⚠️ Please set CONTRACT_ADDRESS in your .env file.');
}

// Validate contract address format
const isValidEthereumAddress = (address) => {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
};

let contract = null;
if (contractAddress && isValidEthereumAddress(contractAddress)) {
  try {
    contract = new ethers.Contract(contractAddress, DRUG_CHAIN_ABI, provider);
  } catch (error) {
    console.error('❌ Failed to create contract instance:', error.message);
  }
} else if (contractAddress) {
  console.error(`❌ Invalid contract address format: ${contractAddress}`);
}

// Service methods
const blockchainService = {
  // Get product details from blockchain
  async getProduct(productId) {
    if (!contract) {
      throw new Error('Blockchain contract not initialized. Check CONTRACT_ADDRESS in .env file.');
    }
    try {
      const product = await contract.getProduct(productId);
      return {
        productId: product.productId,
        manufacturerName: product.manufacturerName,
        productName: product.productName,
        productCode: product.productCode,
        category: product.category,
        price: Number(product.price),
        latitude: Number(product.latitude),
        longitude: Number(product.longitude),
        currentOwner: product.currentOwner,
        status: product.status,
        createdAt: Number(product.createdAt) * 1000, // Convert to milliseconds
        // Include expiry date (convert Unix seconds to milliseconds)
        expiryDate: Number(product.expiryDate) * 1000,
        // Include batch number for completeness
        batchNumber: product.batchNumber,
        exists: product.exists
      };
    } catch (error) {
      // Check if it's a "Product does not exist" error (expected case)
      const errorMessage = error?.message || error?.reason || '';
      const isProductNotFound = 
        errorMessage.includes('Product does not exist') ||
        errorMessage.includes('does not exist') ||
        (error?.code === 'CALL_EXCEPTION' && errorMessage.includes('Product'));
      
      if (isProductNotFound) {
        // This is an expected error - product hasn't been created yet or doesn't exist
        // Create a clean error object without the full stack trace
        const notFoundError = new Error('Product does not exist');
        notFoundError.code = 'PRODUCT_NOT_FOUND';
        notFoundError.reason = 'Product does not exist';
        throw notFoundError;
      }
      
      // For other errors, log and throw
      console.error('Error fetching product from blockchain:', error);
      throw error;
    }
  },

  // Get product history
  async getProductHistory(productId) {
    if (!contract) {
      throw new Error('Blockchain contract not initialized. Check CONTRACT_ADDRESS in .env file.');
    }
    try {
      const history = await contract.getProductHistory(productId);
      return history;
    } catch (error) {
      // Check if it's a "Product does not exist" error (expected case)
      const errorMessage = error?.message || error?.reason || '';
      const isProductNotFound = 
        errorMessage.includes('Product does not exist') ||
        errorMessage.includes('does not exist') ||
        (error?.code === 'CALL_EXCEPTION' && errorMessage.includes('Product'));
      
      if (isProductNotFound) {
        const notFoundError = new Error('Product does not exist');
        notFoundError.code = 'PRODUCT_NOT_FOUND';
        notFoundError.reason = 'Product does not exist';
        throw notFoundError;
      }
      
      console.error('Error fetching product history:', error);
      throw error;
    }
  },

  // Get ownership transfers
  async getOwnershipTransfers(productId) {
    if (!contract) {
      throw new Error('Blockchain contract not initialized. Check CONTRACT_ADDRESS in .env file.');
    }
    try {
      const transfers = await contract.getOwnershipTransfers(productId);
      return transfers.map(transfer => ({
        productId: transfer.productId,
        from: transfer.from,
        to: transfer.to,
        status: transfer.status,
        timestamp: Number(transfer.timestamp) * 1000, // Convert to milliseconds
        hash: transfer.hash
      }));
    } catch (error) {
      // Check if it's a "Product does not exist" error (expected case)
      const errorMessage = error?.message || error?.reason || '';
      const isProductNotFound = 
        errorMessage.includes('Product does not exist') ||
        errorMessage.includes('does not exist') ||
        (error?.code === 'CALL_EXCEPTION' && errorMessage.includes('Product'));
      
      if (isProductNotFound) {
        const notFoundError = new Error('Product does not exist');
        notFoundError.code = 'PRODUCT_NOT_FOUND';
        notFoundError.reason = 'Product does not exist';
        throw notFoundError;
      }
      
      console.error('Error fetching ownership transfers:', error);
      throw error;
    }
  },

  // Verify product authenticity
  async verifyProduct(productId) {
    if (!contract) {
      throw new Error('Blockchain contract not initialized. Check CONTRACT_ADDRESS in .env file.');
    }
    try {
      const isAuthentic = await contract.verifyProduct(productId);
      return isAuthentic;
    } catch (error) {
      // Check if it's a "Product does not exist" error (expected case)
      const errorMessage = error?.message || error?.reason || '';
      const isProductNotFound = 
        errorMessage.includes('Product does not exist') ||
        errorMessage.includes('does not exist') ||
        (error?.code === 'CALL_EXCEPTION' && errorMessage.includes('Product'));
      
      if (isProductNotFound) {
        // Product doesn't exist, so it's not authentic
        return false;
      }
      
      console.error('Error verifying product:', error);
      throw error;
    }
  },

  // Check if product exists
  async checkProductExists(productId) {
    if (!contract) {
      throw new Error('Blockchain contract not initialized. Check CONTRACT_ADDRESS in .env file.');
    }
    try {
      const exists = await contract.checkProductExists(productId);
      return exists;
    } catch (error) {
      // If check fails, assume product doesn't exist
      console.warn('Error checking product existence:', error?.message);
      return false;
    }
  },

  // Get product manufacturer address
  async getProductManufacturer(productId) {
    if (!contract) {
      throw new Error('Blockchain contract not initialized. Check CONTRACT_ADDRESS in .env file.');
    }
    try {
      const manufacturer = await contract.getProductManufacturer(productId);
      return manufacturer;
    } catch (error) {
      const errorMessage = error?.message || error?.reason || '';
      const isProductNotFound = 
        errorMessage.includes('Product does not exist') ||
        errorMessage.includes('does not exist') ||
        (error?.code === 'CALL_EXCEPTION' && errorMessage.includes('Product'));
      
      if (isProductNotFound) {
        const notFoundError = new Error('Product does not exist');
        notFoundError.code = 'PRODUCT_NOT_FOUND';
        notFoundError.reason = 'Product does not exist';
        throw notFoundError;
      }
      
      console.error('Error getting product manufacturer:', error);
      throw error;
    }
  }
};

module.exports = blockchainService;