/**
 * Sample data and an end-to-end phone simulation for the Attendance module.
 *
 *   npx tsx scripts/attendance-sample.ts seed      # TEST contractor, shift, site, staff TEST-001 / TEST-002 (PIN 1234)
 *   npx tsx scripts/attendance-sample.ts phone     # acts like a staff phone against a running server (BASE_URL)
 *   npx tsx scripts/attendance-sample.ts cleanup   # removes everything created by this script
 *
 * Uses the Firebase project configured in .env.local / serviceAccount.json.
 * Every document it creates carries `sample: true`.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";
const SITE = { lat: 26.2172, lng: 50.5946 };
const TZ_OFFSET = "+03:00";

const at = (date: string, time: string) => new Date(`${date}T${time}:00${TZ_OFFSET}`).toISOString();
const bahrainDate = (offsetDays: number) => {
  const d = new Date(Date.now() + 3 * 3600_000 + offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
};

async function db() {
  const { getAdminDb } = await import("../src/lib/firebase/admin");
  return getAdminDb();
}

async function seed() {
  const adb = await db();
  const { createSetup, createStaff } = await import("../src/lib/attendance/setup");
  const { COL } = await import("../src/lib/attendance/store");

  const admins = await adb.collection("Users").where("role", "==", "Admin").limit(1).get();
  if (admins.empty) throw new Error("No WareOps user with role Admin found to act as supervisor");
  const adminId = admins.docs[0].id;
  const adminName = String(admins.docs[0].get("fullName") ?? admins.docs[0].get("name") ?? adminId);
  const actor = { userId: adminId, role: "Admin", isAdmin: true };
  const now = new Date();

  const existing = await adb.collection(COL.staffCodes).doc("TEST-001").get();
  if (existing.exists) {
    console.log("Sample data already exists. Run `cleanup` first to start again.");
    return;
  }

  const tag = async (col: string, id: string) => adb.collection(col).doc(id).set({ sample: true }, { merge: true });

  const contractor = await createSetup(adb, actor, "contractors", { name: "TEST Contractor (sample)" }, now);
  await tag(COL.contractors, contractor.id);
  const shift = await createSetup(adb, actor, "shifts", { name: "TEST Day shift", startTime: "07:00", endTime: "16:00" }, now);
  await tag(COL.shifts, shift.id);
  const site = await createSetup(adb, actor, "geofences", { name: "TEST Site (sample)", ...SITE, radiusM: 200 }, now);
  await tag(COL.geofences, site.id);

  for (const [code, name] of [
    ["TEST-001", "Test Staff One"],
    ["TEST-002", "Test Staff Two"],
  ]) {
    const staff = await createStaff(
      adb,
      actor,
      { staffCode: code, name, contractorId: contractor.id, supervisorId: adminId, shiftId: shift.id, geofenceIds: [site.id], pin: "1234" },
      // Created a week ago so the month report counts the sample days.
      new Date(now.getTime() - 7 * 86400_000),
    );
    await tag(COL.staff, staff.id);
    await tag(COL.staffCodes, code);
    console.log(`Created staff ${code} (PIN 1234), Supervisor 1 = ${adminName}`);
  }
  console.log("Seed done: TEST contractor, TEST Day shift 07:00–16:00, TEST site, TEST-001, TEST-002.");
}

type Json = Record<string, unknown>;

async function http(method: string, path: string, body?: unknown, token?: string, deviceId?: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(deviceId ? { "X-Device-Id": deviceId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  return { status: res.status, data };
}

let seq = 0;
function event(type: string, iso: string, extra: Json = {}) {
  seq += 1;
  return {
    clientEventId: `sample-${Date.now()}-${seq}`,
    type,
    source: type.startsWith("OT") ? "MANUAL" : "AUTO",
    trigger: type.startsWith("OT") ? "USER_TAP" : "SCHEDULED",
    deviceTime: iso,
    ...SITE,
    accuracyM: 15,
    mockLocation: false,
    ...extra,
  };
}

const ok = (label: string, pass: boolean, detail = "") => console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);

async function phone() {
  const device = "sample-device-0001";
  const d1 = bahrainDate(-1);
  const d2 = bahrainDate(-2);
  const d3 = bahrainDate(-3);

  const login = await http("POST", "/api/attendance/mobile/login", { staffCode: "test-001", pin: "1234", deviceId: device });
  ok("Staff login with staff ID + PIN", login.status === 200, `HTTP ${login.status} ${login.data.error ?? ""}`);
  if (login.status !== 200) return;
  const token = String(login.data.accessToken);

  const other = await http("POST", "/api/attendance/mobile/login", { staffCode: "TEST-001", pin: "1234", deviceId: "sample-device-9999" });
  ok("Second phone for the same staff is blocked", other.status === 403, String(other.data.error ?? ""));

  const wrong = await http("POST", "/api/attendance/mobile/login", { staffCode: "TEST-001", pin: "0000", deviceId: device });
  ok("Wrong PIN refused", wrong.status === 401);

  const me = await http("GET", "/api/attendance/mobile/me", undefined, token, device);
  const profile = me.data.profile as Json | undefined;
  ok("Phone profile with calendar and site", me.status === 200 && Array.isArray(profile?.calendar), `${(profile?.calendar as unknown[] | undefined)?.length ?? 0} calendar days`);

  const consent = await http("POST", "/api/attendance/mobile/consent", { version: (profile?.consent as Json)?.version, accepted: true }, token, device);
  ok("Consent stored", consent.status === 200);

  const jpeg = Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=",
    "base64",
  );
  const photoId = `sample-photo-${Date.now()}`;
  const form = new FormData();
  form.append("photoId", photoId);
  form.append("file", new Blob([jpeg], { type: "image/jpeg" }), `${photoId}.jpg`);
  const upload = await fetch(`${BASE_URL}/api/attendance/mobile/photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "X-Device-Id": device },
    body: form,
  });
  ok("Selfie upload to private storage", upload.status === 201 || upload.status === 200, `HTTP ${upload.status}`);

  const batch = [
    event("IN", at(d1, "06:52"), { trigger: "GEOFENCE_ENTER" }),
    event("OUT", at(d1, "16:04")),
    event("OT_IN", at(d1, "16:10"), { reason: "Too early test" }),
    event("OT_IN", at(d1, "16:45"), { reason: "Container unloading (sample)", photoRef: photoId }),
    event("OT_OUT", at(d1, "18:50")),
    event("IN", at(d2, "07:22")),
    event("OUT", at(d2, "16:01")),
    event("IN", at(d3, "06:58"), { mockLocation: true }),
    event("OUT", at(d3, "16:02")),
  ];
  const sync = await http("POST", "/api/attendance/mobile/events", { sentAt: new Date().toISOString(), events: batch }, token, device);
  const results = (sync.data.results as { status: string; code?: string; message?: string }[]) ?? [];
  ok("Offline batch accepted", sync.status === 200, results.map((r) => r.status + (r.code ? `:${r.code}` : "")).join(", "));
  const early = results.find((r) => r.code === "OT_TOO_EARLY");
  ok("OT In before shift end + 30 min is blocked", !!early, early?.message);

  const again = await http("POST", "/api/attendance/mobile/events", { sentAt: new Date().toISOString(), events: batch }, token, device);
  const dup = (again.data.results as { status: string }[]) ?? [];
  ok("Re-sending the same batch creates no duplicates", dup.every((r) => r.status === "DUPLICATE"));

  const health = await http(
    "POST",
    "/api/attendance/mobile/health",
    {
      locationPermission: "WHILE_IN_USE",
      gpsEnabled: true,
      batteryOptimised: true,
      notificationsEnabled: true,
      mockLocationDetected: false,
      rooted: false,
      appVersion: "1.0.0",
      manufacturer: "Samsung",
      model: "Sample A15",
    },
    token,
    device,
  );
  ok("Device health reported", health.status === 200);

  const history = await http("GET", `/api/attendance/mobile/history?month=${d1.slice(0, 7)}`, undefined, token, device);
  const days = ((history.data.history as Json)?.days as { date: string; status: string; regularMinutes: number; flags: string[] }[]) ?? [];
  const day = (date: string) => days.find((d) => d.date === date);
  ok(`${d1}: on time → PRESENT 9 h`, day(d1)?.status === "PRESENT" && day(d1)?.regularMinutes === 540, JSON.stringify(day(d1) ?? null));
  ok(`${d2}: IN 07:22 → LATE`, day(d2)?.status === "LATE", JSON.stringify(day(d2) ?? null));
  ok(`${d3}: fake GPS flagged, not rejected`, !!day(d3)?.flags.includes("MOCK_LOCATION"), JSON.stringify(day(d3) ?? null));
  const ot = ((history.data.history as Json)?.overtime as { status: string; minutes: number; rateType: string }[]) ?? [];
  ok("Overtime request PENDING for supervisor", ot.some((o) => o.status === "PENDING" && o.minutes === 120), JSON.stringify(ot));

  const comment = await http("POST", "/api/attendance/mobile/comments", { date: d2, text: "Bus was late (sample comment)" }, token, device);
  ok("Staff comment on a flagged day", comment.status === 200);

  // Block / delete flow on the second account (through the services, as a supervisor would in WareOps)
  const adb = await db();
  const { updateStaff } = await import("../src/lib/attendance/setup");
  const { COL } = await import("../src/lib/attendance/store");
  const code = await adb.collection(COL.staffCodes).doc("TEST-002").get();
  if (code.exists) {
    const staffId = String(code.get("staffId"));
    const supervisorId = String((await adb.collection(COL.staff).doc(staffId).get()).get("supervisorId"));
    const actor = { userId: supervisorId, role: "Admin", isAdmin: true };
    const l2 = await http("POST", "/api/attendance/mobile/login", { staffCode: "TEST-002", pin: "1234", deviceId: "sample-device-0002" });
    const t2 = String(l2.data.accessToken);
    await updateStaff(adb, actor, staffId, { action: "deactivate" }, new Date());
    const blocked = await http("GET", "/api/attendance/mobile/me", undefined, t2, "sample-device-0002");
    ok("Blocked staff is logged out at once", blocked.status === 403, String(blocked.data.error ?? ""));
    const relog = await http("POST", "/api/attendance/mobile/login", { staffCode: "TEST-002", pin: "1234", deviceId: "sample-device-0002" });
    ok("Blocked staff cannot log in", relog.status === 403, String(relog.data.error ?? ""));
    await updateStaff(adb, actor, staffId, { action: "activate" }, new Date());
    const back = await http("POST", "/api/attendance/mobile/login", { staffCode: "TEST-002", pin: "1234", deviceId: "sample-device-0002" });
    ok("Access allowed again → can log in", back.status === 200);
    await updateStaff(adb, actor, staffId, { action: "delete" }, new Date());
    const gone = await http("POST", "/api/attendance/mobile/login", { staffCode: "TEST-002", pin: "1234", deviceId: "sample-device-0002" });
    ok("Deleted staff can never log in again", gone.status === 401, String(gone.data.error ?? ""));
  }

  console.log("\nOpen WareOps → Attendance (Today / Overtime / Records / Month report) to review the TEST-001 sample data.");
}

async function cleanup() {
  const adb = await db();
  const { COL } = await import("../src/lib/attendance/store");
  const staffSnap = await adb.collection(COL.staff).where("sample", "==", true).get();
  const staffIds = staffSnap.docs.map((d) => d.id);
  let removed = 0;
  const del = async (ref: FirebaseFirestore.DocumentReference) => {
    await ref.delete();
    removed += 1;
  };

  for (const col of [COL.events, COL.days, COL.overtime, COL.corrections, COL.consents, COL.photos]) {
    for (const id of staffIds) {
      const snap = await adb.collection(col).where("staffId", "==", id).get();
      for (const d of snap.docs) {
        if (col === COL.photos) {
          try {
            const { getStorage } = await import("firebase-admin/storage");
            const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "").replace(/^gs:\/\//, "");
            await getStorage().bucket(bucketName || undefined).file(String(d.get("path"))).delete({ ignoreNotFound: true });
          } catch {
            // file already gone
          }
        }
        await del(d.ref);
      }
    }
  }
  for (const id of staffIds) {
    await del(adb.collection(COL.deviceHealth).doc(id));
    const audit = await adb.collection(COL.audit).where("entityId", "==", id).get();
    for (const d of audit.docs) await del(d.ref);
  }
  for (const col of [COL.staff, COL.staffCodes, COL.contractors, COL.shifts, COL.geofences]) {
    const snap = await adb.collection(col).where("sample", "==", true).get();
    for (const d of snap.docs) {
      const audit = await adb.collection(COL.audit).where("entityId", "==", d.id).get();
      for (const a of audit.docs) await del(a.ref);
      await del(d.ref);
    }
  }
  console.log(`Cleanup done: removed ${removed} sample documents.`);
}

const command = process.argv[2];
const run = command === "seed" ? seed : command === "phone" ? phone : command === "cleanup" ? cleanup : null;
if (!run) {
  console.log("Usage: npx tsx scripts/attendance-sample.ts seed | phone | cleanup");
  process.exit(1);
}
run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
