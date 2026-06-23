import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
  console.warn(
    'Firebase is not configured. Set VITE_FIREBASE_* variables in supply-chain-frontend/.env'
  );
}

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

export const COLLECTIONS = {
  PRODUCTS: 'products',
  TRANSFERS: 'transfers',
  METADATA: 'metadata'
} as const;

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

export interface TransferRecord {
  productId: string;
  from: string;
  to: string;
  status: string;
  timestamp: string;
  txHash: string;
  location?: string;
}
