import type {
  BrandRule,
  LocationMeta,
  NumberRange,
  SubInventoryLayout,
  ValueSet,
  WarehouseLayout,
  WarehouseRecord,
} from "./types";
import {
  buildRackLocations,
  countRackLocations,
  sanitizeZone,
} from "./rack-builder";
import { countDesignLocations, designLocations, normalizeRackDesign } from "./rack-design";

export const SAMPLE_BRAND_RULES: BrandRule[] = [
  { prefix: "CEIL", brand: "CEIL" },
  { prefix: "BULK", brand: "BULK" },
  { prefix: "CYCLO", brand: "CYCLO" },
  { prefix: "DYNEX", brand: "DYNEX" },
  { prefix: "FILTER", brand: "FILTER" },
  { prefix: "OPTIMA", brand: "OPTIMA" },
  { prefix: "IDMITSU", brand: "IDMITSU" },
  { prefix: "REEMS", brand: "REEMS" },
  { prefix: "SCOPE", brand: "SCOPE" },
  { prefix: "SFSONIC", brand: "SFSONIC" },
  { prefix: "SFEFB", brand: "SFSONIC" },
  { prefix: "TMOIL", brand: "TMOIL" },
  { prefix: "USBAT", brand: "USBAT" },
  { prefix: "VALVOLINE", brand: "VAL - Drum" },
  { prefix: "VAL", brand: "VALVOLINE" },
  { prefix: "EXIDE", brand: "EXIDE" },
  { prefix: "HBL", brand: "HBL" },
  { prefix: "GS BAT", brand: "Gulf Star" },
  { prefix: "TGMOIL", brand: "TGMOIL" },
  { prefix: "TMG", brand: "TGMOIL" },
  { prefix: "VARTA", brand: "VARTA" },
  { prefix: "RECEIVE", brand: "RECEIVING" },
];

const LEVEL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function defaultRange(min = 1, max = 1, pad = 2): NumberRange {
  return { min, max, pad };
}

export function rangeValues(range: NumberRange): number[] {
  const min = Math.max(0, Math.floor(range.min));
  const max = Math.max(min, Math.floor(range.max));
  const values: number[] = [];
  // Guard against a mistyped range freezing the browser.
  for (let value = min; value <= max && values.length < 5000; value += 1) {
    values.push(value);
  }
  return values;
}

export function rangeCount(range: NumberRange): number {
  return Math.max(0, Math.floor(range.max) - Math.floor(range.min) + 1);
}

export function padNumber(value: number, pad: number): string {
  const width = Math.max(1, Math.min(6, Math.floor(pad || 1)));
  return String(value).padStart(width, "0");
}

export function normalizeLocator(value: string): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function splitLocator(value: string): string[] {
  return normalizeLocator(value)
    .split(/[.\s/\\|_-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function subInventoryFor(
  layout: WarehouseLayout,
  code: string,
): SubInventoryLayout | undefined {
  const target = code.trim().toUpperCase();
  return layout.subInventories.find(
    (sub) => sub.code.trim().toUpperCase() === target,
  );
}

export function createSubInventory(code: string): SubInventoryLayout {
  return {
    code,
    name: code,
    kind: "rack",
    aisles: defaultRange(),
    bays: defaultRange(),
    levels: ["A", "B", "C"],
    bins: { values: ["1"], pad: 1 },
    locType: "",
  };
}

export function createLayout(
  branchId: string,
  branchName: string,
): WarehouseLayout {
  return {
    id: `layout_${branchId || "new"}`,
    branchId,
    branchName,
    name: branchName ? `${branchName} Warehouse` : "Warehouse",
    subInventories: [createSubInventory("A5")],
    brandRules: SAMPLE_BRAND_RULES.map((rule) => ({ ...rule })),
    updatedAt: new Date().toISOString(),
  };
}

export function buildLocator(
  sub: SubInventoryLayout,
  aisle: number,
  bay: number,
  level: string,
  bin: string,
): string {
  const binToken = /^\d+$/.test(bin)
    ? padNumber(Number.parseInt(bin, 10), sub.bins.pad ?? 1)
    : bin.toUpperCase();
  return [
    sub.code.trim().toUpperCase(),
    padNumber(aisle, sub.aisles.pad),
    padNumber(bay, sub.bays.pad),
    String(level).trim().toUpperCase(),
    binToken,
  ].join(".");
}

export function capacityOf(layout: WarehouseLayout): number {
  if (layout.rackDesign) return countDesignLocations(normalizeRackDesign(layout.rackDesign));
  if (layout.rackBuilder) return countRackLocations(layout.rackBuilder);
  return layout.subInventories.reduce((total, sub) => {
    if (sub.locations?.length) return total + sub.locations.length;
    const levels = sub.levels.length || 1;
    return (
      total +
      rowValuesFor(sub).length *
        rackValuesFor(sub).length *
        levels *
        Math.max(1, sub.bins.values.length)
    );
  }, 0);
}

/** Effective row tokens, numeric range or explicit alphabet values. */
export function rowValuesFor(sub: SubInventoryLayout): string[] {
  return seriesFor(sub.rowValues, sub.aisles);
}

/** Effective rack tokens, numeric range or explicit alphabet values. */
export function rackValuesFor(sub: SubInventoryLayout): string[] {
  return seriesFor(sub.rackValues, sub.bays);
}

function seriesFor(values: string[] | undefined, range: NumberRange): string[] {
  if (values?.length) {
    return values.map((value) => value.trim().toUpperCase()).filter(Boolean);
  }
  return rangeValues(range).map((value) => padNumber(value, range.pad));
}

/** Build every planned location for a layout. */
export const MAX_LOCATIONS = 60000;

export function buildLocationMap(
  layout: WarehouseLayout,
): Map<string, LocationMeta> {
  const map = new Map<string, LocationMeta>();
  if (layout.rackDesign) {
    for (const location of designLocations(normalizeRackDesign(layout.rackDesign))) {
      if (map.size >= MAX_LOCATIONS) break;
      const aisle = /^\d+$/.test(location.rack.bay) ? Number(location.rack.bay) : location.rack.row + 1;
      map.set(location.locator, {
        locator: location.locator,
        sub: location.zone,
        kind: "rack",
        aisle,
        bay: location.rack.num,
        rowCode: location.rack.bay,
        rackCode: location.rackLabel,
        level: location.levelCode,
        bin: location.binCode,
        locType: "Racking",
        unplanned: false,
      });
    }
    return map;
  }
  if (layout.rackBuilder) {
    const zone = sanitizeZone(layout.rackBuilder.zone);
    for (const location of buildRackLocations(layout.rackBuilder)) {
      map.set(location.locator, {
        locator: location.locator,
        sub: zone,
        kind: "rack",
        aisle: location.rowIndex + 1,
        bay: location.bayNumber,
        rowCode: location.rowCode,
        rackCode: location.bayCode,
        level: location.levelCode,
        bin: location.binCode,
        locType: "Racking",
        unplanned: false,
      });
    }
    return map;
  }
  const numeric = (value: string | undefined): number | null => {
    if (value === undefined) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };
  outer: for (const sub of layout.subInventories) {
    const code = sub.code.trim().toUpperCase();
    const explicit = Array.isArray(sub.locations)
      ? sub.locations.map(normalizeLocator).filter(Boolean)
      : [];
    if (explicit.length) {
      for (const locator of explicit) {
        if (map.size >= MAX_LOCATIONS) break outer;
        const parts = locator.split(".");
        map.set(locator, {
          locator,
          sub: code,
          kind: sub.kind,
          aisle: numeric(parts[1]),
          bay: null,
          rackCode: parts[2],
          level: (parts[3] ?? "—").toUpperCase(),
          bin: parts[4] ?? null,
          locType: sub.locType,
          unplanned: false,
        });
      }
      continue;
    }
    const levels = sub.levels.length ? sub.levels : ["1"];
    const bins = sub.bins.values.length ? sub.bins.values : ["1"];
    const rows = rowValuesFor(sub);
    const racks = rackValuesFor(sub);
    for (const row of rows) {
      const aisle = numeric(row);
      for (const rack of racks) {
        const bay = numeric(rack);
        for (const level of levels) {
          for (const bin of bins) {
            if (map.size >= MAX_LOCATIONS) break outer;
            const locator = [
              code,
              row,
              rack,
              String(level).toUpperCase(),
              String(bin).toUpperCase(),
            ].join(".");
            map.set(locator, {
              locator,
              sub: code,
              kind: sub.kind,
              aisle,
              bay,
              rowCode: row,
              rackCode: rack,
              level: String(level).toUpperCase(),
              bin: String(bin).toUpperCase(),
              locType: sub.locType,
              unplanned: false,
            });
          }
        }
      }
    }
  }
  return map;
}

export function metaFromLocator(
  locator: string,
  layout: WarehouseLayout,
): LocationMeta | null {
  const parts = normalizeLocator(locator).split(".");
  if (parts.length < 2) return null;
  const sub = subInventoryFor(layout, parts[0]);
  const numeric = (value: string | undefined): number | null => {
    if (value === undefined) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const levelToken = parts.length >= 4 ? parts[3] : parts[parts.length - 1];
  const binToken = parts.length >= 5 ? parts[4] : undefined;
  return {
    locator: normalizeLocator(locator),
    sub: parts[0],
    kind: sub?.kind ?? "rack",
    aisle: numeric(parts[1]),
    bay: numeric(parts[2]),
    rackCode: parts[2],
    level: levelToken,
    bin: binToken ? binToken.toUpperCase() : null,
    locType: sub?.locType,
    unplanned: true,
  };
}

export function assignBrand(lpn: string, rules: BrandRule[]): string {
  const value = String(lpn || "")
    .trim()
    .toUpperCase();
  if (!value) return "Unknown";
  const sorted = [...rules]
    .filter((rule) => rule.prefix.trim())
    .sort((a, b) => b.prefix.trim().length - a.prefix.trim().length);
  for (const rule of sorted) {
    if (value.startsWith(rule.prefix.trim().toUpperCase()))
      return rule.brand.trim() || "Unknown";
  }
  return "Unknown";
}

type Detected = {
  code: string;
  kind: "rack" | "bulk";
  aisles: number[];
  bays: number[];
  bins: string[];
  levels: string[];
  aislePad: number;
  bayPad: number;
  binPad: number;
  locType?: string;
};

function sortedLevels(values: string[]): string[] {
  const unique = [...new Set(values.filter(Boolean))];
  if (!unique.length) return ["A"];
  const allLetters = unique.every((value) => /^[A-Z]$/.test(value));
  if (allLetters) {
    return [...unique].sort(
      (a, b) => LEVEL_LETTERS.indexOf(a) - LEVEL_LETTERS.indexOf(b),
    );
  }
  const allNumeric = unique.every((value) => /^\d+$/.test(value));
  if (allNumeric) return [...unique].sort((a, b) => Number(a) - Number(b));
  return [...unique].sort();
}

function detectFromRecords(records: WarehouseRecord[]): Detected[] {
  const groups = new Map<
    string,
    {
      aisle: number[];
      bay: number[];
      bin: string[];
      level: string[];
      aislePad: number;
      bayPad: number;
      binPad: number;
    }
  >();
  for (const record of records) {
    const parts = splitLocator(record.locator);
    if (parts.length < 3) continue;
    const code = parts[0];
    const group = groups.get(code) ?? {
      aisle: [],
      bay: [],
      bin: [],
      level: [],
      aislePad: 1,
      bayPad: 1,
      binPad: 1,
    };
    const pushNumber = (
      value: string | undefined,
      bucket: number[],
      padKey: "aislePad" | "bayPad",
    ) => {
      if (!value) return;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return;
      bucket.push(parsed);
      group[padKey] = Math.max(group[padKey], value.length);
    };
    pushNumber(parts[1], group.aisle, "aislePad");
    pushNumber(parts[2], group.bay, "bayPad");
    const levelToken = parts[3] ?? parts[parts.length - 1];
    if (levelToken) group.level.push(levelToken.toUpperCase());
    const binToken = parts[4];
    if (binToken) {
      group.bin.push(binToken.toUpperCase());
      if (/^\d+$/.test(binToken)) {
        group.binPad = Math.max(group.binPad, binToken.length);
      }
    }
    groups.set(code, group);
  }

  const detected: Detected[] = [];
  for (const [code, group] of groups) {
    const levels = sortedLevels(group.level);
    const looksBulk = levels.length === 1 && !/^[A-Z]$/.test(levels[0]);
    const aisles = group.aisle.length ? group.aisle : [1];
    const bays = group.bay.length ? group.bay : [1];
    const bins = group.bin.length ? sortedLevels(group.bin) : ["1"];
    detected.push({
      code,
      kind: looksBulk ? "bulk" : "rack",
      aisles,
      bays,
      bins,
      levels,
      aislePad: group.aislePad,
      bayPad: group.bayPad,
      binPad: group.binPad,
    });
  }

  return detected.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "rack" ? -1 : 1;
    return a.code.localeCompare(b.code);
  });
}

function toRange(values: number[], pad: number, fallback: number): NumberRange {
  const usable = values
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.floor(value));
  if (!usable.length) return defaultRange(fallback, fallback, pad || 2);
  return {
    min: Math.min(...usable),
    max: Math.max(...usable),
    pad: Math.max(1, pad || String(Math.max(...usable)).length),
  };
}

function toValueSet(values: string[], pad: number): ValueSet {
  const usable = [
    ...new Set(
      values.map((value) => value.trim().toUpperCase()).filter(Boolean),
    ),
  ];
  const resolved = usable.length ? usable : ["1"];
  const allNumeric = resolved.every((value) => /^\d+$/.test(value));
  return {
    values: resolved,
    pad: allNumeric ? Math.max(1, pad) : undefined,
  };
}

/**
 * Suggest a layout from the uploaded inventory file. The ranges are based on
 * the locators that actually appear in the file, so the user should widen the
 * capacity in the Layout tab when the warehouse has empty locations beyond the
 * observed range (the capacity card warns about this).
 */
export function detectLayout(
  records: WarehouseRecord[],
  branchId: string,
  branchName: string,
  warehouseName?: string,
): WarehouseLayout {
  const detected = detectFromRecords(records);
  const base = createLayout(branchId, branchName);
  if (!detected.length) return base;

  return {
    ...base,
    name:
      warehouseName || (branchName ? `${branchName} Warehouse` : "Warehouse"),
    subInventories: detected.map((entry) => ({
      code: entry.code,
      name: entry.code,
      kind: entry.kind,
      aisles: toRange(entry.aisles, entry.aislePad, 1),
      bays: toRange(entry.bays, entry.bayPad, 1),
      levels: entry.levels,
      bins: toValueSet(entry.bins, entry.binPad),
      locType: entry.locType,
    })),
  };
}

export function describeSub(sub: SubInventoryLayout): string {
  if (sub.locations?.length)
    return `${sub.locations.length.toLocaleString()} imported locations`;
  if (sub.kind === "bulk") return "Floor / bulk area";
  return `${rowValuesFor(sub).length} rows × ${rackValuesFor(sub).length} racks × ${sub.levels.length} levels × ${sub.bins.values.length} bins`;
}

/**
 * Migrate layouts saved before bins became a value set (and guard against
 * incomplete documents created by older clients).
 */
export function normalizeLayout(layout: WarehouseLayout): WarehouseLayout {
  const subInventories = Array.isArray(layout?.subInventories)
    ? layout.subInventories
    : [];
  return {
    ...layout,
    id: layout?.id || `layout_${layout?.branchId || "new"}`,
    name: layout?.name || "Warehouse",
    branchId: layout?.branchId || "",
    branchName: layout?.branchName || "",
    brandRules: Array.isArray(layout?.brandRules) ? layout.brandRules : [],
    subInventories: subInventories.map((sub) => {
      const rawBins = (sub as unknown as { bins?: unknown }).bins as
        | { values?: unknown[]; min?: number; max?: number; pad?: number }
        | undefined;
      let bins: ValueSet;
      if (rawBins && Array.isArray(rawBins.values) && rawBins.values.length) {
        bins = {
          values: rawBins.values.map((value) => String(value).toUpperCase()),
          pad: rawBins.pad,
        };
      } else if (
        rawBins &&
        typeof rawBins.min === "number" &&
        typeof rawBins.max === "number"
      ) {
        const pad = rawBins.pad || 1;
        bins = {
          values: rangeValues({ min: rawBins.min, max: rawBins.max, pad }).map(
            (value) => padNumber(value, pad),
          ),
          pad,
        };
      } else {
        bins = { values: ["1"], pad: 1 };
      }
      return {
        ...sub,
        aisles: sub.aisles ?? defaultRange(),
        bays: sub.bays ?? defaultRange(),
        levels:
          Array.isArray(sub.levels) && sub.levels.length
            ? sub.levels.map((level) => String(level).toUpperCase())
            : ["1"],
        bins,
        locations: Array.isArray(sub.locations)
          ? sub.locations
              .map((locator) => normalizeLocator(locator))
              .filter(Boolean)
          : undefined,
      };
    }),
  };
}
