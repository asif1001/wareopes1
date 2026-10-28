import type { NextRequest } from "next/server";
import { attendanceDb, fail, limit, ok, readJson, requireStaff } from "@/lib/attendance/http";
import { cancelOwnRequest, createStaffRequest, listOwnRequests } from "@/lib/attendance/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The staff member's own correction / leave requests. */
export async function GET(request: NextRequest) {
  try {
    limit(request, "att-mobile-requests", 30);
    const db = await attendanceDb();
    const staff = await requireStaff(request, db, new Date());
    return ok({ items: await listOwnRequests(db, staff) });
  } catch (error) {
    return fail(error);
  }
}

/** Body: a new request, or `{ cancel: "<id>" }` to withdraw an open one. */
export async function POST(request: NextRequest) {
  try {
    limit(request, "att-mobile-requests-post", 10);
    const db = await attendanceDb();
    const now = new Date();
    const staff = await requireStaff(request, db, now);
    const body = await readJson(request);
    if (body && typeof body === "object" && typeof (body as { cancel?: unknown }).cancel === "string") {
      await cancelOwnRequest(db, staff, (body as { cancel: string }).cancel, now);
      return ok();
    }
    return ok({ item: await createStaffRequest(db, staff, body, now) }, 201);
  } catch (error) {
    return fail(error);
  }
}
