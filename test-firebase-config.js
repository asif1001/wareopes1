// Test Firebase configuration in browser environment
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// This should match exactly what Next.js loads
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

console.log('🔧 Firebase Configuration Check:');
console.log('API Key:', firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 20)}...` : '❌ MISSING');
console.log('Auth Domain:', firebaseConfig.authDomain || '❌ MISSING');
console.log('Project ID:', firebaseConfig.projectId || '❌ MISSING');
console.log('Storage Bucket:', firebaseConfig.storageBucket || '❌ MISSING');
console.log('Messaging Sender ID:', firebaseConfig.messagingSenderId || '❌ MISSING');
console.log('App ID:', firebaseConfig.appId ? `${firebaseConfig.appId.substring(0, 20)}...` : '❌ MISSING');

async function testFirebaseConnection() {
  try {
    console.log('\n🔄 Testing Firebase connection...');
    
    // Check if all required config values are present
    const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    const missingFields = requiredFields.filter(field => !firebaseConfig[field]);
    
    if (missingFields.length > 0) {
      console.error('❌ Missing required Firebase configuration fields:', missingFields);
      console.log('\n💡 This explains the "projects/undefined" error.');
      console.log('The environment variables are not being loaded properly.');
      return;
    }
    
    console.log('✅ All Firebase configuration fields are present');
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('✅ Firebase app initialized successfully');
    
    // Test Firestore connection
    const usersRef = collection(db, 'Users');
    const snapshot = await getDocs(usersRef);
    
    console.log('✅ Successfully connected to Firestore');
    console.log(`📊 Found ${snapshot.size} users in the Users collection`);
    
    if (snapshot.size === 0) {
      console.log('\n⚠️ No users found in the Users collection.');
      console.log('This is why login is failing - there are no users to authenticate against.');
      console.log('\n💡 Next steps:');
      console.log('1. Create users in Firebase Console, or');
      console.log('2. Use a script to populate the Users collection');
    } else {
      console.log('\n👥 Users found! Login should work if credentials match.');
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`- Employee No: ${data.employeeNo}, Name: ${data.fullName}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Firebase connection failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
}

testFirebaseConnection();