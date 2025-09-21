"use server"
import { generateCustomReport } from "@/ai/flows/generate-custom-report";
import type { GenerateCustomReportInput, GenerateCustomReportOutput } from "@/ai/flows/generate-custom-report";
import { addUser, addSource, addContainerSize, addDepartment, addBranch, deleteUser, deleteSource, deleteContainerSize, deleteDepartment, deleteBranch, updateUser, updateSource, updateContainerSize, updateDepartment, updateBranch, getUserByEmployeeNo, bulkAddShipments } from "@/lib/firebase/firestore";
import type { User, Source, ContainerSize, Department, Branch, UserRole, Shipment } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { redirect } from 'next/navigation';
import { z } from "zod";

export async function loginAction(
    prevState: { error: string | null },
    formData: FormData
): Promise<{ error: string | null }> {
    try {
        const employeeNo = formData.get("employeeNo") as string;
        const password = formData.get("password") as string;

        if (!employeeNo || !password) {
            return { error: "Employee number and password are required." };
        }

        const user = await getUserByEmployeeNo(employeeNo);

        if (!user) {
            return { error: "Invalid employee number or password." };
        }
        
        // IMPORTANT: In a real app, you MUST hash passwords.
        // This is a plaintext comparison for demo purposes only.
        if (user.password !== password) {
            return { error: "Invalid employee number or password." };
        }

    } catch (e: any) {
        console.error(e);
        return { error: "An unexpected error occurred. Please try again." };
    }
    
    // On successful login, redirect to the dashboard.
    redirect('/dashboard');
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
        await addUser(newUser);
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
        await addSource(newSource);
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
        await addContainerSize(newSize);
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
        await addDepartment(newDepartment);
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
        await addBranch(newBranch);
        revalidatePath("/dashboard/settings");
        return { message: "Branch added successfully." };
    } catch (e: any) {
        return { message: e.message || "Failed to add branch." };
    }
}

// Delete Actions
export async function deleteUserAction(id: string) {
    await deleteUser(id);
    revalidatePath("/dashboard/settings");
}
export async function deleteSourceAction(id: string) {
    await deleteSource(id);
    revalidatePath("/dashboard/settings");
}
export async function deleteContainerSizeAction(id: string) {
    await deleteContainerSize(id);
    revalidatePath("/dashboard/settings");
}
export async function deleteDepartmentAction(id: string) {
    await deleteDepartment(id);
    revalidatePath("/dashboard/settings");
}
export async function deleteBranchAction(id: string) {
    await deleteBranch(id);
    revalidatePath("/dashboard/settings");
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
        await updateUser(id, updatedUser);
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
        await updateSource(id, updatedSource);
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
        await updateContainerSize(id, updatedSize);
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
        await updateDepartment(id, updatedDepartment);
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
        await updateBranch(id, updatedBranch);
        revalidatePath("/dashboard/settings");
        return { message: "Branch updated successfully." };
    } catch (e: any) {
        return { message: e.message || "Failed to update branch." };
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

export async function bulkAddShipmentsAction(prevState: any, formData: FormData) {
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
