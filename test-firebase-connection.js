const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');
require('dotenv').config();

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

async function testFirebaseConnection() {
  try {
    console.log('Testing Firebase connection...');
    console.log('Project ID:', firebaseConfig.projectId);
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('✅ Firebase initialized successfully');
    
    // Test Firestore connection by checking for test users
    console.log('\nChecking for test users in Firestore...');
    
    // Check for admin user (Employee No: 12345)
    const adminQuery = query(collection(db, 'Users'), where('employeeNo', '==', '12345'));
    const adminSnapshot = await getDocs(adminQuery);
    
    if (!adminSnapshot.empty) {
      const adminUser = adminSnapshot.docs[0].data();
      console.log('✅ Admin user found:');
      console.log('  - Employee No:', adminUser.employeeNo);
      console.log('  - Full Name:', adminUser.fullName);
      console.log('  - Role:', adminUser.role);
      console.log('  - Email:', adminUser.email);
      console.log('  - Has Password:', !!adminUser.password);
    } else {
      console.log('❌ Admin user (Employee No: 12345) not found');
    }
    
    // Check for regular user (Employee No: 54321)
    const userQuery = query(collection(db, 'Users'), where('employeeNo', '==', '54321'));
    const userSnapshot = await getDocs(userQuery);
    
    if (!userSnapshot.empty) {
      const regularUser = userSnapshot.docs[0].data();
      console.log('\n✅ Regular user found:');
      console.log('  - Employee No:', regularUser.employeeNo);
      console.log('  - Full Name:', regularUser.fullName);
      console.log('  - Role:', regularUser.role);
      console.log('  - Email:', regularUser.email);
      console.log('  - Has Password:', !!regularUser.password);
    } else {
      console.log('\n❌ Regular user (Employee No: 54321) not found');
    }
    
    // Count total users
    const allUsersSnapshot = await getDocs(collection(db, 'Users'));
    console.log('\n📊 Total users in database:', allUsersSnapshot.size);
    
    console.log('\n✅ Firebase connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Firebase connection test failed:');
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
  }
}

testFirebaseConnection();