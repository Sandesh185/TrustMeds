import { useEffect } from "react";
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
import { SEPOLIA_CHAIN_ID_HEX } from "./utils/network";
import "./App.css";

function App() {
  useEffect(() => {
    async function initBlockchain() {
      try {
        const { ethereum } = window as Window & { ethereum?: { isMetaMask?: boolean; providers?: { isMetaMask?: boolean }[]; request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } };
        if (!ethereum) return;

        const isMetaMask = Boolean(
          ethereum.isMetaMask || ethereum.providers?.some((p) => p.isMetaMask)
        );
        if (!isMetaMask) return;

        await ethereum.request({ method: "eth_requestAccounts" });

        const { ethers } = await import("ethers");
        const provider = new ethers.BrowserProvider(ethereum);
        const { chainId } = await provider.getNetwork();

        if (Number(chainId) !== 11155111) {
          try {
            await ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
            });
          } catch (switchError: unknown) {
            console.error("Error switching network:", switchError);
          }
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("User rejected")) {
          console.error("Error during blockchain initialization:", error);
        }
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
