
"use client";

import { useState, useEffect } from "react";
import {
  File,
  ListFilter,
  Search,
  Plus,
  RefreshCw,
  Droplets,
  MapPin,
  Calendar,
  Filter
} from "lucide-react";
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { DashboardHeader } from "@/components/dashboard-header";
import { getBranches, subscribeToBranches, getTankLogs } from "@/lib/firebase/onedelivery";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Branch, OilTank } from "@/types/onedelivery";
import { Tank3DVisualization } from "@/components/oil/tank-3d";
import { formatDistanceToNow } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function OilStatusClientPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("7"); // days
  
  // Data fetching state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  useEffect(() => {
    let unsubscribeBranches: () => void;

    const initData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Initial fetch for logs
        const logsResult = await getTankLogs(parseInt(timeRange));
        setLogs(logsResult);

        // Real-time subscription for branches
        unsubscribeBranches = subscribeToBranches((updatedBranches) => {
          setBranches(updatedBranches);
          setLastRefreshed(new Date());
          console.log("Updated Branches:", updatedBranches);
          setLoading(false); // Ensure loading is false after first update
        });

      } catch (err: any) {
        console.error("Failed to init data:", err);
        setError(err.message || "Failed to connect to OneDelivery database");
        setLoading(false);
      }
    };

    initData();

    return () => {
      if (unsubscribeBranches) unsubscribeBranches();
    };
  }, [timeRange]);

  const refreshLogs = async () => {
     try {
        const logsResult = await getTankLogs(parseInt(timeRange));
        setLogs(logsResult);
        setLastRefreshed(new Date());
     } catch (err) {
         console.error("Error refreshing logs:", err);
     }
  };

  // Filter branches based on search and selection
  const filteredBranches = branches.filter(branch => {
    const name = branch.name || '';
    const location = branch.location || '';
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSelection = selectedBranchId ? branch.id === selectedBranchId : true;
    return matchesSearch && matchesSelection;
  });

  // Calculate Summary Statistics
  const totalCapacity = filteredBranches.reduce((acc, branch) => 
    acc + (branch.oilTanks?.reduce((tAcc, tank) => tAcc + (tank.capacity || 0), 0) || 0), 0);
  
  const totalCurrentLevel = filteredBranches.reduce((acc, branch) => 
    acc + (branch.oilTanks?.reduce((tAcc, tank) => tAcc + (tank.currentLevel || 0), 0) || 0), 0);
    
  const overallPercentage = totalCapacity > 0 ? (totalCurrentLevel / totalCapacity) * 100 : 0;

  // Calculate stock by oil type
  const stockByOilType = filteredBranches.reduce((acc, branch) => {
    branch.oilTanks?.forEach(tank => {
      const type = tank.oilTypeName || 'Unknown';
      if (!acc[type]) acc[type] = 0;
      acc[type] += (tank.currentLevel || 0);
    });
    return acc;
  }, {} as Record<string, number>);

  const lowLevelTanks = filteredBranches.flatMap(branch => 
    (branch.oilTanks || [])
      .filter(tank => {
        const capacity = Math.max(1, tank.capacity || 1);
        const currentLevel = tank.currentLevel || 0;
        return (currentLevel / capacity) < 0.3;
      })
      .map(tank => ({
        branchName: branch.name,
        oilType: tank.oilTypeName || 'Unknown',
        currentLevel: tank.currentLevel || 0,
        capacity: Math.max(1, tank.capacity || 1)
      }))
  );

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Oil Status Monitor" />
      <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
        
        {/* Top Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="relative w-full sm:w-auto flex-1 max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search branches..."
                    className="pl-8 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Time Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Last 24 Hours</SelectItem>
                    <SelectItem value="7">Last 7 Days</SelectItem>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 gap-1">
                            <Filter className="h-3.5 w-3.5" />
                            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                {selectedBranchId ? 'Filtered' : 'All Branches'}
                            </span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Filter by Branch</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem 
                            checked={selectedBranchId === null}
                            onCheckedChange={() => setSelectedBranchId(null)}
                        >
                            All Branches
                        </DropdownMenuCheckboxItem>
                        {branches.map(branch => (
                            <DropdownMenuCheckboxItem 
                                key={branch.id}
                                checked={selectedBranchId === branch.id}
                                onCheckedChange={() => setSelectedBranchId(selectedBranchId === branch.id ? null : branch.id)}
                            >
                                {branch.name}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button size="sm" variant="outline" className="h-9 gap-1" onClick={refreshLogs}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Refresh</span>
                </Button>
            </div>
        </div>

        {/* Connection Status / Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>
              Could not connect to OneDelivery database: {error}
              <div className="mt-2 text-xs">Check your environment variables and network connection.</div>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
                    <Droplets className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalCapacity.toLocaleString()} L</div>
                    <p className="text-xs text-muted-foreground">Across {filteredBranches.length} branches</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Current Stock</CardTitle>
                    <div className={`h-2 w-2 rounded-full ${overallPercentage < 30 ? 'bg-red-500' : 'bg-green-500'}`} />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalCurrentLevel.toLocaleString()} L</div>
                    <p className="text-xs text-muted-foreground mb-2">{overallPercentage.toFixed(1)}% full</p>
                    
                    <div className="space-y-1 mt-2">
                        {Object.entries(stockByOilType).map(([type, amount]) => (
                            <div key={type} className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{type}:</span>
                                <span className="font-medium">{amount.toLocaleString()} L</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Low Level Alerts</CardTitle>
                    <div className={`h-2 w-2 rounded-full ${lowLevelTanks.length > 0 ? 'bg-red-500' : 'bg-green-500'}`} />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{lowLevelTanks.length}</div>
                    <p className="text-xs text-muted-foreground mb-2">Tanks below 30% capacity</p>
                    
                    <div className="space-y-2 mt-2 max-h-[100px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                        {lowLevelTanks.map((tank, idx) => (
                             <div key={idx} className="flex flex-col text-xs border-b border-border/50 pb-1 last:border-0 last:pb-0">
                                <span className="font-medium text-red-500 truncate" title={tank.branchName}>{tank.branchName}</span>
                                <div className="flex justify-between text-muted-foreground">
                                    <span className="truncate max-w-[80px]" title={tank.oilType}>{tank.oilType}</span>
                                    <span>{((tank.currentLevel / tank.capacity) * 100).toFixed(0)}%</span>
                                </div>
                             </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{logs.length}</div>
                    <p className="text-xs text-muted-foreground">Updates in last {timeRange} days</p>
                </CardContent>
            </Card>
        </div>

        {/* Main Content Area */}
        {loading ? (
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
               {[1, 2, 3].map(i => (
                   <Card key={i} className="overflow-hidden">
                       <CardHeader className="space-y-2">
                           <Skeleton className="h-4 w-1/2" />
                           <Skeleton className="h-4 w-1/4" />
                       </CardHeader>
                       <CardContent>
                           <Skeleton className="h-[200px] w-full" />
                       </CardContent>
                   </Card>
               ))}
           </div>
        ) : filteredBranches.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center border rounded-lg border-dashed p-8 bg-muted/20">
                <div className="rounded-full bg-muted p-3 mb-4">
                    <Droplets className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No Branches Found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-2">
                    {branches.length === 0 
                        ? "No branch data available in the connected database." 
                        : "No branches match your current filter criteria."}
                </p>
            </div>
        ) : (
            <div className="space-y-8">
                {filteredBranches.map(branch => (
                    <div key={branch.id} className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b">
                            <MapPin className="h-5 w-5 text-primary" />
                            <h2 className="text-xl font-semibold tracking-tight">{branch.name}</h2>
                            <span className="text-sm text-muted-foreground ml-2">({branch.location})</span>
                        </div>
                        
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {branch.oilTanks && branch.oilTanks.length > 0 ? (
                                branch.oilTanks.map((tank, index) => (
                                    <Card key={tank.id || `tank-${branch.id}-${index}`} className="overflow-hidden border-t-4 border-t-primary/20 hover:border-t-primary transition-all">
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <CardTitle className="text-base">{tank.oilTypeName}</CardTitle>
                                                    <CardDescription className="text-xs mt-1">
                                                        Updated: {tank.lastUpdated?.seconds ? formatDistanceToNow(new Date(tank.lastUpdated.seconds * 1000), { addSuffix: true }) : 'Never'}
                                                    </CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="p-4 pt-0">
                                                <Tank3DVisualization tank={tank} />
                                            </div>
                                            <div className="bg-muted/30 p-3 grid grid-cols-2 gap-2 text-xs border-t">
                                                <div>
                                                    <span className="text-muted-foreground block">Capacity</span>
                                                    <span className="font-medium">{tank.capacity.toLocaleString()} L</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground block">Current</span>
                                                    <span className="font-medium">{tank.currentLevel.toLocaleString()} L</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground block">Fill %</span>
                                                    <span className={`font-medium ${(tank.currentLevel/tank.capacity) < 0.3 ? 'text-red-600' : 'text-green-600'}`}>
                                                        {((tank.currentLevel/tank.capacity)*100).toFixed(1)}%
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground block">Updated By</span>
                                                    <span className="font-medium truncate">{tank.lastUpdatedBy || 'System'}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            ) : (
                                <div className="col-span-full py-8 text-center text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                                    No tanks configured for this branch.
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </main>
    </div>
  );
}
