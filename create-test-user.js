// Script to create a test user in Firebase for login testing
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDqi_NLPG6qQfPDNv4q2EagXk7kyhsFLbU",
  authDomain: "expotracker-6e353.firebaseapp.com",
  databaseURL: "https://expotracker-6e353-default-rtdb.firebaseio.com",
  projectId: "expotracker-6e353",
  storageBucket: "expotracker-6e353.firebasestorage.app",
  messagingSenderId: "980879059261",
  appId: "1:980879059261:web:b1086110b963ee190dfd54",
  measurementId: "G-LG7KRYCFHQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function createTestUser() {
  try {
    console.log('Creating test user...');
    
    // Test user data
    const testUser = {
      employeeNo: "12345",
      fullName: "Test User",
      email: "testuser@wareops.com",
      department: "IT",
      role: "Admin",
      password: "password123", // In production, this should be hashed
      phone: "+1234567890",
      profilePicture: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // First, create the user in Firebase Auth
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, testUser.email, testUser.password);
      console.log('Firebase Auth user created:', userCredential.user.uid);
    } catch (authError) {
      if (authError.code === 'auth/email-already-in-use') {
        console.log('User already exists in Firebase Auth, signing in...');
        const signInCred = await signInWithEmailAndPassword(auth, testUser.email, testUser.password);
        console.log('Signed in as existing user:', signInCred.user.uid);
      } else {
        throw authError;
      }
    }

    // Then add user data to Firestore
    const docRef = await addDoc(collection(db, 'Users'), testUser);
    console.log('Test user created successfully with ID:', docRef.id);
    console.log('Login credentials:');
    console.log('Employee No:', testUser.employeeNo);
    console.log('Password:', testUser.password);
    
  } catch (error) {
    console.error('Error creating test user:', error);
  }
}

createTestUser();