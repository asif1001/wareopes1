import type { NextRequest } from "next/server";
import { attendanceDb, fail, limit, ok, readJson } from "@/lib/attendance/http";
import { loginStaff } from "@/lib/attendance/mobile-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    limit(request, "att-mobile-login", 10);
    const db = await attendanceDb();
    const { staff, tokens } = await loginStaff(db, await readJson(request), new Date());
    return ok({ ...tokens, staff: { id: staff.id, staffCode: staff.staffCode, name: staff.name } });
  } catch (error) {
    return fail(error);
  }
}
