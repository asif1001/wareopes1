import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { currentGateCode } from "@/lib/attendance/gate";
import { attendanceDb, fail, ok } from "@/lib/attendance/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gate screen feed (no login — the link carries the site's display key).
 * Returns the current rotating code as a QR (SVG) that opens the staff check-in page.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const now = new Date();
    const gate = await currentGateCode(await attendanceDb(), params.get("site") ?? "", params.get("key") ?? "", now);
    const url = `${request.nextUrl.origin}/checkin/?gate=${encodeURIComponent(gate.code)}`;
    const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    const response = ok({ siteName: gate.siteName, url, svg, expiresAt: gate.expiresAt.toISOString(), serverTime: now.toISOString() });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return fail(error);
  }
}
