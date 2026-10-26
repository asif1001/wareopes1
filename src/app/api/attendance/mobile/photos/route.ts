import type { NextRequest } from "next/server";
import { MAX_PHOTO_BYTES } from "@/lib/attendance/config";
import { badRequest } from "@/lib/attendance/errors";
import { attendanceDb, fail, limit, ok, requireStaff } from "@/lib/attendance/http";
import { firebasePhotoStore, savePhoto } from "@/lib/attendance/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** multipart/form-data: `photoId` (phone-generated id) + `file` (JPEG/PNG). */
export async function POST(request: NextRequest) {
  try {
    limit(request, "att-mobile-photos", 30);
    const db = await attendanceDb();
    const now = new Date();
    const staff = await requireStaff(request, db, now);
    const length = Number(request.headers.get("content-length") || 0);
    if (length > MAX_PHOTO_BYTES + 64 * 1024) throw badRequest("Photo is too large");
    const form = await request.formData();
    const photoId = String(form.get("photoId") ?? "");
    const file = form.get("file");
    if (!(file instanceof Blob)) throw badRequest("Photo file is required");
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await savePhoto(db, await firebasePhotoStore(), staff, photoId, bytes, now);
    return ok(result, result.duplicate ? 200 : 201);
  } catch (error) {
    return fail(error);
  }
}
