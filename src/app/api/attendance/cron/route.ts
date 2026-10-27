import type { NextRequest } from "next/server";
import { CRON_JOBS, runCron, type CronJob } from "@/lib/attendance/cron";
import { badRequest, unauthorized } from "@/lib/attendance/errors";
import { attendanceDb, fail, ok } from "@/lib/attendance/http";
import { firebasePhotoStore } from "@/lib/attendance/photos";
import { safeEqual } from "@/lib/attendance/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled maintenance.
 * - Vercel Cron: `GET /api/attendance/cron?job=all` with `Authorization: Bearer $CRON_SECRET` (see vercel.json).
 * - Any other scheduler: `POST` with header `X-Cron-Secret: $ATTENDANCE_CRON_SECRET`.
 */
function authorised(request: NextRequest) {
  const provided =
    request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return [process.env.ATTENDANCE_CRON_SECRET, process.env.CRON_SECRET].some(
    (secret) => !!secret && secret.length >= 32 && safeEqual(provided, secret),
  );
}

async function handle(request: NextRequest) {
  try {
    if (!authorised(request)) throw unauthorized();
    const job = (request.nextUrl.searchParams.get("job") ?? "all") as CronJob;
    if (!CRON_JOBS.includes(job)) throw badRequest("Unknown job");
    const result = await runCron(await attendanceDb(), job, new Date(), firebasePhotoStore);
    return ok({ job, result });
  } catch (error) {
    return fail(error);
  }
}

export const GET = handle;
export const POST = handle;
