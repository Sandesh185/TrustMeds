const dotenv = require('dotenv');
dotenv.config();

// Prefer Firebase Admin SDK on the backend to bypass client-side security rules
let admin;
let adminInitialized = false;
let db; // Will be set to Firestore instance (admin or client)
let useAdmin = false;

try {
  admin = require('firebase-admin');
  // Try to initialize with service account credentials from env
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const hasGoogleCredsPath = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (svcJson) {
    try {
      const serviceAccount = JSON.parse(svcJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
      db = admin.firestore();
      adminInitialized = true;
      useAdmin = true;
      console.log('✅ Firebase Admin initialized with service account (env JSON)');
    } catch (parseError) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', parseError.message);
    }
  } else if (hasGoogleCredsPath) {
    try {
      const fs = require('fs');
      const path = require('path');
      const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      // Resolve relative paths
      const resolvedPath = path.isAbsolute(credsPath) 
        ? credsPath 
        : path.resolve(__dirname, '..', credsPath);
      
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Service account file not found: ${resolvedPath}`);
      }
      
      const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      // Use the project ID from the service account, not from .env (they might differ)
      const projectId = serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID;
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId,
      });
      db = admin.firestore();
      adminInitialized = true;
      useAdmin = true;
      console.log('✅ Firebase Admin initialized with GOOGLE_APPLICATION_CREDENTIALS');
      console.log(`   Using service account: ${serviceAccount.client_email}`);
      console.log(`   Service Account Project ID: ${serviceAccount.project_id}`);
      console.log(`   .env Project ID: ${process.env.FIREBASE_PROJECT_ID}`);
      console.log(`   Using Project ID: ${projectId}`);
      console.log(`   useAdmin flag: ${useAdmin} (Firebase writes enabled)`);
      
      // Warn if project IDs don't match
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== serviceAccount.project_id) {
        console.warn(`⚠️  Project ID mismatch detected!`);
        console.warn(`   Service account is for: ${serviceAccount.project_id}`);
        console.warn(`   .env has: ${process.env.FIREBASE_PROJECT_ID}`);
        console.warn(`   Using service account project ID: ${projectId}`);
      }
    } catch (credError) {
      console.error('❌ Failed to initialize with GOOGLE_APPLICATION_CREDENTIALS:', credError.message);
      console.error('   Path attempted:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    }
  } else {
    // Try to initialize without explicit credentials (for development/testing)
    // This will only work if running on GCP or with default credentials configured
    try {
      // Check if Firebase Admin is already initialized (avoid duplicate initialization)
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
      }
      db = admin.firestore();
      adminInitialized = true;
      useAdmin = true;
      console.log('✅ Firebase Admin initialized (using default credentials)');
    } catch (defaultError) {
      // Default credentials not available - will fall back to client SDK
      console.warn('⚠️ Firebase Admin SDK not initialized - default credentials not available');
      console.warn('💡 To fix: Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS in .env');
    }
  }
} catch (e) {
  // Admin SDK not available or initialization failed; will fall back to client SDK
  console.warn('⚠️ Firebase Admin SDK not available:', e.message);
}

if (!adminInitialized) {
  // Fall back to Firebase client SDK (will require permissive Firestore rules to write)
  // NOTE: Client SDK writes will fail without authentication - Admin SDK is required for backend
  const { initializeApp } = require('firebase/app');
  const { getFirestore } = require('firebase/firestore');
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  };
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.warn('⚠️ Firebase client SDK initialized (writes will fail without Admin SDK credentials)');
    console.warn('💡 Backend requires Firebase Admin SDK for writes. Client SDK is read-only.');
    console.warn(`   useAdmin flag: ${useAdmin}, adminInitialized: ${adminInitialized}`);
  } catch (error) {
    console.error('❌ Firebase client initialization error:', error.message);
  }
} else {
  // Log final state after initialization
  console.log(`✅ Firebase initialization complete - useAdmin: ${useAdmin}, adminInitialized: ${adminInitialized}`);
}

// Helper abstractions to unify admin vs client operations
let clientApi = null;
if (!useAdmin) {
  clientApi = require('firebase/firestore');
}

const makeDocRef = (collectionName, docId) => {
  return useAdmin ? db.collection(collectionName).doc(docId) : clientApi.doc(db, collectionName, docId);
};

const setDocument = async (ref, data) => {
  if (useAdmin) {
    return await ref.set(data, { merge: true });
  } else {
    return await clientApi.setDoc(ref, data);
  }
};

const updateDocument = async (ref, data) => {
  return useAdmin ? ref.update(data) : clientApi.updateDoc(ref, data);
};

const getDocument = async (ref) => {
  return useAdmin ? ref.get() : clientApi.getDoc(ref);
};

const collectionRef = (collectionName) => {
  return useAdmin ? db.collection(collectionName) : clientApi.collection(db, collectionName);
};

const runQuery = async (colRef, whereClauses = [], orderByField = null, orderDir = 'asc') => {
  if (useAdmin) {
    let q = colRef;
    whereClauses.forEach(([field, op, val]) => { q = q.where(field, op, val); });
    if (orderByField) q = q.orderBy(orderByField, orderDir);
    return q.get();
  } else {
    let q = colRef;
    whereClauses.forEach(([field, op, val]) => { q = clientApi.query(q, clientApi.where(field, op, val)); });
    if (orderByField) q = clientApi.query(q, clientApi.orderBy(orderByField, orderDir));
    return clientApi.getDocs(q);
  }
};

// User Management Functions
// --------------------------

// Create a new user
const createUser = async (userData) => {
  try {
    const userRef = makeDocRef('users', userData.address);
    const timestamps = useAdmin ? { createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() } : { createdAt: new Date(), updatedAt: new Date() };
    await setDocument(userRef, { ...userData, ...timestamps });
    return { success: true, address: userData.address };
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

// Get user by wallet address
const getUserByAddress = async (address) => {
  try {
    const userRef = makeDocRef('users', address);
    const snap = await getDocument(userRef);
    if (useAdmin ? snap.exists : snap.exists()) {
      return useAdmin ? snap.data() : snap.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};

// Update user role
const updateUserRole = async (address, role) => {
  try {
    const userRef = makeDocRef('users', address);
    const updatedAt = useAdmin ? admin.firestore.FieldValue.serverTimestamp() : new Date();
    await updateDocument(userRef, { role, updatedAt });
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
  // Prevent writes if Admin SDK is not initialized (client SDK will fail)
  if (!useAdmin) {
    console.warn('⚠️ Skipping Firebase write - Admin SDK not initialized');
    console.warn(`   useAdmin flag: ${useAdmin}, adminInitialized: ${adminInitialized}`);
    console.warn('💡 Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS in .env to enable writes');
    return { success: false, productId: productData.productId, error: 'Firebase Admin SDK not initialized', skipped: true };
  }
  
  try {
    const productId = String(productData.productId || '').trim();
    if (!productId || productId === '' || productId === 'undefined') {
      throw new Error(`Product ID is required. Received: ${JSON.stringify(productData.productId)}`);
    }

    const productRef = makeDocRef('products', productId);
    const timestamps = useAdmin ? { createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() } : { createdAt: new Date(), updatedAt: new Date() };
    
    // Merge with existing data if it exists (don't overwrite)
    const existingDoc = await getDocument(productRef);
    const existingData = useAdmin ? (existingDoc.exists ? existingDoc.data() : null) : (existingDoc.exists() ? existingDoc.data() : null);
    
    // Merge data: existing data takes precedence for fields that exist, new data fills in missing fields
    const mergedData = existingData ? { ...productData, ...existingData, productId, ...timestamps } : { ...productData, productId, ...timestamps };
    
    await setDocument(productRef, mergedData);

    return { success: true, productId };
  } catch (error) {
    if (isFirebaseOfflineError(error)) {
      console.log('⚠️ Firebase is offline - product will be synced when Firebase comes back online');
      return { success: false, productId: productData.productId, offline: true };
    }
    
    // Check for PERMISSION_DENIED (Client SDK trying to write without auth)
    if (error.code === 'permission-denied' || error.message?.includes('PERMISSION_DENIED')) {
      console.warn('\n⚠️ FIREBASE PERMISSION ERROR:');
      console.warn('   The backend is trying to write to Firestore using the Client SDK, but is blocked by security rules.');
      console.warn('   💡 Configure Firebase Admin SDK to fix this:');
      console.warn('   1. Go to Firebase Console > Project Settings > Service accounts');
      console.warn('   2. Generate a new private key (JSON file)');
      console.warn('   3. Set GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json" in backend/.env');
      console.warn('   OR set FIREBASE_SERVICE_ACCOUNT_JSON with the file content in backend/.env\n');
      return { success: false, productId: productData.productId, error: 'Permission denied - Admin SDK not configured', skipped: true };
    }

    console.error('\n❌❌❌ ERROR STORING PRODUCT METADATA ❌❌❌');
    console.error(`   Error code: ${error.code || 'N/A'}`);
    console.error(`   Error message: ${error.message || 'N/A'}`);
    console.error(`   Error stack: ${error.stack ? error.stack.substring(0, 500) : 'N/A'}`);
    console.error(`   Product ID: ${productData.productId}`);
    console.error(`   Product data keys: ${Object.keys(productData).join(', ')}`);
    console.error(`   useAdmin: ${useAdmin}`);
    console.error(`   adminInitialized: ${adminInitialized}`);
    console.error(`   db type: ${useAdmin ? 'Admin SDK' : 'Client SDK'}`);
    console.error(`   Full product data:`, JSON.stringify(productData, null, 2));
    console.error('❌❌❌ END ERROR ❌❌❌\n');
    return { success: false, productId: productData.productId, error: error.message };
  }
};

// Get product metadata from Firestore
const getProductMetadata = async (productId) => {
  try {
    const productRef = makeDocRef('products', productId);
    const snap = await getDocument(productRef);
    if (useAdmin ? snap.exists : snap.exists()) {
      const data = useAdmin ? snap.data() : snap.data();
      return { id: productId, ...data };
    }
    return null;
  } catch (error) {
    if (isFirebaseOfflineError(error)) {
      return null;
    }
    console.error('Error getting product metadata:', error);
    throw error;
  }
};

// Update product status in Firestore (upsert - creates if doesn't exist)
const updateProductStatus = async (productId, status, location, additionalData = {}) => {
  // Prevent writes if Admin SDK is not initialized (client SDK will fail)
  if (!useAdmin) {
    console.warn('⚠️ Skipping Firebase write - Admin SDK not initialized');
    console.warn('💡 Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS in .env to enable writes');
    return { success: false, productId, error: 'Firebase Admin SDK not initialized', skipped: true };
  }

  try {
    const productRef = makeDocRef('products', productId);
    const snap = await getDocument(productRef);
    const updatedAt = useAdmin ? admin.firestore.FieldValue.serverTimestamp() : new Date();
    const createdAt = useAdmin ? admin.firestore.FieldValue.serverTimestamp() : new Date();
    const updateData = { status, updatedAt, ...(location && { currentLocation: location }), ...additionalData };

    if (useAdmin ? snap.exists : snap.exists()) {
      await updateDocument(productRef, updateData);
      return { success: true, productId, created: false };
    } else {
      await setDocument(productRef, {
        productId,
        status,
        updatedAt,
        createdAt,
        ...(location && { currentLocation: location }),
        ...additionalData,
        _eventListenerCreated: true,
      });
      console.log(`ℹ️ Created product document for ${productId} (will be updated by frontend API)`);
      return { success: true, productId, created: true };
    }
  } catch (error) {
    if (isFirebaseOfflineError(error)) {
      return { success: false, productId, offline: true };
    }

    // Check for PERMISSION_DENIED - return gracefully instead of throwing
    if (error.code === 'permission-denied' || error.message?.includes('PERMISSION_DENIED')) {
      console.warn('\n⚠️ FIREBASE PERMISSION ERROR (Update Status):');
      console.warn('   Missing Admin SDK credentials. Status update not stored.');
      console.warn('   💡 Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS in .env\n');
      return { success: false, productId, error: 'Permission denied - Admin SDK not configured', skipped: true };
    }

    console.error('Error updating product status:', error);
    return { success: false, productId, error: error.message };
  }
};

// Get products by manufacturer address
const getProductsByManufacturer = async (manufacturerAddress) => {
  try {
    const col = collectionRef('products');
    const snapshot = await runQuery(col, [['manufacturer', '==', manufacturerAddress]]);
    const products = [];
    if (useAdmin) {
      snapshot.forEach((doc) => products.push({ id: doc.id, ...doc.data() }));
    } else {
      snapshot.forEach((doc) => products.push({ id: doc.id, ...doc.data() }));
    }
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
  // Prevent writes if Admin SDK is not initialized (client SDK will fail)
  if (!useAdmin) {
    console.warn('⚠️ Skipping Firebase write - Admin SDK not initialized');
    console.warn('💡 Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS in .env to enable writes');
    return { success: false, error: 'Firebase Admin SDK not initialized', skipped: true };
  }

  try {
    const transferId = `${transferData.productId}_${Date.now()}`;
    const transferRef = makeDocRef('transfers', transferId);
    const timestamp = useAdmin ? admin.firestore.FieldValue.serverTimestamp() : new Date();
    await setDocument(transferRef, { ...transferData, timestamp });
    return { success: true, transferId };
  } catch (error) {
    if (isFirebaseOfflineError(error)) {
      return { success: false, transferId: `${transferData.productId}_${Date.now()}`, offline: true };
    }

    // Check for PERMISSION_DENIED - return gracefully instead of throwing
    if (error.code === 'permission-denied' || error.message?.includes('PERMISSION_DENIED')) {
      console.error('\n❌ FIREBASE PERMISSION ERROR (Store Transfer):');
      console.error(`   Error code: ${error.code}`);
      console.error(`   Error message: ${error.message}`);
      console.error(`   useAdmin flag: ${useAdmin}`);
      console.error(`   adminInitialized: ${adminInitialized}`);
      console.error('   This might be due to:');
      console.error('   1. Project ID mismatch between service account and .env');
      console.error('   2. Firestore security rules blocking writes');
      console.error('   3. Service account missing Firestore permissions');
      console.error('   💡 Check Firebase Console > Firestore > Rules\n');
      return { success: false, error: `Permission denied: ${error.message}`, skipped: true };
    }

    console.error('Error storing transfer record:', error);
    return { success: false, error: error.message };
  }
};

// Get transfer history for a product
const getTransferHistory = async (productId) => {
  try {
    const col = collectionRef('transfers');
    const snapshot = await runQuery(col, [['productId', '==', productId]], 'timestamp', 'asc');
    const transfers = [];
    if (useAdmin) {
      snapshot.forEach((doc) => {
        const data = doc.data();
        const ts = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate() : new Date();
        transfers.push({ id: doc.id, ...data, timestamp: ts });
      });
    } else {
      snapshot.forEach((doc) => {
        const data = doc.data();
        const ts = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate() : new Date();
        transfers.push({ id: doc.id, ...data, timestamp: ts });
      });
    }
    return transfers;
  } catch (error) {
    if (isFirebaseOfflineError(error)) {
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
