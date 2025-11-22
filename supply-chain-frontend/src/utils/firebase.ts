import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration - uses environment variables with fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC4T25iInkP8_mwLiaL5eXxIj2EZsdjEVY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "drug-supply-chain-db.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "drug-supply-chain-db",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "drug-supply-chain-db.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "460845322217",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1:460845322217:web:40c40332dbdb98b9d68578"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Collection names
export const COLLECTIONS = {
  PRODUCTS: 'products',
  TRANSFERS: 'transfers',
  METADATA: 'metadata'
} as const;

// Product metadata interface
export interface ProductMetadata {
  productId: string;
  txHash: string;
  owner: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  manufacturerName: string;
  productName: string;
  productCode: string;
  category: string;
  price: number;
  latitude: number;
  longitude: number;
}

// Transfer record interface
export interface TransferRecord {
  productId: string;
  from: string;
  to: string;
  status: string;
  timestamp: string;
  txHash: string;
  location?: string;
}
