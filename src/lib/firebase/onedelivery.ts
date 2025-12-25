import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, onSnapshot, doc, query, where, orderBy, limit } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { Branch } from '@/types/onedelivery';

const onedeliveryFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_ONEDELIVERY_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_ONEDELIVERY_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_ONEDELIVERY_PROJECT_ID || "oneplace-b5fc3", 
  storageBucket: process.env.NEXT_PUBLIC_ONEDELIVERY_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_ONEDELIVERY_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_ONEDELIVERY_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_ONEDELIVERY_MEASUREMENT_ID
};

// Initialize the secondary Firebase app instance
// Use getApps() to avoid initializing twice in development (hot reload)
let onedeliveryApp;
if (!getApps().some(app => app.name === 'onedelivery')) {
  onedeliveryApp = initializeApp(onedeliveryFirebaseConfig, 'onedelivery');
} else {
  onedeliveryApp = getApp('onedelivery');
}

// Initialize Analytics only on client side
let onedeliveryAnalytics;
if (typeof window !== 'undefined') {
  try {
    onedeliveryAnalytics = getAnalytics(onedeliveryApp);
  } catch (e) {
    console.warn('OneDelivery Analytics init failed (likely due to ad blocker or environment):', e);
  }
}

// Set up the Firestore database reference variable
const onedeliveryDb = getFirestore(onedeliveryApp);

// Export the initialized instances
export { onedeliveryApp, onedeliveryAnalytics, onedeliveryDb };

/**
 * Fetches all branches with their tank data.
 * @returns Array of Branch objects
 */
export async function getBranches(): Promise<Branch[]> {
  try {
    const querySnapshot = await getDocs(collection(onedeliveryDb, 'branches'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
  } catch (error) {
    console.error("Error fetching branches:", error);
    throw error;
  }
}

/**
 * Subscribes to real-time updates for all branches.
 * @param callback 
 * @returns Unsubscribe function
 */
export function subscribeToBranches(callback: (data: Branch[]) => void) {
  return onSnapshot(collection(onedeliveryDb, 'branches'), (querySnapshot) => {
    const branches = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
    callback(branches);
  });
}

/**
 * Subscribes to real-time updates for a specific branch.
 * @param branchId 
 * @param callback 
 * @returns Unsubscribe function
 */
export function subscribeToBranch(branchId: string, callback: (data: Branch) => void) {
  return onSnapshot(doc(onedeliveryDb, 'branches', branchId), (docSnapshot) => {
    if (docSnapshot.exists()) {
      callback({ id: docSnapshot.id, ...docSnapshot.data() } as Branch);
    }
  });
}

/**
 * Connects to the "onedelivery" database and retrieves data (Generic fallback).
 * @param collectionName The name of the collection to fetch data from.
 * @returns The data array or empty array if not found.
 */
export async function getOneDeliveryData(collectionName: string) {
  try {
    const querySnapshot = await getDocs(collection(onedeliveryDb, collectionName));
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return data;
  } catch (error) {
    console.error("Error fetching data from OneDelivery DB:", error);
    throw error;
  }
}

/**
 * Fetches tank update logs for a specific time range.
 * @param days Number of days to look back
 * @returns Array of log entries
 */
export async function getTankLogs(days: number = 7) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Assuming a 'tank_logs' collection exists. 
    // If it's a subcollection, this needs adjustment.
    const q = query(
      collection(onedeliveryDb, 'tank_logs'),
      where('updatedAt', '>=', startDate),
      orderBy('updatedAt', 'desc'),
      limit(100) // Limit to prevent fetching too much data
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching tank logs:", error);
    // Return empty array instead of throwing to avoid breaking the UI if logs collection doesn't exist
    return [];
  }
}
