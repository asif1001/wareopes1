import { createHmac, randomBytes } from "node:crypto";
import { badRequest, forbidden, notFound } from "./errors";
import { COL, type Db } from "./store";
import { getTokenSecret, safeEqual } from "./tokens";
import type { Geofence } from "./types";

/**
 * Rotating QR code shown on a screen at a site gate. Scanning it proves the
 * staff member was at that site at that moment, without GPS and without the
 * phone being online (the server checks the code when the record arrives).
 *
 * Code: `EKKG1.<siteId>.<slot>.<signature>`, slot = 30-second window.
 * Shown as a URL (…/checkin/?gate=<code>) so an iPhone camera opens the check-in page.
 */
export const GATE_SLOT_SEC = 30;
/** A code is accepted if the scan time is within this many slots of the code (±90 s with clock drift). */
const SLOT_TOLERANCE = 3;
const PREFIX = "EKKG1";

function gateSecret() {
  return createHmac("sha256", getTokenSecret()).update("gate-qr-v1").digest();
}

function sign(siteId: string, slot: number) {
  return createHmac("sha256", gateSecret()).update(`${siteId}.${slot}`).digest("base64url").slice(0, 22);
}

export const slotOf = (at: Date) => Math.floor(at.getTime() / 1000 / GATE_SLOT_SEC);

export function gateCode(siteId: string, at: Date) {
  const slot = slotOf(at);
  return { code: `${PREFIX}.${siteId}.${slot}.${sign(siteId, slot)}`, slot, expiresAt: new Date((slot + 1) * GATE_SLOT_SEC * 1000) };
}

/** Accepts the bare code or the URL form (…?gate=CODE). */
export function extractGateCode(value: string): string | null {
  const text = value.trim();
  const fromUrl = text.match(/[?&]gate=([^&#\s]+)/);
  const code = fromUrl ? decodeURIComponent(fromUrl[1]) : text;
  return /^EKKG1\.[A-Za-z0-9_-]{4,64}\.\d{6,12}\.[A-Za-z0-9_-]{22}$/.test(code) ? code : null;
}

export type GateCheck = { ok: true; siteId: string } | { ok: false; reason: "FORMAT" | "SIGNATURE" | "EXPIRED" | "WRONG_SITE" };

/** Was this code valid at `at` for one of the staff member's sites? */
export function verifyGateCode(value: string, at: Date, sites: Pick<Geofence, "id" | "active">[]): GateCheck {
  const code = extractGateCode(value);
  if (!code) return { ok: false, reason: "FORMAT" };
  const [, siteId, slotText, signature] = code.split(".");
  const slot = Number(slotText);
  if (!safeEqual(signature, sign(siteId, slot))) return { ok: false, reason: "SIGNATURE" };
  if (Math.abs(slotOf(at) - slot) > SLOT_TOLERANCE) return { ok: false, reason: "EXPIRED" };
  if (!sites.some((s) => s.id === siteId && s.active)) return { ok: false, reason: "WRONG_SITE" };
  return { ok: true, siteId };
}

// ---------------------------------------------------------------------------
// Gate screen access: each site has its own display key in the screen link.
// ---------------------------------------------------------------------------

export async function gateScreenKey(db: Db, siteId: string, regenerate: boolean) {
  const ref = db.collection(COL.geofences).doc(siteId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("Site not found");
  let key = snap.get("gateKey") as string | undefined;
  if (!key || regenerate) {
    key = randomBytes(18).toString("base64url");
    await ref.update({ gateKey: key });
  }
  return { key, siteName: String(snap.get("name") ?? "") };
}

/** Current code for a gate screen (no login: the screen link carries the site's display key). */
export async function currentGateCode(db: Db, siteId: string, key: string, now: Date) {
  if (!siteId || !key) throw badRequest("Site and key are required");
  const snap = await db.collection(COL.geofences).doc(siteId).get();
  if (!snap.exists) throw notFound("Site not found");
  const stored = snap.get("gateKey") as string | undefined;
  if (!stored || !safeEqual(key, stored)) throw forbidden("This gate screen link is no longer valid. Open the new link from WareOps → Attendance → Setup.", "GATE_KEY_INVALID");
  if (snap.get("active") === false) throw forbidden("This site is inactive.", "SITE_INACTIVE");
  return { siteName: String(snap.get("name") ?? ""), ...gateCode(snap.id, now) };
}
