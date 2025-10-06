// Test task creation to debug createdBy issue
const { createTaskAction } = require('./src/app/actions.ts');

async function testTaskCreation() {
  console.log('Testing task creation...');
  
  const testTask = {
    title: 'Debug Test Task',
    description: 'Testing createdBy field',
    assignedTo: 'Unassigned',
    priority: 'Medium',
    status: 'To Do',
    dueDate: new Date().toISOString(),
    createdBy: 'test-user-123', // Explicitly setting this
    comments: [],
    activityHistory: []
  };
  
  console.log('Task data before creation:', testTask);
  
  try {
    const result = await createTaskAction(testTask, 'test-user-123');
    console.log('Creation result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testTaskCreation();