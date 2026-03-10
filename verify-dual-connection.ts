
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import * as dotenv from 'dotenv';

dotenv.config();

// Mock process.env for the test script
const env = {
  // Primary: expotracker-6e353
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,

  // Secondary: oneplace-b5fc3
  NEXT_PUBLIC_ONEDELIVERY_API_KEY: process.env.NEXT_PUBLIC_ONEDELIVERY_API_KEY,
  NEXT_PUBLIC_ONEDELIVERY_AUTH_DOMAIN: process.env.NEXT_PUBLIC_ONEDELIVERY_AUTH_DOMAIN,
  NEXT_PUBLIC_ONEDELIVERY_PROJECT_ID: "oneplace-b5fc3",
  NEXT_PUBLIC_ONEDELIVERY_STORAGE_BUCKET: process.env.NEXT_PUBLIC_ONEDELIVERY_STORAGE_BUCKET,
  NEXT_PUBLIC_ONEDELIVERY_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_ONEDELIVERY_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_ONEDELIVERY_APP_ID: process.env.NEXT_PUBLIC_ONEDELIVERY_APP_ID,
};

async function verifyDualConnection() {
  console.log('--- STARTING DUAL DB VERIFICATION ---');

  // 1. Initialize Primary App
  console.log('\n[1] Connecting to PRIMARY DB (expotracker-6e353)...');
  const primaryConfig = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  let primaryApp;
  try {
    primaryApp = initializeApp(primaryConfig, 'primary-test');
    const primaryDb = getFirestore(primaryApp);
    
    // Attempt fetch from 'users' (known collection)
    const usersCol = collection(primaryDb, 'users');
    const usersSnapshot = await getDocs(usersCol);
    console.log(`✅ SUCCESS: Connected to Primary DB. Fetched ${usersSnapshot.size} documents from 'users'.`);
  } catch (err: any) {
    console.error(`❌ FAILURE: Primary DB connection failed: ${err.message}`);
  }

  // 2. Initialize Secondary App
  console.log('\n[2] Connecting to SECONDARY DB (oneplace-b5fc3)...');
  const secondaryConfig = {
    apiKey: env.NEXT_PUBLIC_ONEDELIVERY_API_KEY,
    authDomain: env.NEXT_PUBLIC_ONEDELIVERY_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_ONEDELIVERY_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_ONEDELIVERY_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_ONEDELIVERY_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_ONEDELIVERY_APP_ID,
  };

  let secondaryApp;
  let secondaryDb;
  try {
    secondaryApp = initializeApp(secondaryConfig, 'secondary-test');
    secondaryDb = getFirestore(secondaryApp);
    
    // Attempt fetch from 'users' (known collection)
    const usersCol = collection(secondaryDb, 'users');
    const usersSnapshot = await getDocs(usersCol);
    console.log(`✅ SUCCESS: Connected to Secondary DB. Fetched ${usersSnapshot.size} documents from 'users'.`);
  } catch (err: any) {
    console.error(`❌ FAILURE: Secondary DB connection failed: ${err.message}`);
  }

  // 3. Verify Isolation (Write Test)
  console.log('\n[3] Verifying Isolation (Attempting Write to Secondary DB)...');
  if (secondaryDb) {
    try {
        // Attempt to write to a 'test_write' collection - EXPECT FAILURE if rules are set to read-only for unauthenticated users (or specific roles)
        // Note: Since we are using client SDK without signing in a specific user in this script, we are "unauthenticated".
        // If the rules allow public read but no write, this should fail.
        await setDoc(doc(secondaryDb, 'test_write', 'test_doc'), { test: true });
        console.warn(`⚠️ WARNING: Write to Secondary DB SUCCEEDED. (This might be intended if rules are open, but check if read-only was required).`);
    } catch (err: any) {
        if (err.code === 'permission-denied') {
            console.log(`✅ SUCCESS: Write to Secondary DB was BLOCKED (Permission Denied), as expected for read-only access.`);
        } else {
            console.log(`ℹ️ INFO: Write attempt result: ${err.message}`);
        }
    }
  }

  console.log('\n--- VERIFICATION COMPLETE ---');
  process.exit(0);
}

verifyDualConnection();
