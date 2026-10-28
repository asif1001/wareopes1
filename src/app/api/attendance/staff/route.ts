import type { NextRequest } from "next/server";
import { scopeStaff } from "@/lib/attendance/actor";
import { deviceIssues, siteIssuesByStaff } from "@/lib/attendance/health";
import { attendanceDb, fail, ok, readJson, requireActor } from "@/lib/attendance/http";
import { createStaff } from "@/lib/attendance/setup";
import { COL, getRules, listStaff, toStaffPublic } from "@/lib/attendance/store";
import type { DeviceHealth } from "@/lib/attendance/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireActor("view");
    const db = await attendanceDb();
    const now = new Date();
    const [staff, healthSnap, rules] = await Promise.all([
      listStaff(db),
      db.collection(COL.deviceHealth).get(),
      getRules(db),
    ]);
    const health = new Map(healthSnap.docs.map((d) => [d.id, d.data() as Partial<DeviceHealth>]));
    const scoped = scopeStaff(actor, staff);
    const siteIssues = await siteIssuesByStaff(db, scoped, now);
    const items = scoped.map((s) => {
      const h = health.get(s.id) ?? null;
      const issues = s.active ? [...(siteIssues.get(s.id) ?? []), ...deviceIssues(h, rules, now)] : [];
      return { ...toStaffPublic(s), deviceHealth: h, deviceIssues: issues };
    });
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireActor("add");
    const item = await createStaff(await attendanceDb(), actor, await readJson(request), new Date());
    return ok({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}
