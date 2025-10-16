require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, deleteDoc, doc } = require('firebase/firestore');

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

console.log('🔧 Firebase Configuration:');
console.log('Project ID:', firebaseConfig.projectId);
console.log('Auth Domain:', firebaseConfig.authDomain);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkTasks() {
  try {
    console.log('\n🔄 Checking Tasks collection...');
    const tasksSnapshot = await getDocs(collection(db, 'Tasks'));
    console.log('✅ Successfully connected to Firestore');
    console.log(`📊 Found ${tasksSnapshot.size} tasks in the Tasks collection\n`);
    
    if (tasksSnapshot.size === 0) {
      console.log('⚠️ No tasks found. Creating a test task...');
      
      // Create a test task
      const testTask = {
        title: 'Test Task for Deletion',
        description: 'This is a test task to reproduce the deletion issue',
        status: 'pending',
        priority: 'medium',
        assignedTo: 'test-user',
        createdAt: new Date(),
        updatedAt: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        category: 'testing'
      };
      
      const docRef = await addDoc(collection(db, 'Tasks'), testTask);
      console.log('✅ Test task created with ID:', docRef.id);
      
      // Check again
      const updatedSnapshot = await getDocs(collection(db, 'Tasks'));
      console.log(`📊 Now found ${updatedSnapshot.size} tasks in the Tasks collection`);
    }
    
    // List all tasks
    const finalSnapshot = await getDocs(collection(db, 'Tasks'));
    finalSnapshot.forEach((doc) => {
      console.log('📋 Task ID:', doc.id);
      console.log('📋 Task Data:', JSON.stringify(doc.data(), null, 2));
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Error checking tasks:', error);
  }
}

checkTasks().then(() => {
  console.log('\n✅ Task check completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});