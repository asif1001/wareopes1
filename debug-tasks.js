// Debug script to check task filtering logic
// This will help us understand why unassigned tasks created by the user aren't showing

console.log('=== TASK FILTERING DEBUG ===');

// Mock data to test the filtering logic
const mockCurrentUserId = 'user123';
const mockCurrentUserFullName = 'John Doe';

const mockTasks = [
  {
    id: '1',
    title: 'Task created by me, assigned to me',
    createdBy: 'user123',
    assignedTo: 'John Doe'
  },
  {
    id: '2', 
    title: 'Task created by me, unassigned',
    createdBy: 'user123',
    assignedTo: 'Unassigned'
  },
  {
    id: '3',
    title: 'Task created by someone else, assigned to me', 
    createdBy: 'user456',
    assignedTo: 'John Doe'
  },
  {
    id: '4',
    title: 'Task created by someone else, unassigned',
    createdBy: 'user456', 
    assignedTo: 'Unassigned'
  }
];

console.log('Current User ID:', mockCurrentUserId);
console.log('Current User Full Name:', mockCurrentUserFullName);
console.log('\nTesting filtering logic:');

mockTasks.forEach(task => {
  const isCreatedByUser = task.createdBy === mockCurrentUserId;
  const isAssignedToUser = mockCurrentUserFullName && task.assignedTo === mockCurrentUserFullName;
  const shouldShow = isCreatedByUser || isAssignedToUser;
  
  console.log(`\nTask: ${task.title}`);
  console.log(`  Created by user: ${isCreatedByUser}`);
  console.log(`  Assigned to user: ${isAssignedToUser}`);
  console.log(`  Should show: ${shouldShow}`);
  console.log(`  createdBy: ${task.createdBy}, assignedTo: ${task.assignedTo}`);
});

console.log('\n=== END DEBUG ===');