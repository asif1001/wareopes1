"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, FileSpreadsheet } from "lucide-react";

type Vehicle = {
  id: string;
  plateNo?: string | null;
  vehicleType?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  branch: string;
  status?: string | null;
  ownership: string;
  driverName: string;
  driverEmployeeId?: string | null;
  driverContact?: string | null;
  nextServiceDueKm?: number | null;
  nextServiceDueDate?: string | null;
  insuranceExpiry?: string | null;
  registrationExpiry?: string | null;
  fuelType?: string | null;
};

type Mhe = {
  id: string;
  equipmentInfo: string;
  modelNo?: string | null;
  serialNo?: string | null;
  status?: string | null;
  battery?: { type?: string | null; voltage?: string | null; size?: string | null } | undefined;
  certification?: { type?: string | null; expiry?: string | null; vendor?: string | null; certificateNo?: string | null } | undefined;
};

type VehicleMaintenanceRecord = {
  id: string;
  vehicleId: string;
  date: string;
  type: string;
  workDescription: string;
  vendor?: string | null;
  cost?: number | null;
  invoiceNumber?: string | null;
};

type MheMaintenanceRecord = {
  id: string;
  mheId: string;
  date: string;
  type: string;
  workDescription: string;
  vendor?: string | null;
  cost?: number | null;
};

function formatDate(d?: string | null) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString(); } catch { return String(d); }
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: any) => {
    if (v == null) return "";
    const s = String(v);
    const needsQuote = s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes("\"");
    const q = s.replace(/\"/g, '""');
    return needsQuote ? `"${q}"` : q;
  };
  const bom = "\ufeff"; // Excel-friendly BOM
  const csv = [headers.join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// PDF printing removed per request: display only download options

export function AssetReports() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState<boolean>(true);
  const [mhes, setMhes] = useState<Mhe[]>([]);
  const [vehicleMaint, setVehicleMaint] = useState<VehicleMaintenanceRecord[]>([]);
  const [mheMaint, setMheMaint] = useState<MheMaintenanceRecord[]>([]);
  // Shipment export dialog state
  const [shipmentDialogOpen, setShipmentDialogOpen] = useState<boolean>(false);
  const [shipmentFrom, setShipmentFrom] = useState<string>("");
  const [shipmentTo, setShipmentTo] = useState<string>("");
  const [exportingShipments, setExportingShipments] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadingVehicles(true);
        const res = await fetch(`/api/vehicles?limit=200`, { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data)
            ? data
            : ((data?.items ?? data?.data ?? data?.results ?? []) as any[]);
          const normalized = (list || []).map(v => ({
            id: v.id,
            plateNo: v.plateNo ?? "",
            vehicleType: v.vehicleType ?? "",
            make: v.make ?? "",
            model: v.model ?? "",
            year: v.year ?? null,
            branch: v.branch ?? "",
            status: v.status ?? "Active",
            ownership: v.ownership ?? "Owned",
            driverName: v.driverName ?? "",
            driverEmployeeId: v.driverEmployeeId ?? null,
            driverContact: v.driverContact ?? null,
            nextServiceDueKm: v.nextServiceDueKm ?? null,
            nextServiceDueDate: v.nextServiceDueDate ?? null,
            insuranceExpiry: v.insuranceExpiry ?? null,
            registrationExpiry: v.registrationExpiry ?? null,
            fuelType: v.fuelType ?? null,
          })) as Vehicle[];
          if (active) setVehicles(normalized);
        }
      } catch {}
      finally {
        if (active) setLoadingVehicles(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/mhes?limit=200`, { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          const list = (data?.items || []) as any[];
          const normalized = (list || []).map(m => ({
            id: m.id,
            equipmentInfo: m.equipmentInfo ?? "",
            modelNo: m.modelNo ?? null,
            serialNo: m.serialNo ?? null,
            status: m.status ?? "Active",
            battery: m.battery ?? undefined,
            certification: m.certification ? { ...m.certification, certificateNo: m.certification.certificateNo ?? null } : undefined,
          })) as Mhe[];
          if (active) setMhes(normalized);
        }
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/vehicle-maintenance?limit=300`, { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          const list = (data?.items || []) as any[];
          const normalized = (list || []).map((r: any) => ({
            id: r.id,
            vehicleId: r.vehicleId,
            date: r.date,
            type: r.type,
            workDescription: r.workDescription,
            vendor: r.vendor ?? null,
            cost: r.cost ?? null,
            invoiceNumber: r.invoiceNumber ?? null,
          })) as VehicleMaintenanceRecord[];
          if (active) setVehicleMaint(normalized);
        }
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/mhe-maintenance?limit=300`, { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          const list = (data?.items || []) as any[];
          const normalized = (list || []).map((r: any) => ({
            id: r.id,
            mheId: r.mheId,
            date: r.date,
            type: r.type,
            workDescription: r.workDescription,
            vendor: r.vendor ?? null,
            cost: r.cost ?? null,
          })) as MheMaintenanceRecord[];
          if (active) setMheMaint(normalized);
        }
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  // Summaries removed from display per request

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Downloads</CardTitle>
          <CardDescription>Export the latest datasets for Vehicles, MHE, and Maintenance.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={async () => {
            const headers = ["Plate No","Vehicle Type","Make","Model","Year","Branch","Ownership","Driver","Status","Next Service Km","Next Service Date","Insurance Expiry","Registration Expiry","Fuel Type"];
            let rows = vehicles.map(v => [v.plateNo, v.vehicleType, v.make, v.model, v.year, v.branch, v.ownership, v.driverName, v.status, v.nextServiceDueKm, formatDate(v.nextServiceDueDate), formatDate(v.insuranceExpiry), formatDate(v.registrationExpiry), v.fuelType]);
            // Safety: if no vehicles loaded yet, attempt an on-demand fetch, then export
            if (rows.length === 0) {
              try {
                const res = await fetch(`/api/vehicles?limit=50`, { method: "GET" });
                if (res.ok) {
                  const data = await res.json();
                  const list = Array.isArray(data) ? data : ((data?.items ?? data?.data ?? data?.results ?? []) as any[]);
                  const normalized = (list || []).map(v => ({
                    id: v.id,
                    plateNo: v.plateNo ?? "",
                    vehicleType: v.vehicleType ?? "",
                    make: v.make ?? "",
                    model: v.model ?? "",
                    year: v.year ?? null,
                    branch: v.branch ?? "",
                    status: v.status ?? "Active",
                    ownership: v.ownership ?? "Owned",
                    driverName: v.driverName ?? "",
                    driverEmployeeId: v.driverEmployeeId ?? null,
                    driverContact: v.driverContact ?? null,
                    nextServiceDueKm: v.nextServiceDueKm ?? null,
                    nextServiceDueDate: v.nextServiceDueDate ?? null,
                    insuranceExpiry: v.insuranceExpiry ?? null,
                    registrationExpiry: v.registrationExpiry ?? null,
                    fuelType: v.fuelType ?? null,
                  })) as Vehicle[];
                  setVehicles(normalized);
                  rows = normalized.map(v => [v.plateNo, v.vehicleType, v.make, v.model, v.year, v.branch, v.ownership, v.driverName, v.status, v.nextServiceDueKm, formatDate(v.nextServiceDueDate), formatDate(v.insuranceExpiry), formatDate(v.registrationExpiry), v.fuelType]);
                }
              } catch {}
            }
            downloadCsv("vehicles-report.csv", headers, rows);
          }} title={loadingVehicles ? "Loading vehicles…" : (vehicles.length === 0 ? "No vehicles found" : undefined)}><FileSpreadsheet className="h-4 w-4 mr-2"/>Export Vehicles (Excel)</Button>
          <Button variant="outline" onClick={() => {
            const headers = ["Equipment","Model No","Serial No","Status","Battery Type","Battery Voltage","Battery Size","Cert Type","Cert Vendor","Cert Serial No","Cert Expiry"];
            const rows = mhes.map(m => [m.equipmentInfo, m.modelNo, m.serialNo, m.status, m.battery?.type || "", m.battery?.voltage || "", m.battery?.size || "", m.certification?.type || "", m.certification?.vendor || "", m.certification?.certificateNo || "", formatDate(m.certification?.expiry || null)]);
            downloadCsv("mhe-report.csv", headers, rows);
          }}><FileSpreadsheet className="h-4 w-4 mr-2"/>Export MHE (Excel)</Button>
          <Button variant="outline" onClick={() => {
            const headers = ["Asset Type","Asset ID","Date","Maintenance Type","Description","Vendor","Cost","Invoice No"];
            const rowsVeh = vehicleMaint.map(r => ["Vehicle", r.vehicleId, formatDate(r.date), r.type, r.workDescription, r.vendor, r.cost, r.invoiceNumber]);
            const rowsMhe = mheMaint.map(r => ["MHE", r.mheId, formatDate(r.date), r.type, r.workDescription, r.vendor, r.cost, ""]);
            downloadCsv("maintenance-report.csv", headers, [...rowsVeh, ...rowsMhe]);
          }}><FileDown className="h-4 w-4 mr-2"/>Export Maintenance (Excel)</Button>

          {/* Shipment export: date-wise */}
          <Button variant="outline" onClick={() => setShipmentDialogOpen(true)} title="Export shipment report by date range">
            <FileSpreadsheet className="h-4 w-4 mr-2"/>Export Shipments (Excel)
          </Button>
        </CardContent>
      </Card>

      {/* Shipment Date Range Dialog */}
      <Dialog open={shipmentDialogOpen} onOpenChange={setShipmentDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Shipment Report (Date-wise)</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="from" className="text-right">From</Label>
              <Input id="from" type="date" className="col-span-3" value={shipmentFrom} onChange={e => setShipmentFrom(e.target.value)} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="to" className="text-right">To</Label>
              <Input id="to" type="date" className="col-span-3" value={shipmentTo} onChange={e => setShipmentTo(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShipmentDialogOpen(false)} disabled={exportingShipments}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!shipmentFrom || !shipmentTo) return;
                setExportingShipments(true);
                try {
                  const params = new URLSearchParams({ from: shipmentFrom, to: shipmentTo }).toString();
                  const res = await fetch(`/api/shipments/by-date-range?${params}`);
                  if (!res.ok) {
                    const msg = await res.json().catch(() => ({ error: "Failed to export" }));
                    alert(msg?.error || "Failed to export shipments");
                    return;
                  }
                  const data = await res.json();
                  const list = Array.isArray(data) ? data : (data?.items ?? data?.data ?? data?.results ?? []);

                  // Fetch branches to map branch IDs/codes to names
                  let branchMap: Record<string, string> = {};
                  try {
                    const bRes = await fetch(`/api/branches`);
                    if (bRes.ok) {
                      const bData = await bRes.json();
                      const branches = Array.isArray(bData) ? bData : (bData?.items ?? []);
                      for (const b of branches) {
                        if (b?.id) branchMap[b.id] = b.name ?? b.code ?? b.id;
                        if (b?.code) branchMap[b.code] = b.name ?? b.code;
                        if (b?.name) branchMap[b.name] = b.name; // identity
                      }
                    }
                  } catch {}
                  const headers = [
                    "Invoice","B/L","Source","Branch","Status",
                    "Num Containers","Container Sizes","Bookings",
                    "Bahrain ETA","Original Doc Receipt","Actual Bahrain ETA",
                    "WH ETA Requested by Parts","WH ETA Confirmed by Logistics",
                    "Cleared","Actual Cleared Date","Last Storage Day",
                    "Total Cases","DOM Lines","Bulk Lines","Total Lines",
                    "General Remark","Remark",
                    "Arrived Date","Completed Date","Status Update Date",
                    "Created At","Updated At"
                  ];
                  const rows = (list || []).map((s: any) => {
                    const containerSizes = (s.containers || []).map((c: any) => `${c.size} x${c.quantity}`).join("; ");
                    const bookings = (s.bookings || []).map((b: any) => `${b.containerNo} (${formatDate(b.bookingDate)})`).join("; ");
                    const branchName = s.branch ? (branchMap[s.branch] ?? s.branch) : "";
                    return [
                      s.invoice, s.billOfLading, s.source, branchName, s.status,
                      s.numContainers, containerSizes, bookings,
                      formatDate(s.bahrainEta), formatDate(s.originalDocumentReceiptDate), formatDate(s.actualBahrainEta),
                      formatDate(s.whEtaRequestedByParts), formatDate(s.whEtaConfirmedByLogistics),
                      s.cleared ? "Yes" : "No", formatDate(s.actualClearedDate), formatDate(s.lastStorageDay),
                      s.totalCases, s.domLines, s.bulkLines, s.totalLines,
                      s.generalRemark, s.remark || "",
                      formatDate(s.actualBahrainEta), // Arrived Date
                      formatDate(s.actualClearedDate), // Completed Date
                      formatDate(s.updatedAt), // Status Update Date
                      formatDate(s.createdAt),
                      formatDate(s.updatedAt)
                    ];
                  });
                  downloadCsv("shipments-report.csv", headers, rows);
                  setShipmentDialogOpen(false);
                } catch (e) {
                  alert("Something went wrong while exporting shipments.");
                } finally {
                  setExportingShipments(false);
                }
              }}
              disabled={!shipmentFrom || !shipmentTo || exportingShipments}
            >
              {exportingShipments ? "Exporting…" : "Export"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}