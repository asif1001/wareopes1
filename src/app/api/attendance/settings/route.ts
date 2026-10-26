import type { NextRequest } from "next/server";
import { attendanceDb, fail, ok, readJson, requireActor } from "@/lib/attendance/http";
import { getSettings, updateSettings } from "@/lib/attendance/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireActor("view");
    return ok(await getSettings(await attendanceDb()));
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await requireActor("edit");
    const rules = await updateSettings(await attendanceDb(), actor, await readJson(request), new Date());
    return ok({ rules });
  } catch (error) {
    return fail(error);
  }
}
