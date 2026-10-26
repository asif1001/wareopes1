import type { NextRequest } from "next/server";
import { notFound } from "@/lib/attendance/errors";
import { attendanceDb, fail, ok, readJson, requireActor } from "@/lib/attendance/http";
import { createSetup, isSetupEntity, listSetup } from "@/lib/attendance/setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ entity: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { entity } = await params;
    if (!isSetupEntity(entity)) throw notFound();
    await requireActor("view");
    return ok({ items: await listSetup(await attendanceDb(), entity) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { entity } = await params;
    if (!isSetupEntity(entity)) throw notFound();
    const actor = await requireActor("add");
    const item = await createSetup(await attendanceDb(), actor, entity, await readJson(request), new Date());
    return ok({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}
