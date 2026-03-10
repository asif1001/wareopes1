
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addShipment, updateShipment, isInvoiceUnique, updateShipmentBookings, deleteShipment, getShipmentsByDateRange } from "@/lib/firebase/firestore";
import type { Shipment, Container, ContainerBooking, SerializableShipment } from "@/lib/types";
import { format } from "date-fns";
import { cookies } from 'next/headers';

const shipmentSchema = z.object({
    id: z.string().optional().nullable(),
    source: z.string().min(1, "Source is required"),
    invoice: z.string().min(1, "Invoice is required"),
    billOfLading: z.string().min(1, "Bill of Lading is required"),
    containers: z.string().transform(val => JSON.parse(val) as Container[]).refine(val => val.length > 0, {message: "At least one container is required"}),
    bahrainEta: z.string().min(1, "Bahrain ETA is required"),
    originalDocumentReceiptDate: z.string().optional().nullable(),
    actualBahrainEta: z.string().optional().nullable(),
    lastStorageDay: z.string().optional().nullable(),
    whEtaRequestedByParts: z.string().optional().nullable(),
    whEtaConfirmedByLogistics: z.string().optional().nullable(),
    // Status & Branch
    status: z.enum(['Not Arrived','Arrived','WIP','Completed']).default('Not Arrived'),
    branch: z.string().optional(),
    cleared: z.string().transform(val => val === 'true'),
    actualClearedDate: z.string().optional().nullable(),
    totalCases: z.coerce.number().int().min(0, "Total Cases must be a non-negative number."),
    domLines: z.coerce.number().int().min(0, "DOM Lines must be a non-negative number."),
    bulkLines: z.coerce.number().int().min(0, "Bulk Lines must be a non-negative number."),
    generalRemark: z.string().optional().default(''),
    remark: z.string().optional(),
}).refine(data => {
    if (data.cleared && !data.actualClearedDate) {
        return false;
    }
    return true;
}, {
    message: "Actual Cleared Date is required when Cleared is 'Yes'",
    path: ["actualClearedDate"],
});


export async function saveShipmentAction(
    prevState: { success: boolean, error: string | null, fieldErrors?: { [key: string]: string[] } },
    formData: FormData
): Promise<{ success: boolean, error: string | null, fieldErrors?: { [key: string]: string[] } }> {
  try {
        const rawData = Object.fromEntries(formData.entries());
        
        const validated = shipmentSchema.safeParse(rawData);

        if (!validated.success) {
            console.error("Validation failed:", validated.error.flatten());
            const fieldErrors = validated.error.flatten().fieldErrors;
            const firstError = Object.values(fieldErrors)[0]?.[0];
            return { success: false, error: firstError || "Invalid form data.", fieldErrors };
        }

        const data = validated.data;
        const shipmentId = data.id || undefined;

        const invoiceIsUnique = await isInvoiceUnique(data.invoice, shipmentId);
        if (!invoiceIsUnique) {
            return { success: false, error: "This invoice number is already in use." };
        }

        const numContainers = data.containers.reduce((acc, c) => acc + c.quantity, 0);
        const totalLines = data.domLines + data.bulkLines;

        // Convert date strings to Date objects where applicable
        // Resolve current user name for provenance
        let currentUserName: string = 'current-user';
        try {
            const c = await cookies();
            const rawSession = c.get('session')?.value;
            let userId: string | null = null;
            if (rawSession) {
                try {
                    const parsed = JSON.parse(rawSession);
                    userId = typeof parsed?.id === 'string' ? parsed.id : rawSession;
                } catch {
                    userId = rawSession;
                }
            }
            if (userId) {
                const { getAdminDb } = await import('@/lib/firebase/admin');
                const adb = await getAdminDb();
                const snap = await adb.collection('Users').doc(userId).get();
                const u = snap.exists ? (snap.data() as any) : {};
                currentUserName = String(u?.fullName || u?.name || userId);
            }
        } catch {}

        const shipmentData: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt' | 'bookings'> = {
            ...data,
            bahrainEta: new Date(data.bahrainEta),
            originalDocumentReceiptDate: data.originalDocumentReceiptDate ? new Date(data.originalDocumentReceiptDate) : null,
            actualBahrainEta: data.actualBahrainEta ? new Date(data.actualBahrainEta) : null,
            lastStorageDay: data.lastStorageDay ? new Date(data.lastStorageDay) : null,
            whEtaRequestedByParts: data.whEtaRequestedByParts ? new Date(data.whEtaRequestedByParts) : null,
            whEtaConfirmedByLogistics: data.whEtaConfirmedByLogistics ? new Date(data.whEtaConfirmedByLogistics) : null,
            actualClearedDate: data.actualClearedDate ? new Date(data.actualClearedDate) : null,
            numContainers,
            totalLines,
            createdBy: currentUserName,
            updatedBy: currentUserName,
        };

        // Automatically set status to Arrived only on initial assignment
        if (shipmentData.cleared && (shipmentData.status === 'Not Arrived' || !shipmentData.status)) {
            shipmentData.status = 'Arrived';
        }

        if (shipmentId) {
            await updateShipment(shipmentId, shipmentData);
        } else {
            await addShipment(shipmentData);
        }

        revalidatePath("/dashboard/shipments");
        return { success: true, error: null };
    } catch (e: any) {
        console.error(e);
        return { success: false, error: e.message || "An unknown error occurred." };
    }
}

const bookingSchema = z.object({
    containerNo: z.string().min(1, "Container No is required"),
    bookingDate: z.string().min(1, "Booking Date is required").transform(str => new Date(str)),
});

const containerBookingsSchema = z.object({
    shipmentId: z.string().min(1, "Shipment ID is required"),
    bookings: z.string().transform(val => JSON.parse(val) as any[]).pipe(z.array(bookingSchema)),
});


export async function saveContainerBookingsAction(
    prevState: { success: boolean, error: string | null },
    formData: FormData
): Promise<{ success: boolean, error: string | null }> {
     try {
        const rawData = Object.fromEntries(formData.entries());
        const validated = containerBookingsSchema.safeParse(rawData);

        if (!validated.success) {
            const firstError = Object.values(validated.error.flatten().fieldErrors)[0]?.[0];
            return { success: false, error: firstError || "Invalid booking data." };
        }
        
        const { shipmentId, bookings } = validated.data;

        await updateShipmentBookings(shipmentId, bookings);

        revalidatePath("/dashboard/shipments");
        return { success: true, error: null };
    } catch (e: any) {
        console.error(e);
        return { success: false, error: e.message || "An unknown error occurred." };
    }
}

export async function deleteShipmentAction(id: string): Promise<{ success: boolean, error: string | null }> {
    try {
        // Server-side auth: get current user from session cookie
        const c = await cookies();
        const rawSession = c.get('session')?.value;
        let userId: string | null = null;
        if (rawSession) {
            try {
                const parsed = JSON.parse(rawSession);
                userId = typeof parsed?.id === 'string' ? parsed.id : rawSession;
            } catch {
                userId = rawSession;
            }
        }
        if (!userId) {
            return { success: false, error: 'Not authenticated' };
        }

        // Fetch user and normalize permissions (fallback to role permissions when explicit missing)
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        const snap = await adb.collection('Users').doc(userId).get();
        const udata = snap.exists ? (snap.data() as any) : {};
        let permissions = udata?.permissions as any | undefined;
        if (!permissions && udata?.role) {
            const rolesSnap = await adb.collection('Roles').where('name', '==', String(udata.role)).get();
            if (!rolesSnap.empty) {
                const roleData = rolesSnap.docs[0].data() as any;
                const arr = Array.isArray(roleData?.permissions) ? roleData.permissions : [];
                const normalized: any = {};
                for (const item of arr) {
                    if (typeof item !== 'string') continue;
                    const [page, action] = item.split(':');
                    if (!page || !action) continue;
                    (normalized[page] ||= []).push(action);
                }
                permissions = Object.keys(normalized).length ? normalized : undefined;
            }
        }
        const canDelete = Array.isArray(permissions?.shipments) && permissions.shipments.includes('delete');
        if (!canDelete) {
            return { success: false, error: 'Access denied: delete permission required' };
        }

        await deleteShipment(id);
        revalidatePath("/dashboard/shipments");
        return { success: true, error: null };
    } catch (e: any) {
        console.error(e);
        return { success: false, error: e.message || "An unknown error occurred." };
    }
}


const dateRangeSchema = z.object({
    from: z.date(),
    to: z.date(),
});

function escapeCsvCell(cell: any): string {
    if (cell === null || cell === undefined) {
        return '';
    }
    const str = String(cell);
    // If the string contains a comma, double quote, or newline, wrap it in double quotes.
    if (/[",\r\n]/.test(str)) {
        // Within a double-quoted string, any double quote must be escaped by another double quote.
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}


function convertToCsv(shipments: SerializableShipment[]): string {
    if (shipments.length === 0) {
        return "";
    }
    const headers = [
        "Invoice", "Bill of Lading", "Source", "Containers", "Bahrain ETA", 
        "Actual Bahrain ETA", "Cleared", "Actual Cleared Date", "Total Cases",
        "DOM Lines", "Bulk Lines", "Total Lines", "General Remark"
    ];
    
    const rows = shipments.map(s => [
        s.invoice,
        s.billOfLading,
        s.source,
        s.containers.map(c => `${c.quantity}x${c.size}`).join('; '),
        s.bahrainEta ? format(new Date(s.bahrainEta), 'yyyy-MM-dd') : '',
        s.actualBahrainEta ? format(new Date(s.actualBahrainEta), 'yyyy-MM-dd') : '',
        s.cleared ? 'Yes' : 'No',
        s.actualClearedDate ? format(new Date(s.actualClearedDate), 'yyyy-MM-dd') : '',
        s.totalCases,
        s.domLines,
        s.bulkLines,
        s.totalLines,
        s.generalRemark,
    ]);

    const headerRow = headers.map(escapeCsvCell).join(',');
    const dataRows = rows.map(row => row.map(escapeCsvCell).join(','));

    return [headerRow, ...dataRows].join('\n');
}

export async function exportShipmentsAction(
    prevState: { csv?: string; error?: string },
    formData: FormData
): Promise<{ csv?: string; error?: string }> {
    try {
        const fromDate = formData.get('from');
        const toDate = formData.get('to');

        if (!fromDate || !toDate) {
            return { error: "Please select a valid date range." };
        }

        const validated = dateRangeSchema.safeParse({ from: new Date(fromDate as string), to: new Date(toDate as string) });

        if (!validated.success) {
            return { error: "Invalid date range provided." };
        }
        
        const shipments = await getShipmentsByDateRange(validated.data.from, validated.data.to);
        const csv = convertToCsv(shipments);
        
        return { csv };

    } catch (e: any) {
        console.error("Export error:", e);
        return { error: e.message || "Failed to export shipments." };
    }
}