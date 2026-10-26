import type { NextRequest } from "next/server";
import { notFound } from "@/lib/attendance/errors";
import { attendanceDb, fail, ok, readJson, requireActor } from "@/lib/attendance/http";
import { isSetupEntity, removeSetup, updateSetup } from "@/lib/attendance/setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ entity: string; id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { entity, id } = await params;
    if (!isSetupEntity(entity)) throw notFound();
    const actor = await requireActor("edit");
    const item = await updateSetup(await attendanceDb(), actor, entity, id, await readJson(request), new Date());
    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { entity, id } = await params;
    if (!isSetupEntity(entity)) throw notFound();
    const actor = await requireActor("delete");
    await removeSetup(await attendanceDb(), actor, entity, id, new Date());
    return ok();
  } catch (error) {
    return fail(error);
  }
}
