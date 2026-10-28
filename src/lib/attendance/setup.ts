import { z } from "zod";
import { DEFAULT_GEOFENCE_RADIUS_M, DEFAULT_SHIFT_GRACE_MIN, MOBILE_AUTH } from "./config";
import { canManageStaff, type Actor } from "./actor";
import { writeAudit } from "./audit";
import { badRequest, conflict, forbidden, notFound } from "./errors";
import { shiftCrossesMidnight } from "./rules";
import { COL, getStaff, normalizeCpr, normalizeStaffCode, toStaffPublic, type Db } from "./store";
import { isValidLocalDate } from "./time";
import { hashPin, isValidPassword } from "./tokens";
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
  if (entity === "geofences" && before.active !== false && (after as Record<string, unknown>).active === false) {
    await assertSiteUnused(db, id);
  }
  await ref.set(after);
  await writeAudit(db, { who: actor.userId, what: "UPDATED", entity: collectionFor[entity], entityId: id, before, after }, now);
  return { ...after, id };
}

/** A site that active staff still use cannot be switched off (their phones would lose it silently). */
async function assertSiteUnused(db: Db, geofenceId: string) {
  const users = await db.collection(COL.staff).where("geofenceIds", "array-contains", geofenceId).get();
  const names = users.docs.filter((d) => d.get("active") && !d.get("deleted")).map((d) => String(d.get("name")));
  if (names.length) {
    throw badRequest(`This site is assigned to ${names.slice(0, 5).join(", ")}${names.length > 5 ? ` and ${names.length - 5} more` : ""}. Remove it from their profile first.`);
  }
}

/** Holidays are deleted; everything else is deactivated so history keeps its references. */
export async function removeSetup(db: Db, actor: Actor, entity: SetupEntity, id: string, now: Date) {
  const ref = db.collection(collectionFor[entity]).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw notFound();
  const before = snap.data();
  if (entity === "geofences") await assertSiteUnused(db, id);
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

const password = z
  .string()
  .refine((v) => isValidPassword(v, MOBILE_AUTH.passwordMinLength, MOBILE_AUTH.passwordMaxLength), {
    message: `Password must be ${MOBILE_AUTH.passwordMinLength}-${MOBILE_AUTH.passwordMaxLength} characters, without spaces at the start or end`,
  });

const optionalDate = z
  .string()
  .refine((v) => isValidLocalDate(v), "Invalid date")
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const staffFields = z.object({
  cprNo: z
    .string()
    .transform(normalizeCpr)
    .refine((v) => /^\d{9}$/.test(v), "CPR number must be 9 digits"),
  cprExpiry: optionalDate,
  visaExpiry: optionalDate,
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+\d\s-]*$/, "Phone number: digits, spaces, + and - only")
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  staffCode: z
    .string()
    .trim()
    .max(32)
    .regex(/^[A-Za-z0-9_-]*$/, "Staff code: letters, numbers, - and _ only")
    .optional(),
  name,
  contractorId: z.string().min(1),
  supervisorId: z.string().min(1),
  supervisor2Id: z.string().min(1).nullable().default(null),
  shiftId: z.string().min(1),
  geofenceIds: z.array(z.string().min(1)).default([]),
  webCheckin: z.boolean().default(false),
});

const createStaffSchema = staffFields.extend({ password });

/** Older clients send `pin`; treat it as the password. */
function withPasswordAlias(body: unknown) {
  if (body && typeof body === "object" && "pin" in body && !("password" in body)) {
    const { pin: legacy, ...rest } = body as Record<string, unknown>;
    return { ...rest, password: legacy };
  }
  return body;
}

const staffActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), changes: staffFields.partial() }),
  z.object({ action: z.literal("setPassword"), password }),
  z.object({ action: z.literal("resetDevice") }),
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("deactivate") }),
  z.object({ action: z.literal("delete") }),
]);

async function assertRefs(db: Db, refs: Partial<z.infer<typeof staffFields>>, current?: Staff) {
  const supervisor1 = refs.supervisorId ?? current?.supervisorId;
  const supervisor2 = refs.supervisor2Id !== undefined ? refs.supervisor2Id : current?.supervisor2Id;
  if (supervisor1 && supervisor2 && supervisor1 === supervisor2) {
    throw badRequest("Supervisor 1 and Supervisor 2 must be different people");
  }
  const checks: [string, string, string | null | undefined][] = [
    [COL.contractors, "Contractor", refs.contractorId],
    [COL.shifts, "Shift", refs.shiftId],
    [USERS_COLLECTION, "Supervisor 1", refs.supervisorId],
    [USERS_COLLECTION, "Supervisor 2", refs.supervisor2Id],
  ];
  for (const [col, label, id] of checks) {
    if (!id) continue;
    if (!(await db.collection(col).doc(id).get()).exists) throw badRequest(`${label} not found`);
  }
  for (const id of refs.geofenceIds ?? []) {
    const fence = await db.collection(COL.geofences).doc(id).get();
    if (!fence.exists) throw badRequest("Geofence not found");
    if (fence.get("active") === false) throw badRequest(`Site "${fence.get("name")}" is inactive. Untick it or activate it first.`);
  }
}

export async function createStaff(db: Db, actor: Actor, body: unknown, now: Date) {
  const parsed = createStaffSchema.safeParse(withPasswordAlias(body));
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid staff data");
  const { password: rawPassword, ...fields } = parsed.data;
  const staffCode = normalizeStaffCode(fields.staffCode || fields.cprNo);
  await assertRefs(db, fields);

  const staffRef = db.collection(COL.staff).doc();
  const codeRef = db.collection(COL.staffCodes).doc(staffCode);
  const cprRef = db.collection(COL.staffCpr).doc(fields.cprNo);
  const staff: Omit<Staff, "id"> = {
    ...fields,
    staffCode,
    deviceId: null,
    deviceBoundAt: null,
    active: true,
    pinHash: hashPin(rawPassword),
    pinFailures: 0,
    pinLockedUntil: null,
    tokenVersion: 0,
    consentAt: null,
    consentVersion: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await db.runTransaction(async (tx) => {
    const [code, cpr] = [await tx.get(codeRef), await tx.get(cprRef)];
    if (cpr.exists) throw conflict(`CPR number ${fields.cprNo} is already registered`);
    if (code.exists) throw conflict(`Staff code ${staffCode} is already in use`);
    tx.create(codeRef, { staffId: staffRef.id });
    tx.create(cprRef, { staffId: staffRef.id });
    tx.create(staffRef, staff);
  });
  const created = { ...staff, id: staffRef.id };
  await writeAudit(db, { who: actor.userId, what: "STAFF_CREATED", entity: COL.staff, entityId: created.id, before: null, after: toStaffPublic(created) }, now);
  return toStaffPublic(created);
}

export async function updateStaff(db: Db, actor: Actor, staffId: string, rawBody: unknown, now: Date) {
  const body =
    rawBody && typeof rawBody === "object" && (rawBody as { action?: string }).action === "setPin"
      ? { ...(withPasswordAlias(rawBody) as object), action: "setPassword" }
      : rawBody;
  const parsed = staffActionSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  const staff = await getStaff(db, staffId);
  if (!canManageStaff(actor, staff)) throw forbidden("You do not supervise this staff member");
  if (staff.deleted) throw conflict("This staff account was deleted. Create a new account instead.");

  const ref = db.collection(COL.staff).doc(staffId);
  const stamp = { updatedAt: now.toISOString() };
  const revoke = { tokenVersion: (staff.tokenVersion ?? 0) + 1 };
  const input = parsed.data;
  let updates: Partial<Staff>;
  let what: string;

  switch (input.action) {
    case "update": {
      const raw = (body as { changes?: Record<string, unknown> }).changes ?? {};
      // Only fields the caller actually sent (zod fills defaults for missing optional fields).
      const changes = Object.fromEntries(
        Object.entries(input.changes).filter(([k, v]) => v !== undefined && k in raw),
      ) as Partial<Staff>;
      await assertRefs(db, changes as Partial<z.infer<typeof staffFields>>, staff);
      updates = { ...changes, ...stamp };
      what = "STAFF_UPDATED";
      const newCode = changes.staffCode ? normalizeStaffCode(changes.staffCode) : null;
      if ("staffCode" in changes) {
        if (newCode) updates.staffCode = newCode;
        else delete updates.staffCode;
      }
      const codeChanged = !!newCode && newCode !== staff.staffCode;
      const cprChanged = !!changes.cprNo && changes.cprNo !== staff.cprNo;
      await db.runTransaction(async (tx) => {
        const newCodeRef = codeChanged ? db.collection(COL.staffCodes).doc(newCode!) : null;
        const newCprRef = cprChanged ? db.collection(COL.staffCpr).doc(changes.cprNo!) : null;
        if (newCodeRef && (await tx.get(newCodeRef)).exists) throw conflict(`Staff code ${newCode} is already in use`);
        if (newCprRef && (await tx.get(newCprRef)).exists) throw conflict(`CPR number ${changes.cprNo} is already registered`);
        if (newCodeRef) {
          tx.create(newCodeRef, { staffId });
          tx.delete(db.collection(COL.staffCodes).doc(staff.staffCode));
        }
        if (newCprRef) {
          tx.create(newCprRef, { staffId });
          if (staff.cprNo) tx.delete(db.collection(COL.staffCpr).doc(staff.cprNo));
        }
        tx.update(ref, updates);
      });
      break;
    }
    case "setPassword":
      if (!actor.isAdmin) throw forbidden("Only an admin can set or change a staff app password");
      updates = { pinHash: hashPin(input.password), pinFailures: 0, pinLockedUntil: null, ...revoke, ...stamp };
      what = "STAFF_PASSWORD_SET";
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
    case "delete": {
      const [events, days, overtime] = await Promise.all([
        db.collection(COL.events).where("staffId", "==", staffId).limit(1).get(),
        db.collection(COL.days).where("staffId", "==", staffId).limit(1).get(),
        db.collection(COL.overtime).where("staffId", "==", staffId).limit(1).get(),
      ]);
      const hasHistory = !events.empty || !days.empty || !overtime.empty;
      updates = {
        active: false,
        deleted: true,
        deletedAt: now.toISOString(),
        deletedBy: actor.userId,
        pinHash: null,
        deviceId: null,
        deviceBoundAt: null,
        ...revoke,
        ...stamp,
      };
      what = hasHistory ? "STAFF_DELETED_HISTORY_KEPT" : "STAFF_DELETED";
      const codeRef = db.collection(COL.staffCodes).doc(staff.staffCode);
      const cprRef = staff.cprNo ? db.collection(COL.staffCpr).doc(staff.cprNo) : null;
      await db.runTransaction(async (tx) => {
        const code = await tx.get(codeRef);
        const cpr = cprRef ? await tx.get(cprRef) : null;
        if (code.exists && (code.data() as { staffId?: string }).staffId === staffId) tx.delete(codeRef);
        if (cprRef && cpr?.exists && (cpr.data() as { staffId?: string }).staffId === staffId) tx.delete(cprRef);
        if (hasHistory) tx.update(ref, updates);
        else tx.delete(ref);
      });
      await db.collection(COL.deviceHealth).doc(staffId).delete();
      break;
    }
  }

  const after = { ...staff, ...updates };
  await writeAudit(
    db,
    { who: actor.userId, what, entity: COL.staff, entityId: staffId, before: toStaffPublic(staff), after: toStaffPublic(after) },
    now,
  );
  return toStaffPublic(after);
}
