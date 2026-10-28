import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/attendance/actor";
import { DEFAULT_RULES } from "@/lib/attendance/config";
import { pendingCount } from "@/lib/attendance/exceptions";
import { reportDeviceHealth, deviceIssues } from "@/lib/attendance/health";
import { ingestEvents } from "@/lib/attendance/ingest";
import { authenticateStaff, loginStaff } from "@/lib/attendance/mobile-auth";
import { dueReminder, saveSubscription, sendDueReminders } from "@/lib/attendance/push";
import { cancelOwnRequest, createStaffRequest, decideRequest, listOwnRequests } from "@/lib/attendance/requests";
import { createSetup, createStaff, updateStaff } from "@/lib/attendance/setup";
import { COL, getRules, getShift, getStaff } from "@/lib/attendance/store";
import { zonedToUtc } from "@/lib/attendance/time";
import type { AttendanceDay, Staff } from "@/lib/attendance/types";
import { FakeFirestore } from "./helpers/fake-firestore";

const at = (date: string, time: string) => zonedToUtc(date, time, "Asia/Bahrain");
const admin: Actor = { userId: "admin1", role: "Admin", isAdmin: true };
const sup1: Actor = { userId: "sup1", role: "Supervisor", isAdmin: false };
const sup2: Actor = { userId: "sup2", role: "Supervisor", isAdmin: false };

let db: ReturnType<FakeFirestore["asFirestore"]>;
let staff: Staff;
let shiftId: string;

beforeAll(() => {
  process.env.ATTENDANCE_TOKEN_SECRET = "test-secret-test-secret-test-secret-123";
});

beforeEach(async () => {
  db = new FakeFirestore().asFirestore();
  for (const id of ["sup1", "sup2", "admin1"]) await db.collection("Users").doc(id).set({ fullName: id });
  const now = at("2026-10-01", "00:00");
  const contractorId = (await createSetup(db, admin, "contractors", { name: "Acme" }, now)).id;
  shiftId = (await createSetup(db, admin, "shifts", { name: "Day", startTime: "07:00", endTime: "16:00" }, now)).id;
  const fence = (await createSetup(db, admin, "geofences", { name: "Tubli", lat: 26.19209, lng: 50.53752, radiusM: 200 }, now)).id;
  const created = await createStaff(
    db,
    admin,
    { cprNo: "900000001", name: "Ali", contractorId, supervisorId: "sup1", shiftId, geofenceIds: [fence], password: "1234" },
    now,
  );
  staff = await getStaff(db, created.id);
});

describe("iPhone (web) login", () => {
  it("is refused until 'Allow iPhone check-in' is on, then works and is marked as web", async () => {
    const now = at("2026-10-27", "06:50");
    const body = { cprNo: "900000001", password: "1234", deviceId: "web-device-123456", client: "web" };
    await expect(loginStaff(db, body, now)).rejects.toMatchObject({ code: "WEB_NOT_ALLOWED" });
    await updateStaff(db, admin, staff.id, { action: "update", changes: { webCheckin: true } }, now);
    const { tokens } = await loginStaff(db, body, now);
    const authed = await authenticateStaff(db, `Bearer ${tokens.accessToken}`, "web-device-123456", now);
    expect(authed.client).toBe("web");

    const health = await reportDeviceHealth(
      db,
      authed,
      { locationPermission: "WHILE_IN_USE", gpsEnabled: true, batteryOptimised: true, notificationsEnabled: true, mockLocationDetected: false, rooted: false, appVersion: "1.1.0" },
      now,
    );
    expect(health.platform).toBe("web");
    expect(deviceIssues(health, await getRules(db), now)).toEqual([]);

    // Turning the switch off ends the iPhone session.
    await updateStaff(db, admin, staff.id, { action: "update", changes: { webCheckin: false } }, now);
    await expect(authenticateStaff(db, `Bearer ${tokens.accessToken}`, "web-device-123456", now)).rejects.toMatchObject({ code: "WEB_NOT_ALLOWED" });
  });

  it("Android login is unaffected by the switch", async () => {
    const now = at("2026-10-27", "06:50");
    const { tokens } = await loginStaff(db, { cprNo: "900000001", password: "1234", deviceId: "android-device-1" }, now);
    expect((await authenticateStaff(db, `Bearer ${tokens.accessToken}`, "android-device-1", now)).client).toBe("android");
  });

  it("a web tap-in counts as the day's IN", async () => {
    const now = at("2026-10-27", "06:58");
    await ingestEvents(
      db,
      staff,
      {
        sentAt: now.toISOString(),
        events: [{ clientEventId: "web-in-0000001", type: "IN", source: "MANUAL", trigger: "USER_TAP", deviceTime: now.toISOString(), lat: 26.19209, lng: 50.53752, accuracyM: 20, mockLocation: false }],
      },
      now,
    );
    const day = (await db.collection(COL.days).doc(`${staff.id}_2026-10-27`).get()).data() as AttendanceDay;
    expect(day.firstIn).toBe(now.toISOString());
    expect(day.status).toBe("PENDING");
  });
});

describe("staff requests", () => {
  it("time correction: staff sends, supervisor approves with the time, the day is corrected", async () => {
    const now = at("2026-10-28", "08:00");
    // Yesterday: IN recorded, OUT missing.
    const inAt = at("2026-10-27", "06:55");
    await ingestEvents(
      db,
      staff,
      {
        sentAt: inAt.toISOString(),
        events: [{ clientEventId: "auto-in-000001", type: "IN", source: "AUTO", trigger: "SCHEDULED", deviceTime: inAt.toISOString(), lat: 26.19209, lng: 50.53752, accuracyM: 10, mockLocation: false }],
      },
      inAt,
    );
    const request = await createStaffRequest(db, staff, { type: "CORRECTION", date: "2026-10-27", correctionKind: "MISSING_OUT", time: "16:05", reason: "Phone battery died" }, now);
    expect(request.status).toBe("PENDING");
    await expect(
      createStaffRequest(db, staff, { type: "CORRECTION", date: "2026-10-27", correctionKind: "MISSING_OUT", reason: "again" }, now),
    ).rejects.toMatchObject({ status: 409 });
    expect(await pendingCount(db, sup1)).toBe(1);

    await expect(decideRequest(db, sup2, request.id, { decision: "APPROVE" }, now)).rejects.toMatchObject({ status: 403 });
    const decided = await decideRequest(db, sup1, request.id, { decision: "APPROVE", time: "16:00" }, now);
    expect(decided.status).toBe("APPROVED");
    expect(decided.correctionId).toBeTruthy();

    const day = (await db.collection(COL.days).doc(`${staff.id}_2026-10-27`).get()).data() as AttendanceDay;
    expect(day.lastOut).toBe(at("2026-10-27", "16:00").toISOString());
    expect(day.status).toBe("PRESENT");
    expect(await pendingCount(db, sup1)).toBe(0);
    await expect(decideRequest(db, sup1, request.id, { decision: "REJECT", note: "x" }, now)).rejects.toMatchObject({ status: 409 });
  });

  it("leave: approval marks past and future days as leave", async () => {
    const now = at("2026-10-28", "08:00");
    const request = await createStaffRequest(db, staff, { type: "LEAVE", date: "2026-10-27", endDate: "2026-10-29", leaveType: "SICK", reason: "Fever" }, now);
    await decideRequest(db, sup1, request.id, { decision: "APPROVE" }, now);
    const past = (await db.collection(COL.days).doc(`${staff.id}_2026-10-27`).get()).data() as AttendanceDay;
    expect(past.status).toBe("LEAVE");
    const { recomputeDay } = await import("@/lib/attendance/days");
    const future = await recomputeDay(db, staff, "2026-10-29", at("2026-10-29", "17:00"));
    expect(future?.status).toBe("LEAVE");
  });

  it("reject needs a note; staff can withdraw pending requests and see their list", async () => {
    const now = at("2026-10-28", "08:00");
    const a = await createStaffRequest(db, staff, { type: "LEAVE", date: "2026-11-02", leaveType: "ANNUAL", reason: "Family trip" }, now);
    await expect(decideRequest(db, sup1, a.id, { decision: "REJECT" }, now)).rejects.toMatchObject({ status: 400 });
    await decideRequest(db, sup1, a.id, { decision: "REJECT", note: "Busy week" }, now);
    const b = await createStaffRequest(db, staff, { type: "CORRECTION", date: "2026-10-27", correctionKind: "MISSING_IN", reason: "Forgot" }, now);
    await cancelOwnRequest(db, staff, b.id, now);
    const mine = await listOwnRequests(db, staff);
    expect(mine.map((r) => r.status).sort()).toEqual(["CANCELLED", "REJECTED"]);
  });

  it("refuses future corrections and very long leave", async () => {
    const now = at("2026-10-28", "08:00");
    await expect(createStaffRequest(db, staff, { type: "CORRECTION", date: "2026-10-29", correctionKind: "MISSING_IN", reason: "x y z" }, now)).rejects.toMatchObject({ status: 400 });
    await expect(createStaffRequest(db, staff, { type: "LEAVE", date: "2026-11-01", endDate: "2026-12-15", leaveType: "ANNUAL", reason: "Long trip" }, now)).rejects.toMatchObject({ status: 400 });
  });
});

describe("iPhone reminders", () => {
  it("check-in reminder in the IN window, check-out reminder in the OUT window, once each", async () => {
    const rules = await getRules(db);
    const shift = await getShift(db, shiftId);
    expect(dueReminder(shift, rules, "2026-10-27", null, at("2026-10-27", "06:40"), {})).toBeNull();
    expect(dueReminder(shift, rules, "2026-10-27", null, at("2026-10-27", "06:50"), {})?.kind).toBe("in");
    expect(dueReminder(shift, rules, "2026-10-27", null, at("2026-10-27", "06:50"), { in: "x" })).toBeNull();
    const inDay = { firstIn: "2026-10-27T03:55:00.000Z", lastOut: null, status: "PENDING" } as unknown as AttendanceDay;
    expect(dueReminder(shift, rules, "2026-10-27", inDay, at("2026-10-27", "12:00"), {})).toBeNull();
    expect(dueReminder(shift, rules, "2026-10-27", inDay, at("2026-10-27", "15:50"), {})?.kind).toBe("out");
  });

  it("sends only to iPhone-enabled staff with a subscription", async () => {
    const now = at("2026-10-27", "06:50");
    await saveSubscription(db, staff, { subscription: { endpoint: "https://push.example/abc", keys: { p256dh: "p256dh-key-123", auth: "auth-1" } } }, now);
    const sent: string[] = [];
    const sender = async (_s: unknown, payload: string) => {
      sent.push(JSON.parse(payload).title);
    };
    expect((await sendDueReminders(db, { ...DEFAULT_RULES, ...(await getRules(db)) }, now, sender)).sent).toBe(0);
    await updateStaff(db, admin, staff.id, { action: "update", changes: { webCheckin: true } }, now);
    expect((await sendDueReminders(db, await getRules(db), now, sender)).sent).toBe(1);
    expect((await sendDueReminders(db, await getRules(db), now, sender)).sent).toBe(0);
    expect(sent).toEqual(["Time to check in"]);
  });
});
