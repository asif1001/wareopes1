import type {
  RackBuilderConfig,
  RackDimensions,
  RackNumbering,
  RackRowConfig,
  SubInventoryLayout,
  WarehouseLayout,
} from "./types";

export const DEFAULT_RACK_DIMENSIONS: RackDimensions = {
  bayWidth: 2700,
  rackDepth: 1100,
  levelHeight: 1500,
  aisleWidth: 2200,
  backToBackGap: 200,
};

export const DEFAULT_RACK_NUMBERING: RackNumbering = {
  bay: "num",
  level: "alpha",
  bin: "num",
  binOrientation: "side",
  direction: "ltr",
};

export type RackLocation = {
  locator: string;
  rowIndex: number;
  bayIndex: number;
  bayNumber: number;
  levelIndex: number;
  binIndex: number;
  rowCode: string;
  bayCode: string;
  levelCode: string;
  binCode: string;
};

export function sanitizeZone(value: string): string {
  return (value.trim() || "T").replace(/[^a-z0-9_-]/gi, "").toUpperCase();
}

export function createRackRows(
  count: number,
  bays: number,
  levels: number,
  bins: number,
): RackRowConfig[] {
  const total = Math.max(1, Math.min(20, Math.floor(count) || 1));
  return Array.from({ length: total }, (_, index) => ({
    bays: Math.max(1, Math.min(40, Math.floor(bays) || 1)),
    levels: Math.max(1, Math.min(10, Math.floor(levels) || 1)),
    bins: Math.max(1, Math.min(6, Math.floor(bins) || 1)),
    join: index % 2 === 0 ? "aisle" : "b2b",
  }));
}

export function createRackBuilderConfig(zone = "T"): RackBuilderConfig {
  return {
    zone: sanitizeZone(zone),
    rows: createRackRows(5, 19, 4, 3),
    dimensions: { ...DEFAULT_RACK_DIMENSIONS },
    numbering: { ...DEFAULT_RACK_NUMBERING },
  };
}

/** Format 1 → "01"/"A", 27 → "AA" for alphabet sequences. */
export function rackToken(
  value: number,
  type: "num" | "alpha",
  pad = false,
): string {
  if (type === "alpha") {
    let result = "";
    let current = Math.max(1, Math.floor(value));
    do {
      result = String.fromCharCode(65 + ((current - 1) % 26)) + result;
      current = Math.floor((current - 1) / 26);
    } while (current > 0);
    return result;
  }
  return pad ? String(value).padStart(2, "0") : String(value);
}

export function rackRowCode(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export function buildRackLocations(config: RackBuilderConfig): RackLocation[] {
  const zone = sanitizeZone(config.zone);
  const locations: RackLocation[] = [];
  config.rows.forEach((row, rowIndex) => {
    const rowCode = rackRowCode(rowIndex);
    for (let bayIndex = 0; bayIndex < row.bays; bayIndex += 1) {
      const bayNumber =
        config.numbering.direction === "rtl"
          ? row.bays - bayIndex
          : bayIndex + 1;
      const bayCode = rackToken(bayNumber, config.numbering.bay, true);
      for (let levelIndex = 0; levelIndex < row.levels; levelIndex += 1) {
        const levelCode = rackToken(
          levelIndex + 1,
          config.numbering.level,
          false,
        );
        for (let binIndex = 0; binIndex < row.bins; binIndex += 1) {
          const binCode = rackToken(binIndex + 1, config.numbering.bin, false);
          locations.push({
            locator: [zone, rowCode, bayCode, levelCode, binCode].join("."),
            rowIndex,
            bayIndex,
            bayNumber,
            levelIndex,
            binIndex,
            rowCode,
            bayCode,
            levelCode,
            binCode,
          });
        }
      }
    }
  });
  return locations;
}

export function countRackLocations(config: RackBuilderConfig): number {
  return config.rows.reduce(
    (total, row) => total + row.bays * row.levels * row.bins,
    0,
  );
}

export function buildLayoutWithRackBuilder(
  base: WarehouseLayout,
  config: RackBuilderConfig,
): WarehouseLayout {
  const zone = sanitizeZone(config.zone);
  const maxBays = Math.max(...config.rows.map((row) => row.bays), 1);
  const maxLevels = Math.max(...config.rows.map((row) => row.levels), 1);
  const maxBins = Math.max(...config.rows.map((row) => row.bins), 1);
  const placeholder: SubInventoryLayout = {
    code: zone,
    name: `${zone} racking`,
    kind: "rack",
    aisles: { min: 1, max: config.rows.length, pad: 2 },
    bays: { min: 1, max: maxBays, pad: 2 },
    levels: Array.from({ length: maxLevels }, (_, index) => String(index + 1)),
    bins: {
      values: Array.from({ length: maxBins }, (_, index) => String(index + 1)),
      pad: 1,
    },
    locType: "Racking",
  };
  return {
    ...base,
    name: base.name || `${zone} Warehouse`,
    rackBuilder: config,
    subInventories: [placeholder],
    updatedAt: new Date().toISOString(),
  };
}

/** Derive a builder configuration from a legacy range/explicit layout. */
export function deriveRackBuilderConfig(
  layout: WarehouseLayout,
): RackBuilderConfig {
  if (layout.rackBuilder) return layout.rackBuilder;
  const sub = layout.subInventories[0];
  if (!sub) return createRackBuilderConfig("T");
  const rowCount = Math.max(1, sub.aisles.max - sub.aisles.min + 1);
  const bays = Math.max(1, sub.bays.max - sub.bays.min + 1);
  const levels = Math.max(1, sub.levels.length);
  const bins = Math.max(1, sub.bins.values.length);
  const levelsAreLetters = sub.levels.every((level) => /^[A-Z]$/.test(level));
  const binsAreLetters = sub.bins.values.every((bin) => /^[A-Z]$/.test(bin));
  return {
    zone: sub.code,
    rows: createRackRows(rowCount, bays, levels, bins),
    dimensions: { ...DEFAULT_RACK_DIMENSIONS },
    numbering: {
      ...DEFAULT_RACK_NUMBERING,
      bay: "num",
      level: levelsAreLetters ? "alpha" : "num",
      bin: binsAreLetters ? "alpha" : "num",
    },
  };
}
