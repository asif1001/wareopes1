import type { NextRequest } from "next/server";
import { canManageStaff } from "@/lib/attendance/actor";
import { forbidden } from "@/lib/attendance/errors";
import { attendanceDb, fail, ok, readJson, requireActor } from "@/lib/attendance/http";
import { updateStaff } from "@/lib/attendance/setup";
import { getStaff, toStaffPublic } from "@/lib/attendance/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const actor = await requireActor("view");
    const staff = await getStaff(await attendanceDb(), id);
    if (!canManageStaff(actor, staff)) throw forbidden();
    return ok({ item: toStaffPublic(staff) });
  } catch (error) {
    return fail(error);
  }
}

/** Body: `{ action: "update" | "setPin" | "resetDevice" | "activate" | "deactivate", … }` */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readJson(request);
    const isDeactivate = (body as { action?: string } | null)?.action === "deactivate";
    const actor = await requireActor(isDeactivate ? "delete" : "edit");
    const item = await updateStaff(await attendanceDb(), actor, id, body, new Date());
    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}
