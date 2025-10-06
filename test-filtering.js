const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, orderBy } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDHSuY_5Ej5Ej5Ej5Ej5Ej5Ej5Ej5Ej5E",
  authDomain: "wareops-dev.firebaseapp.com",
  projectId: "wareops-dev",
  storageBucket: "wareops-dev.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdefghijklmnop"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testFiltering() {
  console.log('Testing task filtering...');
  
  // Test with Asif Shaikh's user ID
  const testUserId = 'DF81GrTQSbyeeqyHbQwA';
  console.log(`\nFiltering tasks for user ID: ${testUserId}`);
  
  try {
    const tasksCol = collection(db, 'Tasks');
    let q = query(tasksCol, orderBy('createdAt', 'desc'));
    q = query(q, where('createdBy', '==', testUserId));
    
    const taskSnapshot = await getDocs(q);
    
    console.log(`Found ${taskSnapshot.docs.length} tasks for user ${testUserId}:`);
    
    taskSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`- Task: "${data.title}" - createdBy: ${data.createdBy}, assignedTo: ${data.assignedTo}`);
    });
    
    // Also test with full name filtering
    console.log('\n--- Testing with full name ---');
    const testUserName = 'Asif Shaikh';
    console.log(`Filtering tasks for user name: ${testUserName}`);
    
    let q2 = query(tasksCol, orderBy('createdAt', 'desc'));
    q2 = query(q2, where('createdBy', '==', testUserName));
    
    const taskSnapshot2 = await getDocs(q2);
    
    console.log(`Found ${taskSnapshot2.docs.length} tasks for user name ${testUserName}:`);
    
    taskSnapshot2.docs.forEach(doc => {
      const data = doc.data();
      console.log(`- Task: "${data.title}" - createdBy: ${data.createdBy}, assignedTo: ${data.assignedTo}`);
    });
    
  } catch (error) {
    console.error('Error testing filtering:', error);
  }
}

testFiltering();