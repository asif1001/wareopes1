import { attendanceDb, fail, ok, requireActor } from "@/lib/attendance/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** WareOps users who can be picked as supervisor / backup approver. Only safe fields are returned. */
export async function GET() {
  try {
    await requireActor("view");
    const db = await attendanceDb();
    const snap = await db.collection("Users").get();
    const items = snap.docs
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
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}
