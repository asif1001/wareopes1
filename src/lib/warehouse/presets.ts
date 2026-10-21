import { SAMPLE_BRAND_RULES } from "./layout";
import type { SubInventoryLayout, WarehouseLayout } from "./types";

export type LayoutPreset = {
  id: string;
  name: string;
  description: string;
  build: (branchId: string, branchName: string) => WarehouseLayout;
};

function bulk(code: string, name: string): SubInventoryLayout {
  return {
    code,
    name,
    kind: "bulk",
    aisles: { min: 1, max: 1, pad: 2 },
    bays: { min: 1, max: 1, pad: 2 },
    levels: ["1"],
    bins: { values: ["1"], pad: 1 },
  };
}

function layout(
  branchId: string,
  branchName: string,
  name: string,
  subInventories: SubInventoryLayout[],
): WarehouseLayout {
  return {
    id: `layout_${branchId || "new"}`,
    branchId,
    branchName,
    name,
    subInventories,
    brandRules: SAMPLE_BRAND_RULES.map((rule) => ({ ...rule })),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * The physical naming used on the warehouse floor is
 * Zone.Row.Rack.Level.Bin, for example A5.03.15.F.2.
 */
export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "vna",
    name: "VNA Salmabad (from inventory data)",
    description:
      "A5 main racking: 6 rows × 20 racks × 7 levels (A–G) × 3 bins, plus MAN/SCO/VAL bulk areas.",
    build: (branchId, branchName) =>
      layout(branchId, branchName, "Salmabad VNA", [
        {
          code: "A5",
          name: "VNA main racking",
          kind: "rack",
          aisles: { min: 1, max: 6, pad: 2 },
          bays: { min: 1, max: 20, pad: 2 },
          levels: ["A", "B", "C", "D", "E", "F", "G"],
          bins: { values: ["1", "2", "3"], pad: 1 },
          uTurnAfter: 10,
          locType: "VNA",
        },
        bulk("MAN", "Manual / bulk area"),
        bulk("SCO", "SCO bulk area"),
        bulk("VAL", "VAL bulk area"),
      ]),
  },
  {
    id: "diagram",
    name: "Racking diagram (A · 01 · 01 · 1 · A)",
    description:
      "Diagram template: Zone A, Row 01, Racks 01–03, Levels 1–5, Bins A–D.",
    build: (branchId, branchName) =>
      layout(branchId, branchName, "Racking diagram", [
        {
          code: "A",
          name: "Zone A racking",
          kind: "rack",
          aisles: { min: 1, max: 1, pad: 2 },
          bays: { min: 1, max: 3, pad: 2 },
          levels: ["1", "2", "3", "4", "5"],
          bins: { values: ["A", "B", "C", "D"] },
          uTurnAfter: 0,
          locType: "Racking",
        },
      ]),
  },
];

export function buildLayoutPreset(
  id: string,
  branchId: string,
  branchName: string,
): WarehouseLayout | null {
  const preset = LAYOUT_PRESETS.find((entry) => entry.id === id);
  return preset ? preset.build(branchId, branchName) : null;
}
