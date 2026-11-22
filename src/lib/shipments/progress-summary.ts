import { differenceInDays, format, isValid, parseISO, startOfDay } from "date-fns";
import type { SerializableShipment, ShipmentStatus } from "@/lib/types";

export type ProgressStatus = Extract<ShipmentStatus, "Arrived" | "WIP" | "Completed">;

export type ShipmentProgressRow = {
  id: string;
  shipmentNo: string;
  source: string;
  status: ProgressStatus;
  section: "active" | "completed";
  numContainers: number;
  arrivalDate: string | null;
  startDate: string | null;
  endDate: string | null;
  totalLines: number;
  bulkLines: number;
  domLines: number;
  pendingDays: number | null;
};

export type ProgressSummary = {
  active: ShipmentProgressRow[];
  recentCompleted: ShipmentProgressRow[];
  rows: ShipmentProgressRow[];
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // Prefer the calendar date so UTC midnight strings do not shift a day locally.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return isValid(date) ? date : null;
  }
  const date = new Date(value);
  return isValid(date) ? startOfDay(date) : null;
}

/** Prefer actual arrival; fall back to planned Bahrain ETA. */
export function shipmentArrivalDate(shipment: SerializableShipment): Date | null {
  return parseDate(shipment.actualBahrainEta) ?? parseDate(shipment.bahrainEta);
}

/**
 * Warehouse processing start: cleared-to-WH date, else confirmed W/H ETA,
 * else requested W/H ETA.
 */
export function shipmentStartDate(shipment: SerializableShipment): Date | null {
  return (
    parseDate(shipment.actualClearedDate) ??
    parseDate(shipment.whEtaConfirmedByLogistics) ??
    parseDate(shipment.whEtaRequestedByParts)
  );
}

/** Expected / free-storage end: last storage day. */
export function shipmentEndDate(shipment: SerializableShipment): Date | null {
  return parseDate(shipment.lastStorageDay);
}

/** Sort key for recently completed: end → cleared → updated → arrival. */
export function shipmentCompletedAt(shipment: SerializableShipment): Date | null {
  return (
    shipmentEndDate(shipment) ??
    parseDate(shipment.actualClearedDate) ??
    parseDate(shipment.updatedAt) ??
    shipmentArrivalDate(shipment)
  );
}

export function pendingDaysSince(
  arrival: Date | null,
  today: Date = startOfDay(new Date()),
): number | null {
  if (!arrival) return null;
  return Math.max(0, differenceInDays(startOfDay(today), startOfDay(arrival)));
}

export function formatProgressDate(value: string | null | undefined): string {
  const date = parseDate(value);
  return date ? format(date, "dd MMM yyyy") : "—";
}

export function toIsoDateString(date: Date | null): string | null {
  return date ? format(date, "yyyy-MM-dd") : null;
}

function toProgressRow(
  shipment: SerializableShipment,
  section: "active" | "completed",
  today: Date,
): ShipmentProgressRow {
  const arrival = shipmentArrivalDate(shipment);
  const start = shipmentStartDate(shipment);
  const end = shipmentEndDate(shipment);
  return {
    id: shipment.id,
    shipmentNo: shipment.invoice || shipment.billOfLading || shipment.id,
    source: shipment.source || "—",
    status: shipment.status as ProgressStatus,
    section,
    numContainers: Number(shipment.numContainers) || 0,
    arrivalDate: toIsoDateString(arrival),
    startDate: toIsoDateString(start),
    endDate: toIsoDateString(end),
    totalLines: Number(shipment.totalLines) || 0,
    bulkLines: Number(shipment.bulkLines) || 0,
    domLines: Number(shipment.domLines) || 0,
    pendingDays: section === "active" ? pendingDaysSince(arrival, today) : null,
  };
}

export function buildProgressSummary(
  shipments: SerializableShipment[],
  today: Date = startOfDay(new Date()),
  recentCompletedLimit = 5,
): ProgressSummary {
  const active = shipments
    .filter((s) => s.status === "Arrived" || s.status === "WIP")
    .map((shipment) => toProgressRow(shipment, "active", today))
    .sort((a, b) => {
      const pendingDiff = (b.pendingDays ?? -1) - (a.pendingDays ?? -1);
      if (pendingDiff !== 0) return pendingDiff;
      return a.shipmentNo.localeCompare(b.shipmentNo);
    });

  const recentCompleted = shipments
    .filter((s) => s.status === "Completed")
    .slice()
    .sort((a, b) => {
      const aTime = shipmentCompletedAt(a)?.getTime() ?? 0;
      const bTime = shipmentCompletedAt(b)?.getTime() ?? 0;
      if (bTime !== aTime) return bTime - aTime;
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    })
    .slice(0, recentCompletedLimit)
    .map((shipment) => toProgressRow(shipment, "completed", today));

  return {
    active,
    recentCompleted,
    rows: [...active, ...recentCompleted],
  };
}

/** @deprecated Prefer buildProgressSummary; kept for callers expecting a flat list. */
export function buildProgressRows(
  shipments: SerializableShipment[],
  today: Date = startOfDay(new Date()),
): ShipmentProgressRow[] {
  return buildProgressSummary(shipments, today).rows;
}

function autoWidths(rows: (string | number | null | undefined)[][]): { wch: number }[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      const length = String(cell ?? "").length;
      widths[index] = Math.min(40, Math.max(widths[index] || 12, length + 2));
    });
  }
  return widths.map((wch) => ({ wch }));
}

export async function exportProgressSummaryExcel(
  summary: ProgressSummary | ShipmentProgressRow[],
  options?: { generatedAt?: Date },
): Promise<void> {
  const XLSX = await import("xlsx");
  const generatedAt = options?.generatedAt ?? new Date();
  const progress =
    Array.isArray(summary)
      ? {
          active: summary.filter((r) => r.section !== "completed"),
          recentCompleted: summary.filter((r) => r.section === "completed"),
          rows: summary,
        }
      : summary;

  const title = "Shipment Progress Summary";
  const subtitle =
    "Arrived and WIP shipments, plus the last 5 completed — processing overview";

  const headers = [
    "Shipment No.",
    "Source",
    "Status",
    "Number of Containers",
    "Shipment Arrival Date",
    "Start Date",
    "End Date",
    "Total Lines",
    "Bulk Lines",
    "DOM Lines",
    "Pending Days",
  ];

  const mapRow = (row: ShipmentProgressRow) => [
    row.shipmentNo,
    row.source,
    row.status,
    row.numContainers,
    row.arrivalDate ? format(parseISO(row.arrivalDate), "dd MMM yyyy") : "",
    row.startDate ? format(parseISO(row.startDate), "dd MMM yyyy") : "",
    row.endDate ? format(parseISO(row.endDate), "dd MMM yyyy") : "",
    row.totalLines,
    row.bulkLines,
    row.domLines,
    row.pendingDays ?? "",
  ];

  const sheetRows: (string | number)[][] = [
    [title],
    [subtitle],
    [`Generated: ${format(generatedAt, "dd MMM yyyy HH:mm")}`],
    [
      `Active (Arrived/WIP): ${progress.active.length} · Recent completed: ${progress.recentCompleted.length}`,
    ],
    [],
    ["Active shipments (Arrived / WIP)"],
    headers,
    ...progress.active.map(mapRow),
  ];

  if (progress.active.length > 0) {
    sheetRows.push([
      "Active totals",
      "",
      "",
      progress.active.reduce((sum, row) => sum + row.numContainers, 0),
      "",
      "",
      "",
      progress.active.reduce((sum, row) => sum + row.totalLines, 0),
      progress.active.reduce((sum, row) => sum + row.bulkLines, 0),
      progress.active.reduce((sum, row) => sum + row.domLines, 0),
      "",
    ]);
  }

  sheetRows.push([]);
  sheetRows.push(["Last 5 completed shipments"]);
  sheetRows.push(headers);
  if (progress.recentCompleted.length === 0) {
    sheetRows.push(["No completed shipments yet"]);
  } else {
    sheetRows.push(...progress.recentCompleted.map(mapRow));
  }

  const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
  sheet["!cols"] = autoWidths(sheetRows);
  sheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Progress Summary");
  XLSX.writeFile(
    workbook,
    `shipment-progress-summary-${format(generatedAt, "yyyy-MM-dd")}.xlsx`,
  );
}
