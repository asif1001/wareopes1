import type { NextRequest } from "next/server";
import { attendanceDb, fail, ok, readJson, requireActor } from "@/lib/attendance/http";
import { decideRequest } from "@/lib/attendance/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Body: `{ decision: "APPROVE" | "REJECT", note?, time? }` */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const actor = await requireActor("approve");
    const item = await decideRequest(await attendanceDb(), actor, id, await readJson(request), new Date());
    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}
