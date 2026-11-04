import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/lib/attendance/actor";
import { ensureDays } from "@/lib/attendance/days";
import { siteIssuesByStaff } from "@/lib/attendance/health";
import { ingestEvents } from "@/lib/attendance/ingest";
import { loginStaff } from "@/lib/attendance/mobile-auth";
import { updateSettings } from "@/lib/attendance/settings";
import { createSetup, createStaff, listSetup, updateSetup, updateStaff } from "@/lib/attendance/setup";
import { COL, getHolidaySet, getRules, getStaff, listStaff } from "@/lib/attendance/store";
import { zonedToUtc } from "@/lib/attendance/time";
import type { AttendanceEvent, Staff } from "@/lib/attendance/types";
import { FakeFirestore } from "./helpers/fake-firestore";

// Dates after "today" so stored days are newer than the cache marker written with the real clock.
const DAY = "2027-03-08"; // Monday
const at = (time: string, date = DAY) => zonedToUtc(date, time, "Asia/Bahrain");
const admin: Actor = { userId: "admin1", role: "Admin", isAdmin: true };

let fake: FakeFirestore;
let db: ReturnType<FakeFirestore["asFirestore"]>;
let staff: Staff;
let fenceId: string;

beforeAll(() => {
  process.env.ATTENDANCE_TOKEN_SECRET = "test-secret-test-secret-test-secret-123";
});

beforeEach(async () => {
  fake = new FakeFirestore();
  db = fake.asFirestore();
  await db.collection("Users").doc("sup1").set({ fullName: "sup1" });
  const now = at("00:00", "2027-03-01");
  const contractorId = (await createSetup(db, admin, "contractors", { name: "Acme" }, now)).id;
  const shiftId = (await createSetup(db, admin, "shifts", { name: "Day", startTime: "07:00", endTime: "16:00" }, now)).id;
  fenceId = (await createSetup(db, admin, "geofences", { name: "Tubli", lat: 26.19209, lng: 50.53752, radiusM: 200 }, now)).id;
  const created = await createStaff(
    db,
    admin,
    { cprNo: "900000001", name: "Ali", contractorId, supervisorId: "sup1", shiftId, geofenceIds: [fenceId], password: "1234" },
    now,
  );
  await loginStaff(db, { cprNo: "900000001", password: "1234", deviceId: "device-aaaa-1111" }, now);
  staff = await getStaff(db, created.id);
});

const dayFor = async (now: Date) => (await ensureDays(db, [await getStaff(db, staff.id)], DAY, now))[0];

describe("day records on the Overview / Today pages", () => {
  it("are not rewritten while still current, and are updated when the IN window closes", async () => {
    const first = await dayFor(at("07:00"));
    expect(first.status).toBe("PENDING");
    const again = await dayFor(at("07:10"));
    expect(again.updatedAt).toBe(first.updatedAt);
    const afterWindow = await dayFor(at("07:20"));
    expect(afterWindow.status).toBe("MISSING_IN");
    expect(afterWindow.updatedAt).toBe(at("07:20").toISOString());
  });

  it("are rebuilt after a change to the rules", async () => {
    const first = await dayFor(at("07:00"));
    // The change marker uses the server clock; put it at the simulated time.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at("07:01"));
    try {
      await updateSettings(db, admin, { roundingStepMin: 5 }, at("07:01"));
    } finally {
      vi.useRealTimers();
    }
    const after = await dayFor(at("07:05"));
    expect(after.updatedAt).not.toBe(first.updatedAt);
    expect(after.updatedAt).toBe(at("07:05").toISOString());
  });

  it("still show a check-in at once (events recompute the day)", async () => {
    await dayFor(at("06:50"));
    await ingestEvents(
      db,
      await getStaff(db, staff.id),
      {
        sentAt: at("06:55").toISOString(),
        events: [{ clientEventId: "evt-0000001", type: "IN", source: "AUTO", trigger: "SCHEDULED", deviceTime: at("06:55").toISOString(), lat: 26.19209, lng: 50.53752, accuracyM: 10, mockLocation: false }],
      },
      at("06:55"),
    );
    const day = await dayFor(at("07:00"));
    expect(day.firstIn).toBe(at("06:55").toISOString());
  });
});

describe("cached settings and lists", () => {
  it("show changes immediately after they are saved", async () => {
    expect((await getRules(db)).roundingStepMin).not.toBe(5);
    await updateSettings(db, admin, { roundingStepMin: 5 }, at("08:00"));
    expect((await getRules(db)).roundingStepMin).toBe(5);

    expect((await listStaff(db)).find((s) => s.id === staff.id)?.name).toBe("Ali");
    await updateStaff(db, admin, staff.id, { action: "update", changes: { name: "Ali Hasan" } }, at("08:00"));
    expect((await listStaff(db)).find((s) => s.id === staff.id)?.name).toBe("Ali Hasan");

    await updateSetup(db, admin, "geofences", fenceId, { radiusM: 300 }, at("08:00"));
    expect((await listSetup(db, "geofences")).find((g) => g.id === fenceId)).toMatchObject({ radiusM: 300 });

    expect((await getHolidaySet(db, DAY, DAY)).has(DAY)).toBe(false);
    await createSetup(db, admin, "holidays", { date: DAY, name: "Test", type: "COMPANY" }, at("08:00"));
    expect((await getHolidaySet(db, DAY, DAY)).has(DAY)).toBe(true);
  });

  it("hand out copies, so a caller changing a result does not change the cache", async () => {
    const list = await listStaff(db);
    list[0].name = "changed";
    expect((await listStaff(db))[0].name).not.toBe("changed");
  });
});

describe("far-from-site warning", () => {
  it("uses the location saved at sync, without reading old events", async () => {
    const now = at("07:00");
    await ingestEvents(
      db,
      await getStaff(db, staff.id),
      {
        sentAt: now.toISOString(),
        events: [{ clientEventId: "evt-far-0001", type: "IN", source: "MANUAL", trigger: "USER_TAP", deviceTime: now.toISOString(), lat: 26.11322, lng: 50.32155, accuracyM: 10, mockLocation: false }],
      },
      now,
    );
    for (const e of fake.all<AttendanceEvent>(COL.events)) await db.collection(COL.events).doc(e.id).delete();
    expect((await siteIssuesByStaff(db, [staff], now)).get(staff.id)).toEqual(["FAR_FROM_SITE"]);
  });
});
