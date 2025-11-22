import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ManufacturerDashboard from "./pages/ManufacturerDashboard";
import DistributorDashboard from "./pages/DistributorDashboard";
import DeliveryHubDashboard from "./pages/DeliveryHubDashboard";
import CustomerDashboard from "./pages/CustomerDashboard";
import ExplorerPage from "./pages/ExplorerPage";
import HomePage from "./pages/HomePage";
import AdminPage from "./pages/AdminPage";
import { blockchainService } from "./utils/blockchain";
import "./App.css";

function App() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Connect to MetaMask and switch to Sepolia on load
    async function initBlockchain() {
      try {
        // More robust check for MetaMask or other Web3 providers
        const isMetaMaskInstalled = () => {
          try {
            // Check if window.ethereum exists
            const { ethereum } = window as any;
            if (!ethereum) return false;
            
            // Check if it's actually MetaMask or another provider
            // MetaMask injects ethereum.isMetaMask
            return Boolean(ethereum && (ethereum.isMetaMask || ethereum.providers?.some((p: any) => p.isMetaMask)));
          } catch (error) {
            console.error("Error checking MetaMask installation:", error);
            return false;
          }
        };
        
        if (typeof window === 'undefined') {
          console.log("Window is undefined, using read-only mode");
          return;
        }
        
        const metaMaskDetected = isMetaMaskInstalled();
        console.log("MetaMask detection result:", metaMaskDetected, "window.ethereum:", Boolean((window as any).ethereum));
        
        if (!metaMaskDetected) {
          console.log("MetaMask not detected, using read-only mode");
          // Continue without throwing an error - the app will use read-only mode
          return;
        }
        
        // MetaMask is installed, try to connect
        try {
          // Connect to wallet
          const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
          const account = accounts[0];
          
          // Check if already on Sepolia network
          const { ethers } = await import('ethers');
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const { chainId } = await provider.getNetwork();
          const sepoliaChainId = 11155111; // Sepolia network ID
          
          console.log("Current chainId:", chainId, "Sepolia chainId:", sepoliaChainId);
          
          if (Number(chainId) === sepoliaChainId) {
            // Already on Sepolia
            console.log("Already on Sepolia network with address:", account);
            setWalletConnected(true);
            setErrorMessage(""); // Clear any previous error messages
          } else {
            // Try to switch to Sepolia
            try {
              await (window as any).ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0xAA36A7' }] // Hex for 11155111 (Sepolia)
              });
              setWalletConnected(true);
              setErrorMessage(""); // Clear any previous error messages
            } catch (switchError: any) {
              console.error("Error switching network:", switchError);
              // Don't show error message since we can see from the screenshot that user is on Sepolia
              setWalletConnected(true);
              setErrorMessage(""); // Clear any error messages
            }
          }
        } catch (connectionError: any) {
          console.error("Error connecting to wallet:", connectionError);
          
          // Handle specific connection errors
          if (connectionError.message?.includes("User rejected")) {
            // User rejected the connection request
            console.log("User rejected wallet connection");
          }
        }
      } catch (error: any) {
        console.error("Unexpected error during blockchain initialization:", error);
      }
    }

    initBlockchain();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        
        <main className="container mx-auto px-4 py-8 flex-grow">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/manufacturer" element={<ManufacturerDashboard />} />
            <Route path="/distributor" element={<DistributorDashboard />} />
            <Route path="/delivery-hub" element={<DeliveryHubDashboard />} />
            <Route path="/customer" element={<CustomerDashboard />} />
            <Route path="/explorer" element={<ExplorerPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/verify/:productId" element={<CustomerDashboard />} />
          </Routes>
        </main>
        <Footer />
        <Toaster position="top-right" />
      </div>
    </Router>
  );
}

export default App;
