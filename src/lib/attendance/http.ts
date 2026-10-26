import { NextResponse, type NextRequest } from "next/server";
import type { PermissionAction } from "@/lib/types";
import type { Actor } from "./actor";
import { AttendanceError, forbidden, tooMany, unauthorized } from "./errors";
import { authenticateStaff } from "./mobile-auth";
import { rateLimit } from "./rate-limit";
import { getRules, type Db } from "./store";

export async function attendanceDb(): Promise<Db> {
  const { getAdminDb } = await import("@/lib/firebase/admin");
  return getAdminDb();
}

export function ok(data: Record<string, unknown> = {}, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(error: unknown) {
  if (error instanceof AttendanceError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  console.error("Attendance API error:", error);
  return NextResponse.json({ success: false, error: "Server error", code: "SERVER_ERROR" }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * WareOps user with the given permission on the `attendance` page. Admins always
 * pass; report viewers (Attendance settings) pass for "view" only.
 */
export async function requireActor(action: PermissionAction): Promise<Actor> {
  const { getCurrentUserPermissions, hasPermission, isAdmin } = await import("@/lib/server-permissions");
  const { ok: signedIn, userId, role, permissions } = await getCurrentUserPermissions();
  if (!signedIn || !userId) throw unauthorized();
  const admin = isAdmin(role);
  const rules = await getRules(await attendanceDb());
  const reportViewer = rules.reportViewerIds.includes(userId);
  const allowed = admin || hasPermission(permissions, "attendance", action) || (action === "view" && reportViewer);
  if (!allowed) throw forbidden();
  return { userId, role: role ?? "", isAdmin: admin, reportViewer };
}

export function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function limit(request: NextRequest, name: string, max: number, windowMs = 60000) {
  if (!rateLimit(`${name}:${clientIp(request)}`, max, windowMs)) {
    throw tooMany("Too many requests. Please wait a moment.");
  }
}

/** Phone request: `Authorization: Bearer …` and `X-Device-Id`. */
export async function requireStaff(request: NextRequest, db: Db, now: Date) {
  return authenticateStaff(db, request.headers.get("authorization"), request.headers.get("x-device-id"), now);
}
