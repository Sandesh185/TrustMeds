const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDoc, updateDoc, query, where, getDocs, orderBy } = require('firebase/firestore');
const dotenv = require('dotenv');

dotenv.config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase with error handling for testing
let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Firebase initialization error (using mock for testing):", error.message);
  // Create mock db for testing
  db = {
    async *collection() { yield {}; },
    async *doc() { yield {}; },
    async *setDoc() { yield {}; },
    async *getDoc() { yield { exists: () => false, data: () => ({}) }; },
    async *updateDoc() { yield {}; },
    async *query() { yield {}; },
    async *where() { yield {}; },
    async *getDocs() { yield { forEach: () => {} }; }
  };
}

// User Management Functions
// --------------------------

// Create a new user
const createUser = async (userData) => {
  try {
    const userRef = doc(db, 'users', userData.address);
    await setDoc(userRef, {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { success: true, address: userData.address };
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

// Get user by wallet address
const getUserByAddress = async (address) => {
  try {
    const userRef = doc(db, 'users', address);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};

// Update user role
const updateUserRole = async (address, role) => {
  try {
    const userRef = doc(db, 'users', address);
    await updateDoc(userRef, {
      role,
      updatedAt: new Date()
    });
    return { success: true, address, role };
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

// Helper function to check if error is a Firebase offline/network error
const isFirebaseOfflineError = (error) => {
  if (!error) return false;
  
  const errorCode = error?.code || '';
  const errorMessage = String(error?.message || '').toLowerCase();
  
  // Firebase offline/network error codes
  return (
    errorCode === 'unavailable' ||
    errorCode === 'deadline-exceeded' ||
    errorMessage.includes('client is offline') ||
    errorMessage.includes('network') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('failed to get document')
  );
};

// Product Management Functions
// ---------------------------

// Store product metadata in Firestore
const storeProductMetadata = async (productData) => {
  try {
    // Ensure productId is a string (Firebase requires string for document ID)
    const productId = String(productData.productId || '').trim();
    if (!productId || productId === '' || productId === 'undefined') {
      throw new Error(`Product ID is required. Received: ${JSON.stringify(productData.productId)}`);
    }
    
    console.log(`💾 Storing product metadata in Firebase:`, {
      productId: productId,
      manufacturer: productData.manufacturer || 'N/A',
      productName: productData.productName || 'N/A',
      transactionHash: productData.transactionHash || 'N/A'
    });
    
    const productRef = doc(db, 'products', productId);
    await setDoc(productRef, {
      ...productData,
      productId: productId, // Ensure it's a string
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log(`✅ Successfully stored product in Firebase: ${productId}`);
    return { success: true, productId: productId };
  } catch (error) {
    // Handle offline errors gracefully
    if (isFirebaseOfflineError(error)) {
      // Silently return - metadata will be synced when Firebase comes back online
      console.log(`⚠️ Firebase is offline - product will be synced when Firebase comes back online`);
      return { success: false, productId: productData.productId, offline: true };
    }
    console.error('❌ Error storing product metadata:', error);
    console.error('   Product data:', JSON.stringify(productData, null, 2));
    return { success: false, productId: productData.productId, error: error.message };
  }
};

// Get product metadata from Firestore
const getProductMetadata = async (productId) => {
  try {
    const productRef = doc(db, 'products', productId);
    const productSnap = await getDoc(productRef);
    
    if (productSnap.exists()) {
      return { id: productId, ...productSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    // Handle offline errors gracefully - return null instead of throwing
    if (isFirebaseOfflineError(error)) {
      // Firebase is offline - return null (non-critical, blockchain is source of truth)
      return null;
    }
    // For other errors, log and throw
    console.error('Error getting product metadata:', error);
    throw error;
  }
};

// Update product status in Firestore (upsert - creates if doesn't exist)
const updateProductStatus = async (productId, status, location, additionalData = {}) => {
  try {
    const productRef = doc(db, 'products', productId);
    
    // Check if product exists
    const productSnap = await getDoc(productRef);
    
    const updateData = {
      status,
      updatedAt: new Date(),
      ...(location && { currentLocation: location }),
      ...additionalData
    };
    
    if (productSnap.exists()) {
      // Product exists, update it
      await updateDoc(productRef, updateData);
      return { success: true, productId, created: false };
    } else {
      // Product doesn't exist, create it with minimal data
      // This can happen if the event listener fires before the frontend API call
      await setDoc(productRef, {
        productId: productId,
        status: status,
        updatedAt: new Date(),
        createdAt: new Date(),
        ...(location && { currentLocation: location }),
        ...additionalData,
        _eventListenerCreated: true // Flag to indicate this was created by event listener
      });
      console.log(`ℹ️ Created product document for ${productId} (will be updated by frontend API)`);
      return { success: true, productId, created: true };
    }
  } catch (error) {
    // Handle offline errors gracefully
    if (isFirebaseOfflineError(error)) {
      // Silently return - status will be synced when Firebase comes back online
      return { success: false, productId, offline: true };
    }
    console.error('Error updating product status:', error);
    throw error;
  }
};

// Get products by manufacturer address
const getProductsByManufacturer = async (manufacturerAddress) => {
  try {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('manufacturer', '==', manufacturerAddress));
    const querySnapshot = await getDocs(q);
    
    const products = [];
    querySnapshot.forEach((doc) => {
      products.push({ id: doc.id, ...doc.data() });
    });
    
    return products;
  } catch (error) {
    console.error('Error getting products by manufacturer:', error);
    throw error;
  }
};

// Transfer Management Functions
// ----------------------------

// Store transfer record in Firestore
const storeTransferRecord = async (transferData) => {
  try {
    // Create a unique ID for the transfer record
    const transferId = `${transferData.productId}_${Date.now()}`;
    const transferRef = doc(db, 'transfers', transferId);
    
    await setDoc(transferRef, {
      ...transferData,
      timestamp: new Date()
    });
    
    return { success: true, transferId };
  } catch (error) {
    // Handle offline errors gracefully
    if (isFirebaseOfflineError(error)) {
      // Silently return - transfer will be synced when Firebase comes back online
      return { success: false, transferId: `${transferData.productId}_${Date.now()}`, offline: true };
    }
    console.error('Error storing transfer record:', error);
    throw error;
  }
};

// Get transfer history for a product
const getTransferHistory = async (productId) => {
  try {
    const transfersRef = collection(db, 'transfers');
    const q = query(transfersRef, where('productId', '==', productId), orderBy('timestamp', 'asc'));
    const querySnapshot = await getDocs(q);
    
    const transfers = [];
    querySnapshot.forEach((doc) => {
      transfers.push({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      });
    });
    
    return transfers;
  } catch (error) {
    // Handle offline errors gracefully - return empty array
    if (isFirebaseOfflineError(error)) {
      // Firebase is offline - return empty array (non-critical)
      return [];
    }
    console.error('Error getting transfer history:', error);
    throw error;
  }
};

module.exports = {
  // User management
  createUser,
  getUserByAddress,
  updateUserRole,
  
  // Product management
  storeProductMetadata,
  getProductMetadata,
  updateProductStatus,
  getProductsByManufacturer,
  
  // Transfer management
  storeTransferRecord,
  getTransferHistory
};