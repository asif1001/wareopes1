// Simple script to check users in Firebase using Next.js environment loading
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  
  envLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^"|"$/g, '');
        process.env[key] = value;
      }
    }
  });
}

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

// Firebase configuration using loaded environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

console.log('🔧 Firebase Configuration:');
console.log('Project ID:', firebaseConfig.projectId);
console.log('Auth Domain:', firebaseConfig.authDomain);
console.log('API Key:', firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'Missing');

async function checkUsers() {
  try {
    console.log('\n🔄 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('✅ Firebase initialized successfully');
    
    console.log('\n🔄 Checking Users collection...');
    const usersRef = collection(db, 'Users');
    const snapshot = await getDocs(usersRef);
    
    console.log('✅ Successfully connected to Firestore');
    console.log(`📊 Found ${snapshot.size} users in the Users collection`);
    
    if (snapshot.size > 0) {
      console.log('\n👥 Users in database:');
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`- ID: ${doc.id}`);
        console.log(`  Employee No: ${data.employeeNo}`);
        console.log(`  Name: ${data.fullName}`);
        console.log(`  Role: ${data.role}`);
        console.log(`  Email: ${data.email}`);
        console.log(`  Password: ${data.password ? 'Set' : 'Not set'}`);
        console.log('---');
      });
      
      // Test login with user 16536
      console.log('\n🔍 Looking for user with Employee No: 16536');
      const userQuery = query(usersRef, where('employeeNo', '==', '16536'));
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.size > 0) {
        const userData = userSnapshot.docs[0].data();
        console.log('✅ Found user 16536:');
        console.log(`  Name: ${userData.fullName}`);
        console.log(`  Password: ${userData.password}`);
        console.log('\n✅ You should be able to login with:');
        console.log('  Employee No: 16536');
        console.log(`  Password: ${userData.password}`);
      } else {
        console.log('❌ User with Employee No 16536 not found');
      }
      
    } else {
      console.log('\n⚠️ No users found in the Users collection');
      console.log('This explains why login is failing.');
      console.log('\n💡 Suggestion: Create a user in the Firebase Console or use a script to add users.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    
    if (error.message.includes('Invalid resource field value')) {
      console.log('\n💡 This error suggests there might be an issue with the Firebase project configuration.');
      console.log('Please verify:');
      console.log('1. The project ID is correct');
      console.log('2. Firestore is enabled in your Firebase project');
      console.log('3. The Firebase rules allow read/write access');
    }
  }
}

checkUsers();