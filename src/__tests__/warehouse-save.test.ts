import { describe, expect, it } from "vitest";
import {
  InvalidWarehousePayload,
  prepareForFirestore,
} from "@/lib/warehouse/firestore-payload";
import { createLayout, normalizeLayout } from "@/lib/warehouse/layout";
import {
  buildLayoutWithDesign,
  createRackDesign,
} from "@/lib/warehouse/rack-design";
import { mergeLayouts } from "@/lib/warehouse/store";
import type { WarehouseLayout } from "@/lib/warehouse/types";

describe("Firestore payload", () => {
  it("drops undefined object fields and array entries", () => {
    const prepared = prepareForFirestore({
      id: "layout_1",
      name: "Warehouse",
      notes: undefined,
      levels: ["A", undefined, "B"],
      nested: { keep: 1, drop: undefined },
    });

    expect(prepared).toEqual({
      id: "layout_1",
      name: "Warehouse",
      levels: ["A", "B"],
      nested: { keep: 1 },
    });
    expect(JSON.stringify(prepared)).not.toContain("undefined");
  });

  it("keeps null values, which Firestore accepts", () => {
    expect(prepareForFirestore({ level: null })).toEqual({ level: null });
  });

  it("rejects non-finite numbers with the field path", () => {
    expect(() =>
      prepareForFirestore(
        { layout: { zones: [{ pitch: Number.NaN }] } },
        "layout",
      ),
    ).toThrow(InvalidWarehousePayload);
    expect(() =>
      prepareForFirestore(
        { layout: { zones: [{ pitch: Number.NaN }] } },
        "layout",
      ),
    ).toThrow(/layout\.zones\[0\]\.pitch/);
  });
});

describe("layout sanitising", () => {
  it("omits undefined locations so the Firestore write can succeed", () => {
    const layout = buildLayoutWithDesign(
      createLayout("branch-1", "Branch One"),
      createRackDesign("A5"),
    );
    const normalized = normalizeLayout(layout);

    expect(normalized.subInventories.length).toBeGreaterThan(0);
    for (const sub of normalized.subInventories) {
      expect(Object.prototype.hasOwnProperty.call(sub, "locations")).toBe(
        false,
      );
    }
    expect(() =>
      prepareForFirestore({ ...normalized, id: normalized.id }, "layout"),
    ).not.toThrow();
  });

  it("keeps explicit imported locations", () => {
    const layout = createLayout("branch-1", "Branch One");
    layout.subInventories[0].locations = ["a5.01.01.a.1"];
    const normalized = normalizeLayout(layout);
    expect(normalized.subInventories[0].locations).toEqual(["A5.01.01.A.1"]);
  });

  it("normalises the rack design", () => {
    const layout = createLayout("branch-1", "Branch One");
    layout.rackDesign = createRackDesign("a5");
    const normalized = normalizeLayout(layout);
    expect(normalized.rackDesign?.zones[0].zone).toBe("A5");
    expect(normalized.rackDesign?.zones[0].levels).toBe(6);
  });
});

describe("layout merge", () => {
  const layoutAt = (updatedAt?: string): WarehouseLayout => ({
    ...createLayout("branch-1", "Branch One"),
    updatedAt,
  });

  it("keeps a newer local layout when the cloud copy is older", () => {
    const merged = mergeLayouts(
      [layoutAt("2026-10-01T00:00:00.000Z")],
      [layoutAt("2026-10-02T00:00:00.000Z")],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].updatedAt).toBe("2026-10-02T00:00:00.000Z");
  });

  it("prefers the cloud layout when it is newer or equal", () => {
    const cloud = layoutAt("2026-10-03T00:00:00.000Z");
    const merged = mergeLayouts(
      [cloud],
      [layoutAt("2026-10-02T00:00:00.000Z")],
    );
    expect(merged[0].updatedAt).toBe("2026-10-03T00:00:00.000Z");

    const same = mergeLayouts([cloud], [layoutAt("2026-10-03T00:00:00.000Z")]);
    expect(same[0]).toEqual(cloud);
  });
});
