import { z } from "zod";
import { MOBILE_AUTH } from "./config";
import { writeAudit } from "./audit";
import { AttendanceError, badRequest, forbidden, tooMany, unauthorized } from "./errors";
import { COL, getStaff, normalizeStaffCode, type Db } from "./store";
import { getTokenSecret, isValidPin, signToken, verifyPin, verifyToken } from "./tokens";
import type { Staff } from "./types";

export const deviceIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);

const loginSchema = z.object({
  staffCode: z.string().trim().min(1).max(32),
  pin: z.string(),
  deviceId: deviceIdSchema,
});

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
};

const INVALID = "Staff ID or PIN is incorrect.";

function issueTokens(staff: Staff, now: Date): TokenPair {
  const secret = getTokenSecret();
  const claims = { sub: staff.id, did: staff.deviceId ?? "", ver: staff.tokenVersion ?? 0 };
  return {
    accessToken: signToken({ ...claims, typ: "access" }, MOBILE_AUTH.accessTokenTtlSec, secret, now),
    refreshToken: signToken({ ...claims, typ: "refresh" }, MOBILE_AUTH.refreshTokenTtlSec, secret, now),
    accessExpiresIn: MOBILE_AUTH.accessTokenTtlSec,
  };
}

/**
 * Staff ID + PIN login. The first successful login binds the account to the
 * phone; any other phone is refused until a supervisor resets the binding.
 */
export async function loginStaff(db: Db, body: unknown, now: Date): Promise<{ staff: Staff; tokens: TokenPair }> {
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) throw badRequest("Staff ID, PIN and device are required");
  const { pin, deviceId } = parsed.data;
  const staffCode = normalizeStaffCode(parsed.data.staffCode);

  const codeSnap = await db.collection(COL.staffCodes).doc(staffCode).get();
  if (!codeSnap.exists) throw unauthorized(INVALID, "INVALID_CREDENTIALS");
  const staffId = String((codeSnap.data() as { staffId: string }).staffId);
  const ref = db.collection(COL.staff).doc(staffId);

  type Outcome = { error?: AttendanceError; audit?: string | null; staff?: Staff };
  const outcome = await db.runTransaction<Outcome>(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { error: unauthorized(INVALID, "INVALID_CREDENTIALS") };
    const staff = { ...(snap.data() as Staff), id: snap.id };

    if (!staff.active) return { error: forbidden("This account is disabled. Contact your supervisor.", "ACCOUNT_DISABLED") };
    if (staff.pinLockedUntil && new Date(staff.pinLockedUntil).getTime() > now.getTime()) {
      return { error: tooMany("Too many wrong PINs. Try again later or contact your supervisor.", "PIN_LOCKED") };
    }

    const pinOk = isValidPin(pin, MOBILE_AUTH.pinMinLength, MOBILE_AUTH.pinMaxLength) && verifyPin(pin, staff.pinHash);
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
  return { staff: outcome.staff!, tokens: issueTokens(outcome.staff!, now) };
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
  return staff;
}

export async function refreshStaffSession(db: Db, body: unknown, now: Date) {
  const parsed = z.object({ refreshToken: z.string().min(10), deviceId: deviceIdSchema }).safeParse(body);
  if (!parsed.success) throw badRequest("Refresh token and device are required");
  const staff = await staffFromToken(db, parsed.data.refreshToken, "refresh", parsed.data.deviceId, now);
  return { staff, tokens: issueTokens(staff, now) };
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
