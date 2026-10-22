import {
  buildLocationMap,
  rackValuesFor,
  rangeCount,
  rowValuesFor,
} from "./layout";
import { buildRackLocations, sanitizeZone } from "./rack-builder";
import type { LocationMeta, RackBuilderConfig, WarehouseLayout } from "./types";

/** Physical dimensions (metres) used by the 3D scene. */
export const BAY_WIDTH = 3.6;
/** Distance between the two rack legs of one U-shaped row (the VNA aisle). */
export const LEG_SEPARATION = 3.8;
/** Distance between row centres (U leg + cross aisle). */
export const AISLE_PITCH = 8.4;
/** Rack numbers above this value continue on the return leg of the U. */
export const U_TURN_AFTER = 10;
/** Depth of the turning area at the end of the U. */
export const TURN_DEPTH = 3.5;
/** Extra cross-aisle inserted between groups of rows. */
export const ROW_GROUP_GAP = 6.5;
export const RACK_DEPTH = 1.2;
export const LEVEL_HEIGHT = 1.65;
export const CUBE_HEIGHT = 1.2;
export const BULK_SIZE = 2.4;

export type Vec3 = [number, number, number];

export type SceneLocationPlan = {
  locator: string;
  sub: string;
  kind: "rack" | "bulk";
  position: Vec3;
  size: Vec3;
  meta: LocationMeta;
  unplanned: boolean;
};

export type SceneFrame = {
  center: Vec3;
  size: Vec3;
};

export type SceneLabel = {
  text: string;
  position: Vec3;
  kind: "aisle" | "area" | "detail";
};

export type ScenePlan = {
  locations: Map<string, SceneLocationPlan>;
  frames: SceneFrame[];
  labels: SceneLabel[];
  bounds: { min: Vec3; max: Vec3 };
  center: Vec3;
  radius: number;
};

type AreaOffset = {
  code: string;
  x: number;
  width: number;
  z: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => {
    const aNum = /^\d+$/.test(a);
    const bNum = /^\d+$/.test(b);
    if (aNum && bNum) return Number(a) - Number(b);
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b);
  });
}

function binOffset(
  bin: string | null,
  sub: WarehouseLayout["subInventories"][number],
): number {
  const values = sub.bins.values.length ? sub.bins.values : ["1"];
  const count = Math.max(1, values.length);
  const index = Math.max(0, values.indexOf((bin ?? values[0]).toUpperCase()));
  return (index + 0.5) * (BAY_WIDTH / count) - BAY_WIDTH / 2;
}

/**
 * Racks are arranged in a U: racks 1–10 run down one leg, the truck turns at
 * the end, and racks 11–20 come back on the parallel leg.
 */
function splitRackCount(
  sub: WarehouseLayout["subInventories"][number],
  bayCount: number,
): number {
  const turn = sub.uTurnAfter ?? U_TURN_AFTER;
  if (!Number.isFinite(turn) || turn <= 0 || turn >= bayCount) {
    return bayCount;
  }
  return Math.max(1, Math.floor(turn));
}

function computeRackBuilderPlan(
  layout: WarehouseLayout,
  config: RackBuilderConfig,
  unplannedLocators: LocationMeta[],
): ScenePlan {
  const planned = buildLocationMap(layout);
  const zone = sanitizeZone(config.zone);
  const bayW = Math.max(0.3, config.dimensions.bayWidth / 1000);
  const depth = Math.max(0.3, config.dimensions.rackDepth / 1000);
  const levelH = Math.max(0.3, config.dimensions.levelHeight / 1000);
  const aisle = Math.max(0.3, config.dimensions.aisleWidth / 1000);
  const gap = Math.max(0, config.dimensions.backToBackGap / 1000);
  const rows = config.rows;
  const maxBays = Math.max(...rows.map((row) => row.bays), 1);
  const maxLevels = Math.max(...rows.map((row) => row.levels), 1);
  const width = maxBays * bayW;
  const halfW = width / 2;
  const rowZ: number[] = [];
  let zCursor = 0;
  rows.forEach((row) => {
    rowZ.push(zCursor);
    zCursor += depth + (row.join === "b2b" ? gap : aisle);
  });
  const usedDepth = (rowZ[rows.length - 1] ?? 0) + depth;
  const halfD = usedDepth / 2;
  const height = maxLevels * levelH;

  const locations = new Map<string, SceneLocationPlan>();
  for (const location of buildRackLocations(config)) {
    const row = rows[location.rowIndex];
    if (!row) continue;
    const bins = Math.max(1, row.bins);
    const xBase = location.bayIndex * bayW - halfW;
    const zBase = rowZ[location.rowIndex] - halfD;
    let x = xBase;
    let z = zBase;
    let binWidth = bayW;
    let binDepth = depth;
    if (config.numbering.binOrientation === "side") {
      binWidth = bayW / bins;
      x = xBase + location.binIndex * binWidth;
    } else {
      binDepth = depth / bins;
      z = zBase + location.binIndex * binDepth;
    }
    const meta = planned.get(location.locator);
    if (!meta) continue;
    const y = location.levelIndex * levelH + levelH / 2;
    locations.set(location.locator, {
      locator: location.locator,
      sub: zone,
      kind: "rack",
      position: [x + binWidth / 2, y, z + binDepth / 2],
      size: [binWidth * 0.88, levelH * 0.72, binDepth * 0.88],
      meta,
      unplanned: false,
    });
  }

  const frames: SceneFrame[] = [];
  const labels: SceneLabel[] = [];
  rows.forEach((row, rowIndex) => {
    const zBase = rowZ[rowIndex] - halfD;
    for (let bay = 0; bay <= row.bays; bay += 1) {
      const x = bay * bayW - halfW;
      for (const dz of [0, depth]) {
        frames.push({
          center: [x, height / 2, zBase + dz],
          size: [0.14, height, 0.14],
        });
      }
    }
    for (let level = 0; level < row.levels; level += 1) {
      for (let bay = 0; bay < row.bays; bay += 1) {
        const x = bay * bayW + bayW / 2 - halfW;
        for (const dz of [0, depth]) {
          frames.push({
            center: [x, (level + 1) * levelH, zBase + dz],
            size: [bayW * 0.98, 0.1, 0.1],
          });
        }
      }
    }
    labels.push({
      text: `Row ${rowIndex + 1}`,
      position: [-halfW - 2.2, 0.35, zBase],
      kind: "aisle",
    });
  });

  labels.push({
    text: `Zone ${zone}`,
    position: [-halfW - 2.5, 1.6, -halfD - 2.5],
    kind: "area",
  });
  const firstRow = rows[0];
  if (firstRow) {
    for (let level = 0; level < firstRow.levels; level += 1) {
      labels.push({
        text: `L${level + 1}`,
        position: [-halfW - 2.2, level * levelH + 0.8, -halfD - 1.8],
        kind: "detail",
      });
    }
  }

  const overflowX = halfW + 5;
  unplannedLocators.forEach((meta, index) => {
    if (locations.has(meta.locator)) return;
    const column = index % 8;
    const rowIndex = Math.floor(index / 8);
    locations.set(meta.locator, {
      locator: meta.locator,
      sub: meta.sub,
      kind: meta.kind,
      position: [overflowX + column * 2.7, 0.7, rowIndex * 2.7 - halfD],
      size: [BULK_SIZE * 0.7, 1.3, BULK_SIZE * 0.7],
      meta,
      unplanned: true,
    });
  });
  if (unplannedLocators.length) {
    labels.push({
      text: "Unmapped locations",
      position: [overflowX + 6, 1.3, -halfD - 2],
      kind: "area",
    });
  }

  let min: Vec3 = [Infinity, 0, Infinity];
  let max: Vec3 = [-Infinity, 0, -Infinity];
  const expand = (center: Vec3, size: Vec3) => {
    min = [
      Math.min(min[0], center[0] - size[0] / 2),
      Math.min(min[1], center[1] - size[1] / 2),
      Math.min(min[2], center[2] - size[2] / 2),
    ];
    max = [
      Math.max(max[0], center[0] + size[0] / 2),
      Math.max(max[1], center[1] + size[1] / 2),
      Math.max(max[2], center[2] + size[2] / 2),
    ];
  };
  for (const location of locations.values()) {
    expand(location.position, location.size);
  }
  for (const frame of frames) expand(frame.center, frame.size);
  if (!locations.size) {
    min = [-10, 0, -10];
    max = [10, 10, 10];
  }

  return {
    locations,
    frames,
    labels,
    bounds: { min, max },
    center: [0, height / 2, 0],
    radius: Math.max(12, Math.hypot(width, usedDepth) / 2),
  };
}

/**
 * Turn a warehouse layout into drawable geometry. Planned locations are laid
 * out in contiguous blocks per storage area; locators that are not part of the
 * configured layout are parked in an "unmapped" area so no uploaded record is
 * silently dropped.
 */
export function computeScenePlan(
  layout: WarehouseLayout,
  unplannedLocators: LocationMeta[] = [],
): ScenePlan {
  if (layout.rackBuilder) {
    return computeRackBuilderPlan(
      layout,
      layout.rackBuilder,
      unplannedLocators,
    );
  }
  const planned = buildLocationMap(layout);
  const areas: AreaOffset[] = [];
  let cursorX = 0;
  let maxBayWidth = 1;

  layout.subInventories.forEach((sub) => {
    if (sub.kind === "bulk") {
      const width = Math.max(10, rangeCount(sub.bays) * BAY_WIDTH * 0.6);
      areas.push({
        code: sub.code.trim().toUpperCase(),
        x: cursorX,
        width,
        z: 0,
      });
      cursorX += width + 8;
      return;
    }
    if (sub.locations?.length) {
      const rowTokens = uniqueSorted(
        sub.locations.map((locator) => locator.split(".")[1] ?? ""),
      );
      const rackTokens = uniqueSorted(
        sub.locations.map((locator) => locator.split(".")[2] ?? ""),
      );
      maxBayWidth = Math.max(maxBayWidth, rackTokens.length * BAY_WIDTH);
      const width =
        Math.max(0, rowTokens.length - 1) * AISLE_PITCH +
        (sub.rowGroupSize && sub.rowGroupSize > 1
          ? Math.floor((rowTokens.length - 1) / sub.rowGroupSize) *
            ROW_GROUP_GAP
          : 0) +
        RACK_DEPTH +
        2;
      areas.push({
        code: sub.code.trim().toUpperCase(),
        x: cursorX,
        width,
        z: 0,
      });
      cursorX += width + 8;
      return;
    }
    const rows = Math.max(1, rowValuesFor(sub).length);
    const bays = Math.max(1, rackValuesFor(sub).length);
    const legSpan = Math.min(splitRackCount(sub, bays), bays) * BAY_WIDTH;
    maxBayWidth = Math.max(maxBayWidth, legSpan);
    const width =
      Math.max(0, rows - 1) * AISLE_PITCH + LEG_SEPARATION + RACK_DEPTH + 2;
    areas.push({
      code: sub.code.trim().toUpperCase(),
      x: cursorX,
      width,
      z: 0,
    });
    cursorX += width + 8;
  });

  const overflowStart = cursorX;
  const centerZ = (maxBayWidth - BAY_WIDTH) / 2;

  const areasByCode = new Map(areas.map((area) => [area.code, area]));
  const locations = new Map<string, SceneLocationPlan>();
  const frames: SceneFrame[] = [];
  const labels: SceneLabel[] = [];

  for (const sub of layout.subInventories) {
    const code = sub.code.trim().toUpperCase();
    const area = areasByCode.get(code);
    if (!area) continue;

    if (sub.kind === "bulk") {
      labels.push({
        text: `${code} · ${sub.name || "Bulk area"}`,
        position: [area.x + area.width / 2, 1.2, -4],
        kind: "area",
      });
      for (const [locator, meta] of planned) {
        if (meta.sub !== code) continue;
        locations.set(locator, {
          locator,
          sub: code,
          kind: sub.kind,
          position: [area.x, 0.7, 0],
          size: [BULK_SIZE * 0.8, 1.3, BULK_SIZE * 0.8],
          meta,
          unplanned: false,
        });
      }
      continue;
    }

    if (sub.locations?.length) {
      const rowTokens = uniqueSorted(
        sub.locations.map((locator) => locator.split(".")[1] ?? ""),
      );
      const rackTokens = uniqueSorted(
        sub.locations.map((locator) => locator.split(".")[2] ?? ""),
      );
      const levelTokens = uniqueSorted(
        sub.locations.map((locator) => locator.split(".")[3] ?? ""),
      );
      const binTokens = uniqueSorted(
        sub.locations.map((locator) => locator.split(".")[4] ?? ""),
      );
      const levelsByRack = new Map<string, string[]>();
      const binsByRack = new Map<string, string[]>();
      for (const locator of sub.locations) {
        const parts = locator.split(".");
        const key = `${parts[1] ?? ""}|${parts[2] ?? ""}`;
        if (!levelsByRack.has(key)) levelsByRack.set(key, []);
        if (!binsByRack.has(key)) binsByRack.set(key, []);
        if (parts[3]) levelsByRack.get(key)!.push(parts[3]);
        if (parts[4]) binsByRack.get(key)!.push(parts[4]);
      }
      for (const [key, values] of levelsByRack)
        levelsByRack.set(key, uniqueSorted(values));
      for (const [key, values] of binsByRack)
        binsByRack.set(key, uniqueSorted(values));
      const height = Math.max(1, levelTokens.length) * LEVEL_HEIGHT;
      const rowCount = Math.max(1, rowTokens.length);
      const zStart = -centerZ;
      const zEnd = rackTokens.length * BAY_WIDTH - centerZ;

      labels.push({
        text: `${code}${sub.name && sub.name !== code ? ` · ${sub.name}` : ""}`,
        position: [area.x, 1.6, -4],
        kind: "area",
      });

      rowTokens.forEach((rowToken, rowIndex) => {
        const groupSize =
          sub.rowGroupSize && sub.rowGroupSize > 1
            ? Math.floor(sub.rowGroupSize)
            : 0;
        const centerX =
          area.x +
          rowIndex * AISLE_PITCH +
          (groupSize ? Math.floor(rowIndex / groupSize) * ROW_GROUP_GAP : 0);
        labels.push({
          text: `Row ${rowToken}`,
          position: [centerX, 0.35, -2.6],
          kind: "aisle",
        });
        for (const z of [zStart, zEnd]) {
          for (const side of [-1, 1]) {
            frames.push({
              center: [centerX + side * (RACK_DEPTH / 2), height / 2, z],
              size: [0.14, height, 0.14],
            });
          }
        }
        levelTokens.forEach((_, levelIndex) => {
          frames.push({
            center: [
              centerX,
              (levelIndex + 1) * LEVEL_HEIGHT,
              (zStart + zEnd) / 2,
            ],
            size: [RACK_DEPTH, 0.1, Math.max(BAY_WIDTH, zEnd - zStart)],
          });
        });
      });

      for (const locator of sub.locations) {
        const meta = planned.get(locator);
        if (!meta) continue;
        const parts = locator.split(".");
        const key = `${parts[1] ?? ""}|${parts[2] ?? ""}`;
        const rackLevels = levelsByRack.get(key) ?? levelTokens;
        const rackBins = binsByRack.get(key) ?? binTokens;
        const binCount = Math.max(1, rackBins.length);
        const rowIndex = rowTokens.indexOf(parts[1] ?? "");
        const rackIndex = rackTokens.indexOf(parts[2] ?? "");
        const levelIndex = Math.max(0, rackLevels.indexOf(parts[3] ?? ""));
        const binIndex = Math.max(0, rackBins.indexOf(parts[4] ?? ""));
        const groupSize =
          sub.rowGroupSize && sub.rowGroupSize > 1
            ? Math.floor(sub.rowGroupSize)
            : 0;
        const centerX =
          area.x +
          Math.max(0, rowIndex) * AISLE_PITCH +
          (groupSize
            ? Math.floor(Math.max(0, rowIndex) / groupSize) * ROW_GROUP_GAP
            : 0);
        const z =
          Math.max(0, rackIndex) * BAY_WIDTH +
          ((binIndex + 0.5) * (BAY_WIDTH / binCount) - BAY_WIDTH / 2) -
          centerZ;
        const isFloor = levelIndex === 0;
        const y = isFloor
          ? 0.7
          : levelIndex * LEVEL_HEIGHT + (LEVEL_HEIGHT - 0.15) / 2 + 0.05;
        locations.set(locator, {
          locator,
          sub: code,
          kind: sub.kind,
          position: [centerX, y, z],
          size: [
            RACK_DEPTH * (isFloor ? 0.95 : 0.78),
            isFloor ? 1.35 : CUBE_HEIGHT,
            Math.max(0.55, (BAY_WIDTH / binCount) * (isFloor ? 0.9 : 0.82)),
          ],
          meta,
          unplanned: false,
        });
      }
      continue;
    }

    labels.push({
      text: `${code}${sub.name && sub.name !== code ? ` · ${sub.name}` : ""}`,
      position: [area.x - 3, 1.4, -4],
      kind: "area",
    });

    const aisles = rowValuesFor(sub);
    const bays = rackValuesFor(sub);
    const levels = sub.levels.length ? sub.levels : ["1"];
    const bayCount = bays.length || 1;
    const split = splitRackCount(sub, bayCount);
    const isU = split < bayCount;

    aisles.forEach((aisle, aisleIndex) => {
      const centerX = area.x + (aisles.length - 1 - aisleIndex) * AISLE_PITCH;
      labels.push({
        text: `Row ${aisle}`,
        position: [centerX, 0.35, -2.6],
        kind: "aisle",
      });

      const legs = isU
        ? [
            { offset: -LEG_SEPARATION / 2, count: split },
            { offset: LEG_SEPARATION / 2, count: bayCount - split },
          ]
        : [{ offset: 0, count: bayCount }];

      legs.forEach((leg) => {
        const x = centerX + leg.offset;
        // Rack uprights at each bay boundary, both faces of the rack.
        for (let bay = 0; bay <= leg.count; bay += 1) {
          const z = bay * BAY_WIDTH - BAY_WIDTH / 2 - centerZ;
          for (const side of [-1, 1]) {
            frames.push({
              center: [
                x + side * (RACK_DEPTH / 2),
                (levels.length * LEVEL_HEIGHT) / 2,
                z,
              ],
              size: [0.14, levels.length * LEVEL_HEIGHT, 0.14],
            });
          }
        }
        // Horizontal beams: one per bay per level across the rack depth.
        for (let bay = 0; bay < leg.count; bay += 1) {
          const z = bay * BAY_WIDTH - centerZ;
          levels.forEach((_, levelIndex) => {
            frames.push({
              center: [x, (levelIndex + 1) * LEVEL_HEIGHT, z],
              size: [RACK_DEPTH, 0.1, BAY_WIDTH],
            });
          });
        }
      });

      if (isU) {
        const turnZ = split * BAY_WIDTH + TURN_DEPTH / 2 - centerZ;
        frames.push({
          center: [centerX, 0.03, turnZ],
          size: [LEG_SEPARATION + RACK_DEPTH + 1, 0.05, TURN_DEPTH],
        });
        labels.push({
          text: "U-turn",
          position: [centerX, 0.45, turnZ],
          kind: "detail",
        });
      }
    });

    // Sparse level / bin / rack labels on the first row only, so the view
    // stays readable while still showing how the location code maps to racks.
    levels.forEach((level, levelIndex) => {
      labels.push({
        text: `L${level}`,
        position: [
          area.x - 2.5,
          levelIndex * LEVEL_HEIGHT + 0.8,
          -centerZ - 2.2,
        ],
        kind: "detail",
      });
    });
    sub.bins.values.forEach((bin) => {
      labels.push({
        text: `Bin ${bin}`,
        position: [area.x - 2.5, 0.22, binOffset(bin, sub) - centerZ],
        kind: "detail",
      });
    });
    labels.push({
      text: `Rack ${bays[0] ?? 1}`,
      position: [area.x - (isU ? LEG_SEPARATION / 2 : 0), 0.35, -centerZ - 2.2],
      kind: "detail",
    });

    for (const [locator, meta] of planned) {
      if (meta.sub !== code) continue;
      const rowToken = meta.rowCode ?? String(meta.aisle ?? "");
      const rackToken = meta.rackCode ?? String(meta.bay ?? "");
      const rowIndex = Math.max(0, aisles.indexOf(rowToken));
      const rackIndex = Math.max(0, bays.indexOf(rackToken));
      const bin = meta.bin ?? sub.bins.values[0] ?? "1";
      const levelIndex = Math.max(0, levels.indexOf(meta.level));
      const isFloorLevel = levelIndex === 0 && sub.kind === "rack";
      const leg = !isU ? 0 : rackIndex < split ? -1 : 1;
      const local = !isU
        ? rackIndex
        : rackIndex < split
          ? rackIndex
          : bayCount - 1 - rackIndex;
      const centerX = area.x + (aisles.length - 1 - rowIndex) * AISLE_PITCH;
      const x = centerX + leg * (LEG_SEPARATION / 2);
      const z = local * BAY_WIDTH + binOffset(bin, sub) - centerZ;
      const y = isFloorLevel
        ? 0.7
        : levelIndex * LEVEL_HEIGHT + (LEVEL_HEIGHT - 0.15) / 2 + 0.05;
      locations.set(locator, {
        locator,
        sub: code,
        kind: sub.kind,
        position: [x, y, z],
        size: [
          RACK_DEPTH * (isFloorLevel ? 0.95 : 0.78),
          isFloorLevel ? 1.35 : CUBE_HEIGHT,
          Math.max(
            0.55,
            (BAY_WIDTH / Math.max(1, sub.bins.values.length)) *
              (isFloorLevel ? 0.9 : 0.82),
          ),
        ],
        meta,
        unplanned: false,
      });
    }
  }

  labels.push({
    text: "Unmapped locations",
    position: [overflowStart + 6, 1.3, -4],
    kind: "area",
  });

  unplannedLocators.forEach((meta, index) => {
    if (locations.has(meta.locator)) return;
    const column = index % 8;
    const row = Math.floor(index / 8);
    locations.set(meta.locator, {
      locator: meta.locator,
      sub: meta.sub,
      kind: meta.kind,
      position: [overflowStart + 3 + column * 2.7, 0.7, row * 2.7 - 2],
      size: [BULK_SIZE * 0.72, 1.3, BULK_SIZE * 0.72],
      meta,
      unplanned: true,
    });
  });

  if (!unplannedLocators.length) {
    labels.pop();
  }

  // Bulk areas are drawn as floor pads with one pallet per locator.
  for (const sub of layout.subInventories) {
    if (sub.kind !== "bulk") continue;
    const code = sub.code.trim().toUpperCase();
    const area = areasByCode.get(code);
    if (!area) continue;
    const subLocations = [...locations.values()].filter(
      (entry) => entry.sub === code && entry.kind === "bulk",
    );
    subLocations.forEach((entry, index) => {
      entry.position = [
        area.x + 2 + (index % 4) * 3,
        0.65,
        Math.floor(index / 4) * 3,
      ];
      entry.size = [BULK_SIZE * 0.8, 1.3, BULK_SIZE * 0.8];
      frames.push({
        center: [entry.position[0], 1.35, entry.position[2]],
        size: [BULK_SIZE * 0.05, 2.7, BULK_SIZE * 0.05],
      });
    });
  }

  let min: Vec3 = [Infinity, 0, Infinity];
  let max: Vec3 = [-Infinity, 0, -Infinity];
  for (const location of locations.values()) {
    min = [
      Math.min(min[0], location.position[0] - location.size[0] / 2),
      Math.min(min[1], location.position[1] - location.size[1] / 2),
      Math.min(min[2], location.position[2] - location.size[2] / 2),
    ];
    max = [
      Math.max(max[0], location.position[0] + location.size[0] / 2),
      Math.max(max[1], location.position[1] + location.size[1] / 2),
      Math.max(max[2], location.position[2] + location.size[2] / 2),
    ];
  }
  if (!locations.size) {
    min = [-10, 0, -10];
    max = [10, 10, 10];
  }
  for (const frame of frames) {
    min = [
      Math.min(min[0], frame.center[0] - frame.size[0] / 2),
      Math.min(min[1], frame.center[1] - frame.size[1] / 2),
      Math.min(min[2], frame.center[2] - frame.size[2] / 2),
    ];
    max = [
      Math.max(max[0], frame.center[0] + frame.size[0] / 2),
      Math.max(max[1], frame.center[1] + frame.size[1] / 2),
      Math.max(max[2], frame.center[2] + frame.size[2] / 2),
    ];
  }

  // Keep the model centred on the origin.
  const offsetX = (min[0] + max[0]) / 2;
  const offsetZ = (min[2] + max[2]) / 2;
  for (const location of locations.values()) {
    location.position[0] -= offsetX;
    location.position[2] -= offsetZ;
  }
  for (const frame of frames) {
    frame.center[0] -= offsetX;
    frame.center[2] -= offsetZ;
  }
  for (const label of labels) {
    label.position[0] -= offsetX;
    label.position[2] -= offsetZ;
  }
  const center: Vec3 = [0, (min[1] + max[1]) / 2, 0];
  const radius = Math.max(12, Math.hypot(max[0] - min[0], max[2] - min[2]) / 2);

  return {
    locations,
    frames,
    labels,
    bounds: {
      min: [min[0] - offsetX, min[1], min[2] - offsetZ],
      max: [max[0] - offsetX, max[1], max[2] - offsetZ],
    },
    center,
    radius,
  };
}
