"use server"
import { generateCustomReport } from "@/ai/flows/generate-custom-report";
import type { GenerateCustomReportInput, GenerateCustomReportOutput } from "@/ai/flows/generate-custom-report";
import { getUserByEmployeeNo, bulkAddShipments } from "@/lib/firebase/firestore";
import type { User, Source, ContainerSize, Department, Branch, UserRole, Shipment } from "@/lib/types";
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
        const newUser: Omit<User, 'id'> = {
            fullName: formData.get("fullName") as string,
            employeeNo: formData.get("employeeNo") as string,
            password: formData.get("password") as string, // Note: In a real app, hash this!
            email: formData.get("email") as string,
            department: formData.get("department") as string,
            role: formData.get("role") as UserRole,
        };
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        await adb.collection('Users').add(newUser);
        revalidatePath("/dashboard/settings");
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

// Delete Actions
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

export async function updateTaskAction(id: string, data: any) {
    const mod = await import('./dashboard/tasks/actions').catch(() => null);
    // If dashboard provides a saveTaskAction or saveTask, adapt to update
    try {
        if (mod && (mod as any).saveTaskAction) {
            // saveTaskAction expects (prevState, formData) - call the programmatic saveTask if available
            if ((mod as any).saveTask) {
                const result = await (mod as any).saveTask({ id, ...data });
                return { success: result?.success ?? false, data: result };
            }
            return { success: false, error: 'saveTask wrapper not available' };
        }
        // If there's a direct updateTask exported
        if (mod && (mod as any).updateTask) {
            const result = await (mod as any).updateTask(id, data);
            return { success: true, data: result };
        }
        return { success: false, error: 'Not implemented' };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to update task.' };
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
