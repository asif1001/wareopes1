import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Task, TaskPriority, TaskStatus, AuditLog, SerializableTask, Attachment } from "@/lib/task-types";
import { makeSerializable } from "@/lib/serialization";
import { Timestamp } from 'firebase-admin/firestore';
import { nanoid } from "nanoid";

const taskStatusEnum: [TaskStatus, ...TaskStatus[]] = ["Backlog", "To Do", "In Progress", "Blocked", "On Hold", "Review", "Done"];
const taskPriorityEnum: [TaskPriority, ...TaskPriority[]] = ["No Priority", "Low", "Medium", "High", "Urgent"];

const taskSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    status: z.enum(taskStatusEnum),
    priority: z.enum(taskPriorityEnum),
    labels: z.array(z.string()).optional(),
    startDate: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    assigneeId: z.string().optional().nullable(),
    reporterId: z.string(),
    watchers: z.array(z.string()).optional(),
    branch: z.string().optional(),
    subtasks: z.array(z.object({ title: z.string(), isComplete: z.boolean() })).optional(),
});

// File upload utility function (placeholder - would need actual storage implementation)
async function uploadFile(file: File, taskId: string): Promise<Attachment> {
    // This is a placeholder implementation
    // In a real app, you would upload to cloud storage (AWS S3, Firebase Storage, etc.)
    // and return the actual file URL

    const fileId = nanoid();
    const fileExtension = file.name.split('.').pop() || '';
    const fileName = `${fileId}.${fileExtension}`;

    // Placeholder URL - in real implementation, this would be the actual uploaded file URL
    const fileUrl = `https://storage.example.com/tasks/${taskId}/${fileName}`;

    return {
        id: fileId,
        fileName: file.name,
        fileUrl,
        fileType: file.type,
        size: file.size,
        uploadedAt: (Timestamp.fromDate(new Date()) as any),
        uploadedBy: "user1", // Would be actual user ID
    };
}

function generateAuditLogs(
    originalTask: SerializableTask,
    updatedData: z.infer<typeof taskSchema>,
    userId: string
): AuditLog[] {
    const logs: AuditLog[] = [];
    const timestamp: any = Timestamp.fromDate(new Date());

    const fieldsToTrack: (keyof SerializableTask & keyof z.infer<typeof taskSchema>)[] = ['status', 'priority', 'assigneeId', 'title', 'description', 'dueDate'];

    fieldsToTrack.forEach(field => {
        if (originalTask[field] !== updatedData[field]) {
            logs.push({
                id: nanoid(),
                timestamp,
                userId,
                action: 'updated',
                field,
                oldValue: originalTask[field],
                newValue: updatedData[field],
            });
        }
    });

    return logs;
}

export async function GET() {
    try {
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        const snap = await adb.collection('tasks').get();
        const tasks = snap.docs.map((d: any) => makeSerializable({ id: d.id, ...(d.data ? d.data() : d) }));
        return NextResponse.json(tasks);
    } catch (error) {
        console.error("Error fetching tasks:", error);
        return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const rawData = Object.fromEntries(formData.entries());

        const parsed = taskSchema.safeParse({
            ...rawData,
            labels: rawData.labels ? JSON.parse(rawData.labels as string) : [],
            watchers: rawData.watchers && rawData.watchers !== "" ? JSON.parse(rawData.watchers as string) : [],
            subtasks: rawData.subtasks && rawData.subtasks !== "" ? JSON.parse(rawData.subtasks as string) : [],
            assigneeId: rawData.assigneeId === "" ? null : rawData.assigneeId,
            startDate: rawData.startDate === "" ? null : rawData.startDate,
            dueDate: rawData.dueDate === "" ? null : rawData.dueDate,
        });

        if (!parsed.success) {
            console.error("Validation failed:", parsed.error.flatten());
            const fieldErrors = parsed.error.flatten().fieldErrors;
            const firstError = Object.values(fieldErrors)[0]?.[0];
            return NextResponse.json({ success: false, error: firstError || "Invalid form data.", fieldErrors }, { status: 400 });
        }

        const { id, ...taskData } = parsed.data;
        const currentUserId = "user1"; // Placeholder for actual auth user

        // Handle file uploads
        const attachments: File[] = [];
        const attachmentFiles: Attachment[] = [];

        // Extract attachment files from form data
        for (const [key, value] of formData.entries()) {
            if (key === 'attachments' && value instanceof File) {
                attachments.push(value);
            }
        }

        // Upload files and create attachment metadata
        if (attachments.length > 0) {
            // For new tasks, we need a temporary ID. For updates, use existing ID
            const tempTaskId = id || nanoid();
            for (const file of attachments) {
                try {
                    const attachment = await uploadFile(file, tempTaskId);
                    attachmentFiles.push(attachment);
                } catch (error) {
                    console.error(`Failed to upload file ${file.name}:`, error);
                    // Continue with other files, or handle error as needed
                }
            }
        }

        // Handle existing attachments to keep
        let existingAttachments: Attachment[] = [];
        if (rawData.existingAttachments && rawData.existingAttachments !== "") {
            try {
                existingAttachments = JSON.parse(rawData.existingAttachments as string);
            } catch (error) {
                console.error("Failed to parse existing attachments:", error);
            }
        }

        // Combine existing and new attachments
        const allAttachments = [...existingAttachments, ...attachmentFiles];

        // Convert date strings to Timestamps for Firestore and handle subtasks
            const firestoreData: any = {
            ...taskData,
            startDate: taskData.startDate ? (Timestamp.fromDate(new Date(taskData.startDate)) as any) : null,
            dueDate: taskData.dueDate ? (Timestamp.fromDate(new Date(taskData.dueDate)) as any) : null,
            subtasks: taskData.subtasks ? taskData.subtasks.map(subtask => ({
                id: nanoid(),
                title: subtask.title,
                isComplete: subtask.isComplete
            })) : [],
            attachments: allAttachments, // Add attachments to firestore data
        };

        // Remove undefined fields to avoid Firestore errors
        Object.keys(firestoreData).forEach(key => {
            if (firestoreData[key] === undefined) {
                delete firestoreData[key];
            }
        });

        if (id && id.trim() !== "" ) {
            // Update - fetch original task for audit via admin
            const { getAdminDb } = await import('@/lib/firebase/admin');
            const adb = await getAdminDb();
            const originalTaskDoc = await adb.collection('tasks').doc(id).get();
            if (!originalTaskDoc.exists) {
                return NextResponse.json({ success: false, error: 'Task not found.' }, { status: 404 });
            }
            const originalTask = makeSerializable({ ...originalTaskDoc.data(), id: originalTaskDoc.id } as any);

            const auditLogs = generateAuditLogs(originalTask, parsed.data, currentUserId);
            const updatePayload: any = {
                ...firestoreData,
                updatedAt: (Timestamp.fromDate(new Date()) as any),
            };
            if (auditLogs.length > 0) {
                const firestoreLogs = auditLogs.map(log => ({ ...log, timestamp: (Timestamp.fromDate(new Date()) as any) }));
                const existingHistory = originalTask.history || [];
                updatePayload.history = [...existingHistory, ...firestoreLogs];
            }
            await adb.collection('tasks').doc(id).update(updatePayload as any);
        } else {
            // Create
            const { getAdminDb } = await import('@/lib/firebase/admin');
            const adb = await getAdminDb();
            const creationLog: AuditLog = {
                id: nanoid(),
                timestamp: (Timestamp.fromDate(new Date()) as any),
                userId: currentUserId,
                action: 'created',
                field: 'task',
                oldValue: null,
                newValue: taskData.title,
            };

            await adb.collection('tasks').add({
                ...firestoreData,
                createdAt: (Timestamp.fromDate(new Date()) as any),
                history: [creationLog],
            } as any);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error saving task:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ success: false, error: `Failed to save task: ${errorMessage}` }, { status: 500 });
    }
}