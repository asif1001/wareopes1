const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');
require('dotenv').config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkCurrentUser() {
  try {
    console.log('Checking users in database...');
    
    // Get all users to see the structure
    const usersRef = collection(db, 'Users');
    const snapshot = await getDocs(usersRef);
    
    console.log(`Found ${snapshot.size} users:`);
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`User ID: ${doc.id}`);
      console.log(`  Full Name: ${data.fullName}`);
      console.log(`  Employee No: ${data.employeeNo}`);
      console.log(`  Email: ${data.email}`);
      console.log('---');
    });
    
    // Look specifically for Asif Shaikh
    console.log('\nLooking for Asif Shaikh...');
    const asifQuery = query(usersRef, where('fullName', '==', 'Asif Shaikh'));
    const asifSnapshot = await getDocs(asifQuery);
    
    if (asifSnapshot.size > 0) {
      asifSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`Found Asif Shaikh:`);
        console.log(`  User ID: ${doc.id}`);
        console.log(`  Full Name: ${data.fullName}`);
        console.log(`  Employee No: ${data.employeeNo}`);
      });
    } else {
      console.log('Asif Shaikh not found in Users collection');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkCurrentUser();