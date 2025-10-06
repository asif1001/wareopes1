require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

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

async function testTaskDeletion() {
  try {
    console.log('🔄 Testing task deletion workflow...');
    
    // First, get all tasks
    console.log('\n📋 Getting current tasks...');
    const tasksSnapshot = await getDocs(collection(db, 'Tasks'));
    console.log(`Found ${tasksSnapshot.size} tasks`);
    
    if (tasksSnapshot.size === 0) {
      console.log('❌ No tasks found to delete');
      return;
    }
    
    // Get the first task to delete
    const firstTask = tasksSnapshot.docs[0];
    const taskId = firstTask.id;
    const taskData = firstTask.data();
    
    console.log('\n🎯 Task to delete:');
    console.log('ID:', taskId);
    console.log('Title:', taskData.title);
    console.log('Status:', taskData.status);
    
    // Delete the task
    console.log('\n🗑️ Deleting task...');
    await deleteDoc(doc(db, 'Tasks', taskId));
    console.log('✅ Task deletion completed');
    
    // Wait a moment
    console.log('\n⏳ Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if task is actually deleted
    console.log('\n🔍 Verifying deletion...');
    const updatedSnapshot = await getDocs(collection(db, 'Tasks'));
    console.log(`Now found ${updatedSnapshot.size} tasks`);
    
    // Check if the specific task still exists
    const deletedTaskExists = updatedSnapshot.docs.some(doc => doc.id === taskId);
    
    if (deletedTaskExists) {
      console.log('❌ PROBLEM: Task still exists in database after deletion!');
      console.log('This explains why deleted tasks reappear in the UI.');
    } else {
      console.log('✅ SUCCESS: Task was permanently deleted from database');
    }
    
    // List remaining tasks
    console.log('\n📋 Remaining tasks:');
    updatedSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`- ${doc.id}: ${data.title} (${data.status})`);
    });
    
  } catch (error) {
    console.error('❌ Error during deletion test:', error);
    
    // Check if it's a permission error
    if (error.code === 'permission-denied') {
      console.log('\n🔒 Permission denied - checking Firestore rules...');
      console.log('Make sure your Firestore rules allow delete operations.');
    }
  }
}

testTaskDeletion().then(() => {
  console.log('\n✅ Deletion test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});