import { buildLocationMap, metaFromLocator, normalizeLocator } from "./layout";
import type {
  AisleSummaryRow,
  BrandSummaryRow,
  LevelSummaryRow,
  LocationMeta,
  ResolvedLocation,
  SnapshotSummary,
  SubSummaryRow,
  WarehouseLayout,
  WarehouseRecord,
  WarehouseReport,
} from "./types";

const round1 = (value: number): number => Math.round(value * 10) / 10;
const pct = (part: number, total: number): number =>
  total > 0 ? round1((part / total) * 100) : 0;

export function levelSort(a: string, b: string): number {
  const aNum = /^\d+$/.test(a);
  const bNum = /^\d+$/.test(b);
  if (aNum && bNum) return Number(a) - Number(b);
  if (aNum) return 1;
  if (bNum) return -1;
  return a.localeCompare(b);
}

function emptyLocation(meta: LocationMeta): ResolvedLocation {
  return {
    meta,
    records: [],
    brands: [],
    onHand: 0,
    lpnCount: 0,
    occupied: false,
    mixed: false,
  };
}

function resolveLocation(
  meta: LocationMeta,
  records: WarehouseRecord[],
): ResolvedLocation {
  const brands = [
    ...new Set(records.map((record) => record.brand).filter(Boolean)),
  ].sort();
  const lpns = new Set(records.map((record) => record.lpn).filter(Boolean));
  return {
    meta,
    records,
    brands,
    onHand: records.reduce(
      (total, record) =>
        total + (Number.isFinite(record.onHand) ? record.onHand : 0),
      0,
    ),
    lpnCount: lpns.size,
    occupied: records.length > 0,
    mixed: brands.length > 1,
  };
}

export function summarize(
  layout: WarehouseLayout,
  records: WarehouseRecord[],
  locations: Map<string, ResolvedLocation>,
  unplanned: ResolvedLocation[],
  warnings: string[],
): SnapshotSummary {
  const planned = [...locations.values()];
  const totalLocations = planned.length;
  const occupiedLocations = planned.filter(
    (location) => location.occupied,
  ).length;
  const emptyLocations = totalLocations - occupiedLocations;
  const allLocations = [...planned, ...unplanned];

  const lpnSet = new Set(records.map((record) => record.lpn).filter(Boolean));
  const skuSet = new Set(
    records
      .map(
        (record) =>
          (record.item || "").trim() ||
          (record.description || "").trim() ||
          record.lpn,
      )
      .filter(Boolean),
  );

  const brandLocations = new Map<string, Set<string>>();
  const brandLpns = new Map<string, Set<string>>();
  const brandOnHand = new Map<string, number>();
  for (const record of records) {
    const brand = record.brand || "Unknown";
    if (!brandLocations.has(brand)) brandLocations.set(brand, new Set());
    brandLocations.get(brand)!.add(normalizeLocator(record.locator));
    if (!brandLpns.has(brand)) brandLpns.set(brand, new Set());
    if (record.lpn) brandLpns.get(brand)!.add(record.lpn);
    brandOnHand.set(
      brand,
      (brandOnHand.get(brand) || 0) +
        (Number.isFinite(record.onHand) ? record.onHand : 0),
    );
  }

  const brandRows: BrandSummaryRow[] = [...brandLocations.entries()]
    .map(([brand, locators]) => ({
      brand,
      locations: locators.size,
      lpns: brandLpns.get(brand)?.size ?? 0,
      onHand: brandOnHand.get(brand) ?? 0,
      pct: pct(locators.size, totalLocations),
    }))
    .sort(
      (a, b) => b.locations - a.locations || a.brand.localeCompare(b.brand),
    );

  const levelTotals = new Map<string, { total: number; occupied: number }>();
  for (const location of planned) {
    const key = location.meta.level || "—";
    const entry = levelTotals.get(key) ?? { total: 0, occupied: 0 };
    entry.total += 1;
    if (location.occupied) entry.occupied += 1;
    levelTotals.set(key, entry);
  }
  const levelRows: LevelSummaryRow[] = [...levelTotals.entries()]
    .sort(([a], [b]) => levelSort(a, b))
    .map(([level, value]) => ({
      level,
      total: value.total,
      occupied: value.occupied,
      empty: value.total - value.occupied,
      pct: pct(value.occupied, value.total),
    }));

  const aisleTotals = new Map<number, { total: number; occupied: number }>();
  for (const location of planned) {
    if (location.meta.aisle === null) continue;
    const entry = aisleTotals.get(location.meta.aisle) ?? {
      total: 0,
      occupied: 0,
    };
    entry.total += 1;
    if (location.occupied) entry.occupied += 1;
    aisleTotals.set(location.meta.aisle, entry);
  }
  const aisleRows: AisleSummaryRow[] = [...aisleTotals.entries()]
    .sort(([a], [b]) => a - b)
    .map(([aisle, value]) => ({
      aisle,
      total: value.total,
      occupied: value.occupied,
      empty: value.total - value.occupied,
      pct: pct(value.occupied, value.total),
    }));

  const subRows: SubSummaryRow[] = layout.subInventories.map((sub) => {
    const code = sub.code.trim().toUpperCase();
    const subLocations = planned.filter(
      (location) => location.meta.sub === code,
    );
    const occupied = subLocations.filter((location) => location.occupied);
    return {
      sub: code,
      name: sub.name || code,
      kind: sub.kind,
      total: subLocations.length,
      occupied: occupied.length,
      empty: subLocations.length - occupied.length,
      pct: pct(occupied.length, subLocations.length),
      lpns: new Set(
        occupied.flatMap((location) =>
          location.records.map((record) => record.lpn),
        ),
      ).size,
      onHand: occupied.reduce((total, location) => total + location.onHand, 0),
    };
  });

  const crossTab: Record<string, Record<string, number>> = {};
  for (const brand of brandLocations.keys()) crossTab[brand] = {};
  for (const location of allLocations) {
    if (!location.occupied) continue;
    for (const brand of location.brands) {
      if (!crossTab[brand]) crossTab[brand] = {};
      const level = location.meta.level || "—";
      crossTab[brand][level] = (crossTab[brand][level] || 0) + 1;
    }
  }

  const unknownBrandLpns = new Set(
    records
      .filter((record) => record.brand === "Unknown" && record.lpn)
      .map((record) => record.lpn),
  ).size;

  return {
    totalLocations,
    occupiedLocations,
    emptyLocations,
    occupancyPct: pct(occupiedLocations, totalLocations),
    lpnCount: lpnSet.size,
    skuCount: skuSet.size,
    onHandTotal: records.reduce(
      (total, record) =>
        total + (Number.isFinite(record.onHand) ? record.onHand : 0),
      0,
    ),
    mixedLocations: planned.filter((location) => location.mixed).length,
    brandCount: brandRows.length,
    unknownBrandLpns,
    unplannedLocations: unplanned.length,
    recordCount: records.length,
    brandRows,
    levelRows,
    aisleRows,
    subRows,
    crossTab,
    generatedAt: new Date().toISOString(),
  };
}

export function analyzeWarehouse(
  records: WarehouseRecord[],
  layout: WarehouseLayout,
): WarehouseReport {
  const planned = buildLocationMap(layout);
  const recordsByLocator = new Map<string, WarehouseRecord[]>();
  for (const record of records) {
    const locator = normalizeLocator(record.locator);
    if (!locator) continue;
    if (!recordsByLocator.has(locator)) recordsByLocator.set(locator, []);
    recordsByLocator.get(locator)!.push(record);
  }

  const locations = new Map<string, ResolvedLocation>();
  for (const [locator, meta] of planned) {
    locations.set(
      locator,
      resolveLocation(meta, recordsByLocator.get(locator) ?? []),
    );
  }

  const unplanned: ResolvedLocation[] = [];
  for (const [locator, locatorRecords] of recordsByLocator) {
    if (planned.has(locator)) continue;
    const meta = metaFromLocator(locator, layout) ?? {
      locator,
      sub: locatorRecords[0]?.sub || "UNMAPPED",
      kind: "rack" as const,
      aisle: null,
      bay: null,
      level: "—",
      bin: null,
      unplanned: true,
    };
    unplanned.push(
      resolveLocation({ ...meta, unplanned: true }, locatorRecords),
    );
  }
  unplanned.sort((a, b) => a.meta.locator.localeCompare(b.meta.locator));

  const warnings: string[] = [];
  if (unplanned.length) {
    warnings.push(
      `${unplanned.length.toLocaleString()} storage location(s) in the file are outside the configured layout. Widen the ranges in the Layout tab or review the Validation tab.`,
    );
  }
  if (records.some((record) => record.brand === "Unknown")) {
    warnings.push(
      "Some LPNs did not match a brand prefix. Add the missing prefixes in the Brand rules tab to classify them.",
    );
  }
  if (!layout.subInventories.length) {
    warnings.push("No storage areas are configured for this branch yet.");
  }
  if (records.length === 0) {
    warnings.push("The uploaded sheet did not contain any inventory rows.");
  }

  const summary = summarize(layout, records, locations, unplanned, warnings);
  return { layout, records, summary, locations, unplanned, warnings };
}

export type SummaryDelta = {
  occupancyPct: number;
  occupiedLocations: number;
  emptyLocations: number;
  lpnCount: number;
  onHandTotal: number;
  mixedLocations: number;
  brandGainers: { brand: string; delta: number }[];
  brandLosers: { brand: string; delta: number }[];
};

export function compareSummaries(
  previous: SnapshotSummary,
  current: SnapshotSummary,
): SummaryDelta {
  const previousBrands = new Map(
    previous.brandRows.map((row) => [row.brand, row.locations]),
  );
  const currentBrands = new Map(
    current.brandRows.map((row) => [row.brand, row.locations]),
  );
  const brands = new Set([...previousBrands.keys(), ...currentBrands.keys()]);
  const changes = [...brands]
    .map((brand) => ({
      brand,
      delta: (currentBrands.get(brand) || 0) - (previousBrands.get(brand) || 0),
    }))
    .filter((entry) => entry.delta !== 0)
    .sort((a, b) => b.delta - a.delta);
  return {
    occupancyPct: round1(current.occupancyPct - previous.occupancyPct),
    occupiedLocations: current.occupiedLocations - previous.occupiedLocations,
    emptyLocations: current.emptyLocations - previous.emptyLocations,
    lpnCount: current.lpnCount - previous.lpnCount,
    onHandTotal: current.onHandTotal - previous.onHandTotal,
    mixedLocations: current.mixedLocations - previous.mixedLocations,
    brandGainers: changes.filter((entry) => entry.delta > 0).slice(0, 5),
    brandLosers: changes
      .filter((entry) => entry.delta < 0)
      .slice(-5)
      .reverse(),
  };
}

export function filterRecords(
  report: WarehouseReport,
  predicate: (record: WarehouseRecord) => boolean,
): WarehouseRecord[] {
  return report.records.filter(predicate);
}
