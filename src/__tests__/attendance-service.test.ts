import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/attendance/actor";
import { addCorrection } from "@/lib/attendance/corrections";
import { ingestEvents } from "@/lib/attendance/ingest";
import { getMonthLockState, lockMonth, unlockMonth } from "@/lib/attendance/locks";
import { authenticateStaff, loginStaff, refreshStaffSession } from "@/lib/attendance/mobile-auth";
import { autoCloseOvertime, decideOvertime, markOvertimeReminders } from "@/lib/attendance/overtime";
import { createSetup, createStaff, updateStaff } from "@/lib/attendance/setup";
import { COL, getRules, getStaff } from "@/lib/attendance/store";
import { zonedToUtc } from "@/lib/attendance/time";
import type { AttendanceDay, AttendanceEvent, OvertimeRequest, Staff } from "@/lib/attendance/types";
import { FakeFirestore } from "./helpers/fake-firestore";

const TZ = "Asia/Bahrain";
const at = (date: string, time: string) => zonedToUtc(date, time, TZ);
const MONDAY = "2026-11-02";
const FRIDAY = "2026-11-06";

const admin: Actor = { userId: "admin1", role: "Admin", isAdmin: true };
const supervisor: Actor = { userId: "sup1", role: "Supervisor", isAdmin: false };
const otherSupervisor: Actor = { userId: "sup2", role: "Supervisor", isAdmin: false };

const DEVICE = "device-aaaa-1111";
const OTHER_DEVICE = "device-bbbb-2222";
const INSIDE = { lat: 26.15, lng: 50.6 };

let fake: FakeFirestore;
let db: ReturnType<FakeFirestore["asFirestore"]>;
let staff: Staff;
let seq = 0;

beforeAll(() => {
  process.env.ATTENDANCE_TOKEN_SECRET = "test-secret-test-secret-test-secret-123";
});

async function seed(shift = { name: "Day", startTime: "07:00", endTime: "16:00" }) {
  fake = new FakeFirestore();
  db = fake.asFirestore();
  for (const id of ["sup1", "sup2", "admin1"]) await db.collection("Users").doc(id).set({ fullName: id });
  const now = at(MONDAY, "00:00");
  const contractor = await createSetup(db, admin, "contractors", { name: "Acme Manpower" }, now);
  const createdShift = await createSetup(db, admin, "shifts", shift, now);
  const fence = await createSetup(db, admin, "geofences", { name: "EKK WH", lat: 26.15, lng: 50.6, radiusM: 200 }, now);
  const created = await createStaff(
    db,
    admin,
    {
      staffCode: "c-101",
      name: "Ali",
      contractorId: contractor.id,
      supervisorId: "sup1",
      shiftId: createdShift.id,
      geofenceIds: [fence.id],
      pin: "1234",
    },
    now,
  );
  staff = await getStaff(db, created.id);
  const { staff: bound } = await loginStaff(db, { staffCode: "C-101", pin: "1234", deviceId: DEVICE }, now);
  staff = bound;
}

function ev(type: AttendanceEvent["type"], date: string, time: string, extra: Record<string, unknown> = {}) {
  seq += 1;
  return {
    clientEventId: `client-event-${seq}`,
    type,
    source: "AUTO",
    trigger: "SCHEDULED",
    deviceTime: at(date, time).toISOString(),
    ...INSIDE,
    accuracyM: 15,
    mockLocation: false,
    ...extra,
  };
}

async function sync(events: unknown[], now: Date, sentAt = now) {
  return ingestEvents(db, await getStaff(db, staff.id), { sentAt: sentAt.toISOString(), events }, now);
}

function dayDoc(date: string) {
  return fake.all<AttendanceDay>(COL.days).find((d) => d.id === `${staff.id}_${date}`);
}

function overtime() {
  return fake.all<OvertimeRequest>(COL.overtime);
}

describe("staff login and device binding", () => {
  beforeEach(() => seed());

  it("binds the account to the first phone", async () => {
    expect((await getStaff(db, staff.id)).deviceId).toBe(DEVICE);
  });

  it("blocks a second phone for the same staff", async () => {
    await expect(
      loginStaff(db, { staffCode: "C-101", pin: "1234", deviceId: OTHER_DEVICE }, at(MONDAY, "08:00")),
    ).rejects.toMatchObject({ code: "DEVICE_MISMATCH", status: 403 });
  });

  it("allows a new phone after a supervisor resets the device and revokes old sessions", async () => {
    const { tokens } = await loginStaff(db, { staffCode: "c-101", pin: "1234", deviceId: DEVICE }, at(MONDAY, "08:00"));
    await updateStaff(db, supervisor, staff.id, { action: "resetDevice" }, at(MONDAY, "08:10"));
    await expect(
      authenticateStaff(db, `Bearer ${tokens.accessToken}`, DEVICE, at(MONDAY, "08:11")),
    ).rejects.toMatchObject({ code: "TOKEN_REVOKED" });
    const { staff: rebound } = await loginStaff(db, { staffCode: "c-101", pin: "1234", deviceId: OTHER_DEVICE }, at(MONDAY, "08:12"));
    expect(rebound.deviceId).toBe(OTHER_DEVICE);
  });

  it("locks the PIN after repeated failures", async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(loginStaff(db, { staffCode: "c-101", pin: "9999", deviceId: DEVICE }, at(MONDAY, "08:00"))).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
      });
    }
    await expect(loginStaff(db, { staffCode: "c-101", pin: "1234", deviceId: DEVICE }, at(MONDAY, "08:05"))).rejects.toMatchObject({
      code: "PIN_LOCKED",
    });
    await expect(loginStaff(db, { staffCode: "c-101", pin: "1234", deviceId: DEVICE }, at(MONDAY, "08:20"))).resolves.toBeTruthy();
  });

  it("issues tokens that authenticate, refresh and expire", async () => {
    const { tokens } = await loginStaff(db, { staffCode: "c-101", pin: "1234", deviceId: DEVICE }, at(MONDAY, "08:00"));
    await expect(authenticateStaff(db, `Bearer ${tokens.accessToken}`, DEVICE, at(MONDAY, "08:30"))).resolves.toMatchObject({ id: staff.id });
    await expect(authenticateStaff(db, `Bearer ${tokens.accessToken}`, OTHER_DEVICE, at(MONDAY, "08:30"))).rejects.toBeTruthy();
    await expect(authenticateStaff(db, `Bearer ${tokens.accessToken}`, DEVICE, at(MONDAY, "09:30"))).rejects.toMatchObject({ code: "TOKEN_INVALID" });
    const refreshed = await refreshStaffSession(db, { refreshToken: tokens.refreshToken, deviceId: DEVICE }, at(MONDAY, "09:30"));
    await expect(authenticateStaff(db, `Bearer ${refreshed.tokens.accessToken}`, DEVICE, at(MONDAY, "09:31"))).resolves.toBeTruthy();
  });

  it("blocks a deactivated account at once and lets it back in when re-activated", async () => {
    const { tokens } = await loginStaff(db, { staffCode: "c-101", pin: "1234", deviceId: DEVICE }, at(MONDAY, "08:00"));
    await updateStaff(db, supervisor, staff.id, { action: "deactivate" }, at(MONDAY, "08:05"));
    await expect(authenticateStaff(db, `Bearer ${tokens.accessToken}`, DEVICE, at(MONDAY, "08:06"))).rejects.toMatchObject({ code: "ACCOUNT_DISABLED" });
    await expect(loginStaff(db, { staffCode: "c-101", pin: "1234", deviceId: DEVICE }, at(MONDAY, "08:07"))).rejects.toMatchObject({ code: "ACCOUNT_DISABLED" });
    await updateStaff(db, supervisor, staff.id, { action: "activate" }, at(MONDAY, "08:10"));
    await expect(loginStaff(db, { staffCode: "c-101", pin: "1234", deviceId: DEVICE }, at(MONDAY, "08:11"))).resolves.toBeTruthy();
  });

  it("erases a deleted account with no records and frees the staff ID", async () => {
    await updateStaff(db, admin, staff.id, { action: "delete" }, at(MONDAY, "08:00"));
    expect(fake.all(COL.staff)).toHaveLength(0);
    expect(fake.all(COL.staffCodes)).toHaveLength(0);
    await expect(loginStaff(db, { staffCode: "c-101", pin: "1234", deviceId: DEVICE }, at(MONDAY, "08:01"))).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("keeps the history of a deleted account but removes its login for good", async () => {
    const { tokens } = await loginStaff(db, { staffCode: "c-101", pin: "1234", deviceId: DEVICE }, at(MONDAY, "08:00"));
    await sync([ev("IN", MONDAY, "06:55")], at(MONDAY, "06:55"));
    await updateStaff(db, admin, staff.id, { action: "delete" }, at(MONDAY, "18:00"));
    const kept = fake.all<Staff>(COL.staff)[0];
    expect(kept).toMatchObject({ deleted: true, active: false, pinHash: null, deviceId: null });
    expect(fake.all(COL.staffCodes)).toHaveLength(0);
    expect(fake.all(COL.events)).toHaveLength(1);
    await expect(authenticateStaff(db, `Bearer ${tokens.accessToken}`, DEVICE, at(MONDAY, "18:01"))).rejects.toBeTruthy();
    await expect(loginStaff(db, { staffCode: "c-101", pin: "1234", deviceId: DEVICE }, at(MONDAY, "18:02"))).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(updateStaff(db, admin, staff.id, { action: "activate" }, at(MONDAY, "18:03"))).rejects.toMatchObject({ status: 409 });
  });

  it("never stores the PIN in plain text", async () => {
    const stored = fake.all<Staff>(COL.staff)[0];
    expect(stored.pinHash).toMatch(/^scrypt\$/);
    expect(JSON.stringify(stored)).not.toContain('"1234"');
  });
});

describe("regular attendance sync", () => {
  beforeEach(() => seed());

  it("records IN and OUT automatically and computes a present day", async () => {
    await sync([ev("IN", MONDAY, "06:52", { trigger: "GEOFENCE_ENTER" })], at(MONDAY, "06:52"));
    await sync([ev("OUT", MONDAY, "16:03")], at(MONDAY, "16:03"));
    const day = dayDoc(MONDAY)!;
    expect(day.status).toBe("PRESENT");
    expect(day.regularMinutes).toBe(540);
  });

  it("flags a staff member who arrives 20 minutes late", async () => {
    await sync([ev("IN", MONDAY, "07:20"), ev("OUT", MONDAY, "16:00")], at(MONDAY, "16:05"));
    expect(dayDoc(MONDAY)!.status).toBe("LATE");
  });

  it("syncs an offline day once, with no duplicates on retry", async () => {
    const offline = [ev("IN", MONDAY, "06:55"), ev("OUT", MONDAY, "16:02")];
    const first = await sync(offline, at(MONDAY, "20:00"));
    const retry = await sync(offline, at(MONDAY, "20:05"));
    expect(first.map((r) => r.status)).toEqual(["ACCEPTED", "ACCEPTED"]);
    expect(retry.map((r) => r.status)).toEqual(["DUPLICATE", "DUPLICATE"]);
    expect(fake.all(COL.events)).toHaveLength(2);
    expect(dayDoc(MONDAY)!.status).toBe("PRESENT");
  });

  it("flags fake GPS without rejecting the record", async () => {
    const [result] = await sync([ev("IN", MONDAY, "06:55", { mockLocation: true })], at(MONDAY, "06:55"));
    expect(result.status).toBe("ACCEPTED");
    expect(dayDoc(MONDAY)!.flags).toContain("MOCK_LOCATION");
  });

  it("flags a poor-accuracy reading instead of rejecting it", async () => {
    const [result] = await sync([ev("IN", MONDAY, "06:55", { accuracyM: 350 })], at(MONDAY, "06:55"));
    expect(result.status).toBe("ACCEPTED");
    expect(dayDoc(MONDAY)!.flags).toContain("POOR_ACCURACY");
  });

  it("corrects device clock drift and flags it", async () => {
    const now = at(MONDAY, "07:00");
    const phoneClock = new Date(now.getTime() - 10 * 60000);
    await sync([{ ...ev("IN", MONDAY, "06:50"), deviceTime: phoneClock.toISOString() }], now, phoneClock);
    const stored = fake.all<AttendanceEvent>(COL.events)[0];
    expect(stored.flags).toContain("CLOCK_DRIFT");
    expect(stored.effectiveTime).toBe(now.toISOString());
  });

  it("puts a midnight-crossing shift on the day it started", async () => {
    await seed({ name: "Night", startTime: "22:00", endTime: "06:00" });
    await sync([ev("IN", MONDAY, "21:50"), ev("OUT", "2026-11-03", "06:04")], at("2026-11-03", "06:10"));
    expect(dayDoc(MONDAY)!.status).toBe("PRESENT");
    expect(dayDoc("2026-11-03")).toBeUndefined();
  });
});

describe("overtime", () => {
  beforeEach(() => seed());

  it("blocks OT In before shift end + 30 minutes", async () => {
    const [result] = await sync([ev("OT_IN", MONDAY, "16:20", { source: "MANUAL", trigger: "USER_TAP" })], at(MONDAY, "16:20"));
    expect(result).toMatchObject({ status: "REJECTED", code: "OT_TOO_EARLY" });
    expect(result.message).toContain("16:30");
    expect(overtime()).toHaveLength(0);
  });

  it("blocks OT In outside the geofence", async () => {
    const [result] = await sync([ev("OT_IN", MONDAY, "17:00", { lat: 26.3, lng: 50.6 })], at(MONDAY, "17:00"));
    expect(result.code).toBe("OUTSIDE_GEOFENCE");
  });

  it("creates a pending request that only the supervisor or an admin can approve, with a note", async () => {
    await sync([ev("OT_IN", MONDAY, "16:40", { reason: "Container unloading" })], at(MONDAY, "16:40"));
    await sync([ev("OT_OUT", MONDAY, "18:50")], at(MONDAY, "18:50"));
    const [ot] = overtime();
    expect(ot).toMatchObject({ status: "PENDING", minutes: 120, rateType: "WEEKDAY", reason: "Container unloading" });

    await expect(decideOvertime(db, otherSupervisor, ot.id, { action: "APPROVE", note: "ok ok" }, at(MONDAY, "19:00"))).rejects.toMatchObject({ status: 403 });
    await expect(decideOvertime(db, supervisor, ot.id, { action: "APPROVE", note: "" }, at(MONDAY, "19:00"))).rejects.toMatchObject({ status: 400 });
    const decided = await decideOvertime(db, supervisor, ot.id, { action: "EDIT", minutes: 105, note: "Started late" }, at(MONDAY, "19:00"));
    expect(decided).toMatchObject({ status: "APPROVED", minutes: 105, approverId: "sup1" });
    expect(fake.all<{ what: string }>(COL.audit).some((a) => a.what === "OT_EDIT")).toBe(true);
  });

  it("auto-closes forgotten OT at the cut-off and flags it", async () => {
    await sync([ev("OT_IN", MONDAY, "17:00")], at(MONDAY, "17:00"));
    const rules = await getRules(db);
    expect(await autoCloseOvertime(db, rules, at(MONDAY, "20:59"))).toHaveLength(0);
    expect(await autoCloseOvertime(db, rules, at(MONDAY, "21:01"))).toHaveLength(1);
    const [ot] = overtime();
    expect(ot).toMatchObject({ status: "AUTO_CLOSED", autoClosed: true, minutes: 240, otOut: at(MONDAY, "21:00").toISOString() });
  });

  it("caps a late OT Out at the cut-off", async () => {
    await sync([ev("OT_IN", MONDAY, "17:00")], at(MONDAY, "17:00"));
    await sync([ev("OT_OUT", MONDAY, "22:30")], at(MONDAY, "22:30"));
    expect(overtime()[0]).toMatchObject({ status: "AUTO_CLOSED", minutes: 240 });
  });

  it("uses the Friday rate on a weekly off-day and allows OT at any time", async () => {
    await sync([ev("OT_IN", FRIDAY, "08:00"), ev("OT_OUT", FRIDAY, "11:00")], at(FRIDAY, "11:00"));
    expect(overtime()[0]).toMatchObject({ rateType: "FRIDAY", minutes: 180, dayType: "WEEKLY_OFF" });
  });

  it("marks reminders after 24 hours and escalation after 48 hours", async () => {
    await sync([ev("OT_IN", MONDAY, "16:40"), ev("OT_OUT", MONDAY, "18:40")], at(MONDAY, "18:40"));
    const rules = await getRules(db);
    expect((await markOvertimeReminders(db, rules, at("2026-11-03", "18:41"))).reminded).toHaveLength(1);
    expect((await markOvertimeReminders(db, rules, at("2026-11-04", "18:41"))).escalated).toHaveLength(1);
  });
});

describe("corrections and month lock", () => {
  beforeEach(() => seed());

  it("keeps the original values and writes an audit entry", async () => {
    await sync([ev("IN", MONDAY, "06:55")], at(MONDAY, "06:55"));
    const now = at("2026-11-03", "09:00");
    const { day } = await addCorrection(
      db,
      supervisor,
      await getStaff(db, staff.id),
      { date: MONDAY, field: "lastOut", newValue: at(MONDAY, "16:00").toISOString(), reason: "Phone battery died" },
      now,
    );
    expect(day!.status).toBe("PRESENT");
    expect(day!.computed.status).toBe("MISSING_OUT");
    expect(fake.all<AttendanceEvent>(COL.events)).toHaveLength(1);
    const [correction] = fake.all(COL.corrections) as { oldValue: unknown; reason: string }[];
    expect(correction).toMatchObject({ oldValue: null, reason: "Phone battery died" });
    expect(fake.all<{ what: string }>(COL.audit).some((a) => a.what === "DAY_CORRECTED")).toBe(true);
  });

  it("requires a reason", async () => {
    await expect(
      addCorrection(db, supervisor, await getStaff(db, staff.id), { date: MONDAY, field: "status", newValue: "PRESENT", reason: "" }, at(MONDAY, "18:00")),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects edits in a locked month until an admin unlocks it", async () => {
    const now = at("2026-11-20", "09:00");
    await lockMonth(db, "admin1", "2026-11", now);
    const correct = async () =>
      addCorrection(db, supervisor, await getStaff(db, staff.id), { date: MONDAY, field: "status", newValue: "PRESENT", reason: "Checked CCTV" }, now);
    await expect(correct()).rejects.toMatchObject({ status: 423 });
    await expect(unlockMonth(db, supervisor, "2026-11", "fix", now)).rejects.toMatchObject({ status: 403 });
    await expect(unlockMonth(db, admin, "2026-11", "", now)).rejects.toMatchObject({ status: 400 });
    await unlockMonth(db, admin, "2026-11", "Contractor dispute", now);
    await expect(correct()).resolves.toBeTruthy();
  });

  it("locks a month automatically on day 5 of the next month", async () => {
    const rules = await getRules(db);
    expect((await getMonthLockState(db, "2026-11", rules, at("2026-12-04", "23:00"))).locked).toBe(false);
    expect((await getMonthLockState(db, "2026-11", rules, at("2026-12-05", "00:30"))).locked).toBe(true);
  });

  it("keeps late-synced events from a locked month for review without changing the day", async () => {
    await lockMonth(db, "admin1", "2026-11", at("2026-12-06", "09:00"));
    const [result] = await sync([ev("IN", MONDAY, "06:55")], at("2026-12-06", "09:00"));
    expect(result.code).toBe("MONTH_LOCKED");
    expect(dayDoc(MONDAY)).toBeUndefined();
  });
});
