import type { NextRequest } from "next/server";
import { z } from "zod";
import type { Actor } from "@/lib/attendance/actor";
import { writeAudit } from "@/lib/attendance/audit";
import { badRequest, forbidden } from "@/lib/attendance/errors";
import { gateScreenKey } from "@/lib/attendance/gate";
import { attendanceDb, fail, ok, readJson, requireActor } from "@/lib/attendance/http";
import { COL, type Db } from "@/lib/attendance/store";
import type { Staff } from "@/lib/attendance/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ site: z.string().min(1).max(128), regenerate: z.boolean().default(false) });

/** Admins, users with Attendance edit permission, and the supervisors of active staff assigned to the site. */
async function mayOpenGate(db: Db, actor: Actor, site: string) {
  if (actor.isAdmin) return true;
  const { getCurrentUserPermissions, hasPermission } = await import("@/lib/server-permissions");
  if (hasPermission((await getCurrentUserPermissions()).permissions, "attendance", "edit")) return true;
  const [first, second] = await Promise.all([
    db.collection(COL.staff).where("supervisorId", "==", actor.userId).get(),
    db.collection(COL.staff).where("supervisor2Id", "==", actor.userId).get(),
  ]);
  return [...first.docs, ...second.docs].some((d) => {
    const s = d.data() as Staff;
    return s.active && !s.deleted && s.geofenceIds?.includes(site);
  });
}

/**
 * The gate screen / station link for a site. Anyone with the link can show that site's
 * check-in QR and record staff QR scans, so every view is audited and a new link cancels the old one.
 */
async function gateLink(request: NextRequest, site: string, regenerate: boolean) {
  const actor = await requireActor("view");
  const db = await attendanceDb();
  if (!(await mayOpenGate(db, actor, site))) throw forbidden("Only admins and the supervisors of this site's staff can open its gate screen");
  const { key, siteName } = await gateScreenKey(db, site, regenerate);
  await writeAudit(
    db,
    { who: actor.userId, what: regenerate ? "GATE_LINK_REGENERATED" : "GATE_LINK_VIEWED", entity: COL.geofences, entityId: site, before: null, after: null },
    new Date(),
  );
  const url = `${request.nextUrl.origin}/gate?site=${encodeURIComponent(site)}&key=${encodeURIComponent(key)}`;
  return ok({ siteName, url });
}

export async function GET(request: NextRequest) {
  try {
    const site = request.nextUrl.searchParams.get("site");
    if (!site) throw badRequest("Site is required");
    return await gateLink(request, site, false);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid data");
    return await gateLink(request, parsed.data.site, parsed.data.regenerate);
  } catch (error) {
    return fail(error);
  }
}
