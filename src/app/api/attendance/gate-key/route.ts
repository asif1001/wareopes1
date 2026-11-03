import type { NextRequest } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/attendance/audit";
import { badRequest, forbidden } from "@/lib/attendance/errors";
import { gateScreenKey } from "@/lib/attendance/gate";
import { attendanceDb, fail, ok, readJson, requireActor } from "@/lib/attendance/http";
import { COL } from "@/lib/attendance/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ site: z.string().min(1).max(128), regenerate: z.boolean().default(false) });

/**
 * Admin only: the gate screen link for a site. Anyone with the link can show that site's
 * check-in QR, so every view is audited and regenerating cancels the old link.
 */
async function gateLink(request: NextRequest, site: string, regenerate: boolean) {
  const actor = await requireActor("view");
  if (!actor.isAdmin) throw forbidden("Only an admin can open gate screen links");
  const db = await attendanceDb();
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
