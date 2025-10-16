import type { Timestamp } from "firebase/firestore";

export type TaskStatus = "Backlog" | "To Do" | "In Progress" | "Blocked" | "On Hold" | "Review" | "Done";
export type TaskPriority = "No Priority" | "Low" | "Medium" | "High" | "Urgent";

export type UserProfile = {
    id: string;
    name: string;
    avatarUrl: string;
};

export type Subtask = {
    id: string;
    title: string;
    isComplete: boolean;
};

export type Attachment = {
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    size: number; // Add file size
    uploadedAt: Timestamp;
    uploadedBy: string; // User ID
};

export type Comment = {
    id: string;
    text: string;
    createdAt: Timestamp;
    createdBy: string; // User ID
    mentions?: string[]; // Array of mentioned User IDs
};

export type AuditLog = {
    id: string;
    timestamp: Timestamp;
    userId: string;
    action: string; // e.g., "Created task", "Changed status from 'To Do' to 'In Progress'"
    field?: string; // e.g., "status"
    oldValue?: any;
    newValue?: any;
};

export type Task = {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    labels: string[];
    
    // Dates
    createdAt: Timestamp;
    updatedAt: Timestamp;
    startDate?: Timestamp | null;
    dueDate?: Timestamp | null;

    // People
    assigneeId?: string | null;
    reporterId: string;
    watchers?: string[]; // Array of User IDs

    // Structure
    subtasks?: Subtask[];
    branch?: string; // or projectId
    
    // Relations
    comments?: Comment[];
    attachments?: Attachment[];
    history?: AuditLog[];
};

// Serializable version for client components (Dates and Timestamps as strings)
export type Serializable<T> = T extends (infer U)[]
  ? Serializable<U>[]
  : T extends Timestamp | Date
  ? string
  : T extends { toDate: () => Date }
  ? string
  : T extends object
  ? { [P in keyof T]: Serializable<T[P]> }
  : T;

export type SerializableTask = Serializable<Task>;
export type SerializableUserProfile = Serializable<UserProfile>;
export type SerializableComment = Serializable<Comment>;
export type SerializableAuditLog = Serializable<AuditLog>;
