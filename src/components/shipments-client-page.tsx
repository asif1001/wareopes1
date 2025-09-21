
"use client";

import { useState, useMemo, useEffect } from "react";
import {
  File,
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
import { cn } from "@/lib/utils";
import type { SerializableShipment, Source, ContainerSize } from "@/lib/types";
import { ExportDialog } from "@/components/export-dialog";

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

function ShipmentTable({ shipments, sources, containerSizes, today }: { shipments: SerializableShipment[], sources: any[], containerSizes: any[], today: Date }) {
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
                    <TableHead>Cleared</TableHead>
                    <TableHead></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {shipments.map((shipment) => (
                    <TableRow key={shipment.id}>
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
                        <TableCell className="text-right flex items-center justify-end">
                            <ContainerBookingModal shipment={shipment} />
                            <ShipmentForm
                                shipment={shipment}
                                sources={sources}
                                containerSizes={containerSizes}
                                isEditMode={true}
                            />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

export function ShipmentsClientPage({
    shipments,
    sources,
    containerSizes,
}: {
    shipments: SerializableShipment[];
    sources: Source[];
    containerSizes: ContainerSize[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    setToday(startOfDay(new Date()));
  }, []);


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
  
  const clearedShipments = filteredShipments.filter(s => s.cleared);
  const notClearedShipments = filteredShipments.filter(s => !s.cleared);

  if (!today) {
    return null; // or a loading skeleton
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Shipments" />
      <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
        <Tabs defaultValue="all">
          <div className="flex items-center">
            <TabsList>
              <TabsTrigger value="all">All ({filteredShipments.length})</TabsTrigger>
              <TabsTrigger value="cleared">Cleared ({clearedShipments.length})</TabsTrigger>
              <TabsTrigger value="not-cleared">Not Cleared ({notClearedShipments.length})</TabsTrigger>
            </TabsList>
            <div className="ml-auto flex items-center gap-2">
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
              <ExportDialog />
              <ShipmentForm sources={sources} containerSizes={containerSizes} />
            </div>
          </div>
          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Shipments</CardTitle>
                <CardDescription>
                  Real-time tracking of all shipments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ShipmentTable shipments={filteredShipments} sources={sources} containerSizes={containerSizes} today={today} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="cleared">
            <Card>
              <CardHeader>
                <CardTitle>Cleared Shipments</CardTitle>
                <CardDescription>
                  Shipments that have been cleared.
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <ShipmentTable shipments={clearedShipments} sources={sources} containerSizes={containerSizes} today={today} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="not-cleared">
            <Card>
              <CardHeader>
                <CardTitle>Not Cleared Shipments</CardTitle>
                <CardDescription>
                  Shipments that are pending clearance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <ShipmentTable shipments={notClearedShipments} sources={sources} containerSizes={containerSizes} today={today} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
