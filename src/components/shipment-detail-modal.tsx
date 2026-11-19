"use client";

import type { ReactNode } from "react";
import { format, differenceInDays, startOfDay, isValid, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DetailedModal from "@/components/DetailedModal";
import { cn } from "@/lib/utils";
import type { SerializableShipment } from "@/lib/types";
import {
  CalendarDays,
  Package,
  Ship,
  FileText,
  ClipboardList,
  MapPin,
} from "lucide-react";

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = value.includes("T") || value.includes("Z") ? parseISO(value) : new Date(value);
  return isValid(d) ? d : null;
}

function fmtDate(value: string | null | undefined, pattern = "dd MMM yyyy"): string {
  const d = parseDate(value);
  return d ? format(d, pattern) : "—";
}

function etaHint(value: string | null | undefined, today: Date): string | null {
  const d = parseDate(value);
  if (!d) return null;
  const day = startOfDay(d);
  const days = differenceInDays(day, today);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function etaTone(value: string | null | undefined, today: Date): string {
  const d = parseDate(value);
  if (!d || d < today) return "";
  const days = differenceInDays(d, today);
  if (days <= 3) return "text-red-600";
  if (days <= 7) return "text-amber-600";
  if (days <= 15) return "text-emerald-600";
  return "";
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "Completed") return "default";
  if (status === "Arrived") return "secondary";
  if (status === "WIP") return "outline";
  return "secondary";
}

function Field({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  hint?: string | null;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 text-sm font-medium text-foreground break-words", valueClassName)}>
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function ShipmentDetailModal({
  shipment,
  open,
  onOpenChange,
}: {
  shipment: SerializableShipment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!shipment) return null;

  const today = startOfDay(new Date());
  const containersLabel =
    shipment.containers.length > 0
      ? shipment.containers.map((c) => `${c.quantity}×${c.size}`).join(", ")
      : "—";
  const bookings = shipment.bookings || [];
  const expanded = shipment.containers.flatMap((c) =>
    Array.from({ length: Math.max(0, Number(c.quantity) || 0) }, () => ({ size: c.size }))
  );
  const bookingRows =
    expanded.length > 0
      ? expanded.map((c, i) => ({
          size: c.size,
          containerNo: bookings[i]?.containerNo || "—",
          bookingDate: bookings[i]?.bookingDate || null,
        }))
      : bookings.map((b) => ({
          size: "—",
          containerNo: b.containerNo || "—",
          bookingDate: b.bookingDate || null,
        }));

  const title = `Invoice ${shipment.invoice}`;

  return (
    <DetailedModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold tracking-tight">{shipment.invoice}</span>
                <Badge variant={statusVariant(shipment.status)}>{shipment.status}</Badge>
                <Badge variant={shipment.cleared ? "default" : "secondary"}>
                  {shipment.cleared ? "Cleared at port" : "Not cleared"}
                </Badge>
                {shipment.productionUploaded ? (
                  <Badge variant="outline">Production uploaded</Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>
                  B/L <span className="font-medium text-foreground">{shipment.billOfLading || "—"}</span>
                </span>
                <span>
                  Source <span className="font-medium text-foreground">{shipment.source || "—"}</span>
                </span>
                {shipment.branch ? (
                  <span>
                    Branch <span className="font-medium text-foreground">{shipment.branch}</span>
                  </span>
                ) : null}
                {shipment.monthYear ? (
                  <span>
                    Period <span className="font-medium text-foreground">{shipment.monthYear}</span>
                  </span>
                ) : null}
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Containers</div>
              <div className="font-semibold">{shipment.numContainers || 0}</div>
              <div className="text-xs text-muted-foreground">{containersLabel}</div>
            </div>
          </div>
        </div>

        <Section title="Arrival & clearance" icon={<CalendarDays className="h-4 w-4" />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Bahrain ETA"
              value={fmtDate(shipment.bahrainEta)}
              hint={etaHint(shipment.bahrainEta, today)}
              valueClassName={etaTone(shipment.bahrainEta, today)}
            />
            <Field
              label="Actual Bahrain ETA"
              value={fmtDate(shipment.actualBahrainEta)}
              hint={etaHint(shipment.actualBahrainEta, today)}
              valueClassName={etaTone(shipment.actualBahrainEta, today)}
            />
            <Field
              label="Last storage day"
              value={fmtDate(shipment.lastStorageDay)}
              hint={etaHint(shipment.lastStorageDay, today)}
            />
            <Field
              label="Original document receipt"
              value={fmtDate(shipment.originalDocumentReceiptDate)}
            />
            <Field
              label="W/H ETA (requested)"
              value={fmtDate(shipment.whEtaRequestedByParts)}
              hint={etaHint(shipment.whEtaRequestedByParts, today)}
            />
            <Field
              label="W/H ETA (confirmed)"
              value={fmtDate(shipment.whEtaConfirmedByLogistics)}
              hint={etaHint(shipment.whEtaConfirmedByLogistics, today)}
            />
            <Field
              label="Arrived @ port"
              value={shipment.cleared ? "Yes" : "No"}
            />
            <Field label="Actual cleared date" value={fmtDate(shipment.actualClearedDate)} />
          </div>
        </Section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Containers" icon={<Ship className="h-4 w-4" />}>
            {shipment.containers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No container sizes recorded.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {shipment.containers.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <span className="font-semibold">{c.quantity}</span>
                    <span className="text-muted-foreground"> × </span>
                    <span className="font-medium">{c.size}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Cargo summary" icon={<Package className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Total cases" value={shipment.totalCases ?? 0} />
              <Field label="DOM lines" value={shipment.domLines ?? 0} />
              <Field label="Bulk lines" value={shipment.bulkLines ?? 0} />
              <Field label="Total lines" value={shipment.totalLines ?? 0} />
            </div>
          </Section>
        </div>

        <Section title="Container bookings & arriving dates" icon={<MapPin className="h-4 w-4" />}>
          {bookingRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No container numbers or booking dates have been entered yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Container No</TableHead>
                    <TableHead>Booking / arriving date</TableHead>
                    <TableHead>Timing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookingRows.map((row, i) => (
                    <TableRow key={`${row.containerNo}-${i}`}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>{row.size}</TableCell>
                      <TableCell className="font-medium">{row.containerNo}</TableCell>
                      <TableCell className={cn(etaTone(row.bookingDate, today))}>
                        {fmtDate(row.bookingDate)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {etaHint(row.bookingDate, today) || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>

        <Section title="Remarks" icon={<FileText className="h-4 w-4" />}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                General remark
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {shipment.generalRemark?.trim() || "—"}
              </p>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Remark
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {shipment.remark?.trim() || "—"}
              </p>
            </div>
          </div>
        </Section>

        <Section title="Record info" icon={<ClipboardList className="h-4 w-4" />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Created" value={fmtDate(shipment.createdAt, "dd MMM yyyy HH:mm")} />
            <Field label="Created by" value={shipment.createdBy || "—"} />
            <Field label="Last updated" value={fmtDate(shipment.updatedAt, "dd MMM yyyy HH:mm")} />
            <Field label="Updated by" value={shipment.updatedBy || "—"} />
          </div>
        </Section>
      </div>
    </DetailedModal>
  );
}
