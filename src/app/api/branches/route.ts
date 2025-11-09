import { NextResponse } from "next/server";
import { getBranches } from "@/lib/firebase/firestore";

export async function GET() {
  try {
    const branches = await getBranches();
    return NextResponse.json({ items: branches }, { status: 200 });
  } catch (e: any) {
    const message = e?.message || "Failed to fetch branches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}