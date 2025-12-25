
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const onedeliveryFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_ONEDELIVERY_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_ONEDELIVERY_AUTH_DOMAIN,
  projectId: "oneplace-b5fc3", // Hardcoded based on authDomain
  storageBucket: process.env.NEXT_PUBLIC_ONEDELIVERY_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_ONEDELIVERY_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_ONEDELIVERY_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_ONEDELIVERY_MEASUREMENT_ID
};

console.log('Configuration loaded:', {
  ...onedeliveryFirebaseConfig,
  apiKey: 'HIDDEN'
});

async function verifyConnection() {
  console.log('Initializing OneDelivery Firebase App (Firestore)...');
  
  let app;
  if (!getApps().some(app => app.name === 'onedelivery')) {
    app = initializeApp(onedeliveryFirebaseConfig, 'onedelivery');
  } else {
    app = getApp('onedelivery');
  }
  
  const db = getFirestore(app);
  console.log('Firestore initialized. Attempting to fetch from "users" collection...');
  
  try {
    const colRef = collection(db, 'users');
    const snapshot = await getDocs(colRef);
    
    console.log(`Connection SUCCESSFUL! Fetched ${snapshot.size} documents from "users".`);
    if (snapshot.size > 0) {
      console.log('First doc ID:', snapshot.docs[0].id);
    }
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.log('Connection SUCCESSFUL! (Permission denied, which means we connected but rules rejected read)');
    } else {
      console.error('Connection FAILED:', error);
      process.exit(1);
    }
  }
  
  process.exit(0);
}

verifyConnection();
