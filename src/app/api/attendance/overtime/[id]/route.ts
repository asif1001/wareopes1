import type { NextRequest } from "next/server";
import { attendanceDb, fail, ok, readJson, requireActor } from "@/lib/attendance/http";
import { decideOvertime } from "@/lib/attendance/overtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Body: `{ action: "APPROVE" | "REJECT" | "EDIT", minutes?, note }` */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const actor = await requireActor("approve");
    const item = await decideOvertime(await attendanceDb(), actor, id, await readJson(request), new Date());
    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}
