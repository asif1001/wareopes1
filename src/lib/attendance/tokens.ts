import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Staff PINs (scrypt). Staff credentials are separate from WareOps `Users`.
// ---------------------------------------------------------------------------

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(pin, Buffer.from(salt, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Staff app password set by an admin: any characters, no leading/trailing spaces. */
export function isValidPassword(password: unknown, min: number, max: number): password is string {
  return typeof password === "string" && password.length >= min && password.length <= max && password.trim() === password;
}

// ---------------------------------------------------------------------------
// Signed tokens (HMAC-SHA256, JWT-compatible layout)
// ---------------------------------------------------------------------------

export type TokenType = "access" | "refresh";

export type TokenPayload = {
  sub: string;
  did: string;
  typ: TokenType;
  ver: number;
  /** Client that logged in: Android app (default) or the iPhone web page. */
  cli?: "android" | "web";
  iat: number;
  exp: number;
  jti: string;
};

const HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");

export function getTokenSecret(): string {
  const secret = process.env.ATTENDANCE_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ATTENDANCE_TOKEN_SECRET must be set (at least 32 characters)");
  }
  return secret;
}

function sign(data: string, secret: string) {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function signToken(
  claims: Pick<TokenPayload, "sub" | "did" | "typ" | "ver" | "cli">,
  ttlSec: number,
  secret: string,
  now = new Date(),
): string {
  const iat = Math.floor(now.getTime() / 1000);
  const payload: TokenPayload = { ...claims, iat, exp: iat + ttlSec, jti: randomBytes(9).toString("base64url") };
  const body = `${HEADER}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  return `${body}.${sign(body, secret)}`;
}

export function verifyToken(token: string, secret: string, now = new Date()): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== HEADER) return null;
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`, secret));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as TokenPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= now.getTime()) return null;
    if (typeof payload.sub !== "string" || typeof payload.did !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
