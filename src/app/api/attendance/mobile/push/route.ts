import type { NextRequest } from "next/server";
import { attendanceDb, fail, limit, ok, readJson, requireStaff } from "@/lib/attendance/http";
import { pushKeys, removeSubscription, saveSubscription } from "@/lib/attendance/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public key the iPhone page needs to subscribe to reminders (empty when reminders are not set up). */
export async function GET() {
  return ok({ publicKey: pushKeys()?.publicKey ?? "" });
}

/** Body: `{ subscription }` to turn reminders on, `{ unsubscribe: endpoint }` to turn them off. */
export async function POST(request: NextRequest) {
  try {
    limit(request, "att-mobile-push", 10);
    const db = await attendanceDb();
    const now = new Date();
    const staff = await requireStaff(request, db, now);
    const body = (await readJson(request)) as { unsubscribe?: unknown } | null;
    if (typeof body?.unsubscribe === "string") await removeSubscription(db, staff, body.unsubscribe);
    else await saveSubscription(db, staff, body, now);
    return ok();
  } catch (error) {
    return fail(error);
  }
}
