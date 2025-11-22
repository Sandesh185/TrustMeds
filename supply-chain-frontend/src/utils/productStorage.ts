export interface StoredProduct {
  productId: string;
  manufacturerName: string;
  productName: string;
  productCode: string;
  category: string;
  price: number;
  latitude: number;
  longitude: number;
  location?: string; // Location name (e.g., "Mumbai Warehouse")
  owner: string;
  status: string;
  createdAt: string;
  txHash: string;
  // Optional fields for extended product details
  expiryDate?: string;
  batchNumber?: string;
  history?: TransactionHistory[];
}

export interface TransactionHistory {
  timestamp: string;
  action: string;
  from: string;
  to: string;
  status: string;
  txHash: string;
  performedBy: string;
}

const STORAGE_KEY = 'drug_supply_chain_products';

export const saveProduct = (product: StoredProduct) => {
  const products = getProducts();
  // Check if product already exists
  const existingIndex = products.findIndex(p => p.productId === product.productId);
  
  if (existingIndex !== -1) {
    // Update existing product
    products[existingIndex] = product;
  } else {
    // Add new product
    products.push(product);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
};

export const getProducts = (): StoredProduct[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const getProduct = (productId: string): StoredProduct | null => {
  const products = getProducts();
  return products.find(p => p.productId === productId) || null;
};

export const updateProductStatus = (productId: string, status: string, newOwner?: string, performedBy?: string, txHash?: string) => {
  const products = getProducts();
  const product = products.find(p => p.productId === productId);
  
  if (product) {
    const oldOwner = product.owner;
    product.status = status;
    if (newOwner) {
      product.owner = newOwner;
    }
    
    // Add to transaction history
    if (!product.history) {
      product.history = [];
    }
    
    product.history.push({
      timestamp: new Date().toISOString(),
      action: newOwner ? 'Ownership Transferred' : 'Status Updated',
      from: oldOwner,
      to: newOwner || oldOwner,
      status: status,
      txHash: txHash || `0x${Math.random().toString(16).substring(2, 66)}`,
      performedBy: performedBy || 'Unknown'
    });
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    return true;
  }
  
  return false;
};

export const addTransactionHistory = (productId: string, history: TransactionHistory) => {
  const products = getProducts();
  const product = products.find(p => p.productId === productId);
  
  if (product) {
    if (!product.history) {
      product.history = [];
    }
    product.history.push(history);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }
};

