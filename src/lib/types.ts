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

export type ContainerBooking = {
    containerNo: string;
    bookingDate: Date;
}

export type Shipment = {
    id: string;
    // Identifiers
    source: string; // from sources collection
    invoice: string;
    billOfLading: string;
    // Containers
    numContainers: number;
    containers: Container[];
    // ETAs & Dates
    bahrainEta: Date;
    originalDocumentReceiptDate?: Date | null;
    actualBahrainEta?: Date | null;
    lastStorageDay?: Date | null;
    whEtaRequestedByParts?: Date | null;
    whEtaConfirmedByLogistics?: Date | null;
    // Clearance
    cleared: boolean;
    actualClearedDate?: Date | null;
    // Counts
    totalCases: number;
    domLines: number;
    bulkLines: number;
    totalLines: number; // computed
    // Remarks
    generalRemark: string;
    remark?: string;
    // Bookings
    bookings?: ContainerBooking[];
    // Optimization
    monthYear?: string; // e.g., "Aug 24"
    // System Fields
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string;
    updatedBy: string;
};

export type SerializableContainerBooking = {
    containerNo: string;
    bookingDate: string;
}

// A version of Shipment where all Date/Timestamp fields are strings (ISO format)
// This is safe to pass from Server to Client Components.
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


export type Task = {
  id: string;
  title: string;
  assignedTo: string;
  assignedToAvatar: string;
  status: 'To Do' | 'In Progress' | 'Done' | 'Blocked';
  priority: 'High' | 'Medium' | 'Low';
  dueDate: string;
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
    profilePicture?: string;
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
