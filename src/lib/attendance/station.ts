import { z } from "zod";
import { badRequest } from "./errors";
import { assertSiteKey, parseBadgeCode, verifyBadge } from "./gate";
import { ingestEvents } from "./ingest";
import { attendanceDateFor } from "./rules";
import { COL, dayId, getRules, getShift, type Db } from "./store";
import type { AttendanceDay, Geofence, Staff } from "./types";

/**
 * Gate station: a PC or tablet at the site gate reads the staff member's own QR ("My QR"
 * in the app) with a USB/Bluetooth scanner or its camera. The first scan of the day is IN,
 * later scans are OUT (the last OUT counts). Scans made while the station was offline are
 * sent later with their scan time.
 */
export const stationBatchSchema = z.object({
  site: z.string().min(1).max(128),
  key: z.string().min(1).max(200),
  /** Station clock when the batch was sent; corrects a wrong station clock. */
  sentAt: z.string().datetime({ offset: true }),
  scans: z
    .array(z.object({ code: z.string().trim().min(1).max(300), scannedAt: z.string().datetime({ offset: true }) }))
    .min(1)
    .max(50),
});

export type StationResult = {
  status: "ACCEPTED" | "DUPLICATE" | "REJECTED";
  type?: "IN" | "OUT";
  at?: string;
  staff?: { name: string; staffCode: string; company: string };
  message: string;
};

/** A second scan this soon after the last IN / OUT is ignored (staff scanning twice). */
export const STATION_REPEAT_MS = 2 * 60 * 1000;
/** Offline scans older than this are refused. */
const MAX_SCAN_AGE_MS = 7 * 24 * 3600 * 1000;

export async function recordStationScans(db: Db, body: unknown, now: Date): Promise<StationResult[]> {
  const parsed = stationBatchSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid scan");
  const { site: siteId, key, sentAt, scans } = parsed.data;
  const site = await assertSiteKey(db, siteId, key);
  const driftMs = now.getTime() - Date.parse(sentAt);
  const results: StationResult[] = [];
  for (const scan of scans) {
    const at = new Date(Math.min(now.getTime(), Date.parse(scan.scannedAt) + driftMs));
    results.push(await recordOne(db, site, scan.code, at, now));
  }
  return results;
}

const time = (at: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);

async function recordOne(db: Db, site: Geofence, code: string, at: Date, now: Date): Promise<StationResult> {
  const badge = parseBadgeCode(code);
  if (!badge) return { status: "REJECTED", message: "This is not an EKK staff QR code." };
  if (now.getTime() - at.getTime() > MAX_SCAN_AGE_MS) return { status: "REJECTED", message: "This scan is too old to record." };

  const snap = await db.collection(COL.staff).doc(badge.staffId).get();
  if (!snap.exists) return { status: "REJECTED", message: "Unknown staff QR code." };
  const staff = { ...(snap.data() as Staff), id: snap.id };
  const company = await companyName(db, staff.contractorId);
  const who = { name: staff.name, staffCode: staff.staffCode, company };
  const refuse = (message: string): StationResult => ({ status: "REJECTED", staff: who, message });

  if (!staff.active || staff.deleted) return refuse("This account is not active. Please see your supervisor.");
  const check = verifyBadge(staff, badge, at);
  if (check === "SIGNATURE") return refuse("This QR code is not valid any more. Sign in to the app again and open My QR.");
  if (check === "EXPIRED") return refuse("This QR code has expired. Check the phone's date and time, then show My QR again.");
  if (!staff.geofenceIds.includes(site.id)) return refuse(`${staff.name} is not assigned to ${site.name}.`);

  const [rules, shift] = await Promise.all([getRules(db), getShift(db, staff.shiftId)]);
  const date = attendanceDateFor(at, shift, rules);
  const daySnap = await db.collection(COL.days).doc(dayId(staff.id, date)).get();
  const day = daySnap.exists ? (daySnap.data() as AttendanceDay) : null;
  const last = [day?.firstIn, day?.lastOut]
    .filter((t): t is string => !!t)
    .map(Date.parse)
    .sort((a, b) => b - a)[0];
  if (last != null && Math.abs(at.getTime() - last) < STATION_REPEAT_MS) {
    const lastType = day?.lastOut && Date.parse(day.lastOut) === last ? "OUT" : "IN";
    return { status: "DUPLICATE", type: lastType, at: new Date(last).toISOString(), staff: who, message: `Already recorded at ${time(new Date(last), rules.timezone)}.` };
  }

  const type = day?.firstIn ? "OUT" : "IN";
  const [result] = await ingestEvents(
    db,
    staff,
    {
      sentAt: now.toISOString(),
      events: [
        {
          clientEventId: `st_${badge.slot}_${staff.id}`.slice(0, 64),
          type,
          source: "STATION",
          trigger: "STATION_SCAN",
          deviceTime: at.toISOString(),
          lat: null,
          lng: null,
          accuracyM: null,
          mockLocation: false,
          rooted: false,
          photoRef: null,
        },
      ],
    },
    now,
    { stationSiteId: site.id },
  );
  if (result.status === "REJECTED") return refuse(result.message ?? "Not recorded.");
  if (result.status === "DUPLICATE") return { status: "DUPLICATE", type, at: at.toISOString(), staff: who, message: "Already recorded." };
  return {
    status: "ACCEPTED",
    type,
    at: at.toISOString(),
    staff: who,
    message: `${type === "IN" ? "Checked in" : "Checked out"} at ${time(at, rules.timezone)}`,
  };
}

async function companyName(db: Db, contractorId: string) {
  if (!contractorId) return "";
  const snap = await db.collection(COL.contractors).doc(contractorId).get();
  return snap.exists ? String(snap.get("name") ?? "") : "";
}
