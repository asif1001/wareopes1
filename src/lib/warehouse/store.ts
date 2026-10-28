import type { SnapshotMeta, WarehouseLayout, WarehouseRecord } from "./types";
import { normalizeLayout } from "./layout";
import { withTimeout } from "./timeout";

const LAYOUT_KEY = "wareops.warehouse.layouts.v1";
const SNAPSHOT_KEY = "wareops.warehouse.snapshots.v1";
const MAX_LOCAL_SNAPSHOTS = 6;
const API_TIMEOUT_MS = 20000;

export type StorageMode = "cloud" | "local";

type LocalSnapshot = {
  meta: SnapshotMeta;
  records: WarehouseRecord[];
};

/**
 * The warehouse page stores data through /api/warehouse (Firebase Admin), so
 * it does not depend on client-side Firestore rules or anonymous auth.
 * When the server cannot be reached, everything falls back to localStorage.
 *
 * The "cloud is down" flag expires after a short cooldown: a single failed
 * request (for example a layout that Firestore rejected) must not stop every
 * later save in the same browser session from trying again.
 */
const CLOUD_COOLDOWN_MS = 15000;
let cloudBlockedUntil = 0;

function cloudUnavailable(): never {
  throw new Error("Warehouse storage is unavailable");
}

function isCloudBlocked(): boolean {
  return Date.now() < cloudBlockedUntil;
}

function blockCloud(): void {
  cloudBlockedUntil = Date.now() + CLOUD_COOLDOWN_MS;
}

function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return "The warehouse API could not be reached.";
  return message.length > 220 ? `${message.slice(0, 217)}...` : message;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function readLocalLayouts(): Record<string, WarehouseLayout> {
  return readJson<Record<string, WarehouseLayout>>(LAYOUT_KEY, {});
}

function readLocalSnapshots(): LocalSnapshot[] {
  const snapshots = readJson<LocalSnapshot[]>(SNAPSHOT_KEY, []);
  return Array.isArray(snapshots) ? snapshots : [];
}

function writeLocalSnapshots(snapshots: LocalSnapshot[]): boolean {
  let attempt = snapshots;
  while (attempt.length && !writeJson(SNAPSHOT_KEY, attempt)) {
    attempt = attempt.slice(0, attempt.length - 1);
  }
  return attempt.length === snapshots.length;
}

function sortByUploadedAtDesc<T extends { uploadedAt: string }>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
}

export function mergeLayouts(
  cloud: WarehouseLayout[],
  local: WarehouseLayout[],
): WarehouseLayout[] {
  const byBranch = new Map<string, WarehouseLayout>();
  for (const layout of local) byBranch.set(layout.branchId, layout);
  for (const layout of cloud) {
    const existing = byBranch.get(layout.branchId);
    // Never hide a layout that was saved locally because the API was down:
    // the newer copy wins, and the cloud copy wins only on a tie.
    if (!existing || layoutTime(layout) >= layoutTime(existing)) {
      byBranch.set(layout.branchId, layout);
    }
  }
  return [...byBranch.values()].sort((a, b) =>
    a.branchName.localeCompare(b.branchName),
  );
}

function layoutTime(layout: WarehouseLayout | null | undefined): number {
  if (!layout?.updatedAt) return 0;
  const time = new Date(layout.updatedAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

async function readApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    // The response body was not JSON; fall back to the status code.
  }
  return `Warehouse API responded ${response.status}`;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (isCloudBlocked()) cloudUnavailable();
  try {
    const response = await withTimeout(
      fetch(path, {
        ...init,
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      }),
      API_TIMEOUT_MS,
      "Warehouse storage",
    );
    if (!response.ok) throw new Error(await readApiError(response));
    cloudBlockedUntil = 0;
    return (await response.json()) as T;
  } catch (error) {
    blockCloud();
    throw error;
  }
}

export async function listLayouts(): Promise<{
  layouts: WarehouseLayout[];
  storage: StorageMode;
}> {
  const local = Object.values(readLocalLayouts());
  try {
    const data = await apiRequest<{ layouts: WarehouseLayout[] }>(
      "/api/warehouse?kind=layouts",
    );
    const cloud = (data.layouts ?? []).map(normalizeLayout);
    return {
      layouts: mergeLayouts(cloud, local.map(normalizeLayout)),
      storage: "cloud",
    };
  } catch {
    return {
      layouts: mergeLayouts([], local.map(normalizeLayout)),
      storage: "local",
    };
  }
}

export async function getLayoutForBranch(
  branchId: string,
): Promise<WarehouseLayout | null> {
  const cached = readLocalLayouts()[branchId] ?? null;
  const local = cached ? normalizeLayout(cached) : null;
  try {
    const data = await apiRequest<{ layouts: WarehouseLayout[] }>(
      `/api/warehouse?kind=layouts&branchId=${encodeURIComponent(branchId)}`,
    );
    const first = data.layouts?.[0];
    if (first) {
      const cloud = normalizeLayout(first);
      if (!local || layoutTime(cloud) >= layoutTime(local)) return cloud;
    }
  } catch {
    // Fall back to the locally cached layout below.
  }
  return local;
}

export type SaveLayoutResult = {
  layout: WarehouseLayout;
  storage: StorageMode;
  /** Why the layout was kept in the browser when `storage` is "local". */
  reason?: string;
};

export async function saveLayout(
  layout: WarehouseLayout,
  updatedBy?: string,
): Promise<SaveLayoutResult> {
  const id = layout.id || `layout_${layout.branchId || "new"}`;
  const payload: WarehouseLayout = normalizeLayout({
    ...layout,
    id,
    updatedAt: new Date().toISOString(),
    updatedBy,
  });
  try {
    const data = await apiRequest<{ layout: WarehouseLayout }>(
      "/api/warehouse",
      {
        method: "POST",
        body: JSON.stringify({ type: "layout", layout: payload }),
      },
    );
    return {
      layout: normalizeLayout(data.layout ?? payload),
      storage: "cloud",
    };
  } catch (error) {
    const reason = reasonOf(error);
    const local = readLocalLayouts();
    local[payload.branchId] = payload;
    if (!writeJson(LAYOUT_KEY, local)) {
      throw new Error(
        `The layout could not be saved because this browser's storage is full. ${reason}`,
      );
    }
    return { layout: payload, storage: "local", reason };
  }
}

export async function listSnapshots(
  branchId?: string,
): Promise<{ snapshots: SnapshotMeta[]; storage: StorageMode }> {
  const local = readLocalSnapshots()
    .map((entry) => ({
      ...entry.meta,
      layout: normalizeLayout(entry.meta.layout),
      storage: "local" as const,
    }))
    .filter((meta) => !branchId || meta.branchId === branchId);
  try {
    const query = branchId
      ? `?kind=snapshots&branchId=${encodeURIComponent(branchId)}`
      : "?kind=snapshots";
    const data = await apiRequest<{ snapshots: SnapshotMeta[] }>(
      `/api/warehouse${query}`,
    );
    const cloud = (data.snapshots ?? []).map((meta) => ({
      ...meta,
      layout: normalizeLayout(meta.layout),
      storage: "cloud" as const,
    }));
    const cloudIds = new Set(cloud.map((meta) => meta.id));
    return {
      snapshots: sortByUploadedAtDesc([
        ...cloud,
        ...local.filter((meta) => !cloudIds.has(meta.id)),
      ]),
      storage: "cloud",
    };
  } catch {
    return { snapshots: sortByUploadedAtDesc(local), storage: "local" };
  }
}

function cleanRecord(record: WarehouseRecord): WarehouseRecord {
  const cleaned: WarehouseRecord = {
    locator: record.locator,
    lpn: record.lpn,
    brand: record.brand,
    onHand: record.onHand,
    sub: record.sub,
  };
  if (record.item) cleaned.item = record.item;
  if (record.description) cleaned.description = record.description;
  if (record.grade) cleaned.grade = record.grade;
  if (record.uom) cleaned.uom = record.uom;
  if (record.status) cleaned.status = record.status;
  return cleaned;
}

export function createSnapshotId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `snap_${Date.now()}_${random}`;
}

export type SaveSnapshotResult = {
  meta: SnapshotMeta;
  storage: StorageMode;
  /** Why the snapshot was kept in the browser when `storage` is "local". */
  reason?: string;
};

export async function saveSnapshot(
  meta: SnapshotMeta,
  records: WarehouseRecord[],
  uploadedBy?: string,
): Promise<SaveSnapshotResult> {
  const localMeta: SnapshotMeta = {
    ...meta,
    layout: normalizeLayout(meta.layout),
    uploadedBy: uploadedBy ?? meta.uploadedBy,
    recordCount: records.length,
    storage: "local",
  };
  const cleanedRecords = records.map(cleanRecord);

  try {
    const data = await apiRequest<{ meta: SnapshotMeta }>("/api/warehouse", {
      method: "POST",
      body: JSON.stringify({
        type: "snapshot",
        meta: localMeta,
        records: cleanedRecords,
      }),
    });
    return {
      meta: { ...(data.meta ?? localMeta), storage: "cloud" },
      storage: "cloud",
    };
  } catch (error) {
    const reason = reasonOf(error);
    const local = readLocalSnapshots().filter(
      (entry) => entry.meta.id !== localMeta.id,
    );
    local.unshift({ meta: localMeta, records: cleanedRecords });
    const kept = local.slice(0, MAX_LOCAL_SNAPSHOTS);
    if (!writeLocalSnapshots(kept)) {
      throw new Error(
        `The snapshot could not be saved because this browser's storage is full and the warehouse API is unavailable. ${reason}`,
      );
    }
    return { meta: localMeta, storage: "local", reason };
  }
}

export async function loadSnapshotRecords(
  meta: SnapshotMeta,
): Promise<WarehouseRecord[]> {
  if (meta.storage === "local") {
    const entry = readLocalSnapshots().find((item) => item.meta.id === meta.id);
    return entry?.records ?? [];
  }
  try {
    const data = await apiRequest<{ records: WarehouseRecord[] }>(
      `/api/warehouse?snapshotId=${encodeURIComponent(meta.id)}`,
    );
    return data.records ?? [];
  } catch {
    const entry = readLocalSnapshots().find((item) => item.meta.id === meta.id);
    return entry?.records ?? [];
  }
}

export async function deleteSnapshot(id: string): Promise<void> {
  const local = readLocalSnapshots().filter((entry) => entry.meta.id !== id);
  writeJson(SNAPSHOT_KEY, local);
  try {
    await apiRequest(`/api/warehouse?snapshotId=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch {
    // Local deletion is enough when the server is unreachable.
  }
}

export function getCachedLayout(branchId: string): WarehouseLayout | null {
  const layout = readLocalLayouts()[branchId];
  return layout ? normalizeLayout(layout) : null;
}

/** Remove the branch layout and every snapshot for it. */
export async function deleteBranchData(branchId: string): Promise<StorageMode> {
  const layouts = readLocalLayouts();
  delete layouts[branchId];
  writeJson(LAYOUT_KEY, layouts);
  writeLocalSnapshots(
    readLocalSnapshots().filter((entry) => entry.meta.branchId !== branchId),
  );
  try {
    await apiRequest(
      `/api/warehouse?branchId=${encodeURIComponent(branchId)}&all=true`,
      { method: "DELETE" },
    );
    return "cloud";
  } catch {
    blockCloud();
    return "local";
  }
}

/** Called when the rest of the app has already established storage is unreachable. */
export function markCloudUnavailable(): void {
  blockCloud();
}
