const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
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

console.log('Firebase Config:');
console.log('Project ID:', firebaseConfig.projectId);
console.log('Auth Domain:', firebaseConfig.authDomain);
console.log('API Key:', firebaseConfig.apiKey ? 'Present' : 'Missing');

async function testFirebaseConnection() {
  try {
    console.log('\n🔄 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('✅ Firebase initialized successfully');
    
    console.log('\n🔄 Testing Firestore connection...');
    const usersRef = collection(db, 'Users');
    const snapshot = await getDocs(usersRef);
    
    console.log('✅ Firestore connection successful');
    console.log(`📊 Found ${snapshot.size} users in the database`);
    
    if (snapshot.size > 0) {
      console.log('\n👥 Users in database:');
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`- Employee No: ${data.employeeNo}, Name: ${data.fullName}, Role: ${data.role}`);
      });
    } else {
      console.log('\n⚠️ No users found in the database');
      console.log('This might be why login is failing.');
    }
    
  } catch (error) {
    console.error('❌ Firebase connection failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
}

testFirebaseConnection();