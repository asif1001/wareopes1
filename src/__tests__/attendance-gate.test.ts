import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/attendance/actor";
import { currentGateCode, extractGateCode, gateCode, gateScreenKey, verifyGateCode } from "@/lib/attendance/gate";
import { ingestEvents } from "@/lib/attendance/ingest";
import { loginStaff } from "@/lib/attendance/mobile-auth";
import { createSetup, createStaff, listSetup } from "@/lib/attendance/setup";
import { COL, getStaff } from "@/lib/attendance/store";
import { zonedToUtc } from "@/lib/attendance/time";
import type { AttendanceDay, AttendanceEvent, OvertimeRequest, Staff } from "@/lib/attendance/types";
import { FakeFirestore } from "./helpers/fake-firestore";

const TZ = "Asia/Bahrain";
const at = (date: string, time: string) => zonedToUtc(date, time, TZ);
const MONDAY = "2026-11-02";
const FRIDAY = "2026-11-06";
const admin: Actor = { userId: "admin1", role: "Admin", isAdmin: true };

let fake: FakeFirestore;
let db: ReturnType<FakeFirestore["asFirestore"]>;
let staff: Staff;
let siteId: string;
let otherSiteId: string;
let seq = 0;

beforeAll(() => {
  process.env.ATTENDANCE_TOKEN_SECRET = "test-secret-test-secret-test-secret-123";
});

async function seed() {
  fake = new FakeFirestore();
  db = fake.asFirestore();
  for (const id of ["sup1", "admin1"]) await db.collection("Users").doc(id).set({ fullName: id });
  const now = at(MONDAY, "00:00");
  const contractor = await createSetup(db, admin, "contractors", { name: "Acme Manpower" }, now);
  const shift = await createSetup(db, admin, "shifts", { name: "Day", startTime: "07:00", endTime: "16:00" }, now);
  const fence = await createSetup(db, admin, "geofences", { name: "EKK WH", lat: 26.15, lng: 50.6, radiusM: 200 }, now);
  const other = await createSetup(db, admin, "geofences", { name: "Other WH", lat: 26.2, lng: 50.5, radiusM: 200 }, now);
  siteId = fence.id;
  otherSiteId = other.id;
  const created = await createStaff(
    db,
    admin,
    {
      staffCode: "c-101",
      cprNo: "900000101",
      cprExpiry: "2027-05-01",
      visaExpiry: "2027-05-01",
      phone: "+973 3300 0101",
      name: "Ali",
      contractorId: contractor.id,
      supervisorId: "sup1",
      shiftId: shift.id,
      geofenceIds: [fence.id],
      pin: "1234",
    },
    now,
  );
  staff = await getStaff(db, created.id);
  ({ staff } = await loginStaff(db, { staffCode: "C-101", pin: "1234", deviceId: "device-aaaa-1111" }, now));
}

/** A check-in by scanning the gate QR, with GPS off unless a location is given. */
function qr(type: AttendanceEvent["type"], date: string, time: string, extra: Record<string, unknown> = {}) {
  seq += 1;
  const when = at(date, time);
  return {
    clientEventId: `client-event-${seq}`,
    type,
    source: "QR",
    trigger: "QR_SCAN",
    deviceTime: when.toISOString(),
    gateCode: `https://example.test/checkin/?gate=${encodeURIComponent(gateCode(siteId, when).code)}`,
    lat: null,
    lng: null,
    accuracyM: null,
    mockLocation: false,
    ...extra,
  };
}

function gps(type: AttendanceEvent["type"], date: string, time: string, extra: Record<string, unknown> = {}) {
  seq += 1;
  return {
    clientEventId: `client-event-${seq}`,
    type,
    source: "AUTO",
    trigger: "SCHEDULED",
    deviceTime: at(date, time).toISOString(),
    lat: 26.15,
    lng: 50.6,
    accuracyM: 15,
    mockLocation: false,
    ...extra,
  };
}

async function sync(events: unknown[], now: Date, sentAt = now) {
  return ingestEvents(db, await getStaff(db, staff.id), { sentAt: sentAt.toISOString(), events }, now);
}

const events = () => fake.all<AttendanceEvent>(COL.events);
const overtime = () => fake.all<OvertimeRequest>(COL.overtime);
const dayDoc = (date: string) => fake.all<AttendanceDay>(COL.days).find((d) => d.id === `${staff.id}_${date}`);

describe("gate QR codes", () => {
  beforeEach(() => seed());

  const sites = () => [
    { id: siteId, active: true },
    { id: otherSiteId, active: false },
  ];

  it("accepts the current code, bare or as the check-in link", () => {
    const now = at(MONDAY, "07:00");
    const { code } = gateCode(siteId, now);
    expect(verifyGateCode(code, now, sites())).toEqual({ ok: true, siteId });
    expect(extractGateCode(`https://wareopes1.vercel.app/checkin/?gate=${encodeURIComponent(code)}`)).toBe(code);
    expect(verifyGateCode(`https://wareopes1.vercel.app/checkin/?gate=${code}`, new Date(now.getTime() + 60_000), sites()).ok).toBe(true);
  });

  it("rejects old, tampered, foreign and inactive-site codes", () => {
    const now = at(MONDAY, "07:00");
    const { code } = gateCode(siteId, now);
    expect(verifyGateCode(code, new Date(now.getTime() + 5 * 60_000), sites())).toMatchObject({ ok: false, reason: "EXPIRED" });
    expect(verifyGateCode(code.replace(/.$/, code.endsWith("A") ? "B" : "A"), now, sites())).toMatchObject({ ok: false, reason: "SIGNATURE" });
    expect(verifyGateCode(code.replace(siteId, otherSiteId), now, sites())).toMatchObject({ ok: false, reason: "SIGNATURE" });
    expect(verifyGateCode(gateCode(otherSiteId, now).code, now, sites())).toMatchObject({ ok: false, reason: "WRONG_SITE" });
    expect(verifyGateCode("hello", now, sites())).toMatchObject({ ok: false, reason: "FORMAT" });
  });

  it("serves codes only with the site's current display key, and never lists the key", async () => {
    const { key } = await gateScreenKey(db, siteId, false);
    expect((await gateScreenKey(db, siteId, false)).key).toBe(key);
    const now = at(MONDAY, "07:00");
    expect((await currentGateCode(db, siteId, key, now)).code).toBe(gateCode(siteId, now).code);
    await expect(currentGateCode(db, siteId, "wrong-key", now)).rejects.toMatchObject({ status: 403 });

    const { key: renewed } = await gateScreenKey(db, siteId, true);
    expect(renewed).not.toBe(key);
    await expect(currentGateCode(db, siteId, key, now)).rejects.toMatchObject({ code: "GATE_KEY_INVALID" });

    const listed = (await listSetup(db, "geofences")) as unknown as Record<string, unknown>[];
    expect(listed.some((g) => "gateKey" in g)).toBe(false);
    expect(listed.find((g) => g.id === siteId)).toMatchObject({ hasGateScreen: true });
  });
});

describe("check-in by gate QR", () => {
  beforeEach(() => seed());

  it("records a QR scan with GPS off as on-site, not manual", async () => {
    const [result] = await sync([qr("IN", MONDAY, "06:55")], at(MONDAY, "06:55"));
    expect(result.status).toBe("ACCEPTED");
    const [stored] = events();
    expect(stored).toMatchObject({ source: "QR", insideGeofence: true, geofenceId: siteId });
    expect(stored.flags).not.toContain("NO_LOCATION");
    expect(stored.flags).not.toContain("MANUAL");
    expect(dayDoc(MONDAY)!.flags).not.toContain("MANUAL_IN");
  });

  it("accepts a scan made offline when it is synced hours later", async () => {
    const [result] = await sync([qr("IN", MONDAY, "06:55")], at(MONDAY, "12:30"));
    expect(result.status).toBe("ACCEPTED");
    expect(events()[0].source).toBe("QR");
  });

  it("treats an old or copied code as a manual record and flags it", async () => {
    const stale = gateCode(siteId, at(MONDAY, "06:40")).code;
    await sync([qr("IN", MONDAY, "06:55", { gateCode: stale })], at(MONDAY, "06:55"));
    const [stored] = events();
    expect(stored.source).toBe("MANUAL");
    expect(stored.flags).toEqual(expect.arrayContaining(["QR_INVALID", "MANUAL", "NO_LOCATION"]));
    expect(dayDoc(MONDAY)!.flags).toContain("MANUAL_IN");
  });

  it("flags a valid code scanned with a good GPS fix far from the site (code sent to someone)", async () => {
    await sync([qr("IN", MONDAY, "06:55", { lat: 26.25, lng: 50.6, accuracyM: 20 })], at(MONDAY, "06:55"));
    const [stored] = events();
    expect(stored.source).toBe("QR");
    expect(stored.flags).toContain("OUTSIDE_GEOFENCE");
  });

  it("ignores a weak GPS fix when the QR is valid", async () => {
    await sync([qr("IN", MONDAY, "06:55", { lat: 26.25, lng: 50.6, accuracyM: 1500 })], at(MONDAY, "06:55"));
    expect(events()[0].flags).not.toContain("OUTSIDE_GEOFENCE");
    expect(events()[0].flags).not.toContain("POOR_ACCURACY");
  });
});

describe("overtime from a late check-out", () => {
  beforeEach(() => seed());

  it("creates a pending overtime claim, extended by a later check-out", async () => {
    await sync([gps("IN", MONDAY, "06:55")], at(MONDAY, "06:55"));
    await sync([qr("OUT", MONDAY, "19:00")], at(MONDAY, "19:00"));
    let [ot] = overtime();
    expect(ot).toMatchObject({
      status: "PENDING",
      minutes: 150,
      otIn: at(MONDAY, "16:30").toISOString(),
      otOut: at(MONDAY, "19:00").toISOString(),
      dayType: "WORKDAY",
    });
    expect(ot.flags).toContain("AUTO_DETECTED");
    expect(ot.reason).toContain("19:00");

    await sync([qr("OUT", MONDAY, "20:00")], at(MONDAY, "20:00"));
    expect(overtime()).toHaveLength(1);
    [ot] = overtime();
    expect(ot).toMatchObject({ minutes: 210, otOut: at(MONDAY, "20:00").toISOString() });
    expect(dayDoc(MONDAY)!.lastOut).toBe(at(MONDAY, "20:00").toISOString());
  });

  it("does nothing for a normal check-out", async () => {
    await sync([gps("IN", MONDAY, "06:55"), gps("OUT", MONDAY, "16:20")], at(MONDAY, "16:20"));
    expect(overtime()).toHaveLength(0);
  });

  it("leaves overtime the staff member started with OT In alone", async () => {
    await sync([gps("IN", MONDAY, "06:55"), gps("OUT", MONDAY, "16:05")], at(MONDAY, "16:05"));
    await sync([gps("OT_IN", MONDAY, "16:40"), gps("OT_OUT", MONDAY, "18:40")], at(MONDAY, "18:40"));
    await sync([qr("OUT", MONDAY, "19:00")], at(MONDAY, "19:00"));
    expect(overtime()).toHaveLength(1);
    expect(overtime()[0].flags ?? []).not.toContain("AUTO_DETECTED");
  });

  it("does not auto-create overtime on a weekly off-day", async () => {
    await sync([gps("IN", FRIDAY, "08:00"), qr("OUT", FRIDAY, "19:00")], at(FRIDAY, "19:00"));
    expect(overtime()).toHaveLength(0);
  });
});
