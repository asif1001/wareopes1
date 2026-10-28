import { z } from "zod";
import { MOBILE_AUTH } from "./config";
import { writeAudit } from "./audit";
import { AttendanceError, badRequest, forbidden, tooMany, unauthorized } from "./errors";
import { COL, getStaff, normalizeCpr, normalizeStaffCode, type Db } from "./store";
import { getTokenSecret, signToken, verifyPin, verifyToken } from "./tokens";
import type { Staff } from "./types";

export const deviceIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);

/** `cprNo` is the login; `staffCode` and `pin` are still accepted from older app builds. */
const loginSchema = z
  .object({
    cprNo: z.string().trim().max(32).optional(),
    staffCode: z.string().trim().max(32).optional(),
    password: z.string().max(64).optional(),
    pin: z.string().max(64).optional(),
    deviceId: deviceIdSchema,
    /** "web" = iPhone / browser check-in page. */
    client: z.enum(["android", "web"]).default("android"),
  })
  .refine((v) => !!(v.cprNo || v.staffCode) && !!(v.password ?? v.pin));

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
};

const INVALID = "CPR number or password is incorrect.";

export type MobileClient = "android" | "web";

const WEB_NOT_ALLOWED = "iPhone check-in is not turned on for your account. Ask your supervisor.";

function issueTokens(staff: Staff, now: Date, client: MobileClient): TokenPair {
  const secret = getTokenSecret();
  const claims = { sub: staff.id, did: staff.deviceId ?? "", ver: staff.tokenVersion ?? 0, cli: client };
  return {
    accessToken: signToken({ ...claims, typ: "access" }, MOBILE_AUTH.accessTokenTtlSec, secret, now),
    refreshToken: signToken({ ...claims, typ: "refresh" }, MOBILE_AUTH.refreshTokenTtlSec, secret, now),
    accessExpiresIn: MOBILE_AUTH.accessTokenTtlSec,
  };
}

async function findStaffId(db: Db, loginId: string): Promise<string | null> {
  const cpr = normalizeCpr(loginId);
  if (/^\d{9}$/.test(cpr)) {
    const snap = await db.collection(COL.staffCpr).doc(cpr).get();
    if (snap.exists) return String((snap.data() as { staffId: string }).staffId);
  }
  // Accounts created before CPR login, or a staff code typed instead of the CPR.
  const code = normalizeStaffCode(loginId);
  if (!code) return null;
  const snap = await db.collection(COL.staffCodes).doc(code).get();
  return snap.exists ? String((snap.data() as { staffId: string }).staffId) : null;
}

/**
 * CPR number + password login. The first successful login binds the account to
 * the phone; any other phone is refused until a supervisor resets the binding.
 */
export async function loginStaff(db: Db, body: unknown, now: Date): Promise<{ staff: Staff; tokens: TokenPair }> {
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) throw badRequest("CPR number, password and device are required");
  const { deviceId, client } = parsed.data;
  const pin = (parsed.data.password ?? parsed.data.pin)!;

  const staffId = await findStaffId(db, (parsed.data.cprNo || parsed.data.staffCode)!);
  if (!staffId) throw unauthorized(INVALID, "INVALID_CREDENTIALS");
  const ref = db.collection(COL.staff).doc(staffId);

  type Outcome = { error?: AttendanceError; audit?: string | null; staff?: Staff };
  const outcome = await db.runTransaction<Outcome>(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { error: unauthorized(INVALID, "INVALID_CREDENTIALS") };
    const staff = { ...(snap.data() as Staff), id: snap.id };

    if (!staff.active) return { error: forbidden("This account is disabled. Contact your supervisor.", "ACCOUNT_DISABLED") };
    if (client === "web" && !staff.webCheckin) return { error: forbidden(WEB_NOT_ALLOWED, "WEB_NOT_ALLOWED") };
    if (staff.pinLockedUntil && new Date(staff.pinLockedUntil).getTime() > now.getTime()) {
      return { error: tooMany("Too many wrong passwords. Try again in 15 minutes or contact your supervisor.", "PIN_LOCKED") };
    }

    const pinOk = pin.length <= MOBILE_AUTH.passwordMaxLength && verifyPin(pin, staff.pinHash);
    if (!pinOk) {
      const failures = (staff.pinFailures ?? 0) + 1;
      const lock = failures >= MOBILE_AUTH.maxPinFailures;
      tx.update(ref, {
        pinFailures: lock ? 0 : failures,
        pinLockedUntil: lock ? new Date(now.getTime() + MOBILE_AUTH.pinLockoutMin * 60000).toISOString() : null,
      });
      return { error: unauthorized(INVALID, "INVALID_CREDENTIALS"), audit: lock ? "PIN_LOCKED" : null, staff };
    }

    if (staff.deviceId && staff.deviceId !== deviceId) {
      return {
        error: forbidden(
          "This account is registered to another phone. Ask your supervisor to reset the device.",
          "DEVICE_MISMATCH",
        ),
        audit: "LOGIN_OTHER_DEVICE_BLOCKED",
        staff,
      };
    }

    const binding = !staff.deviceId;
    const updates: Partial<Staff> = { pinFailures: 0, pinLockedUntil: null, updatedAt: now.toISOString() };
    if (binding) Object.assign(updates, { deviceId, deviceBoundAt: now.toISOString() });
    tx.update(ref, updates);
    return { staff: { ...staff, ...updates }, audit: binding ? "DEVICE_BOUND" : null };
  });

  if (outcome.audit && outcome.staff) {
    await writeAudit(
      db,
      {
        who: `staff:${outcome.staff.id}`,
        what: outcome.audit,
        entity: COL.staff,
        entityId: outcome.staff.id,
        before: { deviceId: outcome.staff.deviceId },
        after: { deviceId },
      },
      now,
    );
  }
  if (outcome.error) throw outcome.error;
  return { staff: outcome.staff!, tokens: issueTokens(outcome.staff!, now, client) };
}

async function staffFromToken(db: Db, token: string, type: "access" | "refresh", deviceId: string | null, now: Date) {
  const payload = verifyToken(token, getTokenSecret(), now);
  if (!payload || payload.typ !== type) throw unauthorized("Session expired. Please log in again.", "TOKEN_INVALID");
  if (deviceId !== null && payload.did !== deviceId) throw unauthorized("Device does not match this session.", "DEVICE_MISMATCH");

  const staff = await getStaff(db, payload.sub).catch(() => null);
  if (!staff) throw unauthorized("Session expired. Please log in again.", "TOKEN_INVALID");
  if (!staff.active) throw forbidden("This account is disabled. Contact your supervisor.", "ACCOUNT_DISABLED");
  if ((staff.tokenVersion ?? 0) !== payload.ver || staff.deviceId !== payload.did) {
    throw unauthorized("Session revoked. Please log in again.", "TOKEN_REVOKED");
  }
  if (payload.cli === "web" && !staff.webCheckin) throw forbidden(WEB_NOT_ALLOWED, "WEB_NOT_ALLOWED");
  return Object.assign(staff, { client: (payload.cli === "web" ? "web" : "android") as MobileClient });
}

export async function refreshStaffSession(db: Db, body: unknown, now: Date) {
  const parsed = z.object({ refreshToken: z.string().min(10), deviceId: deviceIdSchema }).safeParse(body);
  if (!parsed.success) throw badRequest("Refresh token and device are required");
  const staff = await staffFromToken(db, parsed.data.refreshToken, "refresh", parsed.data.deviceId, now);
  return { staff, tokens: issueTokens(staff, now, staff.client) };
}

/** Authenticate a phone request: `Authorization: Bearer <access>` + `X-Device-Id`. */
export async function authenticateStaff(
  db: Db,
  authorization: string | null,
  deviceId: string | null,
  now: Date,
): Promise<Staff> {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
  if (!token) throw unauthorized("Please log in.", "TOKEN_MISSING");
  if (!deviceId || !deviceIdSchema.safeParse(deviceId).success) {
    throw unauthorized("Device id missing.", "DEVICE_MISSING");
  }
  return staffFromToken(db, token, "access", deviceId, now);
}
