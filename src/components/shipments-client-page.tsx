
"use client";

import { useState, useMemo } from "react";
import {
  FileSpreadsheet,
  ListFilter,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardHeader } from "@/components/dashboard-header";
import { ShipmentForm } from "@/components/shipment-form";
import { format, differenceInDays, startOfDay } from "date-fns";
import { ContainerBookingModal } from "@/components/container-booking-modal";
import { ShipmentDetailModal } from "@/components/shipment-detail-modal";
import { cn } from "@/lib/utils";
import type { SerializableShipment, Source, ContainerSize, Branch } from "@/lib/types";
import {
  buildProgressSummary,
  exportProgressSummaryExcel,
  formatProgressDate,
  type ProgressSummary,
  type ShipmentProgressRow,
} from "@/lib/shipments/progress-summary";
import { useToast } from "@/hooks/use-toast";

const getDateColorClass = (dateString: string | null, today: Date) => {
  if (!dateString) {
    return "";
  }
  const date = new Date(dateString);
  
  // Only apply color for today or future dates
  if (date < today) {
    return "";
  }

  const daysUntil = differenceInDays(date, today);

  if (daysUntil >= 0 && daysUntil <= 3) {
    return "text-red-600 font-bold";
  }
  if (daysUntil >= 4 && daysUntil <= 7) {
    return "text-yellow-600 font-bold";
  }
  if (daysUntil >= 8 && daysUntil <= 15) {
    return "text-green-600 font-bold";
  }
  
  return "";
};

function ShipmentTable({
  shipments,
  sources,
  containerSizes,
  today,
  branches,
  onSelect,
}: {
  shipments: SerializableShipment[];
  sources: any[];
  containerSizes: any[];
  today: Date;
  branches: Branch[];
  onSelect: (shipment: SerializableShipment) => void;
}) {
    if (shipments.length === 0) {
        return <div className="text-center p-8 text-muted-foreground">No shipments found.</div>
    }
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>B/L</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Containers</TableHead>
                    <TableHead>Bahrain ETA</TableHead>
                    <TableHead>Actual Bahrain ETA</TableHead>
                    <TableHead>Arrived @ Port</TableHead>
                    <TableHead></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {shipments.map((shipment) => (
                    <TableRow
                      key={shipment.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onSelect(shipment)}
                      data-testid={`shipment-row-${shipment.id}`}
                    >
                        <TableCell className="font-medium">{shipment.invoice}</TableCell>
                        <TableCell>{shipment.billOfLading}</TableCell>
                        <TableCell>{shipment.source}</TableCell>
                        <TableCell>{shipment.containers.map(c => `${c.quantity}x${c.size}`).join(', ')}</TableCell>
                        <TableCell className={cn(getDateColorClass(shipment.bahrainEta, today))}>{format(new Date(shipment.bahrainEta), 'dd MMM yy')}</TableCell>
                        <TableCell className={cn(getDateColorClass(shipment.actualBahrainEta, today))}>
                            {shipment.actualBahrainEta ? format(new Date(shipment.actualBahrainEta), 'dd MMM yy') : '-'}
                        </TableCell>
                        <TableCell>
                            <Badge variant={shipment.cleared ? 'default' : 'secondary'}>{shipment.cleared ? 'Yes' : 'No'}</Badge>
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-end">
                              <ContainerBookingModal shipment={shipment} />
                              <ShipmentForm
                                  shipment={shipment}
                                  sources={sources}
                                  containerSizes={containerSizes}
                                  branches={branches}
                                  isEditMode={true}
                              />
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

function pendingDaysClass(days: number | null): string {
  if (days == null) return "text-muted-foreground";
  if (days >= 14) return "text-red-600 font-semibold";
  if (days >= 7) return "text-amber-600 font-semibold";
  return "font-medium";
}

function statusBadgeVariant(status: ShipmentProgressRow["status"]): "default" | "secondary" | "outline" {
  if (status === "Completed") return "default";
  if (status === "WIP") return "outline";
  return "secondary";
}

function ProgressRowCells({ row }: { row: ShipmentProgressRow }) {
  return (
    <>
      <TableCell>
        <div className="font-medium">{row.shipmentNo}</div>
        <Badge variant={statusBadgeVariant(row.status)} className="mt-1">
          {row.status}
        </Badge>
      </TableCell>
      <TableCell>{row.source}</TableCell>
      <TableCell className="text-right tabular-nums">{row.numContainers}</TableCell>
      <TableCell>{formatProgressDate(row.arrivalDate)}</TableCell>
      <TableCell>{formatProgressDate(row.startDate)}</TableCell>
      <TableCell>{formatProgressDate(row.endDate)}</TableCell>
      <TableCell className="text-right tabular-nums">{row.totalLines}</TableCell>
      <TableCell className="text-right tabular-nums">{row.bulkLines}</TableCell>
      <TableCell className="text-right tabular-nums">{row.domLines}</TableCell>
      <TableCell className={cn("text-right tabular-nums", pendingDaysClass(row.pendingDays))}>
        {row.pendingDays == null ? "—" : row.pendingDays}
      </TableCell>
    </>
  );
}

function ProgressSummaryTable({
  summary,
  onSelect,
  shipmentById,
}: {
  summary: ProgressSummary;
  onSelect: (shipment: SerializableShipment) => void;
  shipmentById: Map<string, SerializableShipment>;
}) {
  if (summary.rows.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No Arrived, WIP, or recent completed shipments to show.
      </div>
    );
  }

  const renderRow = (row: ShipmentProgressRow) => (
    <TableRow
      key={row.id}
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => {
        const shipment = shipmentById.get(row.id);
        if (shipment) onSelect(shipment);
      }}
      data-testid={`progress-row-${row.id}`}
    >
      <ProgressRowCells row={row} />
    </TableRow>
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shipment No.</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">Containers</TableHead>
            <TableHead>Arrival Date</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead className="text-right">Total Lines</TableHead>
            <TableHead className="text-right">Bulk Lines</TableHead>
            <TableHead className="text-right">DOM Lines</TableHead>
            <TableHead className="text-right">Pending Days</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summary.active.length > 0 ? (
            summary.active.map(renderRow)
          ) : (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                No Arrived or WIP shipments right now.
              </TableCell>
            </TableRow>
          )}
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={10}
              className="bg-muted/40 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Last 5 completed shipments
            </TableCell>
          </TableRow>
          {summary.recentCompleted.length > 0 ? (
            summary.recentCompleted.map(renderRow)
          ) : (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                No completed shipments yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function ShipmentsClientPage({
    shipments,
    sources,
    containerSizes,
    branches,
    label = "Shipments",
}: {
    shipments: SerializableShipment[];
    sources: Source[];
    containerSizes: ContainerSize[];
    branches: Branch[];
    label?: string;
}) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [today] = useState(() => startOfDay(new Date()));
  const [selectedShipment, setSelectedShipment] = useState<SerializableShipment | null>(null);
  const [exporting, setExporting] = useState(false);


  const filteredShipments = useMemo(() => {
    return shipments.filter(shipment => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
            shipment.invoice.toLowerCase().includes(query) ||
            shipment.billOfLading.toLowerCase().includes(query);

        const matchesFilter = 
            sourceFilter === "all" || shipment.source === sourceFilter;

        return matchesSearch && matchesFilter;
    });
  }, [shipments, searchQuery, sourceFilter]);
  
  const notClearedShipments = filteredShipments.filter(s => !s.cleared);
  const wipShipments = filteredShipments.filter(s => s.status === 'WIP');
  const arrivedShipments = filteredShipments.filter(s => s.status === 'Arrived');
  const completedShipments = filteredShipments.filter(s => s.status === 'Completed');
  const progressSummary = useMemo(
    () => buildProgressSummary(filteredShipments, today),
    [filteredShipments, today],
  );
  const shipmentById = useMemo(
    () => new Map(shipments.map((shipment) => [shipment.id, shipment])),
    [shipments],
  );

  async function handleExportProgress() {
    if (progressSummary.rows.length === 0) {
      toast({
        title: "Nothing to export",
        description: "There are no Arrived, WIP, or recent completed shipments in this view.",
      });
      return;
    }
    setExporting(true);
    try {
      await exportProgressSummaryExcel(progressSummary);
      toast({
        title: "Excel ready",
        description: `Exported ${progressSummary.rows.length} shipment${progressSummary.rows.length === 1 ? "" : "s"}.`,
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error?.message || "Could not create the Excel file.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title={label} />
      <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
        <Tabs defaultValue="all">
          <div className="flex items-center">
            <TabsList>
              <TabsTrigger value="all">All ({filteredShipments.length})</TabsTrigger>
              <TabsTrigger value="not-cleared">Not Cleared ({notClearedShipments.length})</TabsTrigger>
              <TabsTrigger value="wip">WIP ({wipShipments.length})</TabsTrigger>
              <TabsTrigger value="arrived">Arrived ({arrivedShipments.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedShipments.length})</TabsTrigger>
              <TabsTrigger value="progress">Progress ({progressSummary.rows.length})</TabsTrigger>
            </TabsList>
            <div className="ml-auto flex items-center gap-3">
              <div className="relative">
                 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                 <Input
                    type="search"
                    placeholder="Search by Invoice or B/L..."
                    className="pl-8 sm:w-[300px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 gap-1">
                    <ListFilter className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Filter
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Filter by Source</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={sourceFilter} onValueChange={setSourceFilter}>
                    <DropdownMenuRadioItem value="all">All Sources</DropdownMenuRadioItem>
                    {sources.map(source => (
                        <DropdownMenuRadioItem key={source.id} value={source.shortName}>
                            {source.shortName}
                        </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <ShipmentForm sources={sources} containerSizes={containerSizes} branches={branches} />
            </div>
          </div>
          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All {label}</CardTitle>
                <CardDescription>
                  Real-time tracking of all shipments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ShipmentTable
                  shipments={filteredShipments}
                  sources={sources}
                  containerSizes={containerSizes}
                  today={today}
                  branches={branches}
                  onSelect={setSelectedShipment}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="not-cleared">
            <Card>
              <CardHeader>
                <CardTitle>Not Cleared {label}</CardTitle>
                <CardDescription>
                  Shipments that are pending clearance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <ShipmentTable
                   shipments={notClearedShipments}
                   sources={sources}
                   containerSizes={containerSizes}
                   today={today}
                   branches={branches}
                   onSelect={setSelectedShipment}
                 />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="wip">
            <Card>
              <CardHeader>
                <CardTitle>WIP {label}</CardTitle>
                <CardDescription>
                  Shipments currently in Work In Progress.
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <ShipmentTable
                   shipments={wipShipments}
                   sources={sources}
                   containerSizes={containerSizes}
                   today={today}
                   branches={branches}
                   onSelect={setSelectedShipment}
                 />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="arrived">
            <Card>
              <CardHeader>
                <CardTitle>Arrived {label}</CardTitle>
                <CardDescription>
                  Shipments with status Arrived.
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <ShipmentTable
                   shipments={arrivedShipments}
                   sources={sources}
                   containerSizes={containerSizes}
                   today={today}
                   branches={branches}
                   onSelect={setSelectedShipment}
                 />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="completed">
            <Card>
              <CardHeader>
                <CardTitle>Completed {label}</CardTitle>
                <CardDescription>
                  Shipments with status Completed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <ShipmentTable
                   shipments={completedShipments}
                   sources={sources}
                   containerSizes={containerSizes}
                   today={today}
                   branches={branches}
                   onSelect={setSelectedShipment}
                 />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="progress">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <CardTitle>Progress overview</CardTitle>
                  <CardDescription>
                    Arrived and WIP shipments, plus the last 5 completed. Includes source.
                    Arrival uses Actual Bahrain ETA (or Bahrain ETA). Start uses Actual
                    Cleared Date (or W/H ETA). End uses Last Storage Date. Pending Days
                    counts from arrival to today for open shipments.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 gap-2"
                  onClick={() => void handleExportProgress()}
                  disabled={exporting || progressSummary.rows.length === 0}
                  data-testid="export-progress-excel"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {exporting ? "Exporting…" : "Export Excel"}
                </Button>
              </CardHeader>
              <CardContent>
                <ProgressSummaryTable
                  summary={progressSummary}
                  onSelect={setSelectedShipment}
                  shipmentById={shipmentById}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <ShipmentDetailModal
          shipment={selectedShipment}
          open={!!selectedShipment}
          onOpenChange={(open) => {
            if (!open) setSelectedShipment(null);
          }}
        />
      </main>
    </div>
  );
}
