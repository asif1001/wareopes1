import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Task, TaskPriority, TaskStatus, AuditLog, SerializableTask, Attachment } from "@/lib/task-types";
import { makeSerializable } from "@/lib/serialization";
import { Timestamp } from 'firebase-admin/firestore';
import { nanoid } from "nanoid";
import { getStorage } from 'firebase-admin/storage';

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

// File upload utility function: uploads to Firebase Storage (Admin SDK) and returns a public download URL
async function uploadFile(file: File, taskId: string): Promise<Attachment> {
    // Ensure Firebase Admin app is initialized
    const { getAdminDb } = await import('@/lib/firebase/admin');
    await getAdminDb();

    const storage = getStorage();

    // Resolve bucket for Admin SDK operations (Google Cloud Storage).
    // Prefer env-provided bucket and check both domains: appspot.com and firebasestorage.app.
    const envBucket = (process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').replace(/^gs:\/\//, '');
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
    const candidates: string[] = [];

    if (envBucket) {
        const parts = envBucket.split('.');
        const proj = parts[0];
        if (envBucket.endsWith('.appspot.com')) {
            candidates.push(envBucket);
            if (proj) candidates.push(`${proj}.firebasestorage.app`);
        } else if (envBucket.endsWith('.firebasestorage.app')) {
            candidates.push(envBucket);
            if (proj) candidates.push(`${proj}.appspot.com`);
        } else {
            // treat as project id
            candidates.push(`${envBucket}.appspot.com`, `${envBucket}.firebasestorage.app`);
        }
    } else if (projectId) {
        candidates.push(`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`);
    }

    let chosenBucketName: string | undefined;
    const attempted: string[] = [];
    let lastErr: any = null;

    for (const cand of candidates) {
        attempted.push(cand);
        try {
            const candBucket = storage.bucket(cand);
            const [exists] = await candBucket.exists();
            if (exists) {
                chosenBucketName = cand;
                break;
            }
        } catch (e) {
            lastErr = e;
        }
    }

    if (!chosenBucketName) {
        const attemptedMsg = attempted.length ? `Tried: ${attempted.join(', ')}` : 'No bucket candidates available';
        const lastErrMsg = lastErr ? `; last error: ${lastErr?.message || String(lastErr)}` : '';
        throw new Error(`Bucket check failed: ${attemptedMsg}${lastErrMsg}. Ensure Firebase Storage is enabled for the project and that at least one of the buckets exists: "<project-id>.appspot.com" or "<project-id>.firebasestorage.app".`);
    }

    const bucket = storage.bucket(chosenBucketName);

    const fileId = nanoid();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `tasks/${taskId}/${fileId}-${safeName}`;

    // Read bytes from the web File object
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate a persistent download token so we can construct a stable URL
    const downloadToken = nanoid();

    await bucket.file(storagePath).save(buffer, {
        metadata: {
            contentType: file.type || 'application/octet-stream',
            metadata: {
                firebaseStorageDownloadTokens: downloadToken,
            },
        },
        resumable: false,
        public: false,
    });

    const encodedPath = encodeURIComponent(storagePath);
    const finalBucket = bucket.name;
    const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${finalBucket}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    return {
        id: fileId,
        fileName: file.name,
        fileUrl,
        fileType: file.type,
        size: file.size,
        uploadedAt: (Timestamp.fromDate(new Date()) as any),
        uploadedBy: "user1", // TODO: replace with actual user ID
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

export async function GET(request: NextRequest) {
    try {
        // Identify current user from secure session cookie
        const { cookies } = await import('next/headers');
        const sessionCookie = (await cookies()).get('session');

        let currentUserId: string | null = null;
        if (sessionCookie?.value) {
            try {
                const sessionData = JSON.parse(sessionCookie.value);
                currentUserId = sessionData?.id || null;
            } catch {
                // Fallback for legacy plain string cookies
                currentUserId = sessionCookie.value;
            }
        }

        if (!currentUserId) {
            return NextResponse.json({ error: 'Unauthorized: no session' }, { status: 401 });
        }

        // Use Admin SDK to query only tasks where the user is reporter or assignee
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();

        // Firestore doesn't support OR in a single query; run two queries and merge
        const [reporterSnap, assigneeSnap] = await Promise.all([
            adb.collection('tasks').where('reporterId', '==', currentUserId).get(),
            adb.collection('tasks').where('assigneeId', '==', currentUserId).get(),
        ]);

        const seen = new Set<string>();
        const tasks: any[] = [];

        for (const d of reporterSnap.docs) {
            if (!seen.has(d.id)) {
                seen.add(d.id);
                const raw = d.data ? d.data() : {};
                const { id: _discard, ...dataNoId } = raw as any;
                tasks.push(makeSerializable({ id: d.id, ...dataNoId }));
            }
        }
        for (const d of assigneeSnap.docs) {
            if (!seen.has(d.id)) {
                seen.add(d.id);
                const raw = d.data ? d.data() : {};
                const { id: _discard, ...dataNoId } = raw as any;
                tasks.push(makeSerializable({ id: d.id, ...dataNoId }));
            }
        }

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
        const { cookies } = await import('next/headers');
        const sessionCookie = (await cookies()).get('session');
        let currentUserId = 'unknown';
        try {
            const sessionData = sessionCookie?.value ? JSON.parse(sessionCookie.value) : null;
            currentUserId = sessionData?.id || (sessionCookie?.value || 'unknown');
        } catch {
            currentUserId = sessionCookie?.value || 'unknown';
        }

        // Compute bucket name used for uploads (for error reporting)
        const envBucket = (process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').replace(/^gs:\/\//, '');
        const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
        let resolvedBucket = envBucket || (projectId ? `${projectId}.firebasestorage.app` : '');

        // Handle file uploads
        const attachments: File[] = [];
        const attachmentFiles: Attachment[] = [];
        const uploadErrors: { fileName: string; message: string }[] = [];

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
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    console.error(`Failed to upload file ${file.name}:`, message);
                    uploadErrors.push({ fileName: file.name, message });
                    // Continue with other files
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

        // If attachments were provided but none uploaded, surface a clear error
        if (attachments.length > 0 && attachmentFiles.length === 0) {
            const firstErr = uploadErrors[0]?.message || 'Attachment upload failed';
            return NextResponse.json({ 
                success: false, 
                error: `No attachments were uploaded. ${firstErr}. Check Storage bucket configuration and credentials.`,
                details: { attempted: attachments.length, uploaded: attachmentFiles.length, bucket: resolvedBucket || '(default)', errors: uploadErrors }
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, details: { uploaded: attachmentFiles.length, bucket: resolvedBucket || '(default)' } });
    } catch (error) {
        console.error("Error saving task:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ success: false, error: `Failed to save task: ${errorMessage}` }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { id } = await request.json().catch(() => ({ id: undefined }));
        if (!id || typeof id !== 'string' || id.trim() === '') {
            return NextResponse.json({ success: false, error: 'Task id is required.' }, { status: 400 });
        }

        // Initialize admin
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();

        // Attempt to delete any stored attachments under tasks/<id>/ prefix
        let attachmentsDeleted = false;
        try {
            const storage = (await import('firebase-admin/storage')).getStorage();
            const envBucket = (process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').replace(/^gs:\/\//, '');
            const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
            const candidates: string[] = [];
            if (envBucket) {
                const proj = envBucket.split('.')[0];
                if (envBucket.endsWith('.appspot.com')) {
                    candidates.push(envBucket);
                    if (proj) candidates.push(`${proj}.firebasestorage.app`);
                } else if (envBucket.endsWith('.firebasestorage.app')) {
                    candidates.push(envBucket);
                    if (proj) candidates.push(`${proj}.appspot.com`);
                } else {
                    candidates.push(`${envBucket}.appspot.com`, `${envBucket}.firebasestorage.app`);
                }
            } else if (projectId) {
                candidates.push(`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`);
            }

            let bucket: ReturnType<typeof storage.bucket> | null = null;
            for (const cand of candidates) {
                try {
                    const b = storage.bucket(cand);
                    const [exists] = await b.exists();
                    if (exists) { bucket = b; break; }
                } catch (_) {}
            }
            if (!bucket) {
                throw new Error(`No Storage bucket found for candidates: ${candidates.join(', ')}`);
            }
            try {
                const [exists] = await bucket.exists();
                if (exists) {
                    await bucket.deleteFiles({ prefix: `tasks/${id}/` });
                    attachmentsDeleted = true;
                }
            } catch (e) {
                // Swallow storage errors to not block task deletion
                console.warn('Attachment cleanup skipped:', (e as any)?.message || e);
            }
        } catch (e) {
            console.warn('Storage not available for attachment cleanup:', (e as any)?.message || e);
        }

        // Delete the task document
        await adb.collection('tasks').doc(id).delete();

        return NextResponse.json({ success: true, details: { attachmentsDeleted } });
    } catch (error) {
        console.error('Error deleting task:', error);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ success: false, error: `Failed to delete task: ${msg}` }, { status: 500 });
    }
}