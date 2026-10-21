export const BRAND_PALETTE = [
  "#00d9f5",
  "#ff4d6d",
  "#7be343",
  "#b66dff",
  "#ff902a",
  "#3985ff",
  "#ffdb35",
  "#00c9a7",
  "#fa72d1",
  "#c4e855",
  "#ff6745",
  "#70a9ff",
  "#e2a6ff",
  "#4de0b0",
  "#ffb96b",
  "#a8b9ff",
  "#ea5fbd",
  "#8cddff",
  "#b6f068",
  "#d3a26b",
];

export const EMPTY_COLOR = "#2b3d52";
export const MIXED_COLOR = "#f5c542";
export const OCCUPIED_COLOR = "#2ec27e";
export const UNPLANNED_COLOR = "#ff6b6b";

export function brandColor(brand: string, index: number): string {
  if (brand === "Unknown") return "#94a3b8";
  return BRAND_PALETTE[index % BRAND_PALETTE.length];
}

export function buildBrandColorMap(brands: string[]): Map<string, string> {
  const map = new Map<string, string>();
  [...brands]
    .sort((a, b) => a.localeCompare(b))
    .forEach((brand, index) => map.set(brand, brandColor(brand, index)));
  return map;
}

export function areaColor(index: number): string {
  const colors = [
    "#3d8ef0",
    "#00c9a7",
    "#b66dff",
    "#ff902a",
    "#ff4d6d",
    "#ffdb35",
    "#4de0b0",
    "#70a9ff",
  ];
  return colors[index % colors.length];
}

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toLocaleString() : "0";
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}
