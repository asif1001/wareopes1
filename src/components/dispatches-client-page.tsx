"use client";

import { useState, useMemo, useEffect } from "react";
import {
  File,
  ListFilter,
  Search,
  Truck,
  Calendar,
  Hash,
  Container,
  Package,
  Camera,
  ClipboardList,
  Phone,
  Ship,
  Plane,
  Train,
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
import { DispatchForm } from "@/components/dispatch-form";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { SerializableDispatch, User, ContainerSize } from "@/lib/types";
import { getDispatches, getUsers, getContainerSizes } from "@/lib/firebase/firestore";

function DispatchTable({ dispatches, users, containerSizes, onUpdated }: { dispatches: SerializableDispatch[], users: User[], containerSizes: ContainerSize[], onUpdated: (dispatch: SerializableDispatch) => void }) {
    if (dispatches.length === 0) {
        return <div className="text-center p-8 text-muted-foreground">No dispatches found.</div>
    }
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Loading Plan</TableHead>
                    <TableHead>No of Container</TableHead>
                    <TableHead>No of Cases</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {dispatches.map((dispatch) => (
                    <TableRow key={dispatch.id}>
                        <TableCell className="font-medium">
                            {dispatch.invoiceNo}
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col">
                                <span className="font-medium">{dispatch.customerName}</span>
                                <span className="text-xs text-muted-foreground">{dispatch.customerCode}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            {format(new Date(dispatch.loadingDate), 'dd MMM yy')}
                        </TableCell>
                        <TableCell>
                            {dispatch.noOfContainer} x {dispatch.containerSize}
                        </TableCell>
                        <TableCell>
                            {dispatch.noOfCases}
                        </TableCell>
                        <TableCell>
                            <Badge variant={
                                dispatch.status === 'Dispatched' ? 'default' : 
                                dispatch.status === 'Loaded' ? 'secondary' : 'outline'
                            }>
                                {dispatch.status}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            <DispatchForm dispatch={dispatch} isEditMode users={users} containerSizes={containerSizes} onUpdated={onUpdated} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

export function DispatchesClientPage({
    dispatches: initialDispatches,
    users: initialUsers = [],
    containerSizes: initialContainerSizes = [],
    label = "Dispatches",
}: {
    dispatches: SerializableDispatch[];
    users?: User[];
    containerSizes?: ContainerSize[];
    label?: string;
}) {
    const [dispatches, setDispatches] = useState(initialDispatches);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [users, setUsers] = useState<User[]>(initialUsers);
    const [containerSizes, setContainerSizes] = useState<ContainerSize[]>(initialContainerSizes);
    const shouldFetchLookups = initialUsers.length === 0 || initialContainerSizes.length === 0;
    const shouldFetchDispatches = initialDispatches.length === 0;
    const upsertDispatch = (next: SerializableDispatch) => {
        setDispatches((prev) => {
            const index = prev.findIndex((item) => item.id === next.id);
            const updated = index >= 0
                ? prev.map((item) => (item.id === next.id ? next : item))
                : [next, ...prev];
            return [...updated].sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
        });
    };

    useEffect(() => {
        if (!shouldFetchLookups) return;
        const fetchLookups = async () => {
            try {
                const [fetchedUsers, fetchedContainerSizes] = await Promise.all([
                    getUsers(),
                    getContainerSizes()
                ]);
                setUsers(fetchedUsers);
                setContainerSizes(fetchedContainerSizes);
            } catch (error) {
                console.error("Failed to fetch lookup data:", error);
            }
        };
        fetchLookups();
    }, [shouldFetchLookups]);

    useEffect(() => {
        if (!shouldFetchDispatches) return;
        const fetchDispatches = async () => {
            try {
                const fetchedDispatches = await getDispatches();
                setDispatches(fetchedDispatches);
            } catch {
                setDispatches([]);
            }
        };
        fetchDispatches();
    }, [shouldFetchDispatches]);

    const filteredDispatches = useMemo(() => {
        return dispatches.filter(dispatch => {
            const query = searchQuery.toLowerCase();
            const matchesSearch = 
                dispatch.invoiceNo.toLowerCase().includes(query) ||
                dispatch.customerName.toLowerCase().includes(query) ||
                dispatch.containerNo.toLowerCase().includes(query);

            const matchesFilter = 
                statusFilter === "all" || dispatch.status === statusFilter;

            return matchesSearch && matchesFilter;
        });
    }, [dispatches, searchQuery, statusFilter]);
  
    const pendingDispatches = filteredDispatches.filter(d => d.status === 'Pending');
    const loadedDispatches = filteredDispatches.filter(d => d.status === 'Loaded');
    const dispatchedDispatches = filteredDispatches.filter(d => d.status === 'Dispatched');

    return (
        <div className="flex flex-col h-full">
            <DashboardHeader title={label} />
            <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
                <Tabs defaultValue="all">
                    <div className="flex items-center">
                        <TabsList>
                            <TabsTrigger value="all">All ({filteredDispatches.length})</TabsTrigger>
                            <TabsTrigger value="pending">Pending ({pendingDispatches.length})</TabsTrigger>
                            <TabsTrigger value="loaded">Loaded ({loadedDispatches.length})</TabsTrigger>
                            <TabsTrigger value="dispatched">Dispatched ({dispatchedDispatches.length})</TabsTrigger>
                        </TabsList>
                        <div className="ml-auto flex items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search by Invoice, Customer, or Container..."
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
                                    <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                                        <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Pending">Pending</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Loaded">Loaded</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="Dispatched">Dispatched</DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <DispatchForm users={users} containerSizes={containerSizes} onCreated={upsertDispatch} />
                        </div>
                    </div>
                    <TabsContent value="all">
                        <Card>
                            <CardHeader>
                                <CardTitle>All {label}</CardTitle>
                                <CardDescription>
                                    Manage and track all your dispatches.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <DispatchTable dispatches={filteredDispatches} users={users} containerSizes={containerSizes} onUpdated={upsertDispatch} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="pending">
                        <Card>
                            <CardHeader>
                                <CardTitle>Pending Dispatches</CardTitle>
                                <CardDescription>
                                    These dispatches are scheduled but not yet loaded.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <DispatchTable dispatches={pendingDispatches} users={users} containerSizes={containerSizes} onUpdated={upsertDispatch} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="loaded">
                        <Card>
                            <CardHeader>
                                <CardTitle>Loaded Dispatches</CardTitle>
                                <CardDescription>
                                    These dispatches have been loaded and are awaiting final dispatch.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <DispatchTable dispatches={loadedDispatches} users={users} containerSizes={containerSizes} onUpdated={upsertDispatch} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="dispatched">
                        <Card>
                            <CardHeader>
                                <CardTitle>Dispatched</CardTitle>
                                <CardDescription>
                                    These dispatches have left the facility.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <DispatchTable dispatches={dispatchedDispatches} users={users} containerSizes={containerSizes} onUpdated={upsertDispatch} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
