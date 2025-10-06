const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

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

async function testTaskCreation() {
  try {
    console.log('Testing task creation...');
    
    // Create a test task
    const testTask = {
      title: "Test Task",
      description: "This is a test task to verify task creation functionality",
      status: "To Do",
      priority: "Medium",
      category: "General",
      assignedTo: "test-user-id",
      assignedToName: "Test User",
      assignedToAvatar: null,
      createdBy: "test-creator-id",
      userName: "Test Creator",
      userAvatar: null,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      estimatedHours: 4,
      tags: ["test", "debugging"],
      attachments: [],
      reminderEnabled: false,
      reminderInterval: 24
    };
    
    // Add timestamps
    const taskData = {
      ...testTask,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log('Creating task with data:', JSON.stringify(testTask, null, 2));
    
    // Add to Firestore
    const docRef = await addDoc(collection(db, 'Tasks'), taskData);
    console.log('✅ Task created successfully with ID:', docRef.id);
    
    return { success: true, taskId: docRef.id };
    
  } catch (error) {
    console.error('❌ Error creating task:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
}

testTaskCreation().then(() => {
  console.log('Test completed.');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});