import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { normalizeLayout } from "@/lib/warehouse/layout";
import type {
  SnapshotMeta,
  WarehouseLayout,
  WarehouseRecord,
} from "@/lib/warehouse/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CHUNK_SIZE = 400;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function serverError(error: unknown) {
  console.error("Warehouse API error:", error);
  return NextResponse.json(
    {
      error:
        error instanceof Error ? error.message : "Warehouse request failed",
    },
    { status: 500 },
  );
}

function layoutFromDoc(
  id: string,
  data: Record<string, unknown>,
): WarehouseLayout {
  return normalizeLayout({ id, ...(data as object) } as WarehouseLayout);
}

export async function GET(request: NextRequest) {
  if (!request.cookies.get("session")) return unauthorized();
  try {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");
    const branchId = searchParams.get("branchId");
    const snapshotId = searchParams.get("snapshotId");
    const adb = await getAdminDb();

    if (kind === "layouts") {
      const query = branchId
        ? adb.collection("warehouseLayouts").where("branchId", "==", branchId)
        : adb.collection("warehouseLayouts");
      const snapshot = await query.get();
      const layouts = snapshot.docs.map((entry) =>
        layoutFromDoc(entry.id, entry.data() as Record<string, unknown>),
      );
      return NextResponse.json({ layouts });
    }

    if (kind === "snapshots") {
      const query = branchId
        ? adb.collection("warehouseSnapshots").where("branchId", "==", branchId)
        : adb.collection("warehouseSnapshots");
      const snapshot = await query.get();
      const snapshots = snapshot.docs
        .map((entry) => {
          const data = entry.data() as SnapshotMeta;
          return {
            ...data,
            id: entry.id,
            layout: normalizeLayout(data.layout),
          } as SnapshotMeta;
        })
        .sort(
          (a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
        );
      return NextResponse.json({ snapshots });
    }

    if (snapshotId) {
      const chunks = await adb
        .collection("warehouseSnapshots")
        .doc(snapshotId)
        .collection("chunks")
        .get();
      const records = chunks.docs
        .map(
          (entry) =>
            entry.data() as { index: number; records: WarehouseRecord[] },
        )
        .sort((a, b) => a.index - b.index)
        .flatMap((entry) => entry.records ?? []);
      return NextResponse.json({ records });
    }

    return NextResponse.json(
      { error: "Unknown warehouse request" },
      { status: 400 },
    );
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  if (!request.cookies.get("session")) return unauthorized();
  try {
    const body = await request.json();
    const adb = await getAdminDb();

    if (body?.type === "layout") {
      const layout = normalizeLayout(body.layout as WarehouseLayout);
      const id = layout.id || `layout_${layout.branchId || "new"}`;
      const payload = { ...layout, id };
      await adb
        .collection("warehouseLayouts")
        .doc(id)
        .set(payload, { merge: true });
      return NextResponse.json({ layout: payload });
    }

    if (body?.type === "snapshot") {
      const meta = body.meta as SnapshotMeta;
      const records = (body.records as WarehouseRecord[]) ?? [];
      if (!meta?.id || !meta?.branchId) {
        return NextResponse.json(
          { error: "Snapshot id and branch are required" },
          { status: 400 },
        );
      }
      const metaPayload: SnapshotMeta = {
        ...meta,
        layout: normalizeLayout(meta.layout),
        recordCount: records.length,
      };
      delete (metaPayload as { storage?: string }).storage;

      const snapshotRef = adb.collection("warehouseSnapshots").doc(meta.id);
      await snapshotRef.set(metaPayload, { merge: true });

      const chunks: WarehouseRecord[][] = [];
      for (let index = 0; index < records.length; index += CHUNK_SIZE) {
        chunks.push(records.slice(index, index + CHUNK_SIZE));
      }
      for (let start = 0; start < chunks.length; start += 400) {
        const batch = adb.batch();
        chunks.slice(start, start + 400).forEach((chunk, offset) => {
          batch.set(
            snapshotRef.collection("chunks").doc(String(start + offset)),
            { index: start + offset, records: chunk },
          );
        });
        await batch.commit();
      }
      return NextResponse.json({ meta: metaPayload });
    }

    return NextResponse.json(
      { error: "Unknown warehouse request" },
      { status: 400 },
    );
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: NextRequest) {
  if (!request.cookies.get("session")) return unauthorized();
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    const deleteAll = searchParams.get("all") === "true";
    const adb = await getAdminDb();

    if (deleteAll) {
      if (!branchId) {
        return NextResponse.json(
          { error: "Branch id is required" },
          { status: 400 },
        );
      }
      const layouts = await adb
        .collection("warehouseLayouts")
        .where("branchId", "==", branchId)
        .get();
      for (const layout of layouts.docs) await layout.ref.delete();

      const snapshots = await adb
        .collection("warehouseSnapshots")
        .where("branchId", "==", branchId)
        .get();
      for (const snapshot of snapshots.docs) {
        const chunks = await snapshot.ref.collection("chunks").get();
        let batch = adb.batch();
        let count = 0;
        for (const chunk of chunks.docs) {
          batch.delete(chunk.ref);
          count += 1;
          if (count % 400 === 0) {
            await batch.commit();
            batch = adb.batch();
          }
        }
        await batch.delete(snapshot.ref);
        await batch.commit();
      }
      return NextResponse.json({ ok: true });
    }

    const snapshotId = searchParams.get("snapshotId");
    if (!snapshotId) {
      return NextResponse.json(
        { error: "Snapshot id is required" },
        { status: 400 },
      );
    }
    const snapshotRef = adb.collection("warehouseSnapshots").doc(snapshotId);
    const chunks = await snapshotRef.collection("chunks").get();
    let batch = adb.batch();
    let count = 0;
    for (const chunk of chunks.docs) {
      batch.delete(chunk.ref);
      count += 1;
      if (count % 400 === 0) {
        await batch.commit();
        batch = adb.batch();
      }
    }
    await batch.delete(snapshotRef);
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
