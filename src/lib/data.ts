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
  {
    id: 'SHP-001',
    item: 'Electronics Components',
    quantity: 500,
    origin: 'Shenzhen, CN',
    destination: 'Los Angeles, USA',
    status: 'In Transit',
    estimatedDelivery: '2024-08-15',
  },
  {
    id: 'SHP-002',
    item: 'Apparel & Textiles',
    quantity: 2000,
    origin: 'Dhaka, BD',
    destination: 'Hamburg, DE',
    status: 'Delivered',
    estimatedDelivery: '2024-07-28',
  },
  {
    id: 'SHP-003',
    item: 'Automotive Parts',
    quantity: 150,
    origin: 'Yokohama, JP',
    destination: 'Detroit, USA',
    status: 'Delayed',
    estimatedDelivery: '2024-08-05',
  },
  {
    id: 'SHP-004',
    item: 'Pharmaceuticals',
    quantity: 800,
    origin: 'Geneva, CH',
    destination: 'New York, USA',
    status: 'Processing',
    estimatedDelivery: '2024-08-20',
  },
    {
    id: 'SHP-005',
    item: 'Coffee Beans',
    quantity: 1200,
    origin: 'Bogotá, CO',
    destination: 'Seattle, USA',
    status: 'In Transit',
    estimatedDelivery: '2024-08-18',
  },
  {
    id: 'SHP-006',
    item: 'Luxury Watches',
    quantity: 50,
    origin: 'Zurich, CH',
    destination: 'Dubai, UAE',
    status: 'Delivered',
    estimatedDelivery: '2024-07-30',
  },
];

export const tasks: Task[] = [
  {
    id: 'TSK-001',
    title: 'Conduct weekly inventory audit for Zone A',
    assignedTo: 'Alice Johnson',
    assignedToAvatar: 'https://picsum.photos/seed/avatar1/40/40',
    status: 'In Progress',
    priority: 'High',
    dueDate: '2024-08-10',
  },
  {
    id: 'TSK-002',
    title: 'Service forklift #3',
    assignedTo: 'Bob Williams',
    assignedToAvatar: 'https://picsum.photos/seed/avatar2/40/40',
    status: 'To Do',
    priority: 'Medium',
    dueDate: '2024-08-12',
  },
  {
    id: 'TSK-003',
    title: 'Finalize Q3 logistics report',
    assignedTo: 'Carol White',
    assignedToAvatar: 'https://picsum.photos/seed/avatar3/40/40',
    status: 'Done',
    priority: 'High',
    dueDate: '2024-08-01',
  },
  {
    id: 'TSK-004',
    title: 'Restock packing materials',
    assignedTo: 'David Green',
    assignedToAvatar: 'https://picsum.photos/seed/avatar4/40/40',
    status: 'Blocked',
    priority: 'Low',
    dueDate: '2024-08-05',
  },
    {
    id: 'TSK-005',
    title: 'Train new warehouse staff on safety protocols',
    assignedTo: 'Alice Johnson',
    assignedToAvatar: 'https://picsum.photos/seed/avatar1/40/40',
    status: 'To Do',
    priority: 'High',
    dueDate: '2024-08-15',
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
