import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShipmentsClientPage } from "@/components/shipments-client-page";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "tl1", permissions: { shipments: ["view"] } },
    isAdmin: false,
    permissions: { shipments: ["view"] },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-can", () => ({
  useCan: () => (module: string, action: string) =>
    module === "shipments" && action === "view",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/components/dashboard-header", () => ({
  DashboardHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock("@/components/shipment-form", () => ({
  ShipmentForm: () => null,
}));

vi.mock("@/components/container-booking-modal", () => ({
  ContainerBookingModal: () => null,
}));

const createShipment = (overrides: Partial<any> = {}) => ({
  id: "S1",
  source: "Shanghai",
  invoice: "INV-TL-100",
  billOfLading: "BL-TL-100",
  status: "Arrived",
  branch: "Main",
  numContainers: 2,
  containers: [
    { id: "1", size: "40FT", quantity: 1 },
    { id: "2", size: "20FT", quantity: 1 },
  ],
  bahrainEta: "2026-11-20T00:00:00.000Z",
  originalDocumentReceiptDate: "2026-11-10T00:00:00.000Z",
  actualBahrainEta: "2026-11-21T00:00:00.000Z",
  lastStorageDay: "2026-11-28T00:00:00.000Z",
  whEtaRequestedByParts: "2026-11-22T00:00:00.000Z",
  whEtaConfirmedByLogistics: "2026-11-23T00:00:00.000Z",
  cleared: true,
  actualClearedDate: "2026-11-21T00:00:00.000Z",
  totalCases: 120,
  domLines: 8,
  bulkLines: 2,
  totalLines: 10,
  generalRemark: "Priority unload",
  remark: "Gate 3 preferred",
  bookings: [
    { containerNo: "MSCU1234567", bookingDate: "2026-11-24T00:00:00.000Z" },
    { containerNo: "MSCU7654321", bookingDate: "2026-11-25T00:00:00.000Z" },
  ],
  monthYear: "Nov 26",
  createdAt: "2026-11-01T08:00:00.000Z",
  updatedAt: "2026-11-15T10:00:00.000Z",
  createdBy: "ops",
  updatedBy: "logistics",
  ...overrides,
});

const sources = [{ id: "src1", shortName: "Shanghai", name: "Shanghai Port" }];
const containerSizes = [{ id: "c1", size: "40FT", cmb: "0" }];
const branches = [{ id: "b1", name: "Main", code: "M" }];

describe("Shipment detail modal", () => {
  it("opens full shipment details when a team leader clicks a row", async () => {
    const user = userEvent.setup();
    render(
      <ShipmentsClientPage
        shipments={[createShipment()] as any}
        sources={sources as any}
        containerSizes={containerSizes as any}
        branches={branches as any}
      />
    );

    await user.click(screen.getByTestId("shipment-row-S1"));

    expect(await screen.findByText("Invoice INV-TL-100")).toBeInTheDocument();
    expect(screen.getByText("Arrival & clearance")).toBeInTheDocument();
    expect(screen.getByText("Container bookings & arriving dates")).toBeInTheDocument();
    expect(screen.getByText("MSCU1234567")).toBeInTheDocument();
    expect(screen.getByText("MSCU7654321")).toBeInTheDocument();
    expect(screen.getByText("Priority unload")).toBeInTheDocument();
    expect(screen.getByText("Gate 3 preferred")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("Cleared at port")).toBeInTheDocument();
  });
});
