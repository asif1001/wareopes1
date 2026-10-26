import type { NextRequest } from "next/server";
import { CRON_JOBS, runCron, type CronJob } from "@/lib/attendance/cron";
import { badRequest, unauthorized } from "@/lib/attendance/errors";
import { attendanceDb, fail, ok } from "@/lib/attendance/http";
import { firebasePhotoStore } from "@/lib/attendance/photos";
import { safeEqual } from "@/lib/attendance/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called by Google Cloud Scheduler every 15 minutes:
 * `POST /api/attendance/cron?job=all` with header `X-Cron-Secret: $ATTENDANCE_CRON_SECRET`.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.ATTENDANCE_CRON_SECRET;
    const provided = request.headers.get("x-cron-secret") ?? "";
    if (!secret || secret.length < 32 || !safeEqual(provided, secret)) throw unauthorized();
    const job = (request.nextUrl.searchParams.get("job") ?? "all") as CronJob;
    if (!CRON_JOBS.includes(job)) throw badRequest("Unknown job");
    const result = await runCron(await attendanceDb(), job, new Date(), firebasePhotoStore);
    return ok({ job, result });
  } catch (error) {
    return fail(error);
  }
}
