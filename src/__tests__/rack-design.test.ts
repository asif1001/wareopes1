import { describe, expect, it } from "vitest";
import { computeScenePlan } from "@/lib/warehouse/geometry";
import { buildLocationMap, capacityOf, createLayout } from "@/lib/warehouse/layout";
import { buildRackLocations, createRackBuilderConfig } from "@/lib/warehouse/rack-builder";
import {
  autoCodeByAisle,
  buildLayoutWithDesign,
  buildZoneModel,
  countDesignLocations,
  createRackDesign,
  defaultZone,
  designForLayout,
  designFromRackBuilder,
  designLocations,
  nextRow,
  normalizeRackDesign,
  parseLabel,
  formatLabel,
  validateZone,
} from "@/lib/warehouse/rack-design";

describe("rack designer model", () => {
  it("default zone matches the designer: 2 back-to-back rows sharing one aisle", () => {
    const z = defaultZone();
    const m = buildZoneModel(z);
    expect(m.racks).toHaveLength(20);
    expect(m.aisles).toHaveLength(1);
    expect(m.aisles[0].label).toBe("Aisle 01");
    expect(m.racks[0].id).toBe("A5.01.01");
    expect(m.racks[0].n).toEqual([0, 1]);
    expect(m.racks[10].n).toEqual([0, -1]);
    const locs = designLocations(createRackDesign());
    expect(locs).toHaveLength(20 * 6 * 2);
    expect(locs[0].locator).toBe("A5.01.01.A.1");
    expect(locs[locs.length - 1].locator).toBe("A5.01.20.F.2");
  });

  it("serpentine numbering reverses alternate rows; same-direction does not", () => {
    const z = defaultZone();
    const row2 = buildZoneModel(z).racks.filter((r) => r.row === 1);
    expect(row2[0].num).toBe(11);
    expect(row2[0].x0).toBeGreaterThan(row2[row2.length - 1].x0);
    const same = buildZoneModel({ ...z, numbering: "same" }).racks.filter((r) => r.row === 1);
    expect(same[0].x0).toBeLessThan(same[same.length - 1].x0);
  });

  it("per-row levels, frame-height rule and label styles", () => {
    const z = { ...defaultZone(), heightMode: "frame" as const, frameH: 9, rackStyle: "num3" as const, levelStyle: "num2" as const, binStyle: "alpha" as const };
    z.rows = [{ bay: "1", start: 1, count: 2, levels: 3 }];
    const m = buildZoneModel(z);
    expect(m.racks[0].levels).toBe(3);
    expect(m.racks[0].pitch).toBeCloseTo(3);
    expect(designLocations({ version: 1, zones: [z] })[0].locator).toBe("A5.01.001.01.A");
  });

  it("U-shape places three rows around one aisle", () => {
    const z = { ...defaultZone(), layout: "u" as const, rows: [0, 1, 2].map((i) => ({ bay: "01", start: 1 + i * 5, count: 5 })) };
    const m = buildZoneModel(z);
    expect(m.geo.map((g) => g.axis)).toEqual(["y", "x", "y"]);
    expect(m.aisles).toHaveLength(1);
  });

  it("flags duplicate rack codes and fixes them with auto-code", () => {
    const z = { ...defaultZone(), rows: [{ bay: "01", start: 1, count: 5 }, { bay: "01", start: 1, count: 5 }] };
    expect(validateZone(z)[0].level).toBe("err");
    expect(validateZone(autoCodeByAisle(z))[0].level).toBe("ok");
  });

  it("adds the next row like the designer", () => {
    const z = defaultZone();
    expect(nextRow(z)).toEqual({ bay: "02", start: 1, count: 10 });
    expect(nextRow({ ...z, rows: [z.rows[0]] })).toEqual({ bay: "01", start: 11, count: 10 });
  });

  it("labels round-trip", () => {
    for (const n of [1, 9, 26, 27, 52, 703]) expect(parseLabel(formatLabel(n, "alpha"))).toBe(n);
    expect(formatLabel(7, "num2")).toBe("07");
  });

  it("imports the standalone designer's JSON export", () => {
    const exported = {
      version: 5,
      active: 1,
      zones: [
        { ...defaultZone("A5"), status: { "A5.01.01.A.1": "o" } },
        { ...defaultZone("A5"), sep: "-", status: {} },
      ],
    };
    const design = normalizeRackDesign(JSON.parse(JSON.stringify(exported)));
    expect(design.zones.map((z) => z.zone)).toEqual(["A5", "A5_2"]);
    expect(designLocations(design).some((l) => l.locator === "A5_2-01-01-A-1")).toBe(true);
  });
});

describe("WareOps integration", () => {
  it("old rack builder layouts convert with the same location codes", () => {
    const config = createRackBuilderConfig("T");
    const old = new Set(buildRackLocations(config).map((l) => l.locator));
    const next = new Set(designLocations(designFromRackBuilder(config)).map((l) => l.locator));
    expect(next).toEqual(old);
  });

  it("layout capacity, location map and 3D plan agree", () => {
    const design = createRackDesign();
    design.zones.push({ ...defaultZone("B1"), layout: "single" });
    const layout = buildLayoutWithDesign({ ...createLayout("b1", "Branch"), rackBuilder: createRackBuilderConfig("T") }, design);
    expect(layout.rackBuilder).toBeUndefined();
    expect(layout.subInventories.map((s) => s.code)).toEqual(["A5", "B1"]);
    const total = countDesignLocations(design);
    expect(capacityOf(layout)).toBe(total);
    expect(buildLocationMap(layout).size).toBe(total);
    const plan = computeScenePlan(layout);
    expect(plan.locations.size).toBe(total);
    expect(plan.frames.length).toBeGreaterThan(0);
    expect(designForLayout(layout).zones).toHaveLength(2);
  });
});
