import type { NextRequest } from "next/server";
import { attendanceDb, fail, ok, readJson, requireActor } from "@/lib/attendance/http";
import { compareContractorSheet } from "@/lib/attendance/reports-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Body: `{ month, contractorId?, rows: [{ staffCode, date, status?, hours?, otHours? }] }`.
 * The supervisor UI parses the contractor's CSV/Excel file into rows first.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireActor("view");
    const result = await compareContractorSheet(await attendanceDb(), actor, await readJson(request), new Date());
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
