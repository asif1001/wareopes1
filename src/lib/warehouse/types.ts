/**
 * Shared types for the Warehouse 3D occupancy feature.
 *
 * The model is deliberately data-source agnostic: any Excel/CSV export that has
 * a location (Locator), an LPN and an on-hand quantity can be analysed, while
 * the warehouse structure (aisles / bays / levels / bins) is configured per
 * branch so empty locations are part of the occupancy calculation.
 */

import type { RackDesign } from "./rack-design";

export type NumberRange = {
  min: number;
  max: number;
  /** Zero-padding used when building locator strings (e.g. 2 -> "01"). */
  pad: number;
};

export type SubInventoryKind = "rack" | "bulk";

/**
 * A set of discrete location components (levels, bins). Values are kept as
 * strings so both "A-D" bins and "1-5" levels are supported; numeric values
 * can be zero-padded when locators are generated.
 */
export type ValueSet = {
  values: string[];
  pad?: number;
};

export type SubInventoryLayout = {
  /** Locator prefix, e.g. "A5". */
  code: string;
  /** Friendly area name shown in the legend, e.g. "VNA Main". */
  name?: string;
  kind: SubInventoryKind;
  aisles: NumberRange;
  bays: NumberRange;
  /** Ordered bottom -> top, e.g. ["A","B","C","D","E","F","G"] or ["1","2","3"]. */
  levels: string[];
  /** Ordered bin positions, e.g. ["1","2","3"] or ["A","B","C","D"]. */
  bins: ValueSet;
  /** Explicit row tokens (overrides the numeric aisles range), e.g. A-F. */
  rowValues?: string[];
  /** Explicit rack tokens (overrides the numeric bays range), e.g. A-Z. */
  rackValues?: string[];
  /** Explicit locator list (overrides rows/racks/levels/bins when present). */
  locations?: string[];
  /** Rack number after which the aisle turns around (U shape). 0 disables it. */
  uTurnAfter?: number;
  /** Insert an extra cross-aisle after every N rows (e.g. 2 for paired rows). */
  rowGroupSize?: number;
  /** Free-text storage type, e.g. "Oil / Drum / Battery". */
  locType?: string;
};

export type BrandRule = {
  /** LPN prefix matched case-insensitively, longest prefix wins. */
  prefix: string;
  brand: string;
};

export type RackJoin = "aisle" | "b2b";

export type RackRowConfig = {
  bays: number;
  levels: number;
  bins: number;
  /** Relationship to the next row. */
  join: RackJoin;
};

export type RackDimensions = {
  /** All dimensions are in millimetres, matching the rack builder UI. */
  bayWidth: number;
  rackDepth: number;
  levelHeight: number;
  aisleWidth: number;
  backToBackGap: number;
};

export type RackNumbering = {
  bay: "num" | "alpha";
  level: "num" | "alpha";
  bin: "num" | "alpha";
  binOrientation: "side" | "depth";
  direction: "ltr" | "rtl";
};

export type RackBuilderConfig = {
  zone: string;
  rows: RackRowConfig[];
  dimensions: RackDimensions;
  numbering: RackNumbering;
};

export type WarehouseLayout = {
  id: string;
  branchId: string;
  branchName: string;
  /** Warehouse / site name, e.g. "Salmabad VNA". */
  name: string;
  subInventories: SubInventoryLayout[];
  brandRules: BrandRule[];
  /** Previous rack builder; still read for layouts saved before the rack designer. */
  rackBuilder?: RackBuilderConfig;
  /** When present, the rack designer (zones, aisles, racks) defines the warehouse structure. */
  rackDesign?: RackDesign;
  notes?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type WarehouseRecord = {
  locator: string;
  lpn: string;
  brand: string;
  onHand: number;
  sub: string;
  item?: string;
  description?: string;
  grade?: string;
  uom?: string;
  status?: string;
};

export type ParsedWorkbook = {
  fileName: string;
  sheetName: string;
  headers: string[];
  records: WarehouseRecord[];
  warnings: string[];
  /** Rows that were skipped because they had no locator. */
  skippedRows: number;
  /** Column names that were detected in the file. */
  mappedColumns: Record<string, string>;
};

export type LocationMeta = {
  locator: string;
  sub: string;
  kind: SubInventoryKind;
  aisle: number | null;
  bay: number | null;
  /** Original row token when rows are letters. */
  rowCode?: string;
  /** Original rack token when racks are letters (e.g. "A"–"Y"). */
  rackCode?: string;
  level: string;
  bin: string | null;
  locType?: string;
  /** True when the locator was found in inventory data but not in the layout. */
  unplanned: boolean;
};

export type ResolvedLocation = {
  meta: LocationMeta;
  records: WarehouseRecord[];
  brands: string[];
  onHand: number;
  lpnCount: number;
  occupied: boolean;
  mixed: boolean;
};

export type BrandSummaryRow = {
  brand: string;
  locations: number;
  lpns: number;
  onHand: number;
  /** Percentage of total warehouse capacity occupied by this brand. */
  pct: number;
};

export type LevelSummaryRow = {
  level: string;
  total: number;
  occupied: number;
  empty: number;
  pct: number;
};

export type AisleSummaryRow = {
  aisle: number;
  total: number;
  occupied: number;
  empty: number;
  pct: number;
};

export type SubSummaryRow = {
  sub: string;
  name: string;
  kind: SubInventoryKind;
  total: number;
  occupied: number;
  empty: number;
  pct: number;
  lpns: number;
  onHand: number;
};

export type SnapshotSummary = {
  totalLocations: number;
  occupiedLocations: number;
  emptyLocations: number;
  occupancyPct: number;
  lpnCount: number;
  skuCount: number;
  onHandTotal: number;
  mixedLocations: number;
  brandCount: number;
  unknownBrandLpns: number;
  unplannedLocations: number;
  recordCount: number;
  brandRows: BrandSummaryRow[];
  levelRows: LevelSummaryRow[];
  aisleRows: AisleSummaryRow[];
  subRows: SubSummaryRow[];
  /** brand -> level -> occupied location count. */
  crossTab: Record<string, Record<string, number>>;
  generatedAt: string;
};

export type SnapshotMeta = {
  id: string;
  branchId: string;
  branchName: string;
  warehouseName: string;
  fileName: string;
  sheetName?: string;
  uploadedAt: string;
  uploadedBy?: string;
  recordCount: number;
  summary: SnapshotSummary;
  layout: WarehouseLayout;
  storage?: "cloud" | "local";
};

export type WarehouseReport = {
  layout: WarehouseLayout;
  records: WarehouseRecord[];
  summary: SnapshotSummary;
  locations: Map<string, ResolvedLocation>;
  unplanned: ResolvedLocation[];
  warnings: string[];
};

export type ColorMode = "brand" | "occupancy" | "area";

export type WarehouseFilters = {
  brand: string;
  sub: string;
  aisle: string;
  level: string;
  search: string;
  showEmpty: boolean;
};
