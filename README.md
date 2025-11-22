# TrustMeds - Blockchain-Based Pharmaceutical Supply Chain Management

A comprehensive blockchain-based pharmaceutical supply chain management system that ensures transparency, authenticity, and traceability of pharmaceutical products from manufacturer to customer using Ethereum blockchain and QR code verification.

## 📋 Table of Contents

- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Setup](#-environment-setup)
- [Smart Contract Deployment](#-smart-contract-deployment)
- [Running the Project](#-running-the-project)
- [Project Structure](#-project-structure)
- [User Roles & Workflows](#-user-roles--workflows)
- [Common Commands](#-common-commands)
- [API Endpoints](#-api-endpoints)
- [Troubleshooting](#-troubleshooting)

## 🚀 Features

- **Blockchain Integration**: Immutable product records on Ethereum (Sepolia testnet)
- **QR Code Tracking**: Generate and scan QR codes for instant product verification
- **Location Validation**: Geofencing and location-based validation for supply chain participants
- **Role-Based Access**: Separate dashboards for Manufacturers, Distributors, Delivery Hubs, and Customers
- **Counterfeit Detection**: Report and track counterfeit products
- **Real-time Sync**: Automatic synchronization of blockchain events to Firebase
- **Complete Traceability**: Full chain of custody tracking from creation to delivery

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** (comes with Node.js)
- **MetaMask** browser extension - [Download](https://metamask.io/)
- **Git** - [Download](https://git-scm.com/)
- **Firebase Account** (for off-chain data storage) - [Sign up](https://firebase.google.com/)
- **Ethereum Wallet** with Sepolia testnet ETH (for transactions)

### Getting Sepolia Testnet ETH

You can get free Sepolia ETH from these faucets:
- [Sepolia Faucet](https://sepoliafaucet.com/)
- [QuickNode Faucet](https://faucet.quicknode.com/ethereum/sepolia)
- [Alchemy Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)

## 🔧 Installation

### Step 1: Clone the Repository

```bash
git clone <your-repository-url>
cd drug_supply_chain
```

### Step 2: Install Dependencies

**Root (Hardhat):**
```bash
npm install
```

**Frontend:**
```bash
cd supply-chain-frontend
npm install
```

**Backend:**
```bash
cd supply-chain-frontend/backend
npm install
```

## ⚙️ Environment Setup

### Step 1: Create Environment Files

You need to create `.env` files in three locations:

#### 1. Root `.env` (for Hardhat)

Create `.env` in the root directory:

```env
# Sepolia Testnet Private Key (NEVER commit this to version control)
SEPOLIA_PRIVATE_KEY=your_sepolia_private_key_here

# Infura RPC URL (optional - has fallbacks to public RPCs)
INFURA_URL=https://sepolia.infura.io/v3/your_infura_project_id
```

**How to get your private key:**
- Open MetaMask → Account Icon → Settings → Security & Privacy → Export Private Key
- Or generate a new one: `node -e "const { ethers } = require('ethers'); console.log(ethers.Wallet.createRandom().privateKey);"`

#### 2. Backend `.env` (in `supply-chain-frontend/backend/`)

Create `.env` file:

```env
# Server Configuration
PORT=5000

# Blockchain Configuration
CONTRACT_ADDRESS=your_deployed_contract_address_here
INFURA_URL=https://sepolia.infura.io/v3/your_infura_project_id

# Firebase Configuration (get from Firebase Console)
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
FIREBASE_APP_ID=your_firebase_app_id
```

**How to get Firebase credentials:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Go to Project Settings → General
4. Scroll down to "Your apps" section
5. Click on Web app icon (</>) to get configuration

#### 3. Frontend `.env` (in `supply-chain-frontend/`)

Create `.env` file:

```env
# API Configuration
VITE_API_URL=http://localhost:5000/api

# Blockchain Configuration
VITE_CONTRACT_ADDRESS=your_deployed_contract_address_here
VITE_NETWORK_CHAIN_ID=11155111

# RPC URLs (comma-separated, first one will be primary)
VITE_RPC_URLS=https://rpc.sepolia.org,https://sepolia-rpc.publicnode.com
```

## 📦 Smart Contract Deployment

### Step 1: Deploy to Sepolia Testnet

```bash
# From root directory
npx hardhat run scripts/deploy.js --network sepolia --config hardhat.config.js
```

### Step 2: Copy Contract Address

After deployment, you'll see output like:
```
✅ DrugChain deployed successfully!
📍 Contract Address: 0x3c17A630689F50a023c9c6E49cFfEDA3c49291E1
```

### Step 3: Update Environment Files

Copy the contract address and update:
- `supply-chain-frontend/backend/.env` → `CONTRACT_ADDRESS`
- `supply-chain-frontend/.env` → `VITE_CONTRACT_ADDRESS`

The contract address is also automatically saved to `supply-chain-frontend/src/utils/contract-info.json`.

## 🏃 Running the Project

### Option 1: Run Both Frontend and Backend Together

```bash
cd supply-chain-frontend
npm run dev:all
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend app on `http://localhost:5173`

### Option 2: Run Separately

**Terminal 1 - Backend:**
```bash
cd supply-chain-frontend/backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd supply-chain-frontend
npm run dev
```

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health

## 📁 Project Structure

```
drug_supply_chain/
├── supply-chain-frontend/
│   ├── backend/              # Express.js API server
│   │   ├── routes/           # API routes (auth, products)
│   │   ├── services/         # Blockchain & Firebase services
│   │   ├── middleware/       # Auth, validation, rate limiting
│   │   ├── tests/            # Backend tests
│   │   └── server.js         # Server entry point
│   ├── contracts/            # Solidity smart contracts
│   │   └── DrugChain.sol     # Main contract
│   ├── src/
│   │   ├── pages/           # React pages/dashboards
│   │   │   ├── HomePage.tsx
│   │   │   ├── ManufacturerDashboard.tsx
│   │   │   ├── DistributorDashboard.tsx
│   │   │   ├── DeliveryHubDashboard.tsx
│   │   │   ├── CustomerDashboard.tsx
│   │   │   └── AdminPage.tsx
│   │   ├── components/      # Reusable components
│   │   ├── utils/           # Utilities (blockchain, API, etc.)
│   │   └── hooks/           # Custom React hooks
│   └── scripts/             # Deployment scripts
├── scripts/                 # Root deployment scripts
├── hardhat.config.js       # Hardhat configuration
└── package.json            # Root dependencies
```

## 👥 User Roles & Workflows

### 1. Manufacturer
**Workflow:**
1. Connect MetaMask wallet
2. Navigate to Manufacturer Dashboard
3. Create new product with details (name, batch, expiry, etc.)
4. Set manufacturing location
5. Generate QR code for the product
6. Product is registered on blockchain

**Key Features:**
- Create products
- Generate QR codes
- View all created products
- Set authorized locations

### 2. Distributor
**Workflow:**
1. Connect MetaMask wallet
2. Navigate to Distributor Dashboard
3. Scan QR code to receive product from manufacturer
4. Verify product ownership
5. Transfer product to delivery hub
6. Update product status

**Key Features:**
- Scan QR codes
- Verify product ownership
- Transfer products
- Update status

### 3. Delivery Hub
**Workflow:**
1. Connect MetaMask wallet
2. Navigate to Delivery Hub Dashboard
3. Receive products from distributor
4. Update shipment status
5. Confirm delivery to customer

**Key Features:**
- Track shipments
- Update delivery status
- Location tracking

### 4. Customer
**Workflow:**
1. Connect MetaMask wallet (optional for verification)
2. Navigate to Customer Dashboard
3. Scan QR code on product
4. View complete product history
5. Verify authenticity
6. Report counterfeit if found

**Key Features:**
- Scan QR codes
- View product history
- Verify authenticity
- Report counterfeits

### 5. Admin
**Workflow:**
1. Connect MetaMask wallet (contract owner)
2. Navigate to Admin Dashboard
3. Authorize manufacturers
4. Set manufacturer locations
5. View counterfeit reports
6. Manage system settings

**Key Features:**
- Authorize/revoke manufacturers
- Manage locations
- View reports
- System administration

## 🛠️ Common Commands

### Development Commands

```bash
# Install dependencies (root)
npm install

# Install frontend dependencies
cd supply-chain-frontend && npm install

# Install backend dependencies
cd supply-chain-frontend/backend && npm install

# Run frontend only
cd supply-chain-frontend && npm run dev

# Run backend only
cd supply-chain-frontend/backend && npm start

# Run both frontend and backend
cd supply-chain-frontend && npm run dev:all
```

### Smart Contract Commands

```bash
# Compile contracts
npx hardhat compile --config hardhat.config.js

# Run tests
npx hardhat test --config hardhat.config.js

# Deploy to local network
npx hardhat run scripts/deploy.js --network localhost --config hardhat.config.js

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia --config hardhat.config.js

# Start local Hardhat node
npx hardhat node --config hardhat.config.js
```

### Build Commands

```bash
# Build frontend for production
cd supply-chain-frontend && npm run build

# Preview production build
cd supply-chain-frontend && npm run preview
```

### Testing Commands

```bash
# Run backend tests
cd supply-chain-frontend/backend && npm test

# Run backend tests with coverage
cd supply-chain-frontend/backend && npm run test:coverage
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Login with wallet address and role
- `GET /api/auth/verify` - Verify authentication
- `GET /api/auth/role/:address` - Get user role

### Products
- `GET /api/products/:productId` - Get product details
- `POST /api/products/:productId/metadata` - Store product metadata
- `PUT /api/products/:productId/status` - Update product status
- `GET /api/products/:productId/history` - Get product history
- `GET /api/products/:productId/transfers` - Get ownership transfers
- `POST /api/products/:productId/transfers` - Record transfer
- `GET /api/products/:productId/verify` - Verify product authenticity

### Health Check
- `GET /api/health` - Server health status

## 🐛 Troubleshooting

### MetaMask Connection Issues

**Problem:** Cannot connect to MetaMask
- **Solution:** 
  - Ensure MetaMask is installed and unlocked
  - Check that you're on Sepolia testnet (Chain ID: 11155111)
  - Refresh the page and try again
  - Clear browser cache

### RPC Connection Errors

**Problem:** RPC endpoint errors or timeouts
- **Solution:**
  - The system has automatic fallback RPC endpoints
  - Check your internet connection
  - Verify INFURA_URL in `.env` if using custom endpoint
  - Wait a few moments and try again (public RPCs can be rate-limited)

### Firebase Connection Issues

**Problem:** Firebase not connecting
- **Solution:**
  - Verify all Firebase environment variables are set correctly
  - Check Firebase project settings
  - Ensure Firestore is enabled in Firebase console
  - Verify Firebase credentials are correct

### Contract Not Found

**Problem:** Contract address not working
- **Solution:**
  - Verify contract address in all `.env` files
  - Ensure contract is deployed to Sepolia testnet
  - Check that contract address matches in:
    - `supply-chain-frontend/backend/.env`
    - `supply-chain-frontend/.env`
    - `supply-chain-frontend/src/utils/contract-info.json`

### Transaction Failures

**Problem:** Transactions failing
- **Solution:**
  - Ensure you have Sepolia ETH in your wallet
  - Check that you're on Sepolia testnet
  - Verify you have sufficient gas
  - Check that contract address is correct

### Backend Not Starting

**Problem:** Backend server won't start
- **Solution:**
  - Check that PORT 5000 is not in use
  - Verify all environment variables are set
  - Check for syntax errors in `.env` file
  - Ensure all dependencies are installed: `npm install`

### Frontend Build Errors

**Problem:** Frontend build fails
- **Solution:**
  - Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
  - Check TypeScript errors: `npm run build`
  - Verify all environment variables are set
  - Check for missing dependencies

## 🔒 Security Notes

- **Never commit `.env` files** to version control (they're in `.gitignore`)
- **Keep private keys secure** - never share them
- **Use different keys** for development and production
- **Rotate keys** if they're ever exposed
- **Test on testnet** before deploying to mainnet

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For issues and questions:
- Open an issue in the repository
- Check the troubleshooting section above
- Review the API documentation

---

**Built with:**
- React + TypeScript
- Solidity + Hardhat
- Express.js
- Firebase
- Ethers.js
- Tailwind CSS

**Current Contract Address (Sepolia):** `0x3c17A630689F50a023c9c6E49cFfEDA3c49291E1`

**Network:** Sepolia Testnet (Chain ID: 11155111)
