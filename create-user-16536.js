const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, query, where, getDocs } = require('firebase/firestore');
require('dotenv').config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createUser() {
  try {
    console.log('Creating user with Employee No: 16536');
    
    // Check if user already exists in Firestore
    const usersRef = collection(db, 'Users');
    const q = query(usersRef, where('employeeNo', '==', '16536'));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      console.log('User with Employee No 16536 already exists in Firestore');
      return;
    }
    
    // Create user in Firestore Users collection
    const userData = {
      employeeNo: '16536',
      fullName: 'Test User 16536',
      password: '1234567', // Note: In production, this should be hashed
      email: 'testuser16536@example.com',
      department: 'IT',
      role: 'Employee',
      phone: '+973-1234-5678',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const docRef = await addDoc(usersRef, userData);
    console.log('✅ User created successfully in Firestore with ID:', docRef.id);
    
    console.log('✅ User created in Firestore (skipping Firebase Auth due to API key issues)');
    
    console.log('\n🎉 Test user created successfully!');
    console.log('Login credentials:');
    console.log('Employee No: 16536');
    console.log('Password: 1234567');
    
  } catch (error) {
    console.error('❌ Error creating user:', error);
  }
}

createUser();