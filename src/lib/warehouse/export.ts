import type { SnapshotMeta, WarehouseReport } from "./types";

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9-_]+/gi, "_").replace(/_+/g, "_");
}

function autoWidths(
  rows: (string | number | null | undefined)[][],
): { wch: number }[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      const length = String(cell ?? "").length;
      widths[index] = Math.min(60, Math.max(widths[index] || 10, length + 2));
    });
  }
  return widths.map((wch) => ({ wch }));
}

export async function exportWarehouseWorkbook(
  report: WarehouseReport,
  meta?: SnapshotMeta | null,
): Promise<void> {
  const XLSX = await import("xlsx");
  const { summary, layout, records } = report;
  const workbook = XLSX.utils.book_new();

  const summaryRows: (string | number)[][] = [
    ["WAREHOUSE OCCUPANCY REPORT"],
    [],
    ["Branch", layout.branchName || meta?.branchName || ""],
    ["Warehouse", layout.name || meta?.warehouseName || ""],
    ["Source file", meta?.fileName || "Uploaded data"],
    ["Generated", new Date().toLocaleString()],
    [],
    ["Metric", "Value"],
    ["Total locations", summary.totalLocations],
    ["Occupied locations", summary.occupiedLocations],
    ["Empty locations", summary.emptyLocations],
    ["Occupancy %", summary.occupancyPct],
    ["LPNs", summary.lpnCount],
    ["SKUs", summary.skuCount],
    ["On-hand units", summary.onHandTotal],
    ["Mixed-brand locations", summary.mixedLocations],
    ["Brands", summary.brandCount],
    ["Unplanned locations", summary.unplannedLocations],
    ["Inventory rows", summary.recordCount],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = autoWidths(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  const brandRows: (string | number)[][] = [
    ["Brand", "Occupied locations", "LPNs", "On-hand", "Share of capacity %"],
    ...summary.brandRows.map((row) => [
      row.brand,
      row.locations,
      row.lpns,
      row.onHand,
      row.pct,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(brandRows),
    "Brand-wise",
  );

  const levelRows: (string | number)[][] = [
    ["Level", "Total", "Occupied", "Empty", "Occupancy %"],
    ...summary.levelRows.map((row) => [
      row.level,
      row.total,
      row.occupied,
      row.empty,
      row.pct,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(levelRows),
    "Level-wise",
  );

  const aisleRows: (string | number)[][] = [
    ["Row", "Total", "Occupied", "Empty", "Occupancy %"],
    ...summary.aisleRows.map((row) => [
      row.aisle,
      row.total,
      row.occupied,
      row.empty,
      row.pct,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(aisleRows),
    "Row-wise",
  );

  const areaRows: (string | number)[][] = [
    [
      "Zone",
      "Name",
      "Type",
      "Total",
      "Occupied",
      "Empty",
      "Occupancy %",
      "LPNs",
      "On-hand",
    ],
    ...summary.subRows.map((row) => [
      row.sub,
      row.name,
      row.kind,
      row.total,
      row.occupied,
      row.empty,
      row.pct,
      row.lpns,
      row.onHand,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(areaRows),
    "Zone-wise",
  );

  const levels = summary.levelRows.map((row) => row.level);
  const crossRows: (string | number)[][] = [
    ["Brand", ...levels, "Total"],
    ...summary.brandRows.map((row) => {
      const cells = levels.map(
        (level) => summary.crossTab[row.brand]?.[level] ?? 0,
      );
      return [
        row.brand,
        ...cells,
        cells.reduce((total, value) => total + value, 0),
      ];
    }),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(crossRows),
    "Brand x Level",
  );

  const locationRows: (string | number)[][] = [
    [
      "Locator",
      "Zone",
      "Type",
      "Row",
      "Rack",
      "Level",
      "Bin",
      "Status",
      "Brands",
      "LPNs",
      "On-hand",
    ],
    ...[...report.locations.values()]
      .sort((a, b) => a.meta.locator.localeCompare(b.meta.locator))
      .map((location) => [
        location.meta.locator,
        location.meta.sub,
        location.meta.kind,
        location.meta.aisle ?? "",
        location.meta.rackCode ?? location.meta.bay ?? "",
        location.meta.level,
        location.meta.bin ?? "",
        location.occupied ? "Occupied" : "Empty",
        location.brands.join(", "),
        location.lpnCount,
        location.onHand,
      ]),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(locationRows),
    "Locations",
  );

  const recordRows: (string | number)[][] = [
    [
      "Locator",
      "LPN",
      "Brand",
      "On-hand",
      "Zone",
      "Item",
      "Description",
      "Grade",
      "UOM",
      "Status",
    ],
    ...records.map((record) => [
      record.locator,
      record.lpn,
      record.brand,
      record.onHand,
      record.sub,
      record.item ?? "",
      record.description ?? "",
      record.grade ?? "",
      record.uom ?? "",
      record.status ?? "",
    ]),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(recordRows),
    "Inventory",
  );

  const date = new Date().toISOString().slice(0, 10);
  const fileName = safeFileName(
    `Warehouse_Occupancy_${layout.branchName || "branch"}_${date}`,
  );
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
