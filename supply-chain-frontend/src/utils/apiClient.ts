// API Client Service for Drug Supply Chain
// This service provides a clean interface to communicate with the backend API

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface ProductData {
  productId: string;
  manufacturerName: string;
  productName: string;
  productCode: string;
  category: string;
  price: string | number;
  latitude: number;
  longitude: number;
  expiryDate: string | number;
  batchNumber: string;
  status?: string;
  currentOwner?: string;
}

interface TransferData {
  from: string;
  to: string;
  status: string;
}

interface StatusUpdate {
  status: string;
  location?: string;
}

/**
 * Make an API request with error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    // Get wallet address from localStorage or window.ethereum if available
    const walletAddress = typeof window !== 'undefined' 
      ? (localStorage.getItem('wallet_address') || (window as any).ethereum?.selectedAddress || '')
      : '';
    
    // Add wallet address to headers if available (required by auth middleware)
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(walletAddress && { 'x-wallet-address': walletAddress }),
      ...options.headers,
    };
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error: Failed to connect to API');
  }
}

/**
 * API Client for Product Operations
 */
export const apiClient = {
  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    return apiRequest('/health');
  },

  /**
   * Authentication
   */
  async login(address: string, role: string): Promise<{ success: boolean; user: { address: string; role: string } }> {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ address, role }),
    });
  },

  async verifyAuth(walletAddress: string, role: string): Promise<{ authenticated: boolean }> {
    return apiRequest('/auth/verify', {
      method: 'GET',
      headers: {
        'x-wallet-address': walletAddress,
        'x-user-role': role,
      },
    });
  },

  async getUserRole(address: string): Promise<{ role: string }> {
    return apiRequest(`/auth/role/${address}`);
  },

  /**
   * Product Operations
   */
  async getProduct(productId: string): Promise<ProductData> {
    return apiRequest(`/products/${productId}`);
  },

  async getProductHistory(productId: string): Promise<any[]> {
    try {
      const response = await apiRequest<any>(`/products/${productId}/history`);
      // Backend returns { historyHashes: [], transfers: [] }
      // Return transfers array which contains the actual transaction history
      if (response && response.transfers && Array.isArray(response.transfers) && response.transfers.length > 0) {
        return response.transfers;
      }
      // If response is directly an array (legacy format), return it
      if (Array.isArray(response) && response.length > 0) {
        return response;
      }
      // If only historyHashes are available, return empty array (frontend will use blockchain)
      if (response && response.historyHashes && Array.isArray(response.historyHashes)) {
        // History hashes don't contain full transaction data, return empty to trigger blockchain fallback
        return [];
      }
      return [];
    } catch (error) {
      // Throw error to allow fallback to blockchain
      console.warn('API getProductHistory failed, will use blockchain fallback:', error);
      throw error;
    }
  },

  async verifyProduct(productId: string): Promise<{ productId: string; isAuthentic: boolean }> {
    return apiRequest(`/products/${productId}/verify`);
  },

  async createProductMetadata(productId: string, metadata: any): Promise<{ success: boolean }> {
    return apiRequest(`/products/${productId}/metadata`, {
      method: 'POST',
      body: JSON.stringify(metadata),
    });
  },

  async transferOwnership(
    productId: string,
    transferData: TransferData
  ): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/products/${productId}/transfers`, {
      method: 'POST',
      body: JSON.stringify(transferData),
    });
  },

  async getOwnershipTransfers(productId: string): Promise<any> {
    return apiRequest(`/products/${productId}/transfers`);
  },

  async updateStatus(
    productId: string,
    statusUpdate: StatusUpdate
  ): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/products/${productId}/status`, {
      method: 'PUT',
      body: JSON.stringify(statusUpdate),
    });
  },
};

/**
 * Check if API is available
 * Useful for fallback to direct blockchain calls
 */
export async function isApiAvailable(): Promise<boolean> {
  try {
    await apiClient.healthCheck();
    return true;
  } catch {
    return false;
  }
}

export default apiClient;

