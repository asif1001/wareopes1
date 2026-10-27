/**
 * Rack layout designer (Zone › Aisle › Rack › Level › Bin), ported from the
 * standalone "Warehouse Rack Layout Designer v5.2". Pure functions only, so the
 * same model drives the setup form, the floor plan, the 3D scene and the
 * occupancy analysis.
 *
 * Plan coordinates are metres: x → right, y → down (towards the viewer).
 */
import type { RackBuilderConfig, SubInventoryLayout, WarehouseLayout } from "./types";

export type RackLabelStyle = "num2" | "num3" | "num" | "alpha";
export type LevelLabelStyle = "alpha" | "num2" | "num";
export type BinLabelStyle = "num" | "num2" | "alpha";
export type FloorLayoutType = "b2b" | "single" | "u";
export type RackNumberingDirection = "serpentine" | "same";
export type HeightMode = "pitch" | "frame";
export type LocationSeparator = "." | "-";

export type DesignRow = {
  /** Aisle / bay code, e.g. "01". Digits are zero-padded to two characters. */
  bay: string;
  /** First rack number in this row. */
  start: number;
  /** Number of racks (bays) in this row. */
  count: number;
  /** Levels for this row only; falls back to the zone default. */
  levels?: number;
};

export type DesignZone = {
  zone: string;
  sep: LocationSeparator;
  rackStyle: RackLabelStyle;
  levelStyle: LevelLabelStyle;
  binStyle: BinLabelStyle;
  levels: number;
  bins: number;
  /** Rack bay width (m). */
  rackW: number;
  /** Rack depth (m). */
  rackD: number;
  heightMode: HeightMode;
  frameH: number;
  levelH: number;
  aisle: number;
  flue: number;
  layout: FloorLayoutType;
  numbering: RackNumberingDirection;
  rows: DesignRow[];
};

export type RackDesign = {
  version: 1;
  zones: DesignZone[];
};

export const DESIGN_LIMITS = {
  levels: [1, 20],
  bins: [1, 12],
  rackW: [0.5, 6],
  rackD: [0.3, 3],
  frameH: [1, 40],
  levelH: [0.3, 4],
  aisle: [0.8, 8],
  flue: [0, 1.5],
  rowRacks: [1, 50],
  rows: [1, 40],
} as const;

export const RACK_STYLE_LABELS: Record<RackLabelStyle, string> = {
  num2: "Numbers 01, 02 … 99",
  num3: "Numbers 001, 002 … 999",
  num: "Numbers 1, 2, 3 …",
  alpha: "Letters A, B … Z, AA, AB …",
};
export const LEVEL_STYLE_LABELS: Record<LevelLabelStyle, string> = {
  alpha: "Letters A, B, C …",
  num2: "Numbers 01, 02, 03 …",
  num: "Numbers 1, 2, 3 …",
};
export const BIN_STYLE_LABELS: Record<BinLabelStyle, string> = {
  num: "Numbers 1, 2, 3 …",
  num2: "Numbers 01, 02, 03 …",
  alpha: "Letters A, B, C …",
};
export const LAYOUT_LABELS: Record<FloorLayoutType, string> = {
  b2b: "Shared aisles (back-to-back racking)",
  single: "Single-sided rows (one aisle per row)",
  u: "U-shape (left · bottom · right)",
};
export const NUMBERING_LABELS: Record<RackNumberingDirection, string> = {
  serpentine: "Serpentine (alternate rows reverse)",
  same: "Same direction every row",
};

const RACK_STYLES: RackLabelStyle[] = ["num2", "num3", "num", "alpha"];
const LEVEL_STYLES: LevelLabelStyle[] = ["alpha", "num2", "num"];
const BIN_STYLES: BinLabelStyle[] = ["num", "num2", "alpha"];

export function defaultZone(code = "A5"): DesignZone {
  return {
    zone: code,
    sep: ".",
    rackStyle: "num2",
    levelStyle: "alpha",
    binStyle: "num",
    levels: 6,
    bins: 2,
    rackW: 2.7,
    rackD: 1.1,
    heightMode: "pitch",
    frameH: 9,
    levelH: 1.5,
    aisle: 3.5,
    flue: 0.3,
    layout: "b2b",
    numbering: "serpentine",
    rows: [
      { bay: "01", start: 1, count: 10 },
      { bay: "01", start: 11, count: 10 },
    ],
  };
}

export function createRackDesign(code = "A5"): RackDesign {
  return { version: 1, zones: [defaultZone(code)] };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, "0");

export function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  let n = Number(value);
  if (value === "" || value === null || value === undefined || !Number.isFinite(n)) n = fallback;
  return Math.min(max, Math.max(min, n));
}

export function alphaLabel(n: number): string {
  let s = "";
  let v = Math.max(0, Math.floor(n));
  while (v > 0) {
    v -= 1;
    s = String.fromCharCode(65 + (v % 26)) + s;
    v = Math.floor(v / 26);
  }
  return s;
}

export function formatLabel(n: number, style: RackLabelStyle | LevelLabelStyle | BinLabelStyle): string {
  if (style === "alpha") return alphaLabel(n);
  if (style === "num3") return String(n).padStart(3, "0");
  if (style === "num2") return pad2(n);
  return String(n);
}

/** "07" → 7, "B" → 2, "AA" → 27; NaN when the text is not a label. */
export function parseLabel(text: string): number {
  const t = String(text).trim().toUpperCase();
  if (/^\d+$/.test(t)) return Number(t);
  if (/^[A-Z]{1,3}$/.test(t)) return [...t].reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);
  return Number.NaN;
}

export function bayText(bay: string | number): string {
  const t = String(bay).trim();
  return /^\d+$/.test(t) ? pad2(Number(t)) : t.toUpperCase();
}

export const rackLabel = (z: DesignZone, n: number) => formatLabel(n, z.rackStyle);
export const levelLabel = (z: DesignZone, levelIndex: number) => formatLabel(levelIndex + 1, z.levelStyle);
export const binLabel = (z: DesignZone, bin: number) => formatLabel(bin, z.binStyle);
export const rackCode = (z: DesignZone, row: DesignRow, n: number) =>
  [z.zone, bayText(row.bay), rackLabel(z, n)].join(z.sep);
export const locationCode = (z: DesignZone, rackId: string, levelIndex: number, bin: number) =>
  [rackId, levelLabel(z, levelIndex), binLabel(z, bin)].join(z.sep);

export const rowLevels = (z: DesignZone, i: number) => z.rows[i]?.levels || z.levels;
export const rowPitch = (z: DesignZone, i: number) =>
  z.heightMode === "frame" ? z.frameH / rowLevels(z, i) : z.levelH;

// ---------------------------------------------------------------------------
// Normalisation (also accepts the standalone designer's JSON export)
// ---------------------------------------------------------------------------

export function normalizeZone(input: unknown): DesignZone {
  const d = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const base = defaultZone();
  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  const L = DESIGN_LIMITS;
  const zone: DesignZone = {
    zone: String(d.zone ?? base.zone).trim().toUpperCase().replace(/[^A-Z0-9_]/g, "") || base.zone,
    sep: pick(d.sep, [".", "-"] as const, "."),
    rackStyle: pick(d.rackStyle, RACK_STYLES, base.rackStyle),
    levelStyle: pick(d.levelStyle, LEVEL_STYLES, base.levelStyle),
    binStyle: pick(d.binStyle, BIN_STYLES, base.binStyle),
    levels: Math.round(clampNumber(d.levels, base.levels, ...L.levels)),
    bins: Math.round(clampNumber(d.bins, base.bins, ...L.bins)),
    rackW: clampNumber(d.rackW, base.rackW, ...L.rackW),
    rackD: clampNumber(d.rackD, base.rackD, ...L.rackD),
    heightMode: pick(d.heightMode, ["pitch", "frame"] as const, "pitch"),
    frameH: clampNumber(d.frameH, base.frameH, ...L.frameH),
    levelH: clampNumber(d.levelH, base.levelH, ...L.levelH),
    aisle: clampNumber(d.aisle, base.aisle, ...L.aisle),
    flue: clampNumber(d.flue, base.flue, ...L.flue),
    layout: pick(d.layout, ["b2b", "single", "u"] as const, base.layout),
    numbering: pick(d.numbering, ["serpentine", "same"] as const, base.numbering),
    rows: base.rows,
  };
  const rows = Array.isArray(d.rows) && d.rows.length ? d.rows : base.rows;
  zone.rows = rows.slice(0, L.rows[1]).map((raw) => {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const row: DesignRow = {
      bay: bayText(String(r.bay ?? "01")) || "01",
      start: Math.max(1, Math.round(Number(r.start) || 1)),
      count: Math.round(clampNumber(r.count, 1, ...L.rowRacks)),
    };
    const levels = Number(r.levels);
    if (levels > 0) row.levels = Math.round(clampNumber(levels, zone.levels, ...L.levels));
    return row;
  });
  return zone;
}

export function normalizeRackDesign(input: unknown): RackDesign {
  const d = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const zones = Array.isArray(d.zones) && d.zones.length ? d.zones.map(normalizeZone) : [normalizeZone(d)];
  const seen = new Set<string>();
  for (const z of zones) {
    const code = z.zone;
    let i = 2;
    while (seen.has(z.zone)) z.zone = `${code}_${i++}`;
    seen.add(z.zone);
  }
  return { version: 1, zones };
}

// ---------------------------------------------------------------------------
// Geometry model (port of the designer's build())
// ---------------------------------------------------------------------------

export type Vec2 = [number, number];

export type DesignRack = {
  index: number;
  id: string;
  row: number;
  /** Rack number in the row (row.start + position). */
  num: number;
  bay: string;
  levels: number;
  pitch: number;
  height: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  /** Pick-face normal (towards the aisle). */
  n: Vec2;
  /** Centre of the pick face. */
  fx: number;
  fy: number;
};

export type DesignAisle = { key: string; x: number; y: number; w: number; h: number; rows: number[]; no: number; label: string };

export type ZoneGeometry = {
  axis: "x" | "y";
  x0: number;
  y0: number;
  n: Vec2;
  rev: boolean;
  len: number;
};

export type ZoneModel = {
  racks: DesignRack[];
  aisles: DesignAisle[];
  geo: ZoneGeometry[];
  rowAisle: number[];
  bounds: { x0: number; y0: number; x1: number; y1: number };
  height: number;
};

export function buildZoneModel(z: DesignZone): ZoneModel {
  const W = z.rackW;
  const D = z.rackD;
  const A = z.aisle;
  const F = z.flue;
  const rows = z.rows;
  const Lmax = Math.max(...rows.map((r) => r.count), 1) * W;
  const Xr = D + A + Lmax + A;
  const geo: ZoneGeometry[] = [];
  let y = 0;
  rows.forEach((r, i) => {
    let g: Omit<ZoneGeometry, "len">;
    if (z.layout === "u" && i < 3) {
      g =
        i === 0
          ? { axis: "y", x0: 0, y0: 0, n: [1, 0], rev: false }
          : i === 1
            ? { axis: "x", x0: D + A, y0: Lmax, n: [0, -1], rev: false }
            : { axis: "y", x0: Xr, y0: 0, n: [-1, 0], rev: true };
    } else if (z.layout === "u") {
      g = { axis: "x", x0: 0, y0: Lmax + D + F + (i - 3) * (D + A), n: [0, 1], rev: z.numbering === "serpentine" && i % 2 === 0 };
    } else if (z.layout === "b2b") {
      g = { axis: "x", x0: 0, y0: y, n: i % 2 ? [0, -1] : [0, 1], rev: z.numbering === "serpentine" && i % 2 === 1 };
      y += i % 2 ? D + F : D + A;
    } else {
      g = { axis: "x", x0: 0, y0: y, n: [0, 1], rev: z.numbering === "serpentine" && i % 2 === 1 };
      y += D + A;
    }
    geo.push({ ...g, len: r.count * W });
  });

  const racks: DesignRack[] = [];
  rows.forEach((r, i) => {
    const g = geo[i];
    const levels = rowLevels(z, i);
    const pitch = rowPitch(z, i);
    for (let j = 0; j < r.count; j += 1) {
      const pos = g.rev ? r.count - 1 - j : j;
      const num = r.start + j;
      const b =
        g.axis === "x"
          ? { x0: g.x0 + pos * W, y0: g.y0, x1: g.x0 + (pos + 1) * W, y1: g.y0 + D }
          : { x0: g.x0, y0: g.y0 + pos * W, x1: g.x0 + D, y1: g.y0 + (pos + 1) * W };
      const cx = (b.x0 + b.x1) / 2;
      const cy = (b.y0 + b.y1) / 2;
      const [nx, ny] = g.n;
      racks.push({
        index: racks.length,
        id: rackCode(z, r, num),
        row: i,
        num,
        bay: bayText(r.bay),
        levels,
        pitch,
        height: levels * pitch,
        ...b,
        cx,
        cy,
        n: g.n,
        fx: cx + (nx * D) / 2,
        fy: cy + (ny * D) / 2,
      });
    }
  });

  const aisles: DesignAisle[] = [];
  const addAisle = (x: number, ay: number, w: number, h: number, row: number, key: string) => {
    const a = aisles.find((q) => q.key === key);
    if (!a) {
      aisles.push({ key, x, y: ay, w, h, rows: [row], no: 0, label: "" });
      return;
    }
    const x1 = Math.max(a.x + a.w, x + w);
    const y1 = Math.max(a.y + a.h, ay + h);
    a.x = Math.min(a.x, x);
    a.y = Math.min(a.y, ay);
    a.w = x1 - a.x;
    a.h = y1 - a.y;
    a.rows.push(row);
  };
  geo.forEach((g, i) => {
    if (z.layout === "u" && i < 3) {
      addAisle(D, 0, Xr - D, Lmax, i, "u");
      return;
    }
    const yA = g.n[1] > 0 ? g.y0 + D : g.y0 - A;
    addAisle(g.x0, yA, g.len, A, i, `h${yA.toFixed(3)}`);
  });
  aisles.sort((a, b) => a.y - b.y || a.x - b.x);
  const rowAisle: number[] = [];
  aisles.forEach((a, idx) => {
    a.no = idx + 1;
    a.label = `Aisle ${[...new Set(a.rows.map((i) => bayText(rows[i].bay)))].join("/")}`;
    a.rows.forEach((i) => {
      rowAisle[i] = idx;
    });
  });

  const xs: number[] = [];
  const ys: number[] = [];
  racks.forEach((r) => {
    xs.push(r.x0, r.x1);
    ys.push(r.y0, r.y1);
  });
  aisles.forEach((a) => {
    xs.push(a.x, a.x + a.w);
    ys.push(a.y, a.y + a.h);
  });
  const bounds = xs.length
    ? { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
    : { x0: 0, x1: 1, y0: 0, y1: 1 };
  return { racks, aisles, geo, rowAisle, bounds, height: Math.max(...racks.map((r) => r.height), 0) };
}

export const compassOf = (n: Vec2) => (n[1] < 0 ? "North" : n[1] > 0 ? "South" : n[0] > 0 ? "East" : "West");

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export type DesignLocation = {
  locator: string;
  zoneIndex: number;
  zone: string;
  rack: DesignRack;
  levelIndex: number;
  /** 1-based bin position, left = 1 seen from the aisle. */
  bin: number;
  levelCode: string;
  binCode: string;
  rackLabel: string;
};

export function zoneLocations(z: DesignZone, zoneIndex = 0, model = buildZoneModel(z)): DesignLocation[] {
  const out: DesignLocation[] = [];
  for (const rack of model.racks) {
    for (let l = 0; l < rack.levels; l += 1) {
      for (let b = 1; b <= z.bins; b += 1) {
        out.push({
          locator: locationCode(z, rack.id, l, b).toUpperCase(),
          zoneIndex,
          zone: z.zone,
          rack,
          levelIndex: l,
          bin: b,
          levelCode: levelLabel(z, l),
          binCode: binLabel(z, b),
          rackLabel: rackLabel(z, rack.num),
        });
      }
    }
  }
  return out;
}

export function designLocations(design: RackDesign): DesignLocation[] {
  return design.zones.flatMap((z, i) => zoneLocations(z, i));
}

export function countZoneLocations(z: DesignZone): number {
  return z.rows.reduce((total, _row, i) => total + z.rows[i].count * rowLevels(z, i) * z.bins, 0);
}

export function countDesignLocations(design: RackDesign): number {
  return design.zones.reduce((total, z) => total + countZoneLocations(z), 0);
}

// ---------------------------------------------------------------------------
// Validation and hints
// ---------------------------------------------------------------------------

export type DesignCheck = { level: "ok" | "warn" | "err" | "info"; text: string };

export function duplicateRackCodes(model: ZoneModel): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const r of model.racks) (seen.has(r.id) ? dup : seen).add(r.id);
  return [...dup];
}

export function validateZone(z: DesignZone, model = buildZoneModel(z)): DesignCheck[] {
  const checks: DesignCheck[] = [];
  const dup = duplicateRackCodes(model);
  checks.push(
    dup.length
      ? {
          level: "err",
          text: `Duplicate rack codes: ${dup.slice(0, 5).join(", ")}${dup.length > 5 ? " …" : ""}. Change the aisle code or starting rack number (or press “Auto-code by aisle”).`,
        }
      : { level: "ok", text: "All rack location codes are unique." },
  );
  const top = Math.max(...z.rows.map((_r, i) => (rowLevels(z, i) - 1) * rowPitch(z, i)));
  const tight = z.rows.map((_r, i) => [i, rowPitch(z, i)] as const).filter(([, h]) => h < 0.6);
  if (tight.length)
    checks.push({
      level: "warn",
      text: `Level pitch ${tight.map(([i, h]) => `row ${i + 1}: ${h.toFixed(2)} m`).join(", ")}. Below ~0.6 m only suits cartons/shelving, not pallets (load + beam + 100 mm clearance).`,
    });
  if (top > 10.5)
    checks.push({ level: "warn", text: `Top level starts at ${top.toFixed(1)} m. Confirm truck lift height, load stability and sprinkler clearance.` });
  if (z.layout === "b2b" && z.rows.length > 1 && z.flue < 0.15)
    checks.push({ level: "warn", text: "Flue gap under 150 mm between back-to-back rows. Check your local fire code." });
  if (z.layout === "u" && z.rows.length < 3)
    checks.push({ level: "info", text: "U-shape uses three rows: left, bottom and right. Add rows to complete the U." });
  if (z.layout === "u" && z.rows.length > 3)
    checks.push({ level: "info", text: "U-shape uses rows 1–3. Extra rows are placed as straight rows below the U." });
  if (z.bins > 1 && z.bins * 1.2 > z.rackW + 0.01)
    checks.push({
      level: "warn",
      text: `${z.bins} bins in a ${z.rackW.toFixed(1)} m bay leaves under 1.2 m per bin, which is too narrow for a standard pallet (~1.0–1.2 m incl. clearance).`,
    });
  return checks;
}

export function equipmentHint(aisle: number): string {
  const t =
    aisle < 1.8
      ? "very narrow aisle (VNA): guided turret or man-up order picker"
      : aisle < 2.8
        ? "narrow aisle: reach truck"
        : aisle < 3.5
          ? "reach truck or pallet stacker"
          : "counterbalance forklift";
  return `Aisle ${aisle.toFixed(1)} m → typical equipment: ${t}. Always confirm against your truck's right-angle stacking aisle spec.`;
}

/** Next row as the designer adds it: same aisle for the second face of a shared aisle, otherwise a new aisle code. */
export function nextRow(z: DesignZone): DesignRow {
  const last = z.rows[z.rows.length - 1] ?? { bay: "00", start: 1, count: 10 };
  const i = z.rows.length;
  const shareAisle = (z.layout === "b2b" && i % 2 === 1) || (z.layout === "u" && i < 3) || !/^\d+$/.test(last.bay);
  return shareAisle
    ? { bay: last.bay, start: last.start + last.count, count: last.count }
    : { bay: pad2(Number(last.bay) + 1), start: 1, count: last.count };
}

/** One code per aisle; racks numbered continuously along both faces of that aisle. */
export function autoCodeByAisle(z: DesignZone): DesignZone {
  const model = buildZoneModel(z);
  const rows = z.rows.map((r) => ({ ...r }));
  model.aisles.forEach((a, idx) => {
    let start = 1;
    [...new Set(a.rows)]
      .sort((x, y) => x - y)
      .forEach((i) => {
        rows[i].bay = pad2(idx + 1);
        rows[i].start = start;
        start += rows[i].count;
      });
  });
  return { ...z, rows };
}

export function suggestZoneCode(design: RackDesign, from: string): string {
  const m = from.match(/^(.*?)(\d+)$/);
  let i = 1;
  let code: string;
  do {
    code = m ? m[1] + String(Number(m[2]) + i).padStart(m[2].length, "0") : from + (i + 1);
    i += 1;
  } while (design.zones.some((z) => z.zone === code));
  return code;
}

// ---------------------------------------------------------------------------
// WareOps layout integration
// ---------------------------------------------------------------------------

/** Placeholder storage areas (one per zone) so area filters and legends keep working. */
export function designSubInventories(design: RackDesign): SubInventoryLayout[] {
  return design.zones.map((z) => {
    const maxLevels = Math.max(...z.rows.map((_r, i) => rowLevels(z, i)), 1);
    const racks = z.rows.reduce((t, r) => t + r.count, 0);
    return {
      code: z.zone,
      name: `${z.zone} racking`,
      kind: "rack",
      aisles: { min: 1, max: Math.max(1, z.rows.length), pad: 2 },
      bays: { min: 1, max: Math.max(1, racks), pad: 2 },
      levels: Array.from({ length: maxLevels }, (_, l) => levelLabel(z, l)),
      bins: { values: Array.from({ length: z.bins }, (_, b) => binLabel(z, b + 1)), pad: 1 },
      locType: "Racking",
    };
  });
}

export function buildLayoutWithDesign(base: WarehouseLayout, design: RackDesign): WarehouseLayout {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { rackBuilder: _legacy, ...rest } = base;
  return {
    ...rest,
    name: base.name || `${design.zones[0]?.zone ?? ""} Warehouse`.trim(),
    rackDesign: design,
    subInventories: designSubInventories(design),
    updatedAt: new Date().toISOString(),
  };
}

/** Convert the previous rack builder so existing layouts open in the new form. */
export function designFromRackBuilder(config: RackBuilderConfig): RackDesign {
  const rows = config.rows.length ? config.rows : [{ bays: 10, levels: 4, bins: 2, join: "aisle" as const }];
  const first = rows[0];
  const b2b = rows.some((r) => r.join === "b2b");
  const zone: DesignZone = {
    ...defaultZone(String(config.zone || "T").toUpperCase()),
    rackStyle: config.numbering.bay === "alpha" ? "alpha" : "num2",
    levelStyle: config.numbering.level === "alpha" ? "alpha" : "num",
    binStyle: config.numbering.bin === "alpha" ? "alpha" : "num",
    levels: first.levels,
    bins: Math.max(...rows.map((r) => r.bins)),
    rackW: config.dimensions.bayWidth / 1000,
    rackD: config.dimensions.rackDepth / 1000,
    levelH: config.dimensions.levelHeight / 1000,
    aisle: config.dimensions.aisleWidth / 1000,
    flue: config.dimensions.backToBackGap / 1000,
    layout: b2b ? "b2b" : "single",
    numbering: "same",
    rows: rows.map((r, i) => ({ bay: pad2(i + 1), start: 1, count: r.bays, ...(r.levels !== first.levels ? { levels: r.levels } : {}) })),
  };
  return normalizeRackDesign({ zones: [zone] });
}

/** The design shown in the setup form for any saved layout. */
export function designForLayout(layout: WarehouseLayout): RackDesign {
  if (layout.rackDesign) return normalizeRackDesign(layout.rackDesign);
  if (layout.rackBuilder) return designFromRackBuilder(layout.rackBuilder);
  const racks = layout.subInventories.filter((s) => s.kind === "rack" && !s.locations?.length);
  if (!racks.length) return createRackDesign();
  return normalizeRackDesign({
    zones: racks.map((sub) => {
      const rowCount = Math.max(1, sub.aisles.max - sub.aisles.min + 1);
      const racksPerRow = Math.max(1, sub.bays.max - sub.bays.min + 1);
      const levelsAreLetters = sub.levels.every((l) => /^[A-Z]$/.test(l));
      const binsAreLetters = sub.bins.values.every((b) => /^[A-Z]$/.test(b));
      return {
        ...defaultZone(sub.code),
        levelStyle: levelsAreLetters ? "alpha" : "num",
        binStyle: binsAreLetters ? "alpha" : "num",
        levels: Math.max(1, sub.levels.length),
        bins: Math.max(1, sub.bins.values.length),
        layout: "single",
        numbering: "same",
        rows: Array.from({ length: rowCount }, (_, i) => ({ bay: pad2(sub.aisles.min + i), start: sub.bays.min, count: racksPerRow })),
      };
    }),
  });
}

/** Location master for WMS import (one line per bin). */
export function designLocationsCsv(design: RackDesign): string {
  const q = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = ["Location,Zone,Aisle,Rack,Level,Bin,LevelBase_m,Row,PickSequence"];
  design.zones.forEach((z, zi) => {
    zoneLocations(z, zi).forEach((loc, seq) => {
      lines.push(
        [loc.locator, z.zone, loc.rack.bay, loc.rackLabel, loc.levelCode, loc.binCode, (loc.levelIndex * loc.rack.pitch).toFixed(2), loc.rack.row + 1, seq + 1]
          .map(q)
          .join(","),
      );
    });
  });
  return lines.join("\n");
}
