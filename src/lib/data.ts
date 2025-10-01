import type { Shipment, Task, Feedback, StatCard, RecentShipment } from '@/lib/types';
import { Truck, Package, PackageCheck, AlertTriangle, Users, FileText, CheckCircle, Clock } from 'lucide-react';

export const statCards: StatCard[] = [
  {
    title: 'Shipments in Transit',
    value: '1,204',
    change: '+12.5%',
    changeType: 'increase',
    icon: Truck,
  },
  {
    title: 'Total Inventory',
    value: '45,890 units',
    change: '-2.1%',
    changeType: 'decrease',
    icon: Package,
  },
  {
    title: 'On-Time Deliveries',
    value: '98.2%',
    change: '+0.5%',
    changeType: 'increase',
    icon: PackageCheck,
  },
  {
    title: 'Pending Issues',
    value: '12',
    change: '+3',
    changeType: 'increase',
    icon: AlertTriangle,
  },
];

export const shipments: Shipment[] = [
  // Note: Shipment data structure has been updated to match the actual Shipment type
  // The previous data used properties that don't exist in the Shipment type definition
  // This array is now empty to prevent TypeScript errors
  // TODO: Add proper shipment data that matches the Shipment type structure
];

export const tasks: Task[] = [
  {
    id: 'TSK-001',
    title: 'Conduct weekly inventory audit for Zone A',
    description: 'Comprehensive weekly audit of all inventory items in Zone A to ensure accuracy and compliance.',
    assignedTo: 'Alice Johnson',
    assignedToAvatar: 'https://picsum.photos/seed/avatar1/40/40',
    status: 'In Progress',
    priority: 'High',
    category: 'General',
    dueDate: '2024-08-10',
    estimatedHours: 8,
    actualHours: 4,
    tags: ['inventory', 'audit', 'zone-a'],
    createdAt: '2024-08-01T09:00:00Z',
    updatedAt: '2024-08-02T14:30:00Z',
    createdBy: 'Warehouse Manager',
    comments: [
      {
        id: 'comment-1',
        author: 'Alice Johnson',
        content: 'Started audit process, Zone A-1 completed.',
        createdAt: '2024-08-02T10:00:00Z',
        authorAvatar: 'https://picsum.photos/seed/avatar1/40/40'
      }
    ],
    activityHistory: [
      {
        id: 'activity-1',
        type: 'status_changed',
        description: 'Status changed from "To Do" to "In Progress"',
        timestamp: '2024-08-02T09:00:00Z',
        user: 'Alice Johnson',
        userAvatar: 'https://picsum.photos/seed/avatar1/40/40'
      }
    ]
  },
  {
    id: 'TSK-002',
    title: 'Service forklift #3',
    description: 'Routine maintenance and service check for forklift unit #3 including oil change and safety inspection.',
    assignedTo: 'Bob Williams',
    assignedToAvatar: 'https://picsum.photos/seed/avatar2/40/40',
    status: 'To Do',
    priority: 'Medium',
    category: 'Maintenance',
    dueDate: '2024-08-12',
    estimatedHours: 3,
    tags: ['maintenance', 'forklift', 'safety'],
    createdAt: '2024-08-01T11:00:00Z',
    updatedAt: '2024-08-01T11:00:00Z',
    createdBy: 'Maintenance Supervisor',
    comments: [],
    activityHistory: [
      {
        id: 'activity-2',
        type: 'created',
        description: 'Task created',
        timestamp: '2024-08-01T11:00:00Z',
        user: 'Maintenance Supervisor',
        userAvatar: 'https://picsum.photos/seed/supervisor/40/40'
      }
    ]
  },
  {
    id: 'TSK-003',
    title: 'Finalize Q3 logistics report',
    description: 'Complete and finalize the quarterly logistics performance report including KPIs and recommendations.',
    assignedTo: 'Carol White',
    assignedToAvatar: 'https://picsum.photos/seed/avatar3/40/40',
    status: 'Done',
    priority: 'High',
    category: 'Documentation',
    dueDate: '2024-08-01',
    estimatedHours: 12,
    actualHours: 10,
    tags: ['report', 'logistics', 'quarterly'],
    createdAt: '2024-07-25T08:00:00Z',
    updatedAt: '2024-08-01T16:00:00Z',
    createdBy: 'Operations Director',
    completedAt: '2024-08-01T16:00:00Z',
    comments: [
      {
        id: 'comment-2',
        author: 'Carol White',
        content: 'Report completed and submitted to management.',
        createdAt: '2024-08-01T16:00:00Z',
        authorAvatar: 'https://picsum.photos/seed/avatar3/40/40'
      }
    ],
    activityHistory: [
      {
        id: 'activity-3',
        type: 'status_changed',
        description: 'Status changed from "In Progress" to "Done"',
        timestamp: '2024-08-01T16:00:00Z',
        user: 'Carol White',
        userAvatar: 'https://picsum.photos/seed/avatar3/40/40'
      }
    ]
  },
  {
    id: 'TSK-004',
    title: 'Restock packing materials',
    description: 'Replenish inventory of packing materials including boxes, tape, and protective padding.',
    assignedTo: 'David Green',
    assignedToAvatar: 'https://picsum.photos/seed/avatar4/40/40',
    status: 'Blocked',
    priority: 'Low',
    category: 'Inventory',
    dueDate: '2024-08-05',
    estimatedHours: 2,
    tags: ['inventory', 'packing', 'supplies'],
    createdAt: '2024-07-30T14:00:00Z',
    updatedAt: '2024-08-01T10:00:00Z',
    createdBy: 'Inventory Manager',
    comments: [
      {
        id: 'comment-3',
        author: 'David Green',
        content: 'Waiting for supplier delivery before restocking.',
        createdAt: '2024-08-01T10:00:00Z',
        authorAvatar: 'https://picsum.photos/seed/avatar4/40/40'
      }
    ],
    activityHistory: [
      {
        id: 'activity-4',
        type: 'status_changed',
        description: 'Status changed from "To Do" to "Blocked"',
        timestamp: '2024-08-01T10:00:00Z',
        user: 'David Green',
        userAvatar: 'https://picsum.photos/seed/avatar4/40/40'
      }
    ]
  },
  {
    id: 'TSK-005',
    title: 'Train new warehouse staff on safety protocols',
    description: 'Conduct comprehensive safety training for newly hired warehouse personnel covering all safety protocols.',
    assignedTo: 'Alice Johnson',
    assignedToAvatar: 'https://picsum.photos/seed/avatar1/40/40',
    status: 'To Do',
    priority: 'High',
    category: 'Training',
    dueDate: '2024-08-15',
    estimatedHours: 6,
    tags: ['training', 'safety', 'new-staff'],
    createdAt: '2024-08-01T13:00:00Z',
    updatedAt: '2024-08-01T13:00:00Z',
    createdBy: 'HR Manager',
    comments: [],
    activityHistory: [
      {
        id: 'activity-5',
        type: 'created',
        description: 'Task created',
        timestamp: '2024-08-01T13:00:00Z',
        user: 'HR Manager',
        userAvatar: 'https://picsum.photos/seed/hr/40/40'
      }
    ]
  },
];

export const feedback: Feedback[] = [
  {
    id: 'FDB-001',
    subject: 'Damaged goods received in SHP-001',
    submittedBy: 'Eva Brown',
    submittedByAvatar: 'https://picsum.photos/seed/avatar1/40/40',
    status: 'Open',
    date: '2024-08-02',
    type: 'Complaint',
  },
  {
    id: 'FDB-002',
    subject: 'Suggestion for optimizing picking route',
    submittedBy: 'Frank Black',
    submittedByAvatar: 'https://picsum.photos/seed/avatar2/40/40',
    status: 'In Review',
    date: '2024-07-31',
    type: 'Feedback',
  },
  {
    id: 'FDB-003',
    subject: 'Late delivery of SHP-003',
    submittedBy: 'Grace Hall',
    submittedByAvatar: 'https://picsum.photos/seed/avatar3/40/40',
    status: 'Resolved',
    date: '2024-07-25',
    type: 'Complaint',
  },
  {
    id: 'FDB-004',
    subject: 'Scanner malfunction at Bay 7',
    submittedBy: 'Henry Miller',
    submittedByAvatar: 'https://picsum.photos/seed/avatar4/40/40',
    status: 'Closed',
    date: '2024-07-20',
    type: 'Complaint',
  },
];

export const chartData = [
  { month: 'Jan', shipped: 4000, received: 2400 },
  { month: 'Feb', shipped: 3000, received: 1398 },
  { month: 'Mar', shipped: 2000, received: 9800 },
  { month: 'Apr', shipped: 2780, received: 3908 },
  { month: 'May', shipped: 1890, received: 4800 },
  { month: 'Jun', shipped: 2390, received: 3800 },
  { month: 'Jul', shipped: 3490, received: 4300 },
];

export const recentShipments: RecentShipment[] = [
    { id: 'SHP-001', customer: 'Liam Johnson', email: 'liam@example.com', status: 'In Transit', value: '$2,500.00' },
    { id: 'SHP-002', customer: 'Olivia Smith', email: 'olivia@example.com', status: 'Delivered', value: '$1,500.00' },
    { id: 'SHP-003', customer: 'Noah Williams', email: 'noah@example.com', status: 'Delayed', value: '$3,500.00' },
    { id: 'SHP-004', customer: 'Emma Brown', email: 'emma@example.com', status: 'Processing', value: '$4,500.00' },
    { id: 'SHP-005', customer: 'Ava Jones', email: 'ava@example.com', status: 'Delivered', value: '$550.00' },
];
