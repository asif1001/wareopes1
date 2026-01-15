import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShipmentsClientPage } from "@/components/shipments-client-page";

const createShipment = (overrides: Partial<any>) => {
  const base = {
    id: "S1",
    source: "Shanghai",
    invoice: "INV-001",
    billOfLading: "BL-001",
    status: "Arrived",
    branch: "Main",
    numContainers: 1,
    containers: [],
    bahrainEta: new Date().toISOString(),
    originalDocumentReceiptDate: null,
    actualBahrainEta: null,
    lastStorageDay: null,
    whEtaRequestedByParts: null,
    whEtaConfirmedByLogistics: null,
    cleared: true,
    actualClearedDate: null,
    totalCases: 10,
    domLines: 0,
    bulkLines: 0,
    totalLines: 10,
    generalRemark: "",
    remark: "",
    bookings: [],
    monthYear: "Aug 24",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "u1",
    updatedBy: "u1",
  };
  return { ...base, ...overrides };
};

const sources = [
  { id: "src1", shortName: "Shanghai", name: "Shanghai Port" },
  { id: "src2", shortName: "Dubai", name: "Jebel Ali" },
];

const containerSizes = [{ id: "c1", size: "40FT", cmb: "0" }];
const branches = [{ id: "b1", name: "Main", code: "M" }];

describe("ShipmentsClientPage source filter", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("filters shipments by selected source", () => {
    const shipments = [
      createShipment({ id: "S1", source: "Shanghai", invoice: "INV-SH" }),
      createShipment({ id: "S2", source: "Dubai", invoice: "INV-DU" }),
    ];

    render(
      <ShipmentsClientPage
        shipments={shipments as any}
        sources={sources as any}
        containerSizes={containerSizes as any}
        branches={branches as any}
      />
    );

    fireEvent.click(screen.getByTestId("source-filter-trigger"));
    fireEvent.click(screen.getByText("Shanghai"));

    expect(screen.getByText("INV-SH")).toBeInTheDocument();
    expect(screen.queryByText("INV-DU")).not.toBeInTheDocument();
  });

  it("supports multi-select and clear selection", () => {
    const shipments = [
      createShipment({ id: "S1", source: "Shanghai", invoice: "INV-SH" }),
      createShipment({ id: "S2", source: "Dubai", invoice: "INV-DU" }),
    ];

    render(
      <ShipmentsClientPage
        shipments={shipments as any}
        sources={sources as any}
        containerSizes={containerSizes as any}
        branches={branches as any}
      />
    );

    fireEvent.click(screen.getByTestId("source-filter-trigger"));
    fireEvent.click(screen.getByText("Shanghai"));
    fireEvent.click(screen.getByText("Dubai"));

    expect(screen.getByText("INV-SH")).toBeInTheDocument();
    expect(screen.getByText("INV-DU")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Clear Selection"));

    expect(screen.getByText("INV-SH")).toBeInTheDocument();
    expect(screen.getByText("INV-DU")).toBeInTheDocument();
  });

  it("persists selected sources in localStorage", () => {
    const shipments = [
      createShipment({ id: "S1", source: "Shanghai", invoice: "INV-SH" }),
      createShipment({ id: "S2", source: "Dubai", invoice: "INV-DU" }),
    ];

    const props = {
      shipments: shipments as any,
      sources: sources as any,
      containerSizes: containerSizes as any,
      branches: branches as any,
    };

    const { unmount } = render(<ShipmentsClientPage {...props} />);

    fireEvent.click(screen.getByTestId("source-filter-trigger"));
    fireEvent.click(screen.getByText("Shanghai"));

    unmount();

    render(<ShipmentsClientPage {...props} />);

    expect(screen.getByText("INV-SH")).toBeInTheDocument();
    expect(screen.queryByText("INV-DU")).not.toBeInTheDocument();
  });

  it("handles localStorage errors gracefully", () => {
    const shipments = [
      createShipment({ id: "S1", source: "Shanghai", invoice: "INV-SH" }),
    ];

    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error("setItem failed");
    };

    render(
      <ShipmentsClientPage
        shipments={shipments as any}
        sources={sources as any}
        containerSizes={containerSizes as any}
        branches={branches as any}
      />
    );

    fireEvent.click(screen.getByTestId("source-filter-trigger"));
    fireEvent.click(screen.getByText("Shanghai"));

    expect(screen.getByText("INV-SH")).toBeInTheDocument();

    window.localStorage.setItem = originalSetItem;
  });
}

