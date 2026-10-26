import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/attendance/actor";
import { runCron } from "@/lib/attendance/cron";
import { getDailyExceptions, pendingCount } from "@/lib/attendance/exceptions";
import { compareVersions, deviceIssues, recordConsent, reportDeviceHealth } from "@/lib/attendance/health";
import { ingestEvents } from "@/lib/attendance/ingest";
import { getMobileProfile } from "@/lib/attendance/mobile";
import { loginStaff } from "@/lib/attendance/mobile-auth";
import { decideOvertime } from "@/lib/attendance/overtime";
import { purgeExpiredPhotos, readPhoto, savePhoto, type PhotoStore } from "@/lib/attendance/photos";
import { compareContractorSheet, getMonthReport } from "@/lib/attendance/reports-service";
import { updateSettings } from "@/lib/attendance/settings";
import { createSetup, createStaff } from "@/lib/attendance/setup";
import { COL, getRules, getStaff } from "@/lib/attendance/store";
import { zonedToUtc } from "@/lib/attendance/time";
import { CONSENT_VERSION, DEFAULT_RULES } from "@/lib/attendance/config";
import type { OvertimeRequest, Staff } from "@/lib/attendance/types";
import { FakeFirestore } from "./helpers/fake-firestore";

const at = (date: string, time: string) => zonedToUtc(date, time, "Asia/Bahrain");
const admin: Actor = { userId: "admin1", role: "Admin", isAdmin: true };
const sup1: Actor = { userId: "sup1", role: "Supervisor", isAdmin: false };
const sup2: Actor = { userId: "sup2", role: "Supervisor", isAdmin: false };
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);

let fake: FakeFirestore;
let db: ReturnType<FakeFirestore["asFirestore"]>;
let ali: Staff;
let sara: Staff;
let contractorId: string;
let seq = 0;

beforeAll(() => {
  process.env.ATTENDANCE_TOKEN_SECRET = "test-secret-test-secret-test-secret-123";
});

async function newStaff(code: string, supervisorId: string, shiftId: string, fenceId: string) {
  const created = await createStaff(
    db,
    admin,
    { staffCode: code, name: code, contractorId, supervisorId, shiftId, geofenceIds: [fenceId], pin: "1234" },
    at("2026-10-01", "00:00"),
  );
  await loginStaff(db, { staffCode: code, pin: "1234", deviceId: `device-${code}-xyz` }, at("2026-10-01", "00:00"));
  return getStaff(db, created.id);
}

beforeEach(async () => {
  fake = new FakeFirestore();
  db = fake.asFirestore();
  for (const id of ["sup1", "sup2", "admin1"]) await db.collection("Users").doc(id).set({ fullName: id });
  const now = at("2026-10-01", "00:00");
  contractorId = (await createSetup(db, admin, "contractors", { name: "Acme" }, now)).id;
  const shift = await createSetup(db, admin, "shifts", { name: "Day", startTime: "07:00", endTime: "16:00" }, now);
  const fence = await createSetup(db, admin, "geofences", { name: "WH", lat: 26.15, lng: 50.6 }, now);
  await createSetup(db, admin, "holidays", { date: "2026-11-30", name: "National Day (test)" }, now);
  ali = await newStaff("C-1", "sup1", shift.id, fence.id);
  sara = await newStaff("C-2", "sup2", shift.id, fence.id);
});

function ev(type: string, date: string, time: string) {
  seq += 1;
  return {
    clientEventId: `evt-${seq}-abcdef`,
    type,
    source: "AUTO",
    trigger: "SCHEDULED",
    deviceTime: at(date, time).toISOString(),
    lat: 26.15,
    lng: 50.6,
    accuracyM: 10,
    mockLocation: false,
  };
}

async function sync(staff: Staff, events: unknown[], now: Date) {
  return ingestEvents(db, await getStaff(db, staff.id), { sentAt: now.toISOString(), events }, now);
}

describe("month report", () => {
  it("counts days and only APPROVED overtime, by rate type", async () => {
    await sync(ali, [ev("IN", "2026-11-02", "06:55"), ev("OUT", "2026-11-02", "16:00")], at("2026-11-02", "16:00"));
    await sync(ali, [ev("IN", "2026-11-03", "07:25"), ev("OUT", "2026-11-03", "16:00")], at("2026-11-03", "16:00"));
    await sync(ali, [ev("OT_IN", "2026-11-03", "16:45"), ev("OT_OUT", "2026-11-03", "18:45")], at("2026-11-03", "18:45"));
    await sync(ali, [ev("OT_IN", "2026-11-06", "08:00"), ev("OT_OUT", "2026-11-06", "12:00")], at("2026-11-06", "12:00"));
    await sync(ali, [ev("OT_IN", "2026-11-30", "08:00"), ev("OT_OUT", "2026-11-30", "10:00")], at("2026-11-30", "10:00"));

    const ots = fake.all<OvertimeRequest>(COL.overtime).sort((a, b) => a.otIn.localeCompare(b.otIn));
    await decideOvertime(db, sup1, ots[0].id, { action: "APPROVE", note: "Unloading" }, at("2026-11-04", "09:00"));
    await decideOvertime(db, sup1, ots[1].id, { action: "APPROVE", note: "Stock count" }, at("2026-11-07", "09:00"));
    // ots[2] (holiday) stays pending and must not appear

    const report = await getMonthReport(db, admin, "2026-11", at("2026-11-05", "09:00"));
    const row = report.staff.find((r) => r.staffCode === "C-1")!;
    expect(row.daysPresent).toBe(2);
    expect(row.daysLate).toBe(1);
    // Sunday 1 Nov and Wednesday 4 Nov had no events; both are filled in as ABSENT.
    expect(row.daysAbsent).toBe(2);
    expect(row.regularMinutes).toBe(540 + 510);
    expect(row.otMinutes).toEqual({ WEEKDAY: 120, FRIDAY: 240, HOLIDAY: 0 });
    expect(row.exceptions.map((e) => e.date)).toEqual(["2026-11-01", "2026-11-03", "2026-11-04"]);
    expect(report.contractors[0]).toMatchObject({ contractorName: "Acme", staffCount: 2 });
  });

  it("limits a supervisor to their own staff", async () => {
    const report = await getMonthReport(db, sup1, "2026-11", at("2026-11-02", "09:00"));
    expect(report.staff.map((r) => r.staffCode)).toEqual(["C-1"]);
  });
});

describe("contractor comparison", () => {
  it("lists mismatches with exact dates", async () => {
    await sync(ali, [ev("IN", "2026-11-02", "06:55"), ev("OUT", "2026-11-02", "16:00")], at("2026-11-02", "16:00"));
    await sync(ali, [ev("IN", "2026-11-03", "06:55"), ev("OUT", "2026-11-03", "16:00")], at("2026-11-03", "16:00"));
    const result = await compareContractorSheet(
      db,
      admin,
      {
        month: "2026-11",
        rows: [
          { staffCode: "c-1", date: "2026-11-02", status: "P", hours: 9 },
          { staffCode: "C-1", date: "2026-11-04", status: "P", hours: 9 },
          { staffCode: "C-1", date: "2026-11-03", status: "P", hours: 10 },
          { staffCode: "X-9", date: "2026-11-02", status: "P", hours: 9 },
        ],
      },
      at("2026-11-05", "09:00"),
    );
    const kinds = result.mismatches.map((m) => `${m.staffCode} ${m.date} ${m.kind}`);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "C-1 2026-11-03 HOURS_MISMATCH",
        "C-1 2026-11-04 PRESENCE_MISMATCH",
        "X-9 2026-11-02 UNKNOWN_STAFF",
      ]),
    );
    expect(kinds).not.toContain("C-1 2026-11-02 HOURS_MISMATCH");
  });
});

describe("daily exceptions", () => {
  it("shows only problems for the supervisor's staff", async () => {
    await sync(ali, [ev("IN", "2026-11-02", "07:25")], at("2026-11-02", "07:25"));
    const result = await getDailyExceptions(db, sup1, "2026-11-02", at("2026-11-02", "16:30"));
    expect(result.late.map((i) => i.staff.staffCode)).toEqual(["C-1"]);
    expect(result.missingOut.map((i) => i.staff.staffCode)).toEqual(["C-1"]);
    expect(result.missingIn).toHaveLength(0);
    expect(result.devices.map((d) => d.issues)).toEqual([["NO_DATA"]]);

    const forSara = await getDailyExceptions(db, sup2, "2026-11-02", at("2026-11-02", "16:30"));
    expect(forSara.missingIn.map((i) => i.staff.staffCode)).toEqual(["C-2"]);
  });

  it("counts overtime waiting for a decision", async () => {
    await sync(ali, [ev("OT_IN", "2026-11-02", "16:45"), ev("OT_OUT", "2026-11-02", "18:45")], at("2026-11-02", "18:45"));
    expect(await pendingCount(db, sup1)).toBe(1);
    expect(await pendingCount(db, sup2)).toBe(0);
  });
});

describe("device health and consent", () => {
  it("reports problems from the phone", async () => {
    const rules = await getRules(db);
    const health = await reportDeviceHealth(
      db,
      ali,
      {
        locationPermission: "WHILE_IN_USE",
        gpsEnabled: true,
        batteryOptimised: true,
        notificationsEnabled: true,
        mockLocationDetected: false,
        rooted: false,
        appVersion: "0.9.0",
      },
      at("2026-11-02", "08:00"),
    );
    expect(deviceIssues(health, rules, at("2026-11-02", "09:00"))).toEqual(["LOCATION_NOT_ALWAYS", "BATTERY_OPTIMISED", "APP_OUTDATED"]);
    expect(deviceIssues(health, rules, at("2026-11-04", "09:00"))).toContain("NO_SYNC");
    expect(compareVersions("1.2.10", "1.2.9")).toBe(1);
  });

  it("stores consent with a timestamp", async () => {
    await expect(recordConsent(db, ali, { version: CONSENT_VERSION, accepted: false }, new Date())).rejects.toBeTruthy();
    await recordConsent(db, ali, { version: CONSENT_VERSION, accepted: true }, at("2026-11-02", "08:00"));
    const profile = await getMobileProfile(db, await getStaff(db, ali.id), at("2026-11-02", "08:00"));
    expect(profile.consent).toMatchObject({ required: false, acceptedAt: at("2026-11-02", "08:00").toISOString() });
    expect(profile.calendar.find((d) => d.date === "2026-11-06")?.dayType).toBe("WEEKLY_OFF");
    expect(profile.calendar.find((d) => d.date === "2026-11-02")?.inOpen).toBe(at("2026-11-02", "06:45").toISOString());
  });
});

describe("selfies", () => {
  function memoryStore(): PhotoStore & { files: Map<string, Buffer> } {
    const files = new Map<string, Buffer>();
    return {
      files,
      async save(path, bytes) {
        files.set(path, bytes);
      },
      async read(path) {
        return files.get(path) ?? null;
      },
      async remove(path) {
        files.delete(path);
      },
    };
  }

  it("stores privately, limits access to the supervisor, and deletes after retention", async () => {
    const store = memoryStore();
    await savePhoto(db, store, ali, "photo-0001-abc", JPEG, at("2026-11-02", "17:00"));
    expect((await savePhoto(db, store, ali, "photo-0001-abc", JPEG, at("2026-11-02", "17:01"))).duplicate).toBe(true);
    await expect(savePhoto(db, store, ali, "photo-0002-abc", Buffer.from("not an image"), new Date())).rejects.toMatchObject({ status: 400 });

    await expect(readPhoto(db, store, sup1, "photo-0001-abc")).resolves.toMatchObject({ contentType: "image/jpeg" });
    await expect(readPhoto(db, store, sup2, "photo-0001-abc")).rejects.toMatchObject({ status: 403 });

    const rules = await getRules(db);
    expect(await purgeExpiredPhotos(db, store, rules, at("2027-01-30", "00:00"))).toBe(0);
    expect(await purgeExpiredPhotos(db, store, rules, at("2027-02-01", "00:00"))).toBe(1);
    expect(store.files.size).toBe(0);
    await expect(readPhoto(db, store, sup1, "photo-0001-abc")).rejects.toMatchObject({ status: 410 });
  });
});

describe("settings", () => {
  it("validates and audits rule changes", async () => {
    await expect(updateSettings(db, admin, { roundingStepMin: 0 }, new Date())).rejects.toMatchObject({ status: 400 });
    await expect(updateSettings(db, admin, { notARule: 1 }, new Date())).rejects.toMatchObject({ status: 400 });
    const rules = await updateSettings(db, sup1, { weeklyOffDays: [5, 6], roundingMode: "NEAREST" }, new Date());
    expect(rules).toMatchObject({ ...DEFAULT_RULES, weeklyOffDays: [5, 6], roundingMode: "NEAREST" });
    expect(fake.all<{ what: string }>(COL.audit).some((a) => a.what === "SETTINGS_UPDATED")).toBe(true);
  });
});

describe("scheduled jobs", () => {
  it("marks absences, closes forgotten OT and locks the previous month", async () => {
    await sync(ali, [ev("OT_IN", "2026-11-30", "09:00")], at("2026-11-30", "09:00"));
    const result = await runCron(db, "all", at("2026-12-05", "01:00"));
    expect(result.autoClosed).toHaveLength(1);
    expect(result.monthsLocked).toEqual(["2026-10", "2026-11"]);
    const again = await runCron(db, "all", at("2026-12-05", "01:15"));
    expect(again.autoClosed).toHaveLength(0);
    expect(again.monthsLocked).toEqual([]);
  });
});
