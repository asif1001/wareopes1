import type { BrandRule, ParsedWorkbook, WarehouseRecord } from "./types";
import { assignBrand, normalizeLocator } from "./layout";

const MAX_ROWS = 100000;

const HEADER_ALIASES: Record<string, string[]> = {
  locator: [
    "locator",
    "location",
    "locationcode",
    "locationno",
    "locationnumber",
    "storagelocation",
    "slot",
    "bin",
    "binlocation",
  ],
  lpn: [
    "lpn",
    "lpnid",
    "lpnc",
    "licenseplate",
    "licenseplatenumber",
    "licenseplateno",
    "pallet",
    "palletid",
    "containerno",
  ],
  onhand: [
    "onhand",
    "onhandqty",
    "onhandquantity",
    "onhandunits",
    "quantity",
    "qty",
    "available",
    "availableqty",
    "stock",
    "stockqty",
  ],
  item: [
    "item",
    "itemid",
    "itemcode",
    "itemno",
    "itemnumber",
    "sku",
    "part",
    "partno",
    "partnumber",
    "material",
    "materialcode",
    "productcode",
  ],
  description: [
    "itemdescription",
    "description",
    "itemname",
    "productname",
    "materialdescription",
    "shortdescription",
  ],
  sub: [
    "sub",
    "subinventory",
    "subinv",
    "subinventorycode",
    "area",
    "zone",
    "warehousearea",
  ],
  grade: ["grade", "lotgrade", "quality"],
  uom: ["primaryuom", "uom", "unit", "unitofmeasure"],
  status: ["status", "lpncontext", "context", "inventorystatus"],
  brand: ["brand", "brandname", "make", "manufacturer"],
};

export function normalizeHeader(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findHeader(headers: string[], aliases: string[]): string | null {
  const normalized = headers.map((header) => ({
    header,
    key: normalizeHeader(header),
  }));
  for (const alias of aliases) {
    const exact = normalized.find((entry) => entry.key === alias);
    if (exact) return exact.header;
  }
  for (const alias of aliases) {
    const partial = normalized.find((entry) => entry.key.includes(alias));
    if (partial) return partial.header;
  }
  return null;
}

export function mapHeaders(headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    mapping[canonical] = findHeader(headers, aliases);
  }
  return mapping;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[,\s]/g, "").replace(/[^\d.+-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export type ParsedRows = {
  headers: string[];
  rows: Record<string, unknown>[];
};

export function recordsFromRows(
  rows: Record<string, unknown>[],
  headers: string[],
  brandRules: BrandRule[],
): {
  records: WarehouseRecord[];
  skippedRows: number;
  warnings: string[];
  mappedColumns: Record<string, string>;
  unparsedQty: number;
} {
  const mapping = mapHeaders(headers);
  const locatorHeader = mapping.locator;
  const lpnHeader = mapping.lpn;
  const missing = !locatorHeader || !lpnHeader;
  const warnings: string[] = [];
  if (!mapping.locator) {
    warnings.push(
      'No "Locator" column found. Expected a column named Locator / Location.',
    );
  }
  if (!mapping.lpn) {
    warnings.push(
      'No "LPN" column found. Expected a column named LPN / License Plate / Pallet.',
    );
  }
  if (!mapping.onhand) {
    warnings.push(
      "No on-hand quantity column found. Quantities will be counted as zero.",
    );
  }
  if (!mapping.item && !mapping.description) {
    warnings.push(
      "No item or description column found. SKU counts will fall back to LPNs.",
    );
  }
  if (missing) {
    return {
      records: [],
      skippedRows: rows.length,
      warnings,
      mappedColumns: {},
      unparsedQty: 0,
    };
  }

  let skippedRows = 0;
  let unparsedQty = 0;
  const records: WarehouseRecord[] = [];

  for (const row of rows) {
    const locator = normalizeLocator(cleanText(row[locatorHeader]));
    const lpn = cleanText(row[lpnHeader]);
    if (!locator && !lpn) {
      skippedRows += 1;
      continue;
    }
    if (!locator) {
      skippedRows += 1;
      continue;
    }
    if (records.length >= MAX_ROWS) {
      warnings.push(
        `Only the first ${MAX_ROWS.toLocaleString()} rows were imported. Split the file for larger exports.`,
      );
      break;
    }
    const qtyRaw = mapping.onhand ? row[mapping.onhand] : 0;
    const onHand = parseNumber(qtyRaw) ?? 0;
    if (mapping.onhand && parseNumber(qtyRaw) === null && cleanText(qtyRaw))
      unparsedQty += 1;
    const explicitBrand = mapping.brand ? cleanText(row[mapping.brand]) : "";
    const brand =
      explicitBrand && explicitBrand !== "-"
        ? explicitBrand
        : assignBrand(lpn, brandRules);
    const parts = locator.split(".");
    const rowSub = mapping.sub ? cleanText(row[mapping.sub]).toUpperCase() : "";
    records.push({
      locator,
      lpn,
      brand,
      onHand,
      sub: rowSub || parts[0] || "",
      item: mapping.item
        ? cleanText(row[mapping.item]) || undefined
        : undefined,
      description: mapping.description
        ? cleanText(row[mapping.description]) || undefined
        : undefined,
      grade: mapping.grade
        ? cleanText(row[mapping.grade]) || undefined
        : undefined,
      uom: mapping.uom ? cleanText(row[mapping.uom]) || undefined : undefined,
      status: mapping.status
        ? cleanText(row[mapping.status]) || undefined
        : undefined,
    });
  }

  if (records.some((record) => !record.lpn)) {
    warnings.push(
      "Some rows have an empty LPN. They are still counted for occupancy.",
    );
  }
  if (unparsedQty) {
    warnings.push(
      `${unparsedQty.toLocaleString()} row(s) had a non-numeric on-hand value and were counted as zero.`,
    );
  }

  const mappedColumns: Record<string, string> = {};
  for (const [canonical, header] of Object.entries(mapping)) {
    if (header) mappedColumns[canonical] = header;
  }

  return { records, skippedRows, warnings, mappedColumns, unparsedQty };
}

/** Pick the "Data" sheet when present, otherwise the first sheet with rows. */
export function pickSheet(workbook: {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
}): string {
  const named = workbook.SheetNames.find(
    (name) => name.trim().toLowerCase() === "data",
  );
  if (named) return named;
  const withRows = workbook.SheetNames.find((name) => {
    const sheet = workbook.Sheets[name] as { "!ref"?: string } | undefined;
    return Boolean(sheet?.["!ref"]);
  });
  return withRows || workbook.SheetNames[0];
}

export async function parseWarehouseFile(
  file: File,
  brandRules: BrandRule[],
): Promise<ParsedWorkbook> {
  const buffer = await file.arrayBuffer();
  return parseWarehouseBuffer(buffer, file.name, brandRules);
}

export async function parseWarehouseBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  brandRules: BrandRule[],
): Promise<ParsedWorkbook> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  if (!workbook.SheetNames.length) {
    return {
      fileName,
      sheetName: "",
      headers: [],
      records: [],
      warnings: ["The workbook does not contain any sheets."],
      skippedRows: 0,
      mappedColumns: {},
    };
  }
  const sheetName = pickSheet(workbook);
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const parsed = recordsFromRows(rows, headers, brandRules);
  return {
    fileName,
    sheetName,
    headers,
    records: parsed.records,
    warnings: parsed.warnings,
    skippedRows: parsed.skippedRows,
    mappedColumns: parsed.mappedColumns,
  };
}

export const SUPPORTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];
