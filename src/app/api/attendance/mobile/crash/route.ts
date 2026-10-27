import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/attendance/errors";
import { attendanceDb, fail, limit, ok, readJson } from "@/lib/attendance/http";
import { COL } from "@/lib/attendance/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reportSchema = z.object({
  kind: z.string().max(32),
  where: z.string().max(128).optional(),
  details: z.string().max(20000),
  at: z.number().optional(),
  appVersion: z.string().max(32).optional(),
  device: z.string().max(128).optional(),
  os: z.string().max(64).optional(),
});

/** Public: the staff app sends crash reports here, even before anyone has logged in. */
export async function POST(request: NextRequest) {
  try {
    limit(request, "att-mobile-crash", 5);
    const parsed = reportSchema.safeParse(await readJson(request));
    if (!parsed.success) throw badRequest("Invalid crash report");
    const db = await attendanceDb();
    await db.collection(COL.crashReports).add({
      ...parsed.data,
      happenedAt: parsed.data.at ? new Date(parsed.data.at).toISOString() : null,
      receivedAt: new Date().toISOString(),
    });
    return ok({}, 201);
  } catch (error) {
    return fail(error);
  }
}
