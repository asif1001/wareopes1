"use server"
import type { GenerateCustomReportInput, GenerateCustomReportOutput } from "@/ai/flows/generate-custom-report";
import { getUserByEmployeeNo, bulkAddShipments } from "@/lib/firebase/firestore";
import type { User, Source, ContainerSize, Department, Branch, UserRole, Shipment, Role } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function logoutAction() {
    (await cookies()).delete('session');
    redirect('/');
}

export async function generateReportAction(
    prevState: {
      output: GenerateCustomReportOutput | null,
      error: string | null
    },
    formData: FormData
  ): Promise<{
    output: GenerateCustomReportOutput | null,
    error: string | null
  }> {
    try {
      const input: GenerateCustomReportInput = {
        reportTitle: formData.get("reportTitle") as string,
        dataDescription: formData.get("dataDescription") as string,
        userParameters: formData.get("userParameters") as string,
        preferredChartTypes: formData.get("preferredChartTypes") as string,
      };

      const { generateCustomReport } = await import("@/ai/flows/generate-custom-report");
      const output = await generateCustomReport(input);

      return { output, error: null };
    } catch (e: any) {
      console.error(e);
      return { output: null, error: e.message || "An unknown error occurred." };
    }
}

// Placeholder actions for account page to prevent import errors
export async function changePasswordAction(formData: FormData): Promise<{ success: boolean; message?: string; error?: string }> {
    // In a real app, validate and update password in Firestore/Auth
    const current = formData.get('currentPassword');
    const next = formData.get('newPassword');
    if (!current || !next) {
        return { success: false, error: 'Missing password fields' };
    }
    return { success: true, message: 'Password changed successfully (demo)' };
}

export async function updateNotificationPreferencesAction(formData: FormData): Promise<{ success: boolean; message?: string; error?: string }> {
    // Persist preferences per user if needed; here we just acknowledge
    return { success: true, message: 'Preferences updated (demo)' };
}

export async function submitSupportTicketAction(formData: FormData): Promise<{ success: boolean; message?: string; error?: string }> {
    // Log or store support ticket; for now just return success
    const subject = formData.get('subject');
    const message = formData.get('message');
    if (!subject || !message) {
        return { success: false, error: 'Subject and message are required' };
    }
    return { success: true, message: 'Ticket submitted (demo)' };
}

// Dedicated profile update action used by My Account page
export async function updateUserProfileAction(userId: string, profile: Partial<User>): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        if (!userId) {
            return { success: false, error: 'Missing user id' };
        }
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        await adb.collection('Users').doc(userId).update(profile);
        // Revalidate settings/dashboard pages where user profile may appear
        try { revalidatePath('/dashboard/settings'); } catch {}
        return { success: true, message: 'Profile updated successfully.' };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to update profile.' };
    }
}

// Add Actions
export async function addUserAction(prevState: any, formData: FormData) {
    try {
        const employeeNoRaw = String(formData.get("employeeNo") || "").trim();
        if (!employeeNoRaw) {
            return { message: "Employee No/CPR No is required." };
        }

        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();

        // Uniqueness check for employeeNo/CPR
        const existing = await adb.collection('Users').where('employeeNo', '==', employeeNoRaw).limit(1).get();
        if (!existing.empty) {
            return { message: "Employee No/CPR No already exists." };
        }

        const newUser: Omit<User, 'id'> = {
            fullName: formData.get("fullName") as string,
            employeeNo: employeeNoRaw,
            password: formData.get("password") as string, // Note: In a real app, hash this!
            email: formData.get("email") as string,
            department: formData.get("department") as string,
            role: formData.get("role") as UserRole,
        };

        await adb.collection('Users').add(newUser);
        try { revalidatePath("/dashboard/settings"); } catch {}
        return { message: "User added successfully." };
    } catch (e: any) {
        return { message: e.message || "Failed to add user." };
    }
}

export async function addSourceAction(prevState: any, formData: FormData) {
    try {
        const newSource: Omit<Source, 'id'> = {
            shortName: formData.get("shortName") as string,
            name: formData.get("name") as string,
        };
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        await adb.collection('Sources').add(newSource);
        revalidatePath("/dashboard/settings");
        return { message: "Source added successfully." };
    } catch (e: any) {
        return { message: e.message || "Failed to add source." };
    }
}

export async function addContainerSizeAction(prevState: any, formData: FormData) {
    try {
        const newSize: Omit<ContainerSize, 'id'> = {
            size: formData.get("size") as string,
            cmb: formData.get("cmb") as string,
        };
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        await adb.collection('ContainerSizes').add(newSize);
        revalidatePath("/dashboard/settings");
        return { message: "Container size added successfully." };
    } catch (e: any) {
        return { message: e.message || "Failed to add container size." };
    }
}

export async function addDepartmentAction(prevState: any, formData: FormData) {
    try {
        const newDepartment: Omit<Department, 'id'> = {
            name: formData.get("name") as string,
            branch: formData.get("branch") as string,
        };
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        await adb.collection('Departments').add(newDepartment);
        revalidatePath("/dashboard/settings");
        return { message: "Department added successfully." };
    } catch (e: any) {
        return { message: e.message || "Failed to add department." };
    }
}

export async function addBranchAction(prevState: any, formData: FormData) {
    try {
        const newBranch: Omit<Branch, 'id'> = {
            name: formData.get("name") as string,
            code: formData.get("code") as string,
        };
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        await adb.collection('Branches').add(newBranch);
        revalidatePath("/dashboard/settings");
        return { message: "Branch added successfully." };
    } catch (e: any) {
        return { message: e.message || "Failed to add branch." };
    }
}

// Role Actions
async function ensureAdmin(): Promise<{ id: string } | null> {
  const me = await (async () => {
    try {
      const c = await cookies();
      const id = c.get('session')?.value;
      if (!id) return null;
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const adb = await getAdminDb();
      const snap = await adb.collection('Users').doc(id).get();
      const role = (snap.exists ? (snap.data() as any)?.role : undefined) || undefined;
      if (role !== 'Admin') return null;
      return { id };
    } catch { return null; }
  })();
  return me;
}

export async function addRoleAction(prevState: any, formData: FormData): Promise<{ message: string }>{
  try {
    const admin = await ensureAdmin();
    if (!admin) return { message: 'Forbidden: Admin only' };

    const name = String(formData.get('name') || '').trim();
    const permissions = formData.getAll('permissions').map(String).filter(Boolean);
    if (!name) return { message: 'Role name is required' };

    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();

    // Unique check on name
    const existing = await adb.collection('Roles').where('name', '==', name).limit(1).get();
    if (!existing.empty) return { message: 'Role name already exists' };

    await adb.collection('Roles').add({ name, permissions });
    try { revalidatePath('/dashboard/settings'); } catch {}
    return { message: 'Role added successfully.' };
  } catch (e: any) {
    return { message: e?.message || 'Failed to add role.' };
  }
}

export async function deleteRoleAction(prevState: any, formData: FormData): Promise<{ message: string }>{
  try {
    const admin = await ensureAdmin();
    if (!admin) return { message: 'Forbidden: Admin only' };

    const id = String(formData.get('id') || '');
    if (!id) return { message: 'Missing role id' };

    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    await adb.collection('Roles').doc(id).delete();
    try { revalidatePath('/dashboard/settings'); } catch {}
    return { message: 'Role deleted successfully.' };
  } catch (e: any) {
    return { message: e?.message || 'Failed to delete role.' };
  }
}

// Delete actions: support both direct call with id (used programmatically)
// and form-based server action signature (prevState, formData) used by UI forms.
export async function deleteUserAction(prevState: any, formData: FormData): Promise<{ message: string }> {
    const id = String(formData.get('id'));
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    await adb.collection('Users').doc(id).delete();
    revalidatePath("/dashboard/settings");
    return { message: 'User deleted successfully.' };
}

export async function deleteSourceAction(prevState: any, formData: FormData): Promise<{ message: string }> {
    const id = String(formData.get('id'));
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    await adb.collection('Sources').doc(id).delete();
    revalidatePath("/dashboard/settings");
    return { message: 'Source deleted successfully.' };
}

export async function deleteContainerSizeAction(prevState: any, formData: FormData): Promise<{ message: string }> {
    const id = String(formData.get('id'));
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    await adb.collection('ContainerSizes').doc(id).delete();
    revalidatePath("/dashboard/settings");
    return { message: 'Container size deleted successfully.' };
}

export async function deleteDepartmentAction(prevState: any, formData: FormData): Promise<{ message: string }> {
    const id = String(formData.get('id'));
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    await adb.collection('Departments').doc(id).delete();
    revalidatePath("/dashboard/settings");
    return { message: 'Department deleted successfully.' };
}

export async function deleteBranchAction(prevState: any, formData: FormData): Promise<{ message: string }> {
    const id = String(formData.get('id'));
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    await adb.collection('Branches').doc(id).delete();
    revalidatePath("/dashboard/settings");
    return { message: 'Branch deleted successfully.' };
}


// Update Actions
export async function updateUserAction(prevState: any, formData: FormData) {
    try {
        const id = formData.get("id") as string;
        const updatedUser: Partial<User> = {
            fullName: formData.get("fullName") as string,
            employeeNo: formData.get("employeeNo") as string,
            email: formData.get("email") as string,
            department: formData.get("department") as string,
            role: formData.get("role") as UserRole,
        };
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        await adb.collection('Users').doc(id).update(updatedUser);
        revalidatePath("/dashboard/settings");
        return { message: "User updated successfully." };
    } catch (e: any) {
        return { message: e.message || "Failed to update user." };
    }
}

export async function updateSourceAction(prevState: any, formData: FormData) {
    try {
        const id = formData.get("id") as string;
        const updatedSource: Partial<Source> = {
            shortName: formData.get("shortName") as string,
            name: formData.get("name") as string,
        };
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        await adb.collection('Sources').doc(id).update(updatedSource);
        revalidatePath("/dashboard/settings");
        return { message: "Source updated successfully." };
    } catch (e: any) {
        return { message: e.message || "Failed to update source." };
    }
}

export async function updateContainerSizeAction(prevState: any, formData: FormData) {
    try {
        const id = formData.get("id") as string;
        const updatedSize: Partial<ContainerSize> = {
            size: formData.get("size") as string,
            cmb: formData.get("cmb") as string,
        };
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        await adb.collection('ContainerSizes').doc(id).update(updatedSize);
        revalidatePath("/dashboard/settings");
        return { message: "Container size updated successfully." };
    } catch (e: any) {
        return { message: e.message || "Failed to update container size." };
    }
}

export async function updateDepartmentAction(prevState: any, formData: FormData) {
    try {
        const id = formData.get("id") as string;
        const updatedDepartment: Partial<Department> = {
            name: formData.get("name") as string,
            branch: formData.get("branch") as string,
        };
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        await adb.collection('Departments').doc(id).update(updatedDepartment);
        revalidatePath("/dashboard/settings");
        return { message: "Department updated successfully." };
    } catch (e: any) {
        return { message: e.message || "Failed to update department." };
    }
}

export async function updateBranchAction(prevState: any, formData: FormData) {
    try {
        const id = formData.get("id") as string;
        const updatedBranch: Partial<Branch> = {
            name: formData.get("name") as string,
            code: formData.get("code") as string,
        };
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        await adb.collection('Branches').doc(id).update(updatedBranch);
        revalidatePath("/dashboard/settings");
        return { message: "Branch updated successfully." };
    } catch (e: any) {
        return { message: e.message || "Failed to update branch." };
    }
}

// Task-related server action wrappers expected by client hooks/components
// These forward to the real implementations which may live in dashboard/tasks/actions.ts
export async function getTasksOptimizedAction(options?: any) {
    const mod = await import('./dashboard/tasks/actions');
    // If the dashboard module provides an optimized tasks fetch, use it.
    if ((mod as any).getTasksOptimized) {
        try {
            const data = await (mod as any).getTasksOptimized(options);
            return { success: true, data };
        } catch (err: any) {
            return { success: false, error: err?.message || 'Failed to fetch tasks.' };
        }
    }
    // Fallback: attempt to call a generic getTasks or return empty
    if ((mod as any).getTasks) {
        try {
            const data = await (mod as any).getTasks(options);
            return { success: true, data };
        } catch (err: any) {
            return { success: false, error: err?.message || 'Failed to fetch tasks.' };
        }
    }
    return { success: true, data: [] };
}

export async function getUsersMinimalAction() {
    const mod = await import('./dashboard/tasks/actions').catch(() => null);
    if (mod && (mod as any).getUsersMinimal) {
        try {
            const data = await (mod as any).getUsersMinimal();
            return { success: true, data };
        } catch (err: any) {
            return { success: false, error: err?.message || 'Failed to fetch users.' };
        }
    }
    // As a safe default return empty list
    return { success: true, data: [] };
}

export async function getTaskCountsAction() {
    const mod = await import('./dashboard/tasks/actions').catch(() => null);
    if (mod && (mod as any).getTaskCounts) {
        try {
            const data = await (mod as any).getTaskCounts();
            return { success: true, data };
        } catch (err: any) {
            return { success: false, error: err?.message || 'Failed to fetch task counts.' };
        }
    }
    return { success: true, data: {} };
}

// Helper to convert task data to FormData for dashboard saveTask APIs
function buildTaskFormData(input: any, id?: string): FormData {
  const fd = new FormData();
  if (id) fd.set('id', String(id));
  if (input?.title) fd.set('title', String(input.title));
  if (input?.description !== undefined) fd.set('description', String(input.description ?? ''));
  if (input?.status) fd.set('status', String(input.status));
  if (input?.priority) fd.set('priority', String(input.priority));
  if (input?.labels) fd.set('labels', JSON.stringify(input.labels));
  if (input?.startDate) fd.set('startDate', String(input.startDate));
  if (input?.dueDate) fd.set('dueDate', String(input.dueDate));
  if (input?.assigneeId !== undefined) fd.set('assigneeId', input.assigneeId === null ? '' : String(input.assigneeId));
  if (input?.reporterId) fd.set('reporterId', String(input.reporterId));
  if (input?.watchers) fd.set('watchers', JSON.stringify(input.watchers));
  if (input?.branch) fd.set('branch', String(input.branch));
  if (input?.subtasks) {
    const simplified = Array.isArray(input.subtasks)
      ? input.subtasks.map((s: any) => ({ title: s.title, isComplete: !!s.isComplete }))
      : [];
    fd.set('subtasks', JSON.stringify(simplified));
  }
  return fd;
}

export async function updateTaskAction(id: string, data: any) {
    const mod = await import('./dashboard/tasks/actions').catch(() => null);
    try {
        if (mod && (mod as any).saveTask) {
            const formData = buildTaskFormData(data, id);
            const result = await (mod as any).saveTask(formData);
            return { success: !!(result as any)?.success, data: result };
        }
        if (mod && (mod as any).saveTaskAction) {
            const formData = buildTaskFormData(data, id);
            const result = await (mod as any).saveTaskAction({ success: false, error: null }, formData);
            return { success: !!(result as any)?.success, data: result, error: (result as any)?.error ?? undefined };
        }
        if (mod && (mod as any).updateTask) {
            const res = await (mod as any).updateTask(id, data);
            return { success: true, data: res };
        }
        return { success: false, error: 'Not implemented' };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to update task.' };
    }
}

export async function createTaskAction(data: any) {
    const mod = await import('./dashboard/tasks/actions').catch(() => null);
    try {
        if (mod && (mod as any).saveTask) {
            const formData = buildTaskFormData(data);
            const result = await (mod as any).saveTask(formData);
            return { success: !!(result as any)?.success, data: result };
        }
        if (mod && (mod as any).saveTaskAction) {
            const formData = buildTaskFormData(data);
            const result = await (mod as any).saveTaskAction({ success: false, error: null }, formData);
            return { success: !!(result as any)?.success, data: result, error: (result as any)?.error ?? undefined };
        }
        if (mod && (mod as any).createTask) {
            const res = await (mod as any).createTask(data);
            return { success: true, data: res };
        }
        return { success: false, error: 'Not implemented' };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to create task.' };
    }
}

export async function deleteTaskAction(id: string) {
    const mod = await import('./dashboard/tasks/actions').catch(() => null);
    try {
        if (mod && (mod as any).deleteTask) {
            const result = await (mod as any).deleteTask(id);
            // ensure normalized shape
            if (typeof result === 'object' && 'success' in result) return { success: !!(result as any).success, data: result };
            return { success: true, data: result };
        }
        return { success: false, error: 'Not implemented' };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to delete task.' };
    }
}

export async function batchUpdateTasksAction(updates: any[]) {
    const mod = await import('./dashboard/tasks/actions').catch(() => null);
    try {
        if (mod && (mod as any).batchUpdateTasks) {
            const data = await (mod as any).batchUpdateTasks(updates);
            return { success: true, data };
        }
        return { success: false, error: 'Not implemented' };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to batch update tasks.' };
    }
}

const shipmentSchema = z.object({
    source: z.string(),
    invoice: z.string(),
    billOfLading: z.string(),
    containers: z.string().transform(val => JSON.parse(val)),
    bahrainEta: z.string().transform(val => new Date(val)),
    originalDocumentReceiptDate: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
    actualBahrainEta: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
    lastStorageDay: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
    whEtaRequestedByParts: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
    whEtaConfirmedByLogistics: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
    cleared: z.string().transform(val => val === 'true'),
    actualClearedDate: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
    totalCases: z.coerce.number(),
    domLines: z.coerce.number(),
    bulkLines: z.coerce.number(),
    generalRemark: z.string(),
    remark: z.string().optional(),
});

export async function bulkAddShipmentsAction(prevState: any, formData: FormData): Promise<{ success?: string | null; error?: string | null }> {
    try {
        const jsonString = formData.get('shipments') as string;
        if (!jsonString) {
            return { error: "No shipment data provided." };
        }
        const parsedData = JSON.parse(jsonString);

        if (!Array.isArray(parsedData) || parsedData.length === 0) {
            return { error: "No shipments to import." };
        }
        
        const shipmentsToInsert: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt' | 'bookings'>[] = [];
        const errors: string[] = [];

        for (const [index, item] of parsedData.entries()) {
            const validated = shipmentSchema.safeParse(item);
            if (!validated.success) {
                const errorFields = Object.keys(validated.error.flatten().fieldErrors).join(', ');
                errors.push(`Row ${index + 2} (Invoice: ${item.invoice || 'N/A'}): Invalid fields - ${errorFields}`);
                continue; // Skip to the next item
            }
            const data = validated.data;
            shipmentsToInsert.push({
                ...data,
                containers: data.containers, // Ensure containers is always present
                numContainers: data.containers.reduce((acc: number, c: any) => acc + c.quantity, 0),
                totalLines: data.domLines + data.bulkLines,
                status: 'Not Arrived' as const, // Add default status for bulk imports
                createdBy: "bulk-import",
                updatedBy: "bulk-import",
            });
        }
        
        if (shipmentsToInsert.length > 0) {
            await bulkAddShipments(shipmentsToInsert);
            revalidatePath("/dashboard/shipments");
            revalidatePath("/dashboard/settings");
        }

        if (errors.length > 0) {
            const successMessage = shipmentsToInsert.length > 0 ? `Successfully imported ${shipmentsToInsert.length} shipments.` : '';
            const errorMessage = `Failed to import ${errors.length} shipments. Errors: ${errors.join('; ')}`;
            return { error: `${successMessage} ${errorMessage}`.trim() };
        }

        return { success: `Successfully imported ${shipmentsToInsert.length} shipments.` };

    } catch (e: any) {
        console.error("Bulk import error:", e);
        return { error: e.message || "An unexpected error occurred during bulk import." };
    }
}


// Role-based form templates and submissions actions
import type { FormTemplate, FormField, FormSubmission } from '@/lib/types';

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

async function getCurrentUserServer(): Promise<{ id: string; role?: string } | null> {
  try {
    const c = await cookies();
    const id = c.get('session')?.value;
    if (!id) return null;
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    const snap = await adb.collection('Users').doc(id).get();
    if (!snap.exists) return { id };
    const data = snap.data() as any;
    return { id, role: data?.role };
  } catch {
    return null;
  }
}

export async function getFormTemplatesAction(): Promise<{ success: boolean; data?: FormTemplate[]; error?: string }>{
  try {
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    const q = await adb.collection('FormTemplates').orderBy('slug').get();
    const data: FormTemplate[] = q.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to fetch form templates' };
  }
}

export async function getFormTemplateBySlugAction(slug: string): Promise<{ success: boolean; data?: FormTemplate; error?: string }>{
  try {
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    const q = await adb.collection('FormTemplates').where('slug', '==', slug).limit(1).get();
    if (q.empty) return { success: false, error: 'Form template not found' };
    const d = q.docs[0];
    return { success: true, data: { id: d.id, ...(d.data() as any) } };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to fetch form template' };
  }
}

export async function createFormTemplateAction(input: { slug: string; displayName: string; allowedRoles: string[]; autoRedirectForRoles?: string[]; fields: FormField[] }): Promise<{ success: boolean; id?: string; error?: string }>{
  try {
    const me = await getCurrentUserServer();
    if (!me?.id) return { success: false, error: 'Not authenticated' };
    if (me.role !== 'Admin') return { success: false, error: 'Forbidden: Admin only' };

    const slug = sanitizeSlug(input.slug);
    if (!slug) return { success: false, error: 'Invalid slug' };
    if (!Array.isArray(input.fields) || input.fields.length === 0) return { success: false, error: 'At least one field is required' };

    const now = new Date().toISOString();
    const doc: Omit<FormTemplate, 'id'> = {
      slug,
      displayName: input.displayName || slug,
      allowedRoles: input.allowedRoles?.length ? input.allowedRoles : ['Warehouse Associate', 'Driver', 'Manager', 'Supervisor', 'Team Leader', 'Contract Staff'],
      autoRedirectForRoles: input.autoRedirectForRoles || [],
      fields: input.fields,
      createdBy: me.id,
      createdAt: now,
      updatedAt: now,
    };
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();

    // Ensure unique slug
    const existing = await adb.collection('FormTemplates').where('slug', '==', slug).limit(1).get();
    if (!existing.empty) return { success: false, error: 'Slug already exists' };

    const ref = await adb.collection('FormTemplates').add(doc);
    try { revalidatePath('/dashboard/settings'); } catch {}
    return { success: true, id: ref.id };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to create template' };
  }
}

export async function updateFormTemplateAction(id: string, updates: Partial<FormTemplate>): Promise<{ success: boolean; error?: string }>{
  try {
    const me = await getCurrentUserServer();
    if (!me?.id) return { success: false, error: 'Not authenticated' };
    if (me.role !== 'Admin') return { success: false, error: 'Forbidden: Admin only' };
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    const safe: any = { ...updates };
    if (safe.slug) safe.slug = sanitizeSlug(safe.slug);
    safe.updatedAt = new Date().toISOString();
    safe.updatedBy = me.id;
    await adb.collection('FormTemplates').doc(id).update(safe);
    try { revalidatePath('/dashboard/settings'); } catch {}
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to update template' };
  }
}

export async function deleteFormTemplateAction(id: string): Promise<{ success: boolean; error?: string }>{
  try {
    const me = await getCurrentUserServer();
    if (!me?.id) return { success: false, error: 'Not authenticated' };
    if (me.role !== 'Admin') return { success: false, error: 'Forbidden: Admin only' };
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    await adb.collection('FormTemplates').doc(id).delete();
    try { revalidatePath('/dashboard/settings'); } catch {}
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to delete template' };
  }
}

function zodForField(field: FormField): z.ZodTypeAny {
  switch (field.type) {
    case 'text': {
      let s = z.string();
      if (field.pattern) {
        try { s = s.regex(new RegExp(field.pattern)); } catch {}
      }
      return field.required ? s.min(1) : s.optional();
    }
    case 'textarea': {
      let s = z.string();
      return field.required ? s.min(1) : s.optional();
    }
    case 'number': {
      let s = z.coerce.number();
      if (typeof field.min === 'number') s = s.min(field.min);
      if (typeof field.max === 'number') s = s.max(field.max);
      return field.required ? s : s.optional();
    }
    case 'dropdown': {
      const options = Array.isArray(field.options) ? field.options : [];
      if (options.length > 0) {
        const enumSchema = z.enum(options as [string, ...string[]]);
        return field.required ? enumSchema : enumSchema.optional();
      }
      let s = z.string();
      return field.required ? s.min(1) : s.optional();
    }
    case 'checkbox': {
      return field.required ? z.literal(true) : z.coerce.boolean().optional();
    }
    case 'date': {
      const base = z.string();
      const s = field.required ? base.min(1) : base.optional();
      return s.refine((v) => {
        if (v === undefined) return true; // optional
        if (v === null) return true; // allow nullable handled upstream
        if (typeof v !== 'string') return false;
        const trimmed = v.trim();
        if (!trimmed) return !field.required;
        return !isNaN(Date.parse(trimmed));
      }, { message: 'Invalid date' });
    }
    default:
      return z.any();
  }
}

// Create form template from FormData (used by admin UI builder)
export async function createFormTemplateFromFormAction(_prev: any, formData: FormData): Promise<{ message: string }>{
  try {
    const slugRaw = String(formData.get('slug') || '');
    const displayName = String(formData.get('displayName') || slugRaw);
    const allowedRolesStr = String(formData.get('allowedRoles') || '');
    const autoRedirectStr = String(formData.get('autoRedirectForRoles') || '');
    const fieldsJson = String(formData.get('fieldsJson') || '[]');
    const fields: FormField[] = JSON.parse(fieldsJson);

    const slug = sanitizeSlug(slugRaw || displayName);
    const allowedRoles = allowedRolesStr ? allowedRolesStr.split(',').map(s => s.trim()).filter(Boolean) : [];
    const autoRedirectForRoles = autoRedirectStr ? autoRedirectStr.split(',').map(s => s.trim()).filter(Boolean) : [];

    const res = await createFormTemplateAction({ slug, displayName, allowedRoles, autoRedirectForRoles, fields });
    if (res.success) return { message: `Template ${displayName} (${slug}) created.` };
    return { message: `Failed: ${res.error || 'Unknown error'}` };
  } catch (e: any) {
    return { message: `Failed: ${e?.message || 'Invalid form data'}` };
  }
}

// Submit dynamic form answers (server-side validation and storage)
export async function submitFormAction(_prev: any, formData: FormData): Promise<{ success: boolean; message?: string; error?: string }>{
  try {
    const me = await getCurrentUserServer();
    if (!me?.id) return { success: false, error: 'Not authenticated' };

    const templateSlug = String(formData.get('templateSlug') || '');
    const answersJson = String(formData.get('answersJson') || '{}');
    const answers: Record<string, any> = JSON.parse(answersJson);

    const tplRes = await getFormTemplateBySlugAction(templateSlug);
    if (!tplRes.success || !tplRes.data) return { success: false, error: 'Template not found' };
    const tpl = tplRes.data;

    // Role-based access check
    const role = me.role || 'Unknown';
    if (tpl.allowedRoles && tpl.allowedRoles.length && !tpl.allowedRoles.includes(role)) {
      return { success: false, error: 'Access denied for your role' };
    }

    // Fetch user details for denormalized fields
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    let userFullName: string | undefined = undefined;
    let userEmployeeNo: string | undefined = undefined;
    try {
      const uSnap = await adb.collection('Users').doc(me.id).get();
      const uData = uSnap.data() as any;
      userFullName = uData?.fullName || uData?.name;
      userEmployeeNo = uData?.employeeNo;
    } catch {}

    // Server-side validation
    const shape: Record<string, any> = {};
    for (const f of tpl.fields) {
      shape[f.id] = zodForField(f);
    }
    const schema = z.object(shape);
    const parsed = schema.safeParse(answers);
    if (!parsed.success) {
      const msg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return { success: false, error: `Validation failed: ${msg}` };
    }

    const now = new Date().toISOString();
    const submission: Omit<FormSubmission, 'id'> = {
      templateId: tpl.id,
      templateSlug: tpl.slug,
      userId: me.id,
      userRole: role,
      submittedAt: now,
      answers: parsed.data,
      // Denormalized fields
      userFullName,
      userEmployeeNo,
      templateDisplayName: tpl.displayName,
    };

    const ref = await adb.collection('FormSubmissions').add(submission);
    // Also store under template subcollection for convenient queries
    await adb.collection('FormTemplates').doc(tpl.id).collection('Submissions').doc(ref.id).set(submission);

    try { revalidatePath(`/forms/${tpl.slug}`); } catch {}
    return { success: true, message: 'Form submitted successfully.' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to submit form' };
  }
}

// Find auto-redirect form for a given role
export async function findAutoRedirectFormForRoleAction(role: string): Promise<{ success: boolean; slug?: string; error?: string }>{
  try {
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    // Priority 1: explicit auto-redirect mapping
    const q = await adb.collection('FormTemplates').where('autoRedirectForRoles', 'array-contains', role).limit(1).get();
    if (!q.empty) {
      const d = q.docs[0];
      const data = d.data() as any;
      return { success: true, slug: data.slug };
    }
    // Fallback: slug match to sanitized role string
    const slug = sanitizeSlug(role);
    const q2 = await adb.collection('FormTemplates').where('slug', '==', slug).limit(1).get();
    if (!q2.empty) {
      return { success: true, slug };
    }
    return { success: false, error: 'No matching form for role' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to find redirect form' };
  }
}
