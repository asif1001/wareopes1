import { NextResponse, type NextRequest } from "next/server";
import { attendanceDb, fail, requireActor } from "@/lib/attendance/http";
import { firebasePhotoStore, readPhoto } from "@/lib/attendance/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Streams a selfie to supervisors/admins of that staff member; never a public URL. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const actor = await requireActor("view");
    const { bytes, contentType } = await readPhoto(await attendanceDb(), await firebasePhotoStore(), actor, id);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "Content-Type": contentType, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return fail(error);
  }
}
