// Check existing tasks in database to see createdBy values
require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

// Firebase configuration using loaded environment variables
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkTasks() {
  try {
    console.log('Checking existing tasks in database...');
    
    const tasksQuery = query(collection(db, 'Tasks'), limit(10));
    const tasksSnapshot = await getDocs(tasksQuery);
    
    if (tasksSnapshot.empty) {
      console.log('No tasks found in database');
      return;
    }
    
    console.log(`Found ${tasksSnapshot.size} tasks:`);
    
    tasksSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`Task: "${data.title}" - createdBy: ${data.createdBy}, assignedTo: ${data.assignedTo}`);
    });
    
  } catch (error) {
    console.error('Error checking tasks:', error);
  }
}

checkTasks();