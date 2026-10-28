import type { NextRequest } from "next/server";
import { attendanceDb, fail, ok, requireActor } from "@/lib/attendance/http";
import { listRequests, type RequestStatus } from "@/lib/attendance/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `?status=PENDING|APPROVED|REJECTED|CANCELLED|ALL` (default PENDING) */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireActor("view");
    const status = (request.nextUrl.searchParams.get("status") ?? "PENDING") as RequestStatus | "ALL";
    return ok({ items: await listRequests(await attendanceDb(), actor, { status }) });
  } catch (error) {
    return fail(error);
  }
}
