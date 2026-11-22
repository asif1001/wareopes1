import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import {
  buildProgressSummary,
  pendingDaysSince,
  shipmentArrivalDate,
  shipmentEndDate,
  shipmentStartDate,
} from "@/lib/shipments/progress-summary";

const base = {
  id: "S1",
  source: "Shanghai",
  invoice: "INV-100",
  billOfLading: "BL-100",
  status: "Arrived" as const,
  branch: "Main",
  numContainers: 2,
  containers: [{ id: "1", size: "40FT", quantity: 2 }],
  bahrainEta: "2026-11-01T00:00:00.000Z",
  originalDocumentReceiptDate: null,
  actualBahrainEta: "2026-11-02T00:00:00.000Z",
  lastStorageDay: "2026-11-20T00:00:00.000Z",
  whEtaRequestedByParts: "2026-11-04T00:00:00.000Z",
  whEtaConfirmedByLogistics: "2026-11-05T00:00:00.000Z",
  cleared: true,
  actualClearedDate: "2026-11-03T00:00:00.000Z",
  totalCases: 50,
  domLines: 4,
  bulkLines: 1,
  totalLines: 5,
  generalRemark: "",
  remark: "",
  bookings: [],
  monthYear: "Nov 26",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  createdBy: "u1",
  updatedBy: "u1",
};

describe("shipment progress summary", () => {
  it("includes Arrived/WIP plus the last 5 completed, with source", () => {
    const today = new Date(2026, 10, 12);
    const completed = Array.from({ length: 7 }, (_, i) => ({
      ...base,
      id: `C${i}`,
      invoice: `INV-C${i}`,
      source: i % 2 === 0 ? "Dubai" : "Shanghai",
      status: "Completed" as const,
      lastStorageDay: `2026-11-${String(10 + i).padStart(2, "0")}T00:00:00.000Z`,
      updatedAt: `2026-11-${String(10 + i).padStart(2, "0")}T12:00:00.000Z`,
    }));

    const summary = buildProgressSummary(
      [
        { ...base, id: "A", invoice: "INV-A", status: "Arrived", source: "Shanghai", actualBahrainEta: "2026-11-10T00:00:00.000Z" },
        { ...base, id: "B", invoice: "INV-B", status: "WIP", source: "Jebel Ali", actualBahrainEta: "2026-11-01T00:00:00.000Z" },
        { ...base, id: "D", invoice: "INV-D", status: "Not Arrived", actualBahrainEta: null },
        ...completed,
      ] as any,
      today,
    );

    expect(summary.active.map((r) => r.shipmentNo)).toEqual(["INV-B", "INV-A"]);
    expect(summary.active[0].source).toBe("Jebel Ali");
    expect(summary.active[0].pendingDays).toBe(11);
    expect(summary.active[1].pendingDays).toBe(2);

    expect(summary.recentCompleted).toHaveLength(5);
    expect(summary.recentCompleted.map((r) => r.shipmentNo)).toEqual([
      "INV-C6",
      "INV-C5",
      "INV-C4",
      "INV-C3",
      "INV-C2",
    ]);
    expect(summary.recentCompleted.every((r) => r.pendingDays == null)).toBe(true);
    expect(summary.recentCompleted[0].source).toBe("Dubai");
    expect(summary.rows).toHaveLength(7);
  });

  it("maps arrival, start, and end dates with the expected fallbacks", () => {
    const withActuals = base as any;
    expect(format(shipmentArrivalDate(withActuals)!, "yyyy-MM-dd")).toBe("2026-11-02");
    expect(format(shipmentStartDate(withActuals)!, "yyyy-MM-dd")).toBe("2026-11-03");
    expect(format(shipmentEndDate(withActuals)!, "yyyy-MM-dd")).toBe("2026-11-20");

    const fallbacks = {
      ...base,
      actualBahrainEta: null,
      actualClearedDate: null,
      whEtaConfirmedByLogistics: null,
      lastStorageDay: null,
    } as any;
    expect(format(shipmentArrivalDate(fallbacks)!, "yyyy-MM-dd")).toBe("2026-11-01");
    expect(format(shipmentStartDate(fallbacks)!, "yyyy-MM-dd")).toBe("2026-11-04");
    expect(shipmentEndDate(fallbacks)).toBeNull();
  });

  it("computes pending days from arrival to today", () => {
    const arrival = new Date(2026, 10, 1);
    const today = new Date(2026, 10, 11);
    expect(pendingDaysSince(arrival, today)).toBe(10);
    expect(pendingDaysSince(null, today)).toBeNull();
  });
});
