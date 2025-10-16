// Script to seed some test tasks in Firestore
require('dotenv').config({ path: '../.env' });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const credsJson = process.env.FIREBASE_ADMIN_CREDENTIALS;
  console.log('FIREBASE_ADMIN_CREDENTIALS exists:', !!credsJson);
  if (credsJson) {
    const serviceAccount = JSON.parse(credsJson);
    console.log('Initializing with service account for project:', serviceAccount.project_id);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'expotracker-6e353'
    });
  } else {
    console.log('Using application default credentials');
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: 'expotracker-6e353'
    });
  }
}

const db = admin.firestore();

async function seedTasks() {
  try {
    console.log('Seeding test tasks...');

    const tasks = [
      {
        title: 'Fix login authentication',
        description: 'Implement proper authentication flow',
        status: 'In Progress',
        priority: 'High',
        labels: ['auth', 'security'],
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        startDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-15')),
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-30')),
        assigneeId: null,
        reporterId: 'user1',
        watchers: [],
        branch: 'main',
        subtasks: [
          { title: 'Set up Firebase Auth', isComplete: true },
          { title: 'Create login form', isComplete: false }
        ]
      },
      {
        title: 'Design dashboard UI',
        description: 'Create modern dashboard interface',
        status: 'To Do',
        priority: 'Medium',
        labels: ['ui', 'design'],
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        startDate: null,
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-02-15')),
        assigneeId: null,
        reporterId: 'user1',
        watchers: [],
        branch: 'main',
        subtasks: []
      },
      {
        title: 'Implement task management',
        description: 'Build task CRUD operations',
        status: 'Done',
        priority: 'High',
        labels: ['backend', 'tasks'],
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        startDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-01')),
        dueDate: admin.firestore.Timestamp.fromDate(new Date('2024-01-20')),
        assigneeId: null,
        reporterId: 'user1',
        watchers: [],
        branch: 'main',
        subtasks: [
          { title: 'Create task schema', isComplete: true },
          { title: 'Implement API routes', isComplete: true },
          { title: 'Add task components', isComplete: true }
        ]
      }
    ];

    for (const task of tasks) {
      await db.collection('tasks').add(task);
      console.log(`Added task: ${task.title}`);
    }

    console.log('Tasks seeded successfully!');
  } catch (error) {
    console.error('Error seeding tasks:', error);
  } finally {
    process.exit();
  }
}

seedTasks();