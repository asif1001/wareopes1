import type { Db } from "./store";

/**
 * Server-memory cache for small, rarely changed collections (rules, shifts, sites, holidays,
 * staff list, month locks). Every change to them calls `bumpCacheVersion`, which writes a
 * tiny version marker; each server instance re-checks the marker (one read, shared by a whole
 * request) before using its copy, so a change made on one instance is seen everywhere.
 */
const SETTINGS = "attSettings";
const VERSION_DOC = "cacheVersion";
/** Calls within this time share one marker read (i.e. one request). */
const VERSION_CHECK_MS = 1500;
/** Copies are refreshed at least this often even without a change. */
const MAX_AGE_MS = 10 * 60 * 1000;

type Version = { v: string; at: string };
type Store = { version: { value: Version; checkedAt: number; pending?: Promise<Version> } | null; entries: Map<string, { version: string; at: number; value: unknown }> };

const stores = new WeakMap<object, Store>();

function storeFor(db: Db): Store {
  let store = stores.get(db);
  if (!store) {
    store = { version: null, entries: new Map() };
    stores.set(db, store);
  }
  return store;
}

async function currentVersion(db: Db): Promise<Version> {
  const store = storeFor(db);
  const now = Date.now();
  if (store.version && now - store.version.checkedAt < VERSION_CHECK_MS) return store.version.pending ?? store.version.value;
  const pending = db
    .collection(SETTINGS)
    .doc(VERSION_DOC)
    .get()
    .then((snap) => ({ v: String(snap.exists ? (snap.get("v") ?? "0") : "0"), at: String(snap.exists ? (snap.get("at") ?? "") : "") }));
  store.version = { value: store.version?.value ?? { v: "", at: "" }, checkedAt: now, pending };
  const value = await pending;
  store.version = { value, checkedAt: now };
  return value;
}

/** When cached data (rules, shifts, holidays, staff…) last changed (ISO time, "" if never). */
export async function cacheChangedAt(db: Db): Promise<string> {
  return (await currentVersion(db)).at;
}

/** Cached value for `key`, loaded with `load` when missing, changed, or older than `maxAgeMs`. */
export async function cached<T>(db: Db, key: string, load: () => Promise<T>, maxAgeMs = MAX_AGE_MS): Promise<T> {
  const version = (await currentVersion(db)).v;
  const store = storeFor(db);
  const entry = store.entries.get(key);
  if (entry && entry.version === version && Date.now() - entry.at < maxAgeMs) return structuredClone(entry.value as T);
  const value = await load();
  store.entries.set(key, { version, at: Date.now(), value });
  return structuredClone(value);
}

/** Call after any change to cached data, so every server instance reloads it. */
export async function bumpCacheVersion(db: Db) {
  const value: Version = { v: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString() };
  await db.collection(SETTINGS).doc(VERSION_DOC).set(value);
  const store = storeFor(db);
  store.entries.clear();
  store.version = { value, checkedAt: Date.now() };
}
