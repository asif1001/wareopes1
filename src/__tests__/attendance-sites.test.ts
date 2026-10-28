import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/attendance/actor";
import { siteIssuesByStaff } from "@/lib/attendance/health";
import { ingestEvents } from "@/lib/attendance/ingest";
import { loginStaff } from "@/lib/attendance/mobile-auth";
import { createSetup, createStaff, removeSetup, updateSetup, updateStaff } from "@/lib/attendance/setup";
import { getStaff } from "@/lib/attendance/store";
import { zonedToUtc } from "@/lib/attendance/time";
import type { Staff } from "@/lib/attendance/types";
import { FakeFirestore } from "./helpers/fake-firestore";

const at = (date: string, time: string) => zonedToUtc(date, time, "Asia/Bahrain");
const admin: Actor = { userId: "admin1", role: "Admin", isAdmin: true };

let db: ReturnType<FakeFirestore["asFirestore"]>;
let staff: Staff;
let fenceId: string;
let shiftId: string;
let contractorId: string;

beforeAll(() => {
  process.env.ATTENDANCE_TOKEN_SECRET = "test-secret-test-secret-test-secret-123";
});

beforeEach(async () => {
  db = new FakeFirestore().asFirestore();
  for (const id of ["sup1", "admin1"]) await db.collection("Users").doc(id).set({ fullName: id });
  const now = at("2026-10-01", "00:00");
  contractorId = (await createSetup(db, admin, "contractors", { name: "Acme" }, now)).id;
  shiftId = (await createSetup(db, admin, "shifts", { name: "Day", startTime: "07:00", endTime: "16:00" }, now)).id;
  fenceId = (await createSetup(db, admin, "geofences", { name: "Tubli", lat: 26.19209, lng: 50.53752, radiusM: 200 }, now)).id;
  const created = await createStaff(
    db,
    admin,
    { staffCode: "C-1", cprNo: "900000001", name: "C-1", contractorId, supervisorId: "sup1", shiftId, geofenceIds: [fenceId], pin: "1234" },
    now,
  );
  await loginStaff(db, { staffCode: "C-1", pin: "1234", deviceId: "device-C-1-xyz" }, now);
  staff = await getStaff(db, created.id);
});

async function tapAt(lat: number, lng: number, now: Date) {
  await ingestEvents(
    db,
    await getStaff(db, staff.id),
    {
      sentAt: now.toISOString(),
      events: [{ clientEventId: `evt-${Math.round(lat * 1e5)}-${Math.round(lng * 1e5)}`, type: "IN", source: "MANUAL", trigger: "USER_TAP", deviceTime: now.toISOString(), lat, lng, accuracyM: 10, mockLocation: false }],
    },
    now,
  );
}

describe("site warnings", () => {
  it("no warning when taps are at the site", async () => {
    const now = at("2026-10-27", "07:00");
    await tapAt(26.19208, 50.53751, now);
    expect((await siteIssuesByStaff(db, [staff], now)).get(staff.id)).toEqual([]);
  });

  it("warns when the latest tap is far from every assigned site (wrong pin)", async () => {
    const now = at("2026-10-27", "07:00");
    await db.collection("attGeofences").doc(fenceId).update({ lat: 26.11322, lng: 50.32155 });
    await tapAt(26.19209, 50.53752, now);
    expect((await siteIssuesByStaff(db, [staff], now)).get(staff.id)).toEqual(["FAR_FROM_SITE"]);
  });

  it("warns when the staff member only has inactive sites", async () => {
    const now = at("2026-10-27", "07:00");
    await db.collection("attGeofences").doc(fenceId).update({ active: false });
    expect((await siteIssuesByStaff(db, [staff], now)).get(staff.id)).toEqual(["NO_ACTIVE_SITE"]);
  });
});

describe("site guards", () => {
  it("cannot switch off a site that active staff use", async () => {
    const now = at("2026-10-27", "07:00");
    await expect(removeSetup(db, admin, "geofences", fenceId, now)).rejects.toMatchObject({ status: 400 });
    await expect(updateSetup(db, admin, "geofences", fenceId, { active: false }, now)).rejects.toMatchObject({ status: 400 });
  });

  it("cannot assign an inactive site", async () => {
    const now = at("2026-10-27", "07:00");
    const other = await createSetup(db, admin, "geofences", { name: "Old", lat: 26.1, lng: 50.3 }, now);
    await removeSetup(db, admin, "geofences", other.id, now);
    await expect(updateStaff(db, admin, staff.id, { action: "update", changes: { geofenceIds: [other.id] } }, now)).rejects.toMatchObject({ status: 400 });
  });
});
