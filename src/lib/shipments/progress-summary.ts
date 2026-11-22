import { differenceInDays, format, isValid, parseISO, startOfDay } from "date-fns";
import type { SerializableShipment } from "@/lib/types";

export type ShipmentProgressRow = {
  id: string;
  shipmentNo: string;
  status: "Arrived" | "WIP";
  numContainers: number;
  arrivalDate: string | null;
  startDate: string | null;
  endDate: string | null;
  totalLines: number;
  bulkLines: number;
  domLines: number;
  pendingDays: number | null;
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

export function buildProgressRows(
  shipments: SerializableShipment[],
  today: Date = startOfDay(new Date()),
): ShipmentProgressRow[] {
  const rows = shipments
    .filter((s) => s.status === "Arrived" || s.status === "WIP")
    .map((shipment) => {
      const arrival = shipmentArrivalDate(shipment);
      const start = shipmentStartDate(shipment);
      const end = shipmentEndDate(shipment);
      return {
        id: shipment.id,
        shipmentNo: shipment.invoice || shipment.billOfLading || shipment.id,
        status: shipment.status as "Arrived" | "WIP",
        numContainers: Number(shipment.numContainers) || 0,
        arrivalDate: toIsoDateString(arrival),
        startDate: toIsoDateString(start),
        endDate: toIsoDateString(end),
        totalLines: Number(shipment.totalLines) || 0,
        bulkLines: Number(shipment.bulkLines) || 0,
        domLines: Number(shipment.domLines) || 0,
        pendingDays: pendingDaysSince(arrival, today),
      } satisfies ShipmentProgressRow;
    });

  return rows.sort((a, b) => {
    const pendingDiff = (b.pendingDays ?? -1) - (a.pendingDays ?? -1);
    if (pendingDiff !== 0) return pendingDiff;
    return a.shipmentNo.localeCompare(b.shipmentNo);
  });
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
  rows: ShipmentProgressRow[],
  options?: { generatedAt?: Date },
): Promise<void> {
  const XLSX = await import("xlsx");
  const generatedAt = options?.generatedAt ?? new Date();
  const title = "Shipment Progress Summary";
  const subtitle = "Arrived and WIP shipments — processing overview";

  const headers = [
    "Shipment No.",
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

  const dataRows = rows.map((row) => [
    row.shipmentNo,
    row.status,
    row.numContainers,
    row.arrivalDate ? format(parseISO(row.arrivalDate), "dd MMM yyyy") : "",
    row.startDate ? format(parseISO(row.startDate), "dd MMM yyyy") : "",
    row.endDate ? format(parseISO(row.endDate), "dd MMM yyyy") : "",
    row.totalLines,
    row.bulkLines,
    row.domLines,
    row.pendingDays ?? "",
  ]);

  const sheetRows: (string | number)[][] = [
    [title],
    [subtitle],
    [`Generated: ${format(generatedAt, "dd MMM yyyy HH:mm")}`],
    [`Shipments: ${rows.length}`],
    [],
    headers,
    ...dataRows,
  ];

  if (rows.length > 0) {
    sheetRows.push([]);
    sheetRows.push([
      "Totals",
      "",
      rows.reduce((sum, row) => sum + row.numContainers, 0),
      "",
      "",
      "",
      rows.reduce((sum, row) => sum + row.totalLines, 0),
      rows.reduce((sum, row) => sum + row.bulkLines, 0),
      rows.reduce((sum, row) => sum + row.domLines, 0),
      "",
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
  sheet["!cols"] = autoWidths(sheetRows);
  sheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Progress Summary");
  XLSX.writeFile(
    workbook,
    `shipment-progress-summary-${format(generatedAt, "yyyy-MM-dd")}.xlsx`,
  );
}
