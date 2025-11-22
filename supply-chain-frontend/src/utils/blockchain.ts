// src/utils/blockchain.ts
import { ethers } from "ethers";

/**
 * Full working blockchain service for your frontend (TypeScript).
 * - Uses ethers v6 API (BrowserProvider / JsonRpcProvider)
 * - Handles MetaMask connection, network switching (Sepolia), fallbacks
 * - Exposes: requestAccount, createProduct, updateStatus, transferOwnership, getProduct, getAllProducts
 *
 * Replace CONTRACT_ADDRESS below with your deployed contract address (you gave it already).
 */

/* ===========================
   CONFIG
   =========================== */
// Contract address - use environment variable with fallback
export const CONTRACT_ADDRESS = 
  import.meta.env.VITE_CONTRACT_ADDRESS || 
  "0x3c17A630689F50a023c9c6E49cFfEDA3c49291E1";

// Parse RPC URLs from environment or use defaults
const getRpcUrls = (): string[] => {
  const envUrls = import.meta.env.VITE_RPC_URLS;
  if (envUrls) {
    return envUrls.split(',').map((url: string) => url.trim());
  }
  // Fallback to default RPC URLs
  return [
    "https://rpc.sepolia.org", // Public Sepolia RPC (free, no API key needed)
    "https://ethereum-sepolia-rpc.publicnode.com", // PublicNode (free)
    "https://sepolia-rpc.publicnode.com", // PublicNode alternative
    "https://sepolia.infura.io/v3/6dab3e86aa4d434eb6eacc622ffbab80", // Infura (may have rate limits)
    "https://sepolia.gateway.tenderly.co", // Tenderly
  ];
};

export const NETWORK_CONFIG = {
  chainId: Number(import.meta.env.VITE_NETWORK_CHAIN_ID) || 11155111, // Sepolia
  chainName: "Sepolia Testnet",
  // Multiple RPC endpoints for fallback (try public RPCs first to avoid rate limits)
  rpcUrls: getRpcUrls(),
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
  nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
};

/* ===========================
   ABI (keep full ABI here) 
   =========================== */
/* NOTE: ensure this matches your deployed contract ABI */
export const DRUG_CHAIN_ABI =[
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

/* ===========================
   TYPES
   =========================== */
type MaybeContract = ethers.Contract | null;
type MaybeProvider = ethers.BrowserProvider | ethers.JsonRpcProvider | null;
type MaybeSigner = ethers.Signer | null;

/* ===========================
   BLOCKCHAIN SERVICE
   =========================== */
export class BlockchainService {
  private contract: MaybeContract = null;
  private provider: MaybeProvider = null;
  private signer: MaybeSigner = null;
  private initialized = false;
  private lastProductFetch: Map<string, { data: any; timestamp: number }> = new Map();

  constructor() {
    // constructor intentionally lightweight; call initialize() when needed
  }

  /** Initialize provider, signer and contract. */
  async initialize(): Promise<void> {
    // Always refresh signer if using BrowserProvider (MetaMask) to ensure we use the current active account
    const hasWindow = typeof window !== "undefined";
    const ethereum = hasWindow ? (window as any).ethereum : undefined;
    
    if (ethereum && this.initialized && this.provider instanceof ethers.BrowserProvider) {
      // Refresh signer to use current active MetaMask account
      try {
        await this.provider.send("eth_requestAccounts", []);
        this.signer = await this.provider.getSigner();
        // Update contract with new signer
        const checksummedAddress = ethers.getAddress(CONTRACT_ADDRESS);
        this.contract = new ethers.Contract(checksummedAddress, DRUG_CHAIN_ABI, this.signer);
        return;
      } catch (error) {
        console.warn("Failed to refresh signer, reinitializing:", error);
        // Fall through to full reinitialization
      }
    }
    
    if (this.initialized && !ethereum) return;

    try {
      // prefer MetaMask (window.ethereum)
      const hasWindow = typeof window !== "undefined";
      const ethereum = hasWindow ? (window as any).ethereum : undefined;

      if (ethereum) {
        // Create BrowserProvider (ethers v6)
        this.provider = new ethers.BrowserProvider(ethereum);

        // Ensure user is on target chain (Sepolia)
        const targetHex = `0x${NETWORK_CONFIG.chainId.toString(16)}`;
        try {
          const currentChainHex = await this.provider.send("eth_chainId", []);
          if (String(currentChainHex).toLowerCase() !== targetHex.toLowerCase()) {
            // Attempt to switch network in MetaMask
            try {
              await ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: targetHex }],
              });
            } catch (switchError: any) {
              // If the chain hasn't been added, add it with a good RPC URL
              if (switchError?.code === 4902) {
                // Use the best available RPC (public RPC first to avoid rate limits)
                const bestRpcUrl = NETWORK_CONFIG.rpcUrls[0] || "https://rpc.sepolia.org";
                await ethereum.request({
                  method: "wallet_addEthereumChain",
                  params: [{
                    chainId: targetHex,
                    chainName: NETWORK_CONFIG.chainName,
                    rpcUrls: [bestRpcUrl], // Use best RPC URL
                    blockExplorerUrls: NETWORK_CONFIG.blockExplorerUrls,
                    nativeCurrency: NETWORK_CONFIG.nativeCurrency
                  }],
                });
              } else {
                // rethrow to let caller handle
                throw switchError;
              }
            }
          }
        } catch (e) {
          // Non-fatal: we'll still try to request accounts (some providers might not support eth_chainId)
          console.warn("Could not verify/switch chain id via provider:", e);
        }

        // Request accounts and set signer
        await this.provider.send("eth_requestAccounts", []);
        this.signer = await this.provider.getSigner();

        // Initialize contract with signer (read/write) - checksum the address
        const checksummedAddress = ethers.getAddress(CONTRACT_ADDRESS);
        this.contract = new ethers.Contract(checksummedAddress, DRUG_CHAIN_ABI, this.signer);
        this.initialized = true;
        return;
      }

        // No MetaMask: fallback to JsonRpcProvider (read-only) - try multiple RPCs
        if (NETWORK_CONFIG.rpcUrls && NETWORK_CONFIG.rpcUrls.length > 0) {
          let provider: ethers.JsonRpcProvider | null = null;
          let lastError: any = null;

          // Try each RPC endpoint until one works
          for (const rpcUrl of NETWORK_CONFIG.rpcUrls) {
            try {
              const testProvider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
                staticNetwork: true,
                batchMaxCount: 1, // Reduce batching to avoid rate limits
              });
              // Test the connection
              await testProvider.getBlockNumber();
              provider = testProvider;
              console.log(`Successfully connected to RPC: ${rpcUrl}`);
              break;
            } catch (error: any) {
              console.warn(`RPC endpoint failed: ${rpcUrl}`, error?.message);
              lastError = error;
              continue;
            }
          }

          if (!provider) {
            throw new Error(
              `All RPC endpoints failed. Last error: ${lastError?.message || "Unknown error"}. ` +
              `Please check your internet connection or use MetaMask.`
            );
          }

          this.provider = provider;
          // create a temporary random wallet as signer (read-only operations that need an address will use this)
          const tempWallet = ethers.Wallet.createRandom().connect(this.provider);
          this.signer = tempWallet;
          // Checksum the address before creating contract
          const checksummedAddress = ethers.getAddress(CONTRACT_ADDRESS);
          this.contract = new ethers.Contract(checksummedAddress, DRUG_CHAIN_ABI, this.provider);
          this.initialized = true;
          return;
        }

      throw new Error("No provider available (MetaMask not found and no RPC configured).");
    } catch (error: any) {
      // ensure typed error handling
      console.error("BlockchainService.initialize error:", error?.message ?? error);
      // keep initialized = false
      this.initialized = false;
      throw error;
    }
  }

  /** Ensure connected signer address (prompts user when using MetaMask). */
  async requestAccount(): Promise<string> {
    await this.initialize();
    if (!this.signer) throw new Error("No signer available");
    try {
      const addr = await this.signer.getAddress();
      return addr;
    } catch (error: any) {
      // If signer can't return address (read-only mode or user rejected), rethrow with friendly message
      console.error("requestAccount error:", error?.message ?? error);
      throw new Error("Unable to get account from signer. Please connect wallet in MetaMask.");
    }
  }

  /** Create product on-chain. price should be number (ETH). */
  async createProduct(data: {
    productId: string;
    manufacturerName: string;
    productName: string;
    productCode: string;
    category: string;
    price: number;
    latitude: number;
    longitude: number;
    expiryDate: number; // Unix timestamp
    batchNumber: string;
  }): Promise<{ txHash: string }> {
    await this.initialize();
    if (!this.contract || !this.provider) throw new Error("Blockchain not initialized");

    // ensure signer can send transactions
    if (!this.signer) throw new Error("No signer available to create product (connect MetaMask).");

    // Verify network via provider
    try {
      const network = await this.provider.getNetwork();
      if (Number(network.chainId) !== NETWORK_CONFIG.chainId) {
        throw new Error(`Wrong network. Please switch MetaMask to ${NETWORK_CONFIG.chainName}.`);
      }
    } catch (err) {
      // if provider.getNetwork fails, continue but log
      console.warn("Could not validate provider network:", err);
    }

    try {
      // price -> wei (ethers.parseEther returns bigint)
      const priceInWei = ethers.parseEther(String(data.price));

      // coordinates -> scaled int (match contract expectation)
      const lat = BigInt(Math.round(data.latitude * 1e6));
      const lon = BigInt(Math.round(data.longitude * 1e6));

      // expiryDate -> Unix timestamp (already in seconds, convert to BigInt)
      const expiryDate = BigInt(Math.floor(data.expiryDate / 1000)); // Convert milliseconds to seconds

      // call contract with retry for RPC errors
      const tx = await this.retryRpcCall(() => 
        this.contract!.createProduct(
          data.productId,
          data.manufacturerName,
          data.productName,
          data.productCode,
          data.category,
          priceInWei,
          lat,
          lon,
          expiryDate,
          data.batchNumber
        )
      );

      // ✅ OPTIMIZED: Return transaction hash immediately (don't wait for confirmation)
      // The caller can wait for receipt in background if needed
      const txHash = tx.hash || "";
      
      if (!txHash) {
        throw new Error("Transaction submitted but no hash received");
      }

      // Wait for receipt in background (non-blocking)
      // This ensures the transaction is actually confirmed, but doesn't block the UI
      tx.wait().then(() => {
        console.log(`✅ Product creation transaction confirmed: ${txHash}`);
      }).catch((error: unknown) => {
        console.error(`❌ Product creation transaction failed: ${txHash}`, error);
      });

      return { txHash };
    } catch (error: any) {
      console.error("createProduct failed:", error?.message ?? error);
      
      // Handle RPC rate limiting first
      const rateLimitError = this.handleRpcRateLimitError(error);
      if (rateLimitError) {
        throw rateLimitError;
      }
      
      // try to provide helpful messages
      if (String(error?.message || "").toLowerCase().includes("insufficient")) {
        throw new Error("Insufficient funds for gas. Fund your Sepolia wallet.");
      }
      if (error?.code === 4001) {
        throw new Error("Transaction rejected by user.");
      }
      if (String(error?.message || "").toLowerCase().includes("expiry date")) {
        throw new Error("Expiry date must be in the future.");
      }
      throw new Error(error?.message ?? "Failed to create product on blockchain.");
    }
  }

  /** Update product status on-chain */
  async updateStatus(productId: string, newStatus: string): Promise<{ txHash: string }> {
    await this.initialize();
    if (!this.contract) throw new Error("Blockchain not initialized");
    try {
      const tx = await this.contract.updateStatus(productId, newStatus);
      const receipt = await tx.wait();
      const txHash = (receipt && ((receipt as any).hash ?? (receipt as any).transactionHash)) || tx.hash || "";
      
      // Clear cache for this product to force fresh fetch next time
      this.lastProductFetch.delete(productId);
      console.log(`Cleared cache for product ${productId} after status update`);
      
      return { txHash };
    } catch (error: any) {
      console.error("updateStatus failed:", error?.message ?? error);
      
      // Handle RPC rate limiting
      const rateLimitError = this.handleRpcRateLimitError(error);
      if (rateLimitError) {
        throw rateLimitError;
      }
      
      if (error?.code === 4001) throw new Error("Transaction rejected by user.");
      throw new Error(error?.message ?? "Failed to update status on blockchain.");
    }
  }

  /** Update product status and location on-chain */
  async updateStatusWithLocation(
    productId: string, 
    newStatus: string, 
    latitude: number, 
    longitude: number
  ): Promise<{ txHash: string }> {
    await this.initialize();
    if (!this.contract) throw new Error("Blockchain not initialized");
    try {
      // Convert coordinates to scaled integers (1e6)
      const lat = BigInt(Math.round(latitude * 1e6));
      const lon = BigInt(Math.round(longitude * 1e6));

      const tx = await this.retryRpcCall(() =>
        this.contract!.updateStatusWithLocation(productId, newStatus, lat, lon)
      );
      const receipt = await this.retryRpcCall(() => tx.wait());
      const txHash = (receipt && ((receipt as any).hash ?? (receipt as any).transactionHash)) || tx.hash || "";
      
      // Clear cache for this product to force fresh fetch next time
      this.lastProductFetch.delete(productId);
      console.log(`Cleared cache for product ${productId} after status and location update`);
      
      return { txHash };
    } catch (error: any) {
      console.error("updateStatusWithLocation failed:", error?.message ?? error);
      
      // Handle RPC rate limiting
      const rateLimitError = this.handleRpcRateLimitError(error);
      if (rateLimitError) {
        throw rateLimitError;
      }
      
      if (error?.code === 4001) throw new Error("Transaction rejected by user.");
      throw new Error(error?.message ?? "Failed to update status and location on blockchain.");
    }
  }

  /** Transfer product ownership on-chain */
  async transferOwnership(productId: string, newOwner: string, status: string): Promise<{ txHash: string }> {
    await this.initialize();
    if (!this.contract || !this.signer) throw new Error("Blockchain not initialized or signer missing");

    // validate address
    if (!ethers.isAddress(newOwner)) throw new Error("Invalid new owner address");

    try {
      // Checksum the new owner address
      const checksummedNewOwner = ethers.getAddress(newOwner);
      
      // confirm signer is the current owner
      const product: any = await this.contract.getProduct(productId);
      const signerAddress = await this.signer.getAddress();

      if (product && product.currentOwner) {
        // Normalize both addresses to lowercase for comparison
        // Use ethers.getAddress to handle checksum format, then convert to lowercase
        let onChainOwner: string;
        try {
          // Try to get checksummed address first, then normalize
          onChainOwner = ethers.getAddress(String(product.currentOwner)).toLowerCase();
        } catch {
          // If not a valid address format, just use lowercase
          onChainOwner = String(product.currentOwner).toLowerCase().trim();
        }
        
        const normalizedSignerAddress = signerAddress.toLowerCase().trim();
        
        console.log(`🔍 Transfer ownership check: onChainOwner=${onChainOwner}, signerAddress=${normalizedSignerAddress}, match=${onChainOwner === normalizedSignerAddress}`);
        
        if (onChainOwner !== normalizedSignerAddress) {
          console.error(`❌ Owner mismatch: onChainOwner="${onChainOwner}", signerAddress="${normalizedSignerAddress}"`);
          throw new Error(`You are not the current owner of this product. Current Owner: ${String(product.currentOwner).slice(0, 6)}...${String(product.currentOwner).slice(-4)}, Your Address: ${signerAddress.slice(0, 6)}...${signerAddress.slice(-4)}`);
        }
      }

      const tx = await this.contract.transferOwnership(productId, checksummedNewOwner, status);
      const receipt = await tx.wait();
      const txHash = (receipt && ((receipt as any).hash ?? (receipt as any).transactionHash)) || tx.hash || "";
      return { txHash };
    } catch (error: any) {
      console.error("transferOwnership failed:", error?.message ?? error);
      
      // Handle RPC rate limiting
      const rateLimitError = this.handleRpcRateLimitError(error);
      if (rateLimitError) {
        throw rateLimitError;
      }
      
      if (error?.code === 4001) throw new Error("Transaction rejected by user.");
      throw new Error(error?.message ?? "Failed to transfer ownership on blockchain.");
    }
  }

  /** Transfer ownership and update location in a single transaction (optimized) */
  async transferOwnershipWithLocation(
    productId: string, 
    newOwner: string, 
    status: string,
    latitude: number,
    longitude: number
  ): Promise<{ txHash: string }> {
    await this.initialize();
    if (!this.contract || !this.signer) throw new Error("Blockchain not initialized or signer missing");

    // validate address
    if (!ethers.isAddress(newOwner)) throw new Error("Invalid new owner address");

    try {
      // Checksum the new owner address
      const checksummedNewOwner = ethers.getAddress(newOwner);
      
      // confirm signer is the current owner
      const product: any = await this.contract.getProduct(productId);
      const signerAddress = await this.signer.getAddress();

      if (product && product.currentOwner) {
        // Normalize both addresses to lowercase for comparison
        // Use ethers.getAddress to handle checksum format, then convert to lowercase
        let onChainOwner: string;
        try {
          // Try to get checksummed address first, then normalize
          onChainOwner = ethers.getAddress(String(product.currentOwner)).toLowerCase();
        } catch {
          // If not a valid address format, just use lowercase
          onChainOwner = String(product.currentOwner).toLowerCase().trim();
        }
        
        const normalizedSignerAddress = signerAddress.toLowerCase().trim();
        
        console.log(`🔍 Transfer ownership with location check: onChainOwner=${onChainOwner}, signerAddress=${normalizedSignerAddress}, match=${onChainOwner === normalizedSignerAddress}`);
        
        if (onChainOwner !== normalizedSignerAddress) {
          console.error(`❌ Owner mismatch: onChainOwner="${onChainOwner}", signerAddress="${normalizedSignerAddress}"`);
          throw new Error(`You are not the current owner of this product. Current Owner: ${String(product.currentOwner).slice(0, 6)}...${String(product.currentOwner).slice(-4)}, Your Address: ${signerAddress.slice(0, 6)}...${signerAddress.slice(-4)}`);
        }
      }

      // Use the new single-transaction function if available, otherwise fall back to two transactions
      const lat = BigInt(Math.round(latitude * 1e6));
      const lon = BigInt(Math.round(longitude * 1e6));
      
      // Check if the contract has the new transferOwnershipWithLocation function
      // Try to use the single-transaction function first
      try {
        const tx = await this.retryRpcCall(() =>
          this.contract!.transferOwnershipWithLocation(productId, checksummedNewOwner, status, lat, lon)
        );
        const receipt = await tx.wait();
        const txHash = (receipt && ((receipt as any).hash ?? (receipt as any).transactionHash)) || tx.hash || "";
        
        // Clear cache for this product to force fresh fetch next time
        this.lastProductFetch.delete(productId);
        
        return { txHash };
      } catch (singleTxError: any) {
        // If the function doesn't exist (e.g., contract not updated), fall back to two transactions
        if (singleTxError?.message?.includes("transferOwnershipWithLocation") || 
            singleTxError?.code === "UNSUPPORTED_OPERATION" ||
            singleTxError?.message?.includes("does not exist")) {
          console.warn("Single-transaction function not available, using two-transaction fallback");
          
          // Fallback: First update status and location, then transfer ownership
          const updateTx = await this.retryRpcCall(() =>
            this.contract!.updateStatusWithLocation(productId, status, lat, lon)
          );
          await updateTx.wait();
          
          // Then transfer ownership (this also updates status, but location is already set)
          const transferTx = await this.contract.transferOwnership(productId, checksummedNewOwner, status);
          const receipt = await transferTx.wait();
          const txHash = (receipt && ((receipt as any).hash ?? (receipt as any).transactionHash)) || transferTx.hash || "";
          
          // Clear cache for this product to force fresh fetch next time
          this.lastProductFetch.delete(productId);
          
          return { txHash };
        } else {
          throw singleTxError;
        }
      }
    } catch (error: any) {
      console.error("transferOwnershipWithLocation failed:", error?.message ?? error);
      
      // Handle RPC rate limiting
      const rateLimitError = this.handleRpcRateLimitError(error);
      if (rateLimitError) {
        throw rateLimitError;
      }
      
      if (error?.code === 4001) throw new Error("Transaction rejected by user.");
      throw new Error(error?.message ?? "Failed to transfer ownership with location on blockchain.");
    }
  }

  /** Helper: Check if error is RPC rate limiting and format user-friendly message */
  private handleRpcRateLimitError(error: any): Error | null {
    const errorCode = error?.code;
    const errorMessage = (error?.message || '').toLowerCase();
    const errorData = error?.error || error?.data || {};
    
    // Check for rate limiting errors
    if (errorCode === -32002 || 
        errorMessage.includes('rpc endpoint returned too many errors') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('retrying in') ||
        errorData?.message?.includes('too many errors')) {
      return new Error(`RPC rate-limited. Wait and retry.`);
    }
    return null;
  }

  /** Helper: Retry with exponential backoff for RPC errors */
  private async retryRpcCall<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        // Check if it's a "Product does not exist" error (permanent state, don't retry)
        const errorMessage = (error?.message || error?.reason || '').toLowerCase();
        const isProductNotFound = 
          errorMessage.includes('product does not exist') ||
          errorMessage.includes('does not exist') ||
          error?.name === 'PRODUCT_NOT_FOUND';
        
        if (isProductNotFound) {
          // Product doesn't exist - this is permanent, don't retry
          throw error;
        }
        
        // Check if it's an RPC error that should be retried
        const errorCode = error?.code;
        const errorName = error?.name || '';
        
        const isRpcError = 
          errorCode === -32002 || 
          errorCode === 'CALL_EXCEPTION' ||
          errorCode === 'NETWORK_ERROR' ||
          errorCode === 'TIMEOUT' ||
          errorCode === 'UNKNOWN_ERROR' ||
          errorMessage.includes("rpc endpoint returned too many errors") ||
          errorMessage.includes("rpc error") ||
          errorMessage.includes("missing revert data") ||
          errorMessage.includes("rate limit") ||
          errorMessage.includes("too many requests") ||
          errorMessage.includes("retrying in") ||
          errorName === "RpcRateLimitError" ||
          errorName === "CALL_EXCEPTION";
        
        // For CALL_EXCEPTION with missing revert data, it might be a rate limit
        // But we already checked for "product does not exist" above
        const isCallException = errorCode === 'CALL_EXCEPTION' || errorName === 'CALL_EXCEPTION';
        
        if (!isRpcError && !isCallException) {
          // Non-retryable error, throw immediately
          throw error;
        }
        
        if (attempt === maxRetries - 1) {
          // Last attempt failed - handle gracefully
          if (isRpcError || isCallException) {
            const enhancedError = new Error(
              `RPC endpoint error: ${errorMessage || 'Rate limited or unavailable'}\n\n` +
              `The RPC endpoint may be rate-limited. Please try again in a few minutes.\n` +
              `If the issue persists, update MetaMask's Sepolia network RPC URL to: https://rpc.sepolia.org`
            );
            enhancedError.name = "RpcRateLimitError";
            throw enhancedError;
          }
          throw error;
        }
        
        // Exponential backoff with jitter (longer delays for rate limits)
        const isRateLimit = errorMessage.includes('rate limit') || errorMessage.includes('too many errors');
        const multiplier = isRateLimit ? 3 : 2; // Longer delays for rate limits
        const delay = baseDelay * Math.pow(multiplier, attempt) + Math.random() * 1000;
        
        console.warn(
          `RPC call failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${Math.round(delay)}ms...`, 
          errorCode || errorName || 'Unknown error'
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  /** Check if a product exists (doesn't throw error if product doesn't exist) */
  async checkProductExists(productId: string): Promise<boolean> {
    await this.initialize();
    if (!this.contract) {
      console.warn("Contract not initialized for checkProductExists");
      return false;
    }
    try {
      const exists = await this.retryRpcCall(
        () => this.contract!.checkProductExists(productId),
        2, // Reduce retries for read operations
        500 // Shorter base delay
      );
      return exists;
    } catch (error: any) {
      const errorCode = error?.code;
      const errorMessage = (error?.message || '').toLowerCase();
      
      // Handle CALL_EXCEPTION gracefully - might mean product doesn't exist or RPC issue
      if (errorCode === 'CALL_EXCEPTION' || errorMessage.includes('missing revert data')) {
        console.warn(`checkProductExists: CALL_EXCEPTION for product ${productId} - treating as non-existent or RPC issue`);
        return false; // Assume product doesn't exist if we can't verify
      }
      
      // Handle RPC rate limiting
      if (errorMessage.includes('rpc endpoint returned too many errors') || 
          errorMessage.includes('rate limit') ||
          errorMessage.includes('too many requests')) {
        console.warn(`checkProductExists: RPC rate limited for product ${productId}`);
        return false; // Return false to avoid blocking UI
      }
      
      console.error("checkProductExists failed:", error?.message ?? error);
      return false; // Default to false on any error
    }
  }

  /** Read product (returns parsed fields) */
  async getProduct(productId: string): Promise<any> {
    await this.initialize();
    if (!this.contract) throw new Error("Blockchain not initialized");
    try {
      const product = await this.retryRpcCall(() => this.contract!.getProduct(productId));
      // normalize values
      const expiryDate = product.expiryDate ? Number(product.expiryDate) * 1000 : null; // Convert seconds to milliseconds
      return {
        productId: product.productId,
        manufacturerName: product.manufacturerName,
        productName: product.productName,
        productCode: product.productCode,
        category: product.category,
        price: Number(product.price ? product.price.toString() : 0),
        // Convert from scaled integer (1e6) back to decimal, return null if 0 or invalid
        latitude: product.latitude && Number(product.latitude) !== 0 
          ? Number(product.latitude) / 1e6 
          : null,
        longitude: product.longitude && Number(product.longitude) !== 0 
          ? Number(product.longitude) / 1e6 
          : null,
        currentOwner: product.currentOwner,
        status: product.status,
        createdAt: new Date(Number(product.createdAt) * 1000).toISOString(),
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
        expiryTimestamp: expiryDate,
        batchNumber: product.batchNumber || '',
        exists: product.exists
      };
    } catch (error: any) {
      // Check if it's a "Product does not exist" error (expected case)
      const errorMessage = error?.message || error?.reason || '';
      const isProductNotFound = 
        errorMessage.includes('Product does not exist') ||
        errorMessage.includes('product does not exist') ||
        errorMessage.includes('does not exist') ||
        (error?.code === 'CALL_EXCEPTION' && errorMessage.includes('Product'));
      
      if (isProductNotFound) {
        // This is expected - product doesn't exist on blockchain
        // Create a clean error object without logging
        const notFoundError = new Error('Product does not exist');
        notFoundError.name = 'PRODUCT_NOT_FOUND';
        throw notFoundError;
      }
      
      // For other errors, log and throw
      console.error("getProduct failed:", error?.message ?? error);
      throw new Error(error?.message ?? "Failed to fetch product from blockchain.");
    }
  }

  /** Get ownership transfers for a product */
  async getOwnershipTransfers(productId: string): Promise<any[]> {
    await this.initialize();
    if (!this.contract) throw new Error("Blockchain not initialized");
    try {
      const transfers = await this.retryRpcCall(() => this.contract!.getOwnershipTransfers(productId));
      return transfers.map((transfer: any) => {
        // Convert bytes32 hash to hex string properly
        let hashString = 'N/A';
        if (transfer.hash) {
          if (typeof transfer.hash === 'string') {
            hashString = transfer.hash;
          } else if (transfer.hash.toString) {
            // bytes32 format - convert to hex string
            const hashHex = transfer.hash.toString();
            hashString = hashHex.startsWith('0x') ? hashHex : `0x${hashHex}`;
          } else {
            // Try to convert to hex
            try {
              hashString = `0x${transfer.hash.toString(16)}`;
            } catch {
              hashString = 'N/A';
            }
          }
        }
        
        return {
          productId: transfer.productId,
          from: transfer.from,
          to: transfer.to,
          status: transfer.status,
          timestamp: Number(transfer.timestamp),
          hash: hashString
        };
      });
    } catch (error: any) {
      console.error("getOwnershipTransfers failed:", error?.message ?? error);
      // Return empty array if product doesn't exist or has no transfers
      if (error?.message?.includes("Product does not exist")) {
        return [];
      }
      throw new Error(error?.message ?? "Failed to fetch ownership transfers from blockchain.");
    }
  }

  /** Get complete transaction history for a product (including ProductCreated, OwnershipTransferred, StatusUpdated events) */
  async getProductTransactionHistory(productId: string): Promise<any[]> {
    await this.initialize();
    if (!this.contract || !this.provider) throw new Error("Blockchain not initialized");
    
    try {
      const history: any[] = [];
      
      // Get ProductCreated event
      try {
        const productCreatedFilter = this.contract.filters.ProductCreated(productId);
        const productCreatedEvents = await this.retryRpcCall(() => 
          this.contract!.queryFilter(productCreatedFilter)
        );
        
        for (const event of productCreatedEvents) {
          // In ethers.js v6, transactionHash can be on event.log.transactionHash or event.transactionHash
          // Try multiple ways to access it
          const eventAny = event as any;
          let txHash: string | null = null;
          if (eventAny.log?.transactionHash) {
            txHash = eventAny.log.transactionHash;
          } else if (eventAny.transactionHash) {
            txHash = eventAny.transactionHash;
          } else if (eventAny.hash) {
            txHash = eventAny.hash;
          }
          
          // If still no hash, try to get from the receipt
          if (!txHash && this.provider) {
            try {
              const blockNumber = eventAny.log?.blockNumber || eventAny.blockNumber;
              if (blockNumber) {
                const block = await this.provider.getBlock(blockNumber, true);
                if (block && block.transactions && block.transactions.length > 0) {
                  // Get the first transaction hash from the block (this is a fallback)
                  txHash = typeof block.transactions[0] === 'string' ? block.transactions[0] : (block.transactions[0] as any).hash;
                }
              }
            } catch (e) {
              console.warn('Could not get transaction hash from block:', e);
            }
          }
          
          // Get location from the product state at the block when created
          let latitude: number | null = null;
          let longitude: number | null = null;
          
          const blockNumber = eventAny.log?.blockNumber || eventAny.blockNumber;
          if (blockNumber && this.contract) {
            try {
              // Query product state at the specific block number when this event occurred
              const product = await this.contract.products(productId, { blockTag: blockNumber });
              if (product && product.exists) {
                latitude = Number(product.latitude) / 1e6; // Convert from scaled int256
                longitude = Number(product.longitude) / 1e6;
                // Only include if coordinates are valid (not 0)
                if (latitude === 0 && longitude === 0) {
                  latitude = null;
                  longitude = null;
                }
              }
            } catch (e) {
              console.warn(`Could not fetch product location at creation (block ${blockNumber}):`, e);
              // Try current block as fallback
              try {
                const product = await this.contract.products(productId);
                if (product && product.exists) {
                  latitude = Number(product.latitude) / 1e6;
                  longitude = Number(product.longitude) / 1e6;
                  if (latitude === 0 && longitude === 0) {
                    latitude = null;
                    longitude = null;
                  }
                }
              } catch (e2) {
                console.warn('Could not fetch location from current block for creation:', e2);
              }
            }
          }
          
          history.push({
            type: 'ProductCreated',
            timestamp: eventAny.args?.timestamp ? Number(eventAny.args.timestamp) * 1000 : Date.now(),
            action: 'Product Created',
            owner: eventAny.args?.manufacturer || 'Unknown',
            status: 'Manufactured',
            hash: txHash || 'N/A',
            blockNumber: eventAny.log?.blockNumber || eventAny.blockNumber,
            latitude: latitude,
            longitude: longitude
          });
        }
      } catch (error: any) {
        console.warn('Could not fetch ProductCreated events:', error?.message);
      }
      
      // Get OwnershipTransferred events
      try {
        const ownershipFilter = this.contract.filters.OwnershipTransferred(productId);
        const ownershipEvents = await this.retryRpcCall(() => 
          this.contract!.queryFilter(ownershipFilter)
        );
        
        for (const event of ownershipEvents) {
          // In ethers.js v6, event args are accessed via event.args array or named properties
          const eventAny = event as any;
          
          // Extract event arguments - in ethers.js v6, args can be an array or object
          let fromAddress: string | null = null;
          let toAddress: string | null = null;
          let statusStr: string | null = null;
          let timestampVal: bigint | number | null = null;
          
          // Try multiple ways to access event args (ethers.js v6 compatibility)
          if (eventAny.args) {
            // If args is an array: [productId, from, to, status, timestamp]
            if (Array.isArray(eventAny.args)) {
              fromAddress = eventAny.args[1] || null;
              toAddress = eventAny.args[2] || null;
              statusStr = eventAny.args[3] || null;
              timestampVal = eventAny.args[4] || null;
            } 
            // If args is an object with named properties
            else if (typeof eventAny.args === 'object') {
              fromAddress = eventAny.args.from || eventAny.args[1] || null;
              toAddress = eventAny.args.to || eventAny.args[2] || null;
              statusStr = eventAny.args.status || eventAny.args[3] || null;
              timestampVal = eventAny.args.timestamp || eventAny.args[4] || null;
            }
          }
          
          // Convert addresses to strings and validate
          if (fromAddress) {
            fromAddress = String(fromAddress);
          }
          if (toAddress) {
            toAddress = String(toAddress);
          }
          if (statusStr) {
            statusStr = String(statusStr);
          }
          
          // Extract transaction hash
          let txHash: string | null = null;
          if (eventAny.log?.transactionHash) {
            txHash = eventAny.log.transactionHash;
          } else if (eventAny.transactionHash) {
            txHash = eventAny.transactionHash;
          } else if (eventAny.hash) {
            txHash = eventAny.hash;
          }
          
          // Log for debugging
          console.log(`📋 OwnershipTransferred event parsed:`, {
            from: fromAddress,
            to: toAddress,
            status: statusStr,
            txHash: txHash?.slice(0, 10) + '...'
          });
          
          // Get location from the product state at the block when transferred
          // IMPORTANT: Location is updated BEFORE transfer (via updateStatusWithLocation),
          // so we need to get the location that was set in the previous transaction
          let latitude: number | null = null;
          let longitude: number | null = null;
          
          const blockNumber = eventAny.log?.blockNumber || eventAny.blockNumber;
          const transferTxHash = txHash;
          
          if (blockNumber && this.contract && this.provider) {
            // Strategy 1: Find the StatusUpdated event that happened just before this transfer
            // This is the most reliable way to get the location entered during transfer
            try {
              const statusFilter = this.contract.filters.StatusUpdated(productId);
              const allStatusEvents = await this.retryRpcCall(() => 
                this.contract!.queryFilter(statusFilter)
              );
              
              // Find StatusUpdated events that happened before this transfer
              const statusEventsBeforeTransfer = allStatusEvents
                .filter((event: any) => {
                  const eventBlock = event.log?.blockNumber || event.blockNumber || 0;
                  return eventBlock < blockNumber;
                })
                .sort((a: any, b: any) => {
                  const blockA = a.log?.blockNumber || a.blockNumber || 0;
                  const blockB = b.log?.blockNumber || b.blockNumber || 0;
                  return blockB - blockA; // Most recent first
                });
              
              // Get location from the most recent StatusUpdated event before this transfer
              if (statusEventsBeforeTransfer.length > 0) {
                const mostRecentStatusEvent = statusEventsBeforeTransfer[0] as any;
                const statusBlock = mostRecentStatusEvent.log?.blockNumber || mostRecentStatusEvent.blockNumber;
                
                try {
                  const product = await this.contract.products(productId, { blockTag: statusBlock });
                  if (product && product.exists) {
                    const lat = Number(product.latitude) / 1e6;
                    const lon = Number(product.longitude) / 1e6;
                    if (!(lat === 0 && lon === 0)) {
                      latitude = lat;
                      longitude = lon;
                      console.log(`✅ OwnershipTransferred: Found location from StatusUpdated event at block ${statusBlock}: ${latitude}, ${longitude}`);
                    }
                  }
                } catch (statusError) {
                  console.warn(`Could not fetch location from StatusUpdated event block:`, statusError);
                }
              }
            } catch (statusQueryError) {
              console.warn(`Could not query StatusUpdated events for location:`, statusQueryError);
            }
            
            // Strategy 2: If not found via StatusUpdated, try querying product state at transfer block
            if (latitude === null && longitude === null) {
              try {
                const product = await this.contract.products(productId, { blockTag: blockNumber });
                if (product && product.exists) {
                  const lat = Number(product.latitude) / 1e6;
                  const lon = Number(product.longitude) / 1e6;
                  if (!(lat === 0 && lon === 0)) {
                    latitude = lat;
                    longitude = lon;
                    console.log(`✅ OwnershipTransferred at block ${blockNumber}: Location = ${latitude}, ${longitude}`);
                  }
                }
              } catch (e) {
                console.warn(`Could not fetch product location at transfer block ${blockNumber}:`, e);
              }
            }
            
            // Strategy 3: Try previous block (where location was likely updated)
            if (latitude === null && longitude === null && blockNumber > 1) {
              try {
                const product = await this.contract.products(productId, { blockTag: blockNumber - 1 });
                if (product && product.exists) {
                  const lat = Number(product.latitude) / 1e6;
                  const lon = Number(product.longitude) / 1e6;
                  if (!(lat === 0 && lon === 0)) {
                    latitude = lat;
                    longitude = lon;
                    console.log(`✅ OwnershipTransferred: Location from previous block ${blockNumber - 1}: ${latitude}, ${longitude}`);
                  }
                }
              } catch (e2) {
                console.warn(`Could not fetch location from block ${blockNumber - 1}:`, e2);
              }
            }
            
            // Final validation: set to null if both are 0
            if (latitude === 0 && longitude === 0) {
              latitude = null;
              longitude = null;
            }
            
            if (latitude === null && longitude === null) {
              console.warn(`⚠️ OwnershipTransferred at block ${blockNumber}: Could not retrieve location for this transfer`);
            } else {
              console.log(`📍 OwnershipTransferred location retrieved: (${latitude}, ${longitude}) for transfer at block ${blockNumber}`);
            }
          }
          
          // Determine more descriptive action based on status
          let actionLabel = 'Ownership Transferred';
          const transferStatus = (statusStr || '').toLowerCase();
          if (transferStatus.includes('distributor')) {
            actionLabel = 'Ownership Transferred to Distributor';
          } else if (transferStatus.includes('delivery hub') || transferStatus.includes('delivery')) {
            actionLabel = 'Ownership Transferred to Delivery Hub';
          }
          
          // Convert timestamp
          let timestamp: number;
          if (timestampVal) {
            // Handle bigint or number
            timestamp = typeof timestampVal === 'bigint' ? Number(timestampVal) * 1000 : Number(timestampVal) * 1000;
          } else {
            timestamp = Date.now();
          }
          
          // Validate addresses - if missing, try to infer from transaction
          if (!fromAddress || fromAddress === 'null' || fromAddress === 'undefined') {
            console.warn(`⚠️ OwnershipTransferred event missing 'from' address. Attempting to infer from transaction...`);
            // Try to get from the transaction sender or product state
            if (blockNumber && this.contract) {
              try {
                const product = await this.contract.products(productId, { blockTag: blockNumber - 1 });
                if (product && product.exists && product.currentOwner) {
                  fromAddress = String(product.currentOwner);
                  console.log(`✅ Inferred 'from' address from product state: ${fromAddress}`);
                }
              } catch (e) {
                console.warn(`Could not infer 'from' address from product state:`, e);
              }
            }
          }
          
          if (!toAddress || toAddress === 'null' || toAddress === 'undefined') {
            console.warn(`⚠️ OwnershipTransferred event missing 'to' address`);
          }
          
          // CRITICAL: Ensure fromAddress is set - this is needed for validation
          if (!fromAddress || fromAddress === 'null' || fromAddress === 'undefined' || fromAddress === 'Unknown') {
            console.error(`❌ OwnershipTransferred event missing valid 'from' address. Cannot properly validate location.`);
            // Set to a placeholder, but this will cause validation issues
            fromAddress = 'Unknown';
          }
          
          history.push({
            type: 'OwnershipTransferred',
            timestamp: timestamp,
            action: actionLabel,
            from: fromAddress || 'Unknown', // CRITICAL: This must be set for validation
            owner: toAddress || 'Unknown',
            status: statusStr || 'Transferred',
            hash: txHash || 'N/A',
            blockNumber: eventAny.log?.blockNumber || eventAny.blockNumber,
            latitude: latitude,
            longitude: longitude
          });
          
          // Log the extracted data for debugging
          console.log(`✅ OwnershipTransferred event added to history:`, {
            from: fromAddress,
            to: toAddress,
            status: statusStr,
            location: latitude && longitude ? `(${latitude}, ${longitude})` : 'N/A',
            action: actionLabel
          });
        }
      } catch (error: any) {
        console.warn('Could not fetch OwnershipTransferred events:', error?.message);
      }
      
      // Get StatusUpdated events
      // IMPORTANT: Process events in chronological order to track location changes properly
      try {
        const statusFilter = this.contract.filters.StatusUpdated(productId);
        const statusEvents = await this.retryRpcCall(() => 
          this.contract!.queryFilter(statusFilter)
        );
        
        // Sort events by block number to process chronologically
        const sortedEvents = [...statusEvents].sort((a: any, b: any) => {
          const blockA = a.log?.blockNumber || a.blockNumber || 0;
          const blockB = b.log?.blockNumber || b.blockNumber || 0;
          return blockA - blockB;
        });
        
        for (const event of sortedEvents) {
          // In ethers.js v6, transactionHash can be on event.log.transactionHash or event.transactionHash
          const eventAny = event as any;
          let txHash: string | null = null;
          if (eventAny.log?.transactionHash) {
            txHash = eventAny.log.transactionHash;
          } else if (eventAny.transactionHash) {
            txHash = eventAny.transactionHash;
          } else if (eventAny.hash) {
            txHash = eventAny.hash;
          }
          
          // Get location from the product state at the block when status was updated
          let latitude: number | null = null;
          let longitude: number | null = null;
          
          const blockNumber = eventAny.log?.blockNumber || eventAny.blockNumber;
          const transactionHash = txHash; // Store for logging
          
          if (blockNumber && this.contract && this.provider) {
            // CRITICAL: For StatusUpdated events from updateStatusWithLocation, we need to get the location
            // that was SET in THIS specific transaction. The location is updated in the same transaction,
            // so querying at the block where the transaction was mined should give us the correct location.
            
            // Strategy 1: Get location at the exact block (PRIORITY - this is the location set in this transaction)
            // When updateStatusWithLocation is called, the location is updated in the same transaction,
            // so querying at the block where the transaction was mined should give us the correct location
            try {
              // Try to get transaction receipt to verify this was an updateStatusWithLocation call
              let isUpdateStatusWithLocation = false;
              if (txHash && this.provider) {
                try {
                  const receipt = await this.provider.getTransactionReceipt(txHash);
                  if (receipt && receipt.logs) {
                    // Check if this transaction called updateStatusWithLocation by checking function signature
                    // updateStatusWithLocation has 4 parameters: productId, newStatus, latitude, longitude
                    isUpdateStatusWithLocation = true; // Assume it is if we have a StatusUpdated event
                  }
                } catch (receiptError) {
                  // Ignore receipt error
                }
              }
              
              // Query product state at the block where this event occurred
              const product = await this.contract.products(productId, { blockTag: blockNumber });
              if (product && product.exists) {
                const lat = Number(product.latitude) / 1e6;
                const lon = Number(product.longitude) / 1e6;
                // Accept location even if one coordinate is 0 (as long as not both are 0)
                if (!(lat === 0 && lon === 0)) {
                  latitude = lat;
                  longitude = lon;
                  console.log(`✅ StatusUpdated [${eventAny.args?.newStatus}] at block ${blockNumber}: Location = ${latitude}, ${longitude} (from transaction block)`);
                } else {
                  console.warn(`⚠️ StatusUpdated at block ${blockNumber}: Location is 0,0 - may not have been set in this transaction`);
                }
              }
            } catch (e) {
              console.warn(`Could not fetch location at block ${blockNumber} for StatusUpdated:`, e);
              
              // Strategy 2: Try next block (state definitely updated by then)
              try {
                const product = await this.contract.products(productId, { blockTag: blockNumber + 1 });
                if (product && product.exists) {
                  const lat = Number(product.latitude) / 1e6;
                  const lon = Number(product.longitude) / 1e6;
                  if (!(lat === 0 && lon === 0)) {
                    latitude = lat;
                    longitude = lon;
                    console.log(`✅ StatusUpdated [${eventAny.args?.newStatus}] at block ${blockNumber + 1}: Location = ${latitude}, ${longitude}`);
                  }
                }
              } catch (e2) {
                console.warn(`Could not fetch location at block ${blockNumber + 1}:`, e2);
                
                // Strategy 3: Compare with previous block to detect location change
                if (blockNumber > 1) {
                  try {
                    const productBefore = await this.contract.products(productId, { blockTag: blockNumber - 1 });
                    const productAt = await this.contract.products(productId, { blockTag: blockNumber });
                    if (productAt && productAt.exists) {
                      const lat = Number(productAt.latitude) / 1e6;
                      const lon = Number(productAt.longitude) / 1e6;
                      if (!(lat === 0 && lon === 0)) {
                        // If location changed, this was likely an updateStatusWithLocation call
                        if (productBefore && productBefore.exists) {
                          const latBefore = Number(productBefore.latitude) / 1e6;
                          const lonBefore = Number(productBefore.longitude) / 1e6;
                          // Use the location if it changed (indicating this transaction updated it)
                          if (Math.abs(lat - latBefore) > 0.000001 || Math.abs(lon - lonBefore) > 0.000001) {
                            latitude = lat;
                            longitude = lon;
                            console.log(`✅ StatusUpdated [${eventAny.args?.newStatus}] - Location changed at block ${blockNumber}: ${latitude}, ${longitude} (detected change)`);
                          }
                        } else {
                          // No previous state, use current
                          latitude = lat;
                          longitude = lon;
                          console.log(`✅ StatusUpdated [${eventAny.args?.newStatus}] at block ${blockNumber}: Location = ${latitude}, ${longitude}`);
                        }
                      }
                    }
                  } catch (e3) {
                    console.warn(`Could not compare location at blocks:`, e3);
                  }
                }
              }
            }
            
            // Final validation: set to null if both are 0
            if (latitude === 0 && longitude === 0) {
              latitude = null;
              longitude = null;
            }
            
            // If we still don't have a location, log a warning but don't use current block
            // (using current block would show wrong location for historical events)
            if (latitude === null && longitude === null) {
              console.warn(`❌ StatusUpdated [${eventAny.args?.newStatus}] at block ${blockNumber}: Could not retrieve location for this event`);
            }
          } else {
            // No block number available - cannot get accurate location
            console.warn(`❌ StatusUpdated event has no block number - cannot retrieve accurate location`);
            latitude = null;
            longitude = null;
          }
          
          // Get owner at the time of status update for better context
          let ownerAtUpdate = 'Unknown';
          if (blockNumber && this.contract) {
            try {
              const product = await this.contract.products(productId, { blockTag: blockNumber });
              if (product && product.exists) {
                ownerAtUpdate = product.currentOwner || 'Unknown';
              }
            } catch (e) {
              // Ignore error, use default
            }
          }
          
          // Only add location if we successfully retrieved it for this specific event
          // This ensures each StatusUpdated event shows the location that was set in THAT transaction
          history.push({
            type: 'StatusUpdated',
            timestamp: eventAny.args?.timestamp ? Number(eventAny.args.timestamp) * 1000 : Date.now(),
            action: `Status Updated: ${eventAny.args?.newStatus || 'Unknown'}`,
            owner: ownerAtUpdate,
            status: eventAny.args?.newStatus || 'Unknown',
            hash: txHash || 'N/A',
            blockNumber: eventAny.log?.blockNumber || eventAny.blockNumber,
            latitude: latitude, // Location set in THIS transaction
            longitude: longitude // Location set in THIS transaction
          });
          
          // Log for debugging
          if (latitude !== null && longitude !== null) {
            console.log(`📍 StatusUpdated event recorded: Status="${eventAny.args?.newStatus}", Location=(${latitude}, ${longitude}), Block=${blockNumber}`);
          } else {
            console.warn(`⚠️ StatusUpdated event recorded WITHOUT location: Status="${eventAny.args?.newStatus}", Block=${blockNumber}`);
          }
        }
      } catch (error: any) {
        console.warn('Could not fetch StatusUpdated events:', error?.message);
      }
      
      // If no events found, try to get from ownership transfers (which might have hashes stored)
      if (history.length === 0) {
        try {
          const transfers = await this.getOwnershipTransfers(productId);
          if (transfers && transfers.length > 0) {
            // Use ownership transfers which might have hash stored in struct
            for (const transfer of transfers) {
              history.push({
                type: 'OwnershipTransferred',
                timestamp: Number(transfer.timestamp) * 1000,
                action: 'Ownership Transferred',
                from: transfer.from,
                owner: transfer.to,
                status: transfer.status,
                hash: transfer.hash || 'N/A'
              });
            }
          }
        } catch (error: any) {
          console.warn('Could not fetch ownership transfers as fallback:', error?.message);
        }
      }
      
      // Sort by timestamp (oldest first)
      history.sort((a, b) => a.timestamp - b.timestamp);
      
      // Filter out duplicate StatusUpdated events that occur in the same transaction as OwnershipTransferred
      // When transferOwnershipWithLocation is called, it emits both events, but we only need the OwnershipTransferred
      const filteredHistory: any[] = [];
      const ownershipTransferTxHashes = new Set<string>();
      
      // First pass: collect transaction hashes of OwnershipTransferred events
      for (const entry of history) {
        if (entry.type === 'OwnershipTransferred' && entry.hash && entry.hash !== 'N/A') {
          ownershipTransferTxHashes.add(entry.hash.toLowerCase());
        }
      }
      
      // Second pass: filter out StatusUpdated events that:
      // 1. Have the same transaction hash as an OwnershipTransferred event, AND
      // 2. Have a status that matches a transfer status (e.g., "Transferred to Distributor", "Transferred to Delivery Hub")
      for (const entry of history) {
        if (entry.type === 'StatusUpdated') {
          const isTransferStatus = entry.status && (
            entry.status.toLowerCase().includes('transferred to distributor') ||
            entry.status.toLowerCase().includes('transferred to delivery hub') ||
            entry.status.toLowerCase().includes('transferred to')
          );
          
          const isSameTxAsTransfer = entry.hash && entry.hash !== 'N/A' && 
            ownershipTransferTxHashes.has(entry.hash.toLowerCase());
          
          // Skip StatusUpdated if it's from the same transaction as an OwnershipTransferred with transfer status
          if (isTransferStatus && isSameTxAsTransfer) {
            console.log(`🔍 Filtering out duplicate StatusUpdated event: "${entry.status}" (same transaction as OwnershipTransferred)`);
            continue;
          }
        }
        
        filteredHistory.push(entry);
      }
      
      console.log(`Fetched ${history.length} transaction history entries, filtered to ${filteredHistory.length} entries for product ${productId}`);
      return filteredHistory;
    } catch (error: any) {
      console.error("getProductTransactionHistory failed:", error?.message ?? error);
      return [];
    }
  }

  /** Get all products - returns localStorage immediately, syncs blockchain in background */
  async getAllProducts(syncBlockchain: boolean = false): Promise<any[]> {
    try {
      // Get products from localStorage immediately (fast)
      const storedProducts = JSON.parse(localStorage.getItem("drug_supply_chain_products") || "[]");
      
      if (!storedProducts || storedProducts.length === 0) {
        return [];
      }

      // Return localStorage data immediately for fast UI updates
      // Only sync blockchain if explicitly requested (for background updates)
      if (!syncBlockchain) {
        return storedProducts;
      }

      // Background sync: Update products with blockchain data (non-blocking)
      // This runs in the background and doesn't block the UI
      this.syncProductsWithBlockchain(storedProducts).catch(err => {
        console.warn('Background blockchain sync failed:', err);
      });

      return storedProducts;
    } catch (error: any) {
      console.error("getAllProducts failed:", error?.message ?? error);
      // Fallback to localStorage only
      try {
        const stored = localStorage.getItem("drug_supply_chain_products") || "[]";
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
  }

  /** Sync products with blockchain in background (non-blocking) */
  private async syncProductsWithBlockchain(storedProducts: any[]): Promise<void> {
    try {
      await this.initialize();
      
      // Sync only recently updated products (last 10) to avoid rate limits
      const productsToSync = storedProducts
        .sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        })
        .slice(0, 10); // Only sync top 10 most recent

      for (const storedProduct of productsToSync) {
        try {
          // Check cache first (max 30 seconds old for background sync)
          const cached = this.lastProductFetch.get(storedProduct.productId);
          const now = Date.now();
          
          if (cached && (now - cached.timestamp) < 30000) {
            // Use cached data if less than 30 seconds old
            continue;
          }

          // Fetch from blockchain with timeout
          let productData: any = null;
          try {
            productData = await Promise.race([
              this.getProduct(storedProduct.productId),
              new Promise<any>((resolve) => 
                setTimeout(() => resolve(null), 3000) // 3 second timeout
              )
            ]);
          } catch (error: any) {
            // If product doesn't exist, skip it (don't sync non-existent products)
            if (error?.name === 'PRODUCT_NOT_FOUND' || 
                error?.message?.includes('does not exist')) {
              // Product doesn't exist on blockchain - skip silently
              continue;
            }
            // For other errors, continue to next product
            continue;
          }

          if (productData) {
            // Get manufacturer address from blockchain if not already stored
            let manufacturerAddress = storedProduct.manufacturer || storedProduct.createdBy || '';
            if (!manufacturerAddress) {
              try {
                manufacturerAddress = await this.getProductManufacturer(storedProduct.productId);
              } catch (error: any) {
                // If product doesn't exist, skip manufacturer fetch
                if (error?.name === 'PRODUCT_NOT_FOUND' || 
                    error?.message?.includes('does not exist')) {
                  // Skip this product
                  continue;
                }
                console.debug(`Could not fetch manufacturer for ${storedProduct.productId}:`, error);
              }
            }
            
            // Update localStorage with latest blockchain data
            // Preserve all important fields including manufacturer
            const updatedProduct = {
              ...storedProduct,
              currentOwner: productData.currentOwner,
              status: productData.status,
              manufacturer: manufacturerAddress || storedProduct.manufacturer || storedProduct.createdBy || '',
              createdBy: storedProduct.createdBy || manufacturerAddress || storedProduct.manufacturer || '',
              updatedAt: new Date().toISOString(),
            };
            
            // Update in localStorage
            const allProducts = JSON.parse(localStorage.getItem("drug_supply_chain_products") || "[]");
            const index = allProducts.findIndex((p: any) => p.productId === storedProduct.productId);
            if (index !== -1) {
              allProducts[index] = updatedProduct;
              localStorage.setItem("drug_supply_chain_products", JSON.stringify(allProducts));
            }

            // Cache the result
            this.lastProductFetch.set(storedProduct.productId, { data: productData, timestamp: now });
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error: any) {
          // Silently continue - background sync failures are non-critical
          console.debug(`Background sync failed for ${storedProduct.productId}:`, error?.message);
        }
      }
    } catch (error: any) {
      console.warn('Background blockchain sync error:', error?.message);
    }
  }

  /** Register an authorized location for the current participant */
  async registerAuthorizedLocation(data: {
    locationName: string;
    latitude: number;
    longitude: number;
    radius: number; // in meters
  }): Promise<{ txHash: string }> {
    await this.initialize();
    if (!this.contract || !this.signer) throw new Error("Blockchain not initialized or signer missing");

    try {
      // Convert coordinates to scaled integers (1e6)
      const lat = BigInt(Math.round(data.latitude * 1e6));
      const lon = BigInt(Math.round(data.longitude * 1e6));
      // Convert radius from meters to scaled integer (1e6)
      const radius = BigInt(Math.round(data.radius * 1e6));

      const tx = await this.retryRpcCall(() =>
        this.contract!.registerAuthorizedLocation(
          data.locationName,
          lat,
          lon,
          radius
        )
      );

      const receipt = await this.retryRpcCall(() => tx.wait());
      const txHash = (receipt && ((receipt as any).hash ?? (receipt as any).transactionHash)) || tx.hash || "";

      return { txHash };
    } catch (error: any) {
      console.error("registerAuthorizedLocation failed:", error?.message ?? error);
      
      // Handle RPC rate limiting
      const rateLimitError = this.handleRpcRateLimitError(error);
      if (rateLimitError) {
        throw rateLimitError;
      }
      
      if (error?.code === 4001) throw new Error("Transaction rejected by user.");
      throw new Error(error?.message ?? "Failed to register authorized location on blockchain.");
    }
  }

  /** Set authorized location for a manufacturer (admin only) */
  async setManufacturerLocation(data: {
    manufacturerAddress: string;
    locationName: string;
    latitude: number;
    longitude: number;
    radius: number; // in meters
  }): Promise<{ txHash: string }> {
    await this.initialize();
    if (!this.contract || !this.signer) throw new Error("Blockchain not initialized or signer missing");

    try {
      if (!ethers.isAddress(data.manufacturerAddress)) {
        throw new Error("Invalid manufacturer address");
      }

      const checksummedAddress = ethers.getAddress(data.manufacturerAddress);
      
      // Convert coordinates to scaled int (match contract expectation)
      const lat = BigInt(Math.round(data.latitude * 1e6));
      const lon = BigInt(Math.round(data.longitude * 1e6));
      const radius = BigInt(Math.round(data.radius * 1e6)); // Convert meters to scaled value

      const tx = await this.retryRpcCall(() =>
        this.contract!.setManufacturerLocation(
          checksummedAddress,
          data.locationName,
          lat,
          lon,
          radius
        )
      );

      const receipt = await this.retryRpcCall(() => tx.wait());
      const txHash = (receipt && ((receipt as any).hash ?? (receipt as any).transactionHash)) || tx.hash || "";

      return { txHash };
    } catch (error: any) {
      console.error("setManufacturerLocation failed:", error?.message ?? error);
      
      // Handle RPC rate limiting
      const rateLimitError = this.handleRpcRateLimitError(error);
      if (rateLimitError) {
        throw rateLimitError;
      }
      
      if (error?.code === 4001) throw new Error("Transaction rejected by user.");
      throw new Error(error?.message ?? "Failed to set manufacturer location on blockchain.");
    }
  }

  /** Get authorized locations for a participant */
  async getAuthorizedLocations(participantAddress: string): Promise<any[]> {
    try {
      await this.initialize();
      if (!this.contract) {
        console.warn("Contract not initialized, returning empty array for authorized locations");
        return [];
      }

      // Validate address
      if (!participantAddress || !ethers.isAddress(participantAddress)) {
        console.warn(`Invalid participant address: ${participantAddress}, returning empty array`);
        return [];
      }

      const checksummedAddress = ethers.getAddress(participantAddress);
      console.log(`🔍 Fetching authorized locations for: ${checksummedAddress}`);
      
      const locations = await this.retryRpcCall(() =>
        this.contract!.getAuthorizedLocations(checksummedAddress)
      );

      // Handle case where locations might be null or undefined
      if (!locations || !Array.isArray(locations)) {
        console.log(`No authorized locations found for ${checksummedAddress}`);
        return [];
      }

      // Filter out locations that don't exist
      const existingLocations = locations.filter((loc: any) => loc.exists === true);

      const formattedLocations = existingLocations.map((loc: any) => {
        const lat = Number(loc.latitude) / 1e6;
        const lon = Number(loc.longitude) / 1e6;
        const radius = Number(loc.radius) / 1e6; // Convert back to meters
        
        return {
          participant: loc.participant,
          locationName: loc.locationName,
          latitude: lat,
          longitude: lon,
          radius: radius,
          registeredAt: Number(loc.registeredAt),
          exists: loc.exists,
        };
      });
      
      console.log(`✅ Retrieved ${formattedLocations.length} authorized locations for ${checksummedAddress}`);
      return formattedLocations;
    } catch (error: any) {
      console.error("getAuthorizedLocations failed:", error?.message ?? error);
      
      // Return empty array for all errors - this is a non-critical operation
      // The participant might simply not have any authorized locations registered yet
      const errorMessage = error?.message?.toLowerCase() || '';
      const errorString = String(error).toLowerCase();
      
      // Check for various error types
      const isNonCriticalError = 
        errorMessage.includes("does not exist") ||
        errorMessage.includes("product does not exist") ||
        errorMessage.includes("no locations") ||
        errorMessage.includes("rpc") ||
        errorMessage.includes("network") ||
        errorMessage.includes("connection") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("rate limit") ||
        errorString.includes("rpc") ||
        errorString.includes("network") ||
        error?.code === -32002 ||
        error?.code === "NETWORK_ERROR" ||
        error?.code === "TIMEOUT" ||
        error?.name === "RpcRateLimitError";
      
      if (isNonCriticalError) {
        console.warn("Non-critical error while fetching authorized locations, returning empty array:", error?.message);
        return [];
      }
      
      // For any other error, also return empty array (participant might not have locations yet)
      console.warn("Error fetching authorized locations (returning empty array):", error?.message);
      return [];
    }
  }

  /** Report a product as counterfeit */
  async reportCounterfeit(productId: string): Promise<{ txHash: string }> {
    await this.initialize();
    if (!this.contract || !this.signer) throw new Error("Blockchain not initialized or signer missing");

    try {
      const tx = await this.retryRpcCall(() =>
        this.contract!.reportCounterfeit(productId)
      );

      const receipt = await this.retryRpcCall(() => tx.wait());
      const txHash = (receipt && ((receipt as any).hash ?? (receipt as any).transactionHash)) || tx.hash || "";

      return { txHash };
    } catch (error: any) {
      console.error("reportCounterfeit failed:", error?.message ?? error);
      
      // Handle RPC rate limiting
      const rateLimitError = this.handleRpcRateLimitError(error);
      if (rateLimitError) {
        throw rateLimitError;
      }
      
      if (error?.code === 4001) throw new Error("Transaction rejected by user.");
      throw new Error(error?.message ?? "Failed to report counterfeit product on blockchain.");
    }
  }

  /** Get all counterfeit reports */
  async getAllCounterfeitReports(): Promise<any[]> {
    await this.initialize();
    if (!this.contract) {
      console.warn("Contract not initialized, returning empty array for reports");
      return [];
    }

    try {
      const reports = await this.retryRpcCall(() =>
        this.contract!.getAllCounterfeitReports()
      );

      if (!reports || !Array.isArray(reports)) {
        console.log("No counterfeit reports found");
        return [];
      }

      const formattedReports = reports.map((report: any) => ({
        productId: report.productId,
        reporter: report.reporter,
        manufacturer: report.manufacturer,
        reportedAt: Number(report.reportedAt) * 1000, // Convert to milliseconds
        exists: report.exists,
      }));

      console.log(`✅ Retrieved ${formattedReports.length} counterfeit reports`);
      return formattedReports;
    } catch (error: any) {
      console.error("getAllCounterfeitReports failed:", error?.message ?? error);
      return [];
    }
  }

  /** Check if a product is reported as counterfeit */
  async isReportedAsCounterfeit(productId: string): Promise<boolean> {
    await this.initialize();
    if (!this.contract) {
      return false;
    }

    try {
      const isReported = await this.retryRpcCall(() =>
        this.contract!.isReportedAsCounterfeit(productId)
      );
      return isReported === true;
    } catch (error: any) {
      console.error("isReportedAsCounterfeit failed:", error?.message ?? error);
      return false;
    }
  }

  /** Check if a manufacturer is authorized */
  async isAuthorizedManufacturer(manufacturerAddress: string): Promise<boolean> {
    await this.initialize();
    if (!this.contract) throw new Error("Blockchain not initialized");

    try {
      if (!ethers.isAddress(manufacturerAddress)) {
        console.warn(`⚠️ Invalid address format: ${manufacturerAddress}`);
        return false;
      }

      const checksummedAddress: string = ethers.getAddress(manufacturerAddress);
      
      // Also cross-check with the authorized manufacturers list
      let isAuthorized = false;
      try {
        isAuthorized = await this.retryRpcCall(() =>
          this.contract!.isAuthorizedManufacturer(checksummedAddress)
        );
        
        // Double-check by getting all authorized manufacturers and comparing
        if (!isAuthorized) {
          console.log(`🔍 Direct check returned false, cross-checking with authorized list...`);
          const authorizedList = await this.getAuthorizedManufacturers();
          const normalizedList: string[] = authorizedList.map((addr: any): string => {
            const addrStr: string = String(addr || '');
            if (ethers.isAddress(addrStr)) {
              return String(ethers.getAddress(addrStr));
            }
            return String(addrStr).toLowerCase();
          });
          const normalizedCheck: string = checksummedAddress.toLowerCase();
          
          const foundInList = normalizedList.some(addr => addr.toLowerCase() === normalizedCheck);
          if (foundInList) {
            console.warn(`⚠️ Address found in authorized list but isAuthorizedManufacturer returned false! Address: ${checksummedAddress}`);
            // Use the list result if it's more reliable
            isAuthorized = true;
          }
          
          console.log(`🔍 Authorization check result:`, {
            address: checksummedAddress,
            directCheck: isAuthorized,
            foundInList,
            authorizedListCount: authorizedList.length,
            authorizedList: authorizedList
          });
        }
      } catch (rpcError: any) {
        console.error("RPC error checking authorization:", rpcError?.message ?? rpcError);
        // Try fallback: get all authorized manufacturers and check manually
        try {
          const authorizedList = await this.getAuthorizedManufacturers();
          const normalizedList: string[] = authorizedList.map((addr: any): string => {
            const addrStr: string = String(addr || '');
            if (ethers.isAddress(addrStr)) {
              return String(ethers.getAddress(addrStr));
            }
            return String(addrStr).toLowerCase();
          });
          const normalizedCheck: string = checksummedAddress.toLowerCase();
          isAuthorized = normalizedList.some(addr => addr.toLowerCase() === normalizedCheck);
          console.log(`🔍 Fallback check using authorized list: ${isAuthorized}`);
        } catch (fallbackError: any) {
          console.error("Fallback authorization check also failed:", fallbackError?.message ?? fallbackError);
          return false;
        }
      }

      return isAuthorized;
    } catch (error: any) {
      console.error("isAuthorizedManufacturer failed:", error?.message ?? error);
      return false;
    }
  }

  /** Get product manufacturer address */
  async getProductManufacturer(productId: string): Promise<string> {
    await this.initialize();
    if (!this.contract) throw new Error("Blockchain not initialized");

    try {
      const manufacturerAddress = await this.retryRpcCall(() =>
        this.contract!.getProductManufacturer(productId)
      );

      // Normalize to checksummed address for consistent comparison
      const addressStr = String(manufacturerAddress);
      if (ethers.isAddress(addressStr)) {
        return ethers.getAddress(addressStr);
      }
      return addressStr;
    } catch (error: any) {
      // Check if it's a "Product does not exist" error (expected case)
      const errorMessage = error?.message || error?.reason || '';
      const isProductNotFound = 
        errorMessage.includes('Product does not exist') ||
        errorMessage.includes('product does not exist') ||
        errorMessage.includes('does not exist') ||
        (error?.code === 'CALL_EXCEPTION' && errorMessage.includes('Product'));
      
      if (isProductNotFound) {
        // This is expected - product doesn't exist on blockchain
        // Create a clean error object without logging
        const notFoundError = new Error('Product does not exist');
        notFoundError.name = 'PRODUCT_NOT_FOUND';
        throw notFoundError;
      }
      
      // For other errors, log and throw
      console.error("getProductManufacturer failed:", error?.message ?? error);
      throw new Error(error?.message ?? "Failed to get product manufacturer from blockchain.");
    }
  }

  /** Get all authorized manufacturers */
  async getAuthorizedManufacturers(): Promise<string[]> {
    await this.initialize();
    if (!this.contract) throw new Error("Blockchain not initialized");

    try {
      const manufacturers = await this.retryRpcCall(() =>
        this.contract!.getAuthorizedManufacturers()
      );

      return manufacturers.map((addr: string) => String(addr));
    } catch (error: any) {
      console.error("getAuthorizedManufacturers failed:", error?.message ?? error);
      throw new Error(error?.message ?? "Failed to get authorized manufacturers from blockchain.");
    }
  }

  /** Authorize a manufacturer (only contract owner) */
  async authorizeManufacturer(manufacturerAddress: string): Promise<{ txHash: string }> {
    await this.initialize();
    if (!this.contract || !this.signer) throw new Error("Blockchain not initialized or signer missing");

    try {
      if (!ethers.isAddress(manufacturerAddress)) {
        throw new Error("Invalid manufacturer address");
      }

      const checksummedAddress = ethers.getAddress(manufacturerAddress);
      const tx = await this.retryRpcCall(() =>
        this.contract!.authorizeManufacturer(checksummedAddress)
      );

      const receipt = await this.retryRpcCall(() => tx.wait());
      const txHash = (receipt && ((receipt as any).hash ?? (receipt as any).transactionHash)) || tx.hash || "";

      return { txHash };
    } catch (error: any) {
      console.error("authorizeManufacturer failed:", error?.message ?? error);
      if (error?.code === 4001) throw new Error("Transaction rejected by user.");
      throw new Error(error?.message ?? "Failed to authorize manufacturer on blockchain.");
    }
  }

  /** Revoke a manufacturer (only contract owner) */
  async revokeManufacturer(manufacturerAddress: string): Promise<{ txHash: string }> {
    await this.initialize();
    if (!this.contract || !this.signer) throw new Error("Blockchain not initialized or signer missing");

    try {
      if (!ethers.isAddress(manufacturerAddress)) {
        throw new Error("Invalid manufacturer address");
      }

      const checksummedAddress = ethers.getAddress(manufacturerAddress);
      const tx = await this.retryRpcCall(() =>
        this.contract!.revokeManufacturer(checksummedAddress)
      );

      const receipt = await this.retryRpcCall(() => tx.wait());
      const txHash = (receipt && ((receipt as any).hash ?? (receipt as any).transactionHash)) || tx.hash || "";

      return { txHash };
    } catch (error: any) {
      console.error("revokeManufacturer failed:", error?.message ?? error);
      if (error?.code === 4001) throw new Error("Transaction rejected by user.");
      throw new Error(error?.message ?? "Failed to revoke manufacturer on blockchain.");
    }
  }

  /** Verify product authenticity (checks manufacturer authorization and blockchain existence) */
  async verifyProductAuthenticity(productId: string): Promise<{
    isAuthentic: boolean;
    isValidManufacturer: boolean;
    manufacturerAddress: string;
    existsOnChain: boolean;
  }> {
    await this.initialize();
    if (!this.contract) throw new Error("Blockchain not initialized");

    try {
      // Check if product exists
      const exists = await this.retryRpcCall(() =>
        this.contract!.checkProductExists(productId)
      );

      if (!exists) {
        return {
          isAuthentic: false,
          isValidManufacturer: false,
          manufacturerAddress: "",
          existsOnChain: false,
        };
      }

      // Get manufacturer address
      const manufacturerAddress = await this.getProductManufacturer(productId);
      
      // Normalize address to checksummed format for consistent comparison
      const normalizedManufacturerAddress: string = ethers.isAddress(manufacturerAddress) 
        ? ethers.getAddress(manufacturerAddress) 
        : String(manufacturerAddress || '').toLowerCase();

      // Check if manufacturer is authorized
      const isValidManufacturer = await this.isAuthorizedManufacturer(normalizedManufacturerAddress);
      
      // Debug logging with detailed information
      const authorizedList = await this.getAuthorizedManufacturers().catch(() => []);
      console.log('🔍 Product Authenticity Verification:', {
        productId,
        manufacturerAddress: normalizedManufacturerAddress,
        isValidManufacturer,
        existsOnChain: exists,
        authorizedManufacturersCount: authorizedList.length,
        authorizedManufacturers: authorizedList,
        isInAuthorizedList: authorizedList.some(addr => {
          const normalized: string = ethers.isAddress(addr) ? ethers.getAddress(addr) : String(addr || '').toLowerCase();
          return normalized.toLowerCase() === normalizedManufacturerAddress.toLowerCase();
        })
      });

      // Product is authentic if it exists and manufacturer is authorized
      const isAuthentic = exists && isValidManufacturer;

      return {
        isAuthentic,
        isValidManufacturer,
        manufacturerAddress: normalizedManufacturerAddress,
        existsOnChain: exists,
      };
    } catch (error: any) {
      console.error("verifyProductAuthenticity failed:", error?.message ?? error);
      return {
        isAuthentic: false,
        isValidManufacturer: false,
        manufacturerAddress: "",
        existsOnChain: false,
      };
    }
  }

  /** Get contract owner address */
  async getContractOwner(): Promise<string> {
    await this.initialize();
    if (!this.contract) throw new Error("Blockchain not initialized");

    try {
      const owner = await this.retryRpcCall(() =>
        this.contract!.contractOwner()
      );

      return String(owner);
    } catch (error: any) {
      console.error("getContractOwner failed:", error?.message ?? error);
      throw new Error(error?.message ?? "Failed to get contract owner from blockchain.");
    }
  }
}

/* Export singleton */
export const blockchainService = new BlockchainService();  