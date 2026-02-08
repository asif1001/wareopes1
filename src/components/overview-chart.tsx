"use client";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ClearedShipmentSummary } from "@/lib/types";

const chartConfig = {
  domLines: {
    label: "DOM Lines",
    color: "hsl(var(--chart-1))",
  },
  bulkLines: {
    label: "Bulk Lines",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function OverviewChart({ data }: { data: ClearedShipmentSummary }) {
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  // Memoize the available data based on period
  const chartData = useMemo(() => {
    if (!data) return [];
    
    // Select base dataset
    let baseData: any[] = [];
    let sourceMap: any = {};

    if (period === 'week') {
        baseData = data.weeklyData || [];
        sourceMap = data.bySource?.weekly || {};
    } else if (period === 'year') {
        baseData = data.yearlyData || [];
        sourceMap = data.bySource?.yearly || {};
    } else {
        baseData = data.monthlyData || [];
        sourceMap = data.bySource?.monthly || {};
    }

    // Filter logic
    if (selectedSources.length === 0) {
        return baseData;
    }

    // Key name based on period
    const keyName = period === 'week' ? 'week' : period === 'year' ? 'year' : 'month';

    // Aggregate selected sources
    // Instead of re-aggregating, we can map over baseData keys to ensure consistent X-axis
    // But baseData contains ALL sources aggregated.
    // If we select specific sources, we should sum them up.
    
    // Create a map of key -> { dom, bulk }
    const aggregated: Record<string, { domLines: number, bulkLines: number }> = {};
    
    // Initialize with 0 for all keys present in baseData to maintain x-axis continuity?
    // Or only show keys present in selected sources?
    // Usually, charts keep the timeline consistent. Let's use baseData keys as the "timeline".
    
    baseData.forEach((item) => {
        aggregated[item[keyName]] = { domLines: 0, bulkLines: 0 };
    });

    selectedSources.forEach(src => {
        const srcData = sourceMap[src] || [];
        srcData.forEach((item: any) => {
            const key = item[keyName];
            if (aggregated[key]) {
                aggregated[key].domLines += item.domLines;
                aggregated[key].bulkLines += item.bulkLines;
            }
        });
    });

    // Convert back to array
    return baseData.map((item) => {
        const key = item[keyName];
        return {
            [keyName]: key,
            domLines: aggregated[key].domLines,
            bulkLines: aggregated[key].bulkLines
        };
    });

  }, [data, period, selectedSources]);

  const allSources = useMemo(() => {
    return Object.keys(data?.sourceData ?? {});
  }, [data]);

  // Formatter for XAxis
  const formatXAxis = (tick: string) => {
      if (period === 'week') {
          // tick is "w yyyy" e.g. "1 2024"
          const parts = tick.split(' ');
          if (parts.length >= 1) {
             return `W${parts[0]}`; 
          }
      }
      return tick;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Shipment Overview</CardTitle>
            <CardDescription>
                {period === 'week' ? 'Weekly' : period === 'year' ? 'Yearly' : 'Monthly'} DOM vs. Bulk lines for cleared shipments
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 rounded-md border bg-muted p-0.5 text-xs">
            <button
              type="button"
              className={`rounded-sm px-2 py-1 ${period === "week" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              onClick={() => setPeriod("week")}
            >
              Week
            </button>
            <button
              type="button"
              className={`rounded-sm px-2 py-1 ${period === "month" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              onClick={() => setPeriod("month")}
            >
              Months
            </button>
            <button
              type="button"
              className={`rounded-sm px-2 py-1 ${period === "year" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              onClick={() => setPeriod("year")}
            >
              Years
            </button>
          </div>
        </div>
        <div className="mt-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  Sources
                  {selectedSources.length > 0 && (
                    <Badge variant="secondary" className="ml-1 rounded-sm px-1 font-normal">
                      {selectedSources.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter by Source</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={selectedSources.length === 0}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedSources([]);
                  }}
                >
                  All Sources
                </DropdownMenuCheckboxItem>
                {allSources.map((src) => (
                  <DropdownMenuCheckboxItem
                    key={src}
                    checked={selectedSources.includes(src)}
                    onCheckedChange={(checked) => {
                      setSelectedSources((prev) => {
                        if (checked) return [...prev, src];
                        return prev.filter((s) => s !== src);
                      });
                    }}
                  >
                    {src}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={chartData} margin={{ left: -20, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={period === 'week' ? 'week' : period === 'year' ? 'year' : 'month'}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={formatXAxis}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <defs>
              <linearGradient id="fillDomLines" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-domLines)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-domLines)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillBulkLines" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-bulkLines)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-bulkLines)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <Area
              dataKey="domLines"
              type="natural"
              fill="url(#fillDomLines)"
              stroke="var(--color-domLines)"
            />
            <Area
              dataKey="bulkLines"
              type="natural"
              fill="url(#fillBulkLines)"
              stroke="var(--color-bulkLines)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
