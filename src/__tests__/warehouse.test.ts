import { describe, expect, it } from "vitest";
import {
  assignBrand,
  buildLocationMap,
  capacityOf,
  createLayout,
  detectLayout,
} from "@/lib/warehouse/layout";
import { analyzeWarehouse, compareSummaries } from "@/lib/warehouse/analyze";
import { recordsFromRows } from "@/lib/warehouse/parse";
import { computeScenePlan, AISLE_PITCH } from "@/lib/warehouse/geometry";
import {
  buildLayoutWithRackBuilder,
  buildRackLocations,
  createRackBuilderConfig,
  rackToken,
} from "@/lib/warehouse/rack-builder";
import type { WarehouseLayout, WarehouseRecord } from "@/lib/warehouse/types";

function testLayout(): WarehouseLayout {
  const layout = createLayout("branch-1", "Test Branch");
  layout.subInventories = [
    {
      code: "A5",
      name: "VNA main",
      kind: "rack",
      aisles: { min: 1, max: 2, pad: 2 },
      bays: { min: 1, max: 2, pad: 2 },
      levels: ["A", "B"],
      bins: { values: ["1"], pad: 1 },
      locType: "Oil",
    },
  ];
  layout.brandRules = [
    { prefix: "TMOIL", brand: "TMOIL" },
    { prefix: "VALVOLINE", brand: "VAL - Drum" },
    { prefix: "VAL", brand: "VALVOLINE" },
  ];
  return layout;
}

function record(
  partial: Partial<WarehouseRecord> & { locator: string; lpn: string },
): WarehouseRecord {
  return {
    brand: "Unknown",
    onHand: 0,
    sub: partial.locator.split(".")[0],
    ...partial,
  };
}

describe("brand assignment", () => {
  it("matches the longest prefix first regardless of case", () => {
    const rules = [
      { prefix: "VAL", brand: "VALVOLINE" },
      { prefix: "VALVOLINE", brand: "VAL - Drum" },
    ];
    expect(assignBrand("valvoline-123", rules)).toBe("VAL - Drum");
    expect(assignBrand("VAL4-420", rules)).toBe("VALVOLINE");
    expect(assignBrand("unknown-1", rules)).toBe("Unknown");
    expect(assignBrand("", rules)).toBe("Unknown");
  });
});

describe("layout detection", () => {
  it("detects a racking area and a bulk area from locators", () => {
    const records = [
      record({ locator: "A5.01.01.A.1", lpn: "TMOIL-1" }),
      record({ locator: "A5.06.20.G.3", lpn: "TMOIL-2" }),
      record({ locator: "MAN.1.1.1.1", lpn: "CEIL-1" }),
    ];
    const layout = detectLayout(records, "branch-1", "Test Branch");
    expect(layout.subInventories).toHaveLength(2);
    const [rack, bulk] = layout.subInventories;
    expect(rack).toMatchObject({
      code: "A5",
      kind: "rack",
      aisles: { min: 1, max: 6, pad: 2 },
      bays: { min: 1, max: 20, pad: 2 },
      bins: { values: ["1", "3"], pad: 1 },
      levels: ["A", "G"],
    });
    expect(bulk.code).toBe("MAN");
    expect(bulk.kind).toBe("bulk");
  });

  it("pads locator numbers to the width seen in the file", () => {
    const layout = testLayout();
    const locations = buildLocationMap(layout);
    expect(locations.has("A5.01.01.A.1")).toBe(true);
    expect(locations.get("A5.02.02.B.1")?.aisle).toBe(2);
    expect(capacityOf(layout)).toBe(8);
  });

  it("supports alphabetic bins and numeric racking levels", () => {
    const layout = createLayout("branch-2", "Image example");
    layout.subInventories = [
      {
        code: "Z1",
        name: "Zone A",
        kind: "rack",
        aisles: { min: 1, max: 2, pad: 2 },
        bays: { min: 1, max: 1, pad: 2 },
        levels: ["1", "2", "3"],
        bins: { values: ["A", "B", "C", "D"] },
      },
    ];
    const locations = buildLocationMap(layout);
    expect(capacityOf(layout)).toBe(24);
    expect(locations.has("Z1.01.01.1.A")).toBe(true);
    expect(locations.get("Z1.02.01.3.D")).toMatchObject({
      aisle: 2,
      bay: 1,
      level: "3",
      bin: "D",
    });
  });

  it("supports an explicit location list for irregular masters", () => {
    const layout = createLayout("branch-4", "Tubli");
    layout.subInventories = [
      {
        code: "T",
        name: "Tubli bulk staging",
        kind: "rack",
        aisles: { min: 1, max: 26, pad: 2 },
        bays: { min: 1, max: 1, pad: 1 },
        levels: ["1"],
        bins: { values: ["1"], pad: 1 },
        locations: ["T.01.A.1.A", "T.01.B.2.C", "T.26.Y.4.A"],
      },
    ];
    const locations = buildLocationMap(layout);
    expect(capacityOf(layout)).toBe(3);
    expect(locations.size).toBe(3);
    expect(locations.get("T.01.A.1.A")).toMatchObject({
      sub: "T",
      aisle: 1,
      bay: null,
      rackCode: "A",
      level: "1",
      bin: "A",
    });
    const plan = computeScenePlan(layout);
    expect(plan.locations.size).toBe(3);
  });

  it("generates locations with alphabet rows and racks", () => {
    const layout = createLayout("branch-6", "Alpha rows");
    layout.subInventories = [
      {
        code: "T",
        name: "Alpha",
        kind: "rack",
        aisles: { min: 1, max: 1, pad: 2 },
        bays: { min: 1, max: 1, pad: 2 },
        levels: ["1", "2"],
        bins: { values: ["A"], pad: 1 },
        rowValues: ["A", "B"],
        rackValues: ["A", "B", "C"],
      },
    ];
    const locations = buildLocationMap(layout);
    expect(capacityOf(layout)).toBe(12);
    expect(locations.has("T.A.A.1.A")).toBe(true);
    expect(locations.has("T.B.C.2.A")).toBe(true);
    expect(locations.get("T.B.C.2.A")).toMatchObject({
      rowCode: "B",
      rackCode: "C",
      level: "2",
      bin: "A",
    });
    expect(computeScenePlan(layout).locations.size).toBe(12);
  });

  it("inserts a cross-aisle after each row group", () => {
    const layout = createLayout("branch-5", "Tubli pairs");
    layout.subInventories = [
      {
        code: "T",
        name: "Tubli",
        kind: "rack",
        aisles: { min: 1, max: 3, pad: 2 },
        bays: { min: 1, max: 1, pad: 1 },
        levels: ["1"],
        bins: { values: ["A"], pad: 1 },
        locations: ["T.01.A.1.A", "T.02.A.1.A", "T.03.A.1.A"],
        rowGroupSize: 2,
      },
    ];
    const plan = computeScenePlan(layout);
    const x = (row: string) =>
      plan.locations.get(`T.${row}.A.1.A`)!.position[0];
    expect(x("02") - x("01")).toBeCloseTo(AISLE_PITCH);
    expect(x("03") - x("02")).toBeGreaterThan(AISLE_PITCH);
  });
});

describe("occupancy analysis", () => {
  it("counts planned capacity, mixed brands and unplanned locations", () => {
    const records = [
      record({
        locator: "A5.01.01.A.1",
        lpn: "TMOIL-1",
        brand: "TMOIL",
        onHand: 10,
      }),
      record({
        locator: "A5.01.01.A.1",
        lpn: "VAL-2",
        brand: "VALVOLINE",
        onHand: 5,
      }),
      record({
        locator: "A5.02.02.B.1",
        lpn: "X-1",
        brand: "Unknown",
        onHand: 2,
      }),
      record({
        locator: "MAN.1.1.1.1",
        lpn: "TMOIL-9",
        brand: "TMOIL",
        onHand: 1,
      }),
    ];
    const report = analyzeWarehouse(records, testLayout());
    expect(report.summary.totalLocations).toBe(8);
    expect(report.summary.occupiedLocations).toBe(2);
    expect(report.summary.emptyLocations).toBe(6);
    expect(report.summary.occupancyPct).toBe(25);
    expect(report.summary.lpnCount).toBe(4);
    expect(report.summary.onHandTotal).toBe(18);
    expect(report.summary.mixedLocations).toBe(1);
    expect(report.summary.unplannedLocations).toBe(1);
    expect(report.summary.unknownBrandLpns).toBe(1);
    expect(report.unplanned[0].meta.locator).toBe("MAN.1.1.1.1");
    expect(report.warnings.join(" ")).toMatch(/outside the configured layout/);
    expect(report.warnings.join(" ")).toMatch(/brand prefix/);

    const tmoil = report.summary.brandRows.find((row) => row.brand === "TMOIL");
    expect(tmoil?.locations).toBe(2);
    expect(
      report.summary.levelRows.find((row) => row.level === "A")?.occupied,
    ).toBe(1);
    expect(
      report.summary.aisleRows.find((row) => row.aisle === 2)?.occupied,
    ).toBe(1);
    expect(report.summary.crossTab.TMOIL.A).toBe(1);
  });

  it("compares two snapshots", () => {
    const first = analyzeWarehouse(
      [record({ locator: "A5.01.01.A.1", lpn: "A-1", brand: "A", onHand: 10 })],
      testLayout(),
    ).summary;
    const second = analyzeWarehouse(
      [
        record({ locator: "A5.01.01.A.1", lpn: "A-1", brand: "A", onHand: 10 }),
        record({ locator: "A5.01.02.A.1", lpn: "B-1", brand: "B", onHand: 4 }),
      ],
      testLayout(),
    ).summary;
    const delta = compareSummaries(first, second);
    expect(delta.occupiedLocations).toBe(1);
    expect(delta.occupancyPct).toBe(12.5);
    expect(delta.brandGainers[0]).toEqual({ brand: "B", delta: 1 });
  });
});

describe("spreadsheet parsing", () => {
  it("maps common column names and normalises values", () => {
    const rows = [
      {
        Locator: "a5.01.01.a.1",
        LPN: "TMOIL-1",
        "On-hand": "1,200",
        Item: "TSN4LC",
        "Item Description": "Oil filter",
        Brand: "",
      },
    ];
    const parsed = recordsFromRows(rows, Object.keys(rows[0]), [
      { prefix: "TMOIL", brand: "TMOIL" },
    ]);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]).toMatchObject({
      locator: "A5.01.01.A.1",
      lpn: "TMOIL-1",
      brand: "TMOIL",
      onHand: 1200,
      item: "TSN4LC",
      description: "Oil filter",
    });
    expect(parsed.mappedColumns.locator).toBe("Locator");
  });

  it("returns a warning instead of guessing when Locator is missing", () => {
    const rows = [{ LPN: "TMOIL-1", "On-hand": 5 }];
    const parsed = recordsFromRows(rows, Object.keys(rows[0]), []);
    expect(parsed.records).toHaveLength(0);
    expect(parsed.skippedRows).toBe(1);
    expect(parsed.warnings[0]).toMatch(/Locator/);
  });
});

describe("rack builder", () => {
  it("generates Zone.Row.Bay.Level.Bin codes with letters or numbers", () => {
    const config = createRackBuilderConfig("T");
    config.rows = [
      { bays: 3, levels: 2, bins: 2, join: "aisle" },
      { bays: 2, levels: 1, bins: 1, join: "aisle" },
    ];
    config.numbering = {
      ...config.numbering,
      bay: "num",
      level: "alpha",
      bin: "num",
      direction: "ltr",
    };
    const locations = buildRackLocations(config);
    expect(locations).toHaveLength(14);
    expect(locations[0].locator).toBe("T.01.01.A.1");
    expect(locations[11].locator).toBe("T.01.03.B.2");

    config.numbering.direction = "rtl";
    expect(buildRackLocations(config)[0].locator).toBe("T.01.03.A.1");
    expect(rackToken(27, "alpha")).toBe("AA");
  });

  it("builds a drawable layout from the rack builder", () => {
    const config = createRackBuilderConfig("T");
    config.rows = [
      { bays: 4, levels: 3, bins: 2, join: "aisle" },
      { bays: 3, levels: 2, bins: 1, join: "b2b" },
    ];
    const base = createLayout("branch-7", "Rack builder");
    const layout = buildLayoutWithRackBuilder(base, config);
    expect(layout.rackBuilder?.rows).toHaveLength(2);
    expect(capacityOf(layout)).toBe(30);
    expect(buildLocationMap(layout).size).toBe(30);
    const plan = computeScenePlan(layout);
    expect(plan.locations.size).toBe(30);
    expect(plan.frames.length).toBeGreaterThan(0);
  });
});

describe("3D scene geometry", () => {
  it("places every planned location and parks unmapped locators separately", () => {
    const layout = testLayout();
    const unplanned = [
      {
        locator: "MAN.1.1.1.1",
        sub: "MAN",
        kind: "bulk" as const,
        aisle: 1,
        bay: 1,
        level: "1",
        bin: "1",
        unplanned: true,
      },
    ];
    const plan = computeScenePlan(layout, unplanned);
    expect(plan.locations.size).toBe(9);
    expect(plan.locations.get("A5.01.01.A.1")?.unplanned).toBe(false);
    expect(plan.locations.get("MAN.1.1.1.1")?.unplanned).toBe(true);
    for (const location of plan.locations.values()) {
      expect(location.position.every((value) => Number.isFinite(value))).toBe(
        true,
      );
    }
    expect(plan.frames.length).toBeGreaterThan(0);
    expect(plan.radius).toBeGreaterThan(0);
  });

  it("turns the rack run around after rack 10", () => {
    const layout = createLayout("branch-3", "U-turn");
    layout.subInventories = [
      {
        code: "A5",
        name: "VNA",
        kind: "rack",
        aisles: { min: 1, max: 1, pad: 2 },
        bays: { min: 1, max: 20, pad: 2 },
        levels: ["A"],
        bins: { values: ["1", "2"], pad: 1 },
      },
    ];
    const plan = computeScenePlan(layout);
    const rack = (number: number) =>
      plan.locations.get(`A5.01.${String(number).padStart(2, "0")}.A.1`)!;
    expect(plan.locations.size).toBe(40);
    // Racks 1 and 20 are at the near end, 10 and 11 at the turn.
    expect(rack(1).position[2]).toBeCloseTo(rack(20).position[2]);
    expect(rack(10).position[2]).toBeCloseTo(rack(11).position[2]);
    expect(rack(1).position[0]).toBeLessThan(rack(20).position[0]);
    expect(rack(10).position[0]).toBeLessThan(rack(11).position[0]);
    expect(rack(10).position[2]).toBeGreaterThan(rack(1).position[2]);
  });
});
