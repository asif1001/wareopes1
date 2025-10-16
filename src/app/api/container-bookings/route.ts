import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateShipmentBookings } from "@/lib/firebase/firestore";

const bookingSchema = z.object({
    containerNo: z.string().min(1, "Container No is required"),
    bookingDate: z.string().min(1, "Booking Date is required").transform(str => new Date(str)),
});

const containerBookingsSchema = z.object({
    shipmentId: z.string().min(1, "Shipment ID is required"),
    bookings: z.string().transform(val => JSON.parse(val) as any[]).pipe(z.array(bookingSchema)),
});

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const rawData = Object.fromEntries(formData.entries());

        const validated = containerBookingsSchema.safeParse(rawData);

        if (!validated.success) {
            console.error("Validation failed:", validated.error.flatten());
            const firstError = Object.values(validated.error.flatten().fieldErrors)[0]?.[0];
            return NextResponse.json({ success: false, error: firstError || "Invalid booking data." }, { status: 400 });
        }

        const { shipmentId, bookings } = validated.data;

        await updateShipmentBookings(shipmentId, bookings);

        revalidatePath("/dashboard/shipments");

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error saving container bookings:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ success: false, error: `Failed to save container bookings: ${errorMessage}` }, { status: 500 });
    }
}