/**
 * Signed session cookie (HMAC-SHA256). The server only trusts a session whose
 * signature matches SESSION_SECRET, so the cookie cannot be edited to become
 * another user. Uses Web Crypto so it works in `proxy.ts` and on the server.
 */

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export type SessionPayload = {
  id: string;
  employeeNo?: string;
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  branch?: string;
  redirectPage?: string;
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();
let cachedKey: { secret: string; key: CryptoKey } | null = null;

function getSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

async function key(secret: string): Promise<CryptoKey> {
  if (cachedKey?.secret === secret) return cachedKey.key;
  const k = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  cachedKey = { secret, key: k };
  return k;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function isSessionConfigured() {
  return getSecret() !== null;
}

export async function signSession(data: Omit<SessionPayload, "iat" | "exp">, now = Date.now()): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error("SESSION_SECRET is not configured (at least 32 characters)");
  const iat = Math.floor(now / 1000);
  const payload: SessionPayload = { ...data, iat, exp: iat + SESSION_MAX_AGE_SEC };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(body)));
  return `${body}.${toBase64Url(sig)}`;
}

/** Returns the payload of a valid, unexpired session cookie, or null. */
export async function verifySession(value: string | undefined | null, now = Date.now()): Promise<SessionPayload | null> {
  const secret = getSecret();
  if (!secret || !value) return null;
  const [body, sig, extra] = value.split(".");
  if (!body || !sig || extra !== undefined) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret), fromBase64Url(sig) as BufferSource, encoder.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.id !== "string" || !payload.id) return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SEC,
};

/** Server components, route handlers and server actions: the signed-in user's session, or null. */
export async function getSession(): Promise<SessionPayload | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}
