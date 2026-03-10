import { NextResponse } from "next/server";
import { getShipmentsByDateRange } from "@/lib/firebase/firestore";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fromStr = url.searchParams.get("from");
    const toStr = url.searchParams.get("to");
    if (!fromStr || !toStr) {
      return NextResponse.json({ error: "Missing 'from' or 'to' query params (YYYY-MM-DD)" }, { status: 400 });
    }

    const fromDate = new Date(fromStr + "T00:00:00");
    const toDate = new Date(toStr + "T23:59:59");

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format; expected YYYY-MM-DD" }, { status: 400 });
    }

    const shipments = await getShipmentsByDateRange(fromDate, toDate);
    return NextResponse.json({ items: shipments }, { status: 200 });
  } catch (e: any) {
    const message = e?.message || "Failed to fetch shipments by date range";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}