import { cached } from "@/lib/attendance/cache";
import { attendanceDb, fail, ok, requireActor } from "@/lib/attendance/http";

/** WareOps users change outside Attendance, so the copy is simply refreshed every 5 minutes. */
const USERS_MAX_AGE_MS = 5 * 60 * 1000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** WareOps users who can be picked as supervisor / backup approver. Only safe fields are returned. */
export async function GET() {
  try {
    await requireActor("view");
    const db = await attendanceDb();
    const items = await cached(
      db,
      "users",
      async () => {
        const snap = await db.collection("Users").get();
        return snap.docs
          .map((d) => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              name: String(data.fullName || data.name || data.employeeNo || d.id),
              employeeNo: data.employeeNo != null ? String(data.employeeNo) : "",
              role: typeof data.role === "string" ? data.role : "",
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
      },
      USERS_MAX_AGE_MS,
    );
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}
