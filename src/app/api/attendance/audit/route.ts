import type { NextRequest } from "next/server";
import { badRequest, forbidden } from "@/lib/attendance/errors";
import { attendanceDb, fail, ok, requireActor } from "@/lib/attendance/http";
import { COL } from "@/lib/attendance/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `?entityId=…` — audit history for one record (day, staff, overtime, month). Admins only. */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireActor("view");
    if (!actor.isAdmin) throw forbidden("Only admins can read the audit log");
    const entityId = request.nextUrl.searchParams.get("entityId");
    if (!entityId) throw badRequest("entityId is required");
    const db = await attendanceDb();
    const snap = await db.collection(COL.audit).where("entityId", "==", entityId).get();
    const items = snap.docs
      .map((d) => ({ ...(d.data() as { when: string }), id: d.id }))
      .sort((a, b) => b.when.localeCompare(a.when));
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}
