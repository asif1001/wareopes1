"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Task, TaskPriority, TaskStatus, AuditLog, SerializableTask } from "@/lib/task-types";
import { makeSerializable } from "@/lib/serialization";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
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

const commentSchema = z.object({
    taskId: z.string(),
    comment: z.string().min(1, "Comment cannot be empty"),
});

const attachmentSchema = z.object({
    taskId: z.string(),
    file: z.instanceof(File),
});

function generateAuditLogs(
    originalTask: SerializableTask,
    updatedData: z.infer<typeof taskSchema>,
    userId: string
): AuditLog[] {
    const logs: AuditLog[] = [];
    const timestamp = new Date();

    const fieldsToTrack: (keyof SerializableTask & keyof z.infer<typeof taskSchema>)[] = ['status', 'priority', 'assigneeId', 'title', 'description', 'dueDate'];

    fieldsToTrack.forEach(field => {
        const oldValue = originalTask[field];
        const newValue = updatedData[field];

        // Special handling for dates
        if (field === 'dueDate' && (oldValue || newValue)) {
            const oldDate = oldValue ? new Date(oldValue as string).toISOString().split('T')[0] : null;
            const newDate = newValue ? new Date(newValue as string).toISOString().split('T')[0] : null;
            if (oldDate !== newDate) {
                 logs.push({
                    id: nanoid(),
                    timestamp: timestamp as any,
                    userId,
                    action: `Changed due date from '${oldDate || 'none'}' to '${newDate || 'none'}'`,
                    field,
                    oldValue: oldDate,
                    newValue: newDate,
                });
            }
            return;
        }

        if (String(oldValue || '') !== String(newValue || '')) {
            logs.push({
                id: nanoid(),
                timestamp: timestamp as any,
                userId,
                action: `Changed ${field.toString()} from '${oldValue || 'none'}' to '${newValue || 'none'}'`,
                field,
                oldValue,
                newValue,
            });
        }
    });

    return logs;
}

export async function saveTaskAction(
    prevState: { success: boolean, error: string | null, fieldErrors?: { [key: string]: string[] } },
    formData: FormData
): Promise<{ success: boolean, error: string | null, fieldErrors?: { [key: string]: string[] } }> {
    try {
        const rawData = Object.fromEntries(formData.entries());
        
        const parsed = taskSchema.safeParse({
            ...rawData,
            labels: rawData.labels ? JSON.parse(rawData.labels as string) : [],
            watchers: rawData.watchers ? JSON.parse(rawData.watchers as string) : undefined,
            subtasks: rawData.subtasks ? JSON.parse(rawData.subtasks as string) : [],
            assigneeId: rawData.assigneeId === "" ? null : rawData.assigneeId,
            startDate: rawData.startDate === "" ? null : rawData.startDate,
            dueDate: rawData.dueDate === "" ? null : rawData.dueDate,
        });

        if (!parsed.success) {
            console.error("Validation failed:", parsed.error.flatten());
            const fieldErrors = parsed.error.flatten().fieldErrors;
            const firstError = Object.values(fieldErrors)[0]?.[0];
            return { success: false, error: firstError || "Invalid form data.", fieldErrors };
        }

        const { id, ...taskData } = parsed.data;
        const currentUserId = "user1"; // Placeholder for actual auth user

        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();

        // Convert date strings to JS Dates for admin writes and handle subtasks
        const firestoreData = {
            ...taskData,
            startDate: taskData.startDate ? new Date(taskData.startDate) : null,
            dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
            subtasks: taskData.subtasks ? taskData.subtasks.map(subtask => ({
                id: nanoid(),
                title: subtask.title,
                isComplete: subtask.isComplete
            })) : [],
        };

        if (id && id.trim() !== "" ) {
            // Update - fetch original task for audit via admin
            const originalTaskDoc = await adb.collection('tasks').doc(id).get();
            if (!originalTaskDoc.exists) {
                return { success: false, error: "Task not found." };
            }
            const originalTask = makeSerializable({ ...originalTaskDoc.data(), id: originalTaskDoc.id } as any);

            const auditLogs = generateAuditLogs(originalTask, parsed.data, currentUserId);
            const updatePayload: any = {
                ...firestoreData,
                updatedAt: new Date(),
            };
            if (auditLogs.length > 0) {
                const firestoreLogs = auditLogs.map(log => ({...log, timestamp: new Date()}));
                const existingHistory = originalTask.history || [];
                updatePayload.history = [...existingHistory, ...firestoreLogs];
            }
            await adb.collection('tasks').doc(id).update(updatePayload as any);
        } else {
            // Create
            const creationLog: AuditLog = {
                id: nanoid(),
                timestamp: new Date() as any,
                userId: currentUserId,
                action: "Created the task",
            };
            await adb.collection('tasks').add({
                ...firestoreData,
                createdAt: new Date(),
                updatedAt: new Date(),
                history: [creationLog],
            } as any);
        }
        revalidatePath("/dashboard/tasks");
        return { success: true, error: null };
    } catch (error: any) {
        console.error("Error saving task:", error);
        return { success: false, error: error.message || "An unexpected error occurred." };
    }
}

export async function saveTask(formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());

    const parsed = taskSchema.safeParse({
        ...rawData,
        labels: rawData.labels ? JSON.parse(rawData.labels as string) : [],
        watchers: rawData.watchers ? JSON.parse(rawData.watchers as string) : undefined,
        subtasks: rawData.subtasks ? JSON.parse(rawData.subtasks as string) : [],
        assigneeId: rawData.assigneeId === "" ? null : rawData.assigneeId,
        startDate: rawData.startDate === "" ? null : rawData.startDate,
        dueDate: rawData.dueDate === "" ? null : rawData.dueDate,
    });

    if (!parsed.success) {
        return {
            success: false,
            errors: parsed.error.flatten().fieldErrors,
        };
    }

    try {
        const { id, ...taskData } = parsed.data;
        const currentUserId = "user1"; // Placeholder for actual auth user

        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();

        const firestoreData = {
            ...taskData,
            startDate: taskData.startDate ? new Date(taskData.startDate) : null,
            dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
            subtasks: taskData.subtasks ? taskData.subtasks.map(subtask => ({
                id: nanoid(),
                title: subtask.title,
                isComplete: subtask.isComplete
            })) : [],
        };

        if (id && id.trim() !== "") {
            const originalTaskDoc = await adb.collection('tasks').doc(id).get();
            if (!originalTaskDoc.exists) {
                return { success: false, errors: { _form: ["Task not found."] } };
            }
            const originalTask = makeSerializable({ ...originalTaskDoc.data(), id: originalTaskDoc.id } as any);
            const auditLogs = generateAuditLogs(originalTask, parsed.data, currentUserId);
            const updatePayload: any = {
                ...firestoreData,
                updatedAt: new Date(),
            };
            if (auditLogs.length > 0) {
                const firestoreLogs = auditLogs.map(log => ({ ...log, timestamp: new Date() }));
                const existingHistory = originalTask.history || [];
                updatePayload.history = [...existingHistory, ...firestoreLogs];
            }
            await adb.collection('tasks').doc(id).update(updatePayload as any);
        } else {
            const creationLog: AuditLog = {
                id: nanoid(),
                timestamp: new Date() as any,
                userId: currentUserId,
                action: "Created the task",
            };
            await adb.collection('tasks').add({
                ...firestoreData,
                createdAt: new Date(),
                updatedAt: new Date(),
                history: [creationLog],
            } as any);
        }

        revalidatePath("/dashboard/tasks");
        return { success: true };
    } catch (error) {
        console.error("Error saving task:", error);
        return { success: false, errors: { _form: ["An unexpected error occurred."] } };
    }
}

export async function deleteTask(taskId: string) {
    try {
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        await adb.collection('tasks').doc(taskId).delete();
        revalidatePath("/dashboard/tasks");
        return { success: true };
    } catch (error) {
        console.error("Error deleting task:", error);
        return {
            success: false,
            errors: { _form: ["Failed to delete task."] },
        };
    }
}

export async function addComment(formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());
    const parsed = commentSchema.safeParse(rawData);

    if (!parsed.success) {
        return {
            success: false,
            errors: parsed.error.flatten().fieldErrors,
        };
    }

    try {
        const { taskId, comment } = parsed.data;
        const currentUserId = "user1"; // Placeholder

        const newComment = {
            id: nanoid(),
            text: comment,
            createdAt: new Date(),
            createdBy: currentUserId,
        };

        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        const taskRef = adb.collection('tasks').doc(taskId);
        const docSnap = await taskRef.get();
        const existing = docSnap.exists ? (docSnap.data() as any).comments || [] : [];
        await taskRef.update({ comments: [...existing, newComment] });

        revalidatePath("/dashboard/tasks");
        return { success: true };
    } catch (error) {
        console.error("Error adding comment:", error);
        return {
            success: false,
            errors: { _form: ["Failed to add comment."] },
        };
    }
}

export async function addAttachment(formData: FormData) {
    const rawData = {
        taskId: formData.get('taskId'),
        file: formData.get('file'),
    };

    const parsed = attachmentSchema.safeParse(rawData);

    if (!parsed.success) {
        return {
            success: false,
            errors: parsed.error.flatten().fieldErrors,
        };
    }

    try {
        const { taskId, file } = parsed.data;
        const currentUserId = "user1"; // Placeholder for actual auth user

        const storage = getStorage();
        const storageRef = ref(storage, `tasks/${taskId}/${nanoid()}-${file.name}`);
        
        const uploadTask = await uploadBytesResumable(storageRef, file);
        const downloadURL = await getDownloadURL(uploadTask.ref);

        const newAttachment = {
            id: nanoid(),
            fileName: file.name,
            fileUrl: downloadURL,
            fileType: file.type,
            size: file.size,
            uploadedAt: new Date(),
            uploadedBy: currentUserId,
        };

        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        const taskRef = adb.collection('tasks').doc(taskId);
        const docSnap = await taskRef.get();
        const existing = docSnap.exists ? (docSnap.data() as any).attachments || [] : [];
        await taskRef.update({ attachments: [...existing, newAttachment] });

        revalidatePath("/dashboard/tasks");
        return { success: true, attachment: newAttachment };

    } catch (error) {
        console.error("Error adding attachment:", error);
        return {
            success: false,
            errors: { _form: ["Failed to add attachment."] },
        };
    }
}
