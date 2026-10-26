import { z } from "zod";
import { DEFAULT_GEOFENCE_RADIUS_M, DEFAULT_SHIFT_GRACE_MIN, MOBILE_AUTH } from "./config";
import { canManageStaff, type Actor } from "./actor";
import { writeAudit } from "./audit";
import { badRequest, conflict, forbidden, notFound } from "./errors";
import { shiftCrossesMidnight } from "./rules";
import { COL, getStaff, normalizeStaffCode, toStaffPublic, type Db } from "./store";
import { isValidLocalDate } from "./time";
import { hashPin, isValidPin } from "./tokens";
import type { Contractor, Geofence, Holiday, Shift, Staff } from "./types";

/** WareOps user accounts (supervisors / approvers). Read-only from this module. */
const USERS_COLLECTION = "Users";

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");
const name = z.string().trim().min(1).max(120);

const schemas = {
  contractors: z.object({ name }),
  shifts: z.object({
    name,
    startTime: timeOfDay,
    endTime: timeOfDay,
    crossesMidnight: z.boolean().optional(),
    graceBeforeMin: z.number().int().min(0).max(120).default(DEFAULT_SHIFT_GRACE_MIN),
    graceAfterMin: z.number().int().min(0).max(120).default(DEFAULT_SHIFT_GRACE_MIN),
    breakMinutes: z.number().int().min(0).max(240).default(0),
  }),
  geofences: z.object({
    name,
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    radiusM: z.number().int().min(50).max(2000).default(DEFAULT_GEOFENCE_RADIUS_M),
  }),
  holidays: z.object({
    date: z.string().refine(isValidLocalDate, "Invalid date"),
    name,
    type: z.enum(["PUBLIC", "COMPANY"]).default("PUBLIC"),
  }),
} as const;

export type SetupEntity = keyof typeof schemas;
export const SETUP_ENTITIES = Object.keys(schemas) as SetupEntity[];

const collectionFor: Record<SetupEntity, string> = {
  contractors: COL.contractors,
  shifts: COL.shifts,
  geofences: COL.geofences,
  holidays: COL.holidays,
};

export function isSetupEntity(value: string): value is SetupEntity {
  return (SETUP_ENTITIES as string[]).includes(value);
}

function normalize(entity: SetupEntity, data: Record<string, unknown>) {
  if (entity === "shifts") {
    const shift = data as Omit<Shift, "id" | "active">;
    return { ...shift, crossesMidnight: shiftCrossesMidnight({ ...shift, crossesMidnight: !!shift.crossesMidnight }) };
  }
  return data;
}

export async function listSetup(db: Db, entity: SetupEntity) {
  const snap = await db.collection(collectionFor[entity]).get();
  return snap.docs.map((d) => ({ ...d.data(), id: d.id })) as (Contractor | Shift | Geofence | (Holiday & { id: string }))[];
}

export async function createSetup(db: Db, actor: Actor, entity: SetupEntity, body: unknown, now: Date) {
  const parsed = schemas[entity].safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid data");
  const data = normalize(entity, parsed.data as Record<string, unknown>);
  const col = db.collection(collectionFor[entity]);
  let id: string;
  if (entity === "holidays") {
    id = (data as Holiday).date;
    const ref = col.doc(id);
    if ((await ref.get()).exists) throw conflict("A holiday already exists on that date");
    await ref.set(data);
  } else {
    const ref = await col.add({ ...data, active: true, createdAt: now.toISOString() });
    id = ref.id;
  }
  await writeAudit(db, { who: actor.userId, what: "CREATED", entity: collectionFor[entity], entityId: id, before: null, after: data }, now);
  return { ...data, id };
}

export async function updateSetup(db: Db, actor: Actor, entity: SetupEntity, id: string, body: unknown, now: Date) {
  const ref = db.collection(collectionFor[entity]).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw notFound();
  const before = snap.data() as Record<string, unknown>;
  const parsed = schemas[entity].partial().safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid data");
  const changes = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  if (entity === "holidays" && "date" in changes && changes.date !== id) {
    throw badRequest("Delete and re-create a holiday to change its date");
  }
  const after = normalize(entity, { ...before, ...changes });
  if (typeof (body as { active?: unknown })?.active === "boolean" && entity !== "holidays") {
    (after as Record<string, unknown>).active = (body as { active: boolean }).active;
  }
  await ref.set(after);
  await writeAudit(db, { who: actor.userId, what: "UPDATED", entity: collectionFor[entity], entityId: id, before, after }, now);
  return { ...after, id };
}

/** Holidays are deleted; everything else is deactivated so history keeps its references. */
export async function removeSetup(db: Db, actor: Actor, entity: SetupEntity, id: string, now: Date) {
  const ref = db.collection(collectionFor[entity]).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw notFound();
  const before = snap.data();
  if (entity === "holidays") await ref.delete();
  else await ref.update({ active: false });
  await writeAudit(
    db,
    { who: actor.userId, what: entity === "holidays" ? "DELETED" : "DEACTIVATED", entity: collectionFor[entity], entityId: id, before, after: null },
    now,
  );
}

// ---------------------------------------------------------------------------
// Staff accounts
// ---------------------------------------------------------------------------

const pin = z
  .string()
  .refine((v) => isValidPin(v, MOBILE_AUTH.pinMinLength, MOBILE_AUTH.pinMaxLength), {
    message: `PIN must be ${MOBILE_AUTH.pinMinLength}-${MOBILE_AUTH.pinMaxLength} digits`,
  });

const staffFields = z.object({
  staffCode: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
  name,
  contractorId: z.string().min(1),
  supervisorId: z.string().min(1),
  backupApproverId: z.string().min(1).nullable().default(null),
  shiftId: z.string().min(1),
  geofenceIds: z.array(z.string().min(1)).default([]),
});

const createStaffSchema = staffFields.extend({ pin });

const staffActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), changes: staffFields.partial() }),
  z.object({ action: z.literal("setPin"), pin }),
  z.object({ action: z.literal("resetDevice") }),
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("deactivate") }),
]);

async function assertRefs(db: Db, refs: Partial<z.infer<typeof staffFields>>) {
  const checks: [string, string, string | null | undefined][] = [
    [COL.contractors, "Contractor", refs.contractorId],
    [COL.shifts, "Shift", refs.shiftId],
    [USERS_COLLECTION, "Supervisor", refs.supervisorId],
    [USERS_COLLECTION, "Backup approver", refs.backupApproverId],
  ];
  for (const [col, label, id] of checks) {
    if (!id) continue;
    if (!(await db.collection(col).doc(id).get()).exists) throw badRequest(`${label} not found`);
  }
  for (const id of refs.geofenceIds ?? []) {
    if (!(await db.collection(COL.geofences).doc(id).get()).exists) throw badRequest("Geofence not found");
  }
}

export async function createStaff(db: Db, actor: Actor, body: unknown, now: Date) {
  const parsed = createStaffSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid staff data");
  const { pin: rawPin, ...fields } = parsed.data;
  const staffCode = normalizeStaffCode(fields.staffCode);
  await assertRefs(db, fields);

  const staffRef = db.collection(COL.staff).doc();
  const codeRef = db.collection(COL.staffCodes).doc(staffCode);
  const staff: Omit<Staff, "id"> = {
    ...fields,
    staffCode,
    deviceId: null,
    deviceBoundAt: null,
    active: true,
    pinHash: hashPin(rawPin),
    pinFailures: 0,
    pinLockedUntil: null,
    tokenVersion: 0,
    consentAt: null,
    consentVersion: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await db.runTransaction(async (tx) => {
    if ((await tx.get(codeRef)).exists) throw conflict(`Staff ID ${staffCode} is already in use`);
    tx.create(codeRef, { staffId: staffRef.id });
    tx.create(staffRef, staff);
  });
  const created = { ...staff, id: staffRef.id };
  await writeAudit(db, { who: actor.userId, what: "STAFF_CREATED", entity: COL.staff, entityId: created.id, before: null, after: toStaffPublic(created) }, now);
  return toStaffPublic(created);
}

export async function updateStaff(db: Db, actor: Actor, staffId: string, body: unknown, now: Date) {
  const parsed = staffActionSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  const staff = await getStaff(db, staffId);
  if (!canManageStaff(actor, staff)) throw forbidden("You do not supervise this staff member");

  const ref = db.collection(COL.staff).doc(staffId);
  const stamp = { updatedAt: now.toISOString() };
  const revoke = { tokenVersion: (staff.tokenVersion ?? 0) + 1 };
  const input = parsed.data;
  let updates: Partial<Staff>;
  let what: string;

  switch (input.action) {
    case "update": {
      const changes = Object.fromEntries(Object.entries(input.changes).filter(([, v]) => v !== undefined)) as Partial<Staff>;
      await assertRefs(db, changes as Partial<z.infer<typeof staffFields>>);
      updates = { ...changes, ...stamp };
      what = "STAFF_UPDATED";
      if (changes.staffCode) {
        const newCode = normalizeStaffCode(changes.staffCode);
        updates.staffCode = newCode;
        if (newCode !== staff.staffCode) {
          await db.runTransaction(async (tx) => {
            const newRef = db.collection(COL.staffCodes).doc(newCode);
            if ((await tx.get(newRef)).exists) throw conflict(`Staff ID ${newCode} is already in use`);
            tx.create(newRef, { staffId });
            tx.delete(db.collection(COL.staffCodes).doc(staff.staffCode));
            tx.update(ref, updates);
          });
          break;
        }
      }
      await ref.update(updates);
      break;
    }
    case "setPin":
      updates = { pinHash: hashPin(input.pin), pinFailures: 0, pinLockedUntil: null, ...revoke, ...stamp };
      what = "STAFF_PIN_SET";
      await ref.update(updates);
      break;
    case "resetDevice":
      updates = { deviceId: null, deviceBoundAt: null, ...revoke, ...stamp };
      what = "STAFF_DEVICE_RESET";
      await ref.update(updates);
      break;
    case "activate":
      updates = { active: true, ...stamp };
      what = "STAFF_ACTIVATED";
      await ref.update(updates);
      break;
    case "deactivate":
      updates = { active: false, ...revoke, ...stamp };
      what = "STAFF_DEACTIVATED";
      await ref.update(updates);
      break;
  }

  const after = { ...staff, ...updates };
  await writeAudit(
    db,
    { who: actor.userId, what, entity: COL.staff, entityId: staffId, before: toStaffPublic(staff), after: toStaffPublic(after) },
    now,
  );
  return toStaffPublic(after);
}
