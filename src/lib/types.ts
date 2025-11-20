import type { Timestamp } from "firebase/firestore";

export type OldShipment = {
  id: string;
  item: string;
  quantity: number;
  origin: string;
  destination: string;
  status: 'In Transit' | 'Delivered' | 'Delayed' | 'Processing';
  estimatedDelivery: string;
};

export type Container = {
  id: string; // e.g., '1'
  size: string; // e.g., '40FT'
  quantity: number; // e.g., 2
};

export type ShipmentStatus = 'Not Arrived' | 'Arrived' | 'WIP' | 'Completed';

export type ContainerBooking = {
    containerNo: string;
    bookingDate: Date;
}

export type Shipment = {
    id: string;
    source: string; // from sources collection
    invoice: string;
    billOfLading: string;
    status: ShipmentStatus;
    branch?: string;
    numContainers: number;
    containers: Container[];
    bahrainEta: Date;
    originalDocumentReceiptDate?: Date | null;
    actualBahrainEta?: Date | null;
    lastStorageDay?: Date | null;
    whEtaRequestedByParts?: Date | null;
    whEtaConfirmedByLogistics?: Date | null;
    cleared: boolean;
    actualClearedDate?: Date | null;
    totalCases: number;
    domLines: number;
    bulkLines: number;
    totalLines: number; // computed
    generalRemark: string;
    remark?: string;
    bookings?: ContainerBooking[];
    monthYear?: string; // e.g., "Aug 24"
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string;
    updatedBy: string;
    // Whether production cases have been uploaded (lock flag)
    productionUploaded?: boolean;
};

export type SerializableContainerBooking = {
    containerNo: string;
    bookingDate: string;
}

export type SerializableShipment = Omit<Shipment, 'bahrainEta' | 'originalDocumentReceiptDate' | 'actualBahrainEta' | 'lastStorageDay' | 'whEtaRequestedByParts' | 'whEtaConfirmedByLogistics' | 'actualClearedDate' | 'createdAt' | 'updatedAt' | 'bookings'> & {
    bahrainEta: string;
    originalDocumentReceiptDate: string | null;
    actualBahrainEta: string | null;
    lastStorageDay: string | null;
    whEtaRequestedByParts: string | null;
    whEtaConfirmedByLogistics: string | null;
    actualClearedDate: string | null;
    bookings?: SerializableContainerBooking[];
    createdAt: string;
    updatedAt: string;
};


export type TaskStatus = 'Not Started' | 'To Do' | 'In Progress' | 'Completed' | 'Done' | 'Blocked' | 'On Hold';
export type TaskPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type TaskCategory = 'General' | 'Inventory' | 'Shipping' | 'Quality Control' | 'Maintenance' | 'Documentation' | 'Training';

export type TaskAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
};

export type TaskComment = {
  id: string;
  content: string;
  author: string;
  authorAvatar: string;
  createdAt: string;
  updatedAt?: string;
};

export type TaskActivity = {
  id: string;
  type: 'created' | 'updated' | 'status_changed' | 'assigned' | 'comment_added' | 'attachment_added';
  description: string;
  user: string;
  userAvatar: string;
  timestamp: string;
  oldValue?: string;
  newValue?: string;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  assignedTo: string;
  assignedToAvatar: string;
  assignedBy?: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  estimatedHours?: number;
  actualHours?: number;
  tags?: string[];
  attachments?: TaskAttachment[];
  comments?: TaskComment[];
  activityHistory?: TaskActivity[];
  reminderEnabled?: boolean;
  reminderInterval?: number; // in hours
  completedAt?: string;
  isCreatedByCurrentUser?: boolean;
  isAssignedToCurrentUser?: boolean;
};

export type Feedback = {
  id: string;
  subject: string;
  submittedBy: string;
  submittedByAvatar: string;
  status: 'Open' | 'In Review' | 'Resolved' | 'Closed';
  date: string;
  type: 'Feedback' | 'Complaint';
};

export type StatCard = {
  title: string;
  value: string;
  change: string;
  changeType: 'increase' | 'decrease';
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

export type RecentShipment = {
  id: string;
  customer: string;
  email: string;
  status: 'In Transit' | 'Delivered' | 'Delayed' | 'Processing';
  value: string;
};

export const userRoles = [
    "Admin", "Manager", "Supervisor", "Team Leader", 
    "Contract Staff", "Warehouse Associate", "Driver"
] as const;

export type UserRole = typeof userRoles[number];

// Role entity for database-backed role management
export type Role = {
  id: string;
  name: string; // e.g., 'Admin'
  permissions?: string[]; // optional permissions assigned to this role
};

// Granular permissions
export type PermissionAction = 'view' | 'add' | 'edit' | 'delete';
export type AppPageKey = 'shipments' | 'tasks' | 'settings' | 'production' | 'productivity' | 'maintenance' | 'licenses'; // extendable
export type UserPermissions = Partial<Record<AppPageKey, PermissionAction[]>>;

export type User = {
    id: string;
    fullName: string;
    name?: string; // Alternative name field for compatibility
    employeeNo: string;
    password?: string; // Should be handled securely, not stored plaintext
    email?: string;
    phone?: string;
    department: string;
    role: UserRole;
    branch?: string; // Optional branch for scoping data
    redirectPage?: string; // Optional custom redirect page after login (e.g., "/dashboard/tasks", "/dashboard/shipments")
    profilePicture?: string;
    createdAt?: string; // ISO string for serialization
    updatedAt?: string; // ISO string for serialization
    permissions?: UserPermissions; // optional granular permissions
};

export type Source = {
    id: string;
    shortName: string;
    name: string;
};

export type ContainerSize = {
    id: string;
    size: string;
    cmb: string;
};

export type Department = {
    id: string;
    name: string;
    branch: string;
};

export type Branch = {
    id: string;
    name: string;
    code: string;
};

export type ClearedContainerSummary = {
    totalContainers: number;
    monthlyData: { month: string; containers: number }[];
    sourceData: { [key: string]: number };
}

export type FormFieldType = 'text' | 'number' | 'textarea' | 'dropdown' | 'checkbox' | 'date';

export type FormField = {
  id: string; // stable id for answers mapping
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[]; // for dropdown
  min?: number; // for number
  max?: number; // for number
  pattern?: string; // regex string for text
};

export type FormTemplate = {
  id: string;
  slug: string; // e.g., "forklift_operator"
  displayName: string; // human-readable
  allowedRoles: string[]; // which roles can access
  autoRedirectForRoles?: string[]; // roles auto-redirected to this form
  fields: FormField[];
  createdBy: string; // admin user id
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string; // last admin user id who updated
};

export type FormSubmission = {
  id: string;
  templateId: string;
  templateSlug: string;
  userId: string;
  userRole: string;
  submittedAt: string;
  answers: Record<string, unknown>; // key = field.id, value depends on type
  userFullName?: string;
  userEmployeeNo?: string;
  templateDisplayName?: string;
};
