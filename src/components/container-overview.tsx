"use client";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import type { ClearedContainerSummary } from "@/lib/types";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const chartConfig = {
  containers: {
    label: "Containers",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function ContainerOverview({ data }: { data: ClearedContainerSummary }) {
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

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

    const keyName = period === 'week' ? 'week' : period === 'year' ? 'year' : 'month';

    // Aggregate selected sources
    const aggregated: Record<string, number> = {};
    
    // Initialize with 0
    baseData.forEach((item) => {
        aggregated[item[keyName]] = 0;
    });

    selectedSources.forEach(src => {
        const srcData = sourceMap[src] || [];
        srcData.forEach((item: any) => {
            const key = item[keyName];
            if (aggregated[key] !== undefined) {
                aggregated[key] += item.containers;
            } else {
                 // If baseData is missing this key (shouldn't happen if base covers all), add it?
                 // For now, assume baseData covers the timeline.
            }
        });
    });

    return baseData.map((item) => {
        const key = item[keyName];
        return {
            [keyName]: key,
            containers: aggregated[key] ?? 0
        };
    });
  }, [data, period, selectedSources]);

  const allSources = useMemo(() => Object.keys(data.sourceData), [data.sourceData]);
  
  const totalForSelection = useMemo(() => {
    if (selectedSources.length === 0) return data.totalContainers;
    return selectedSources.reduce((sum, s) => sum + (data.sourceData[s] ?? 0), 0);
  }, [selectedSources, data.sourceData, data.totalContainers]);

  const formatXAxis = (tick: string) => {
      if (period === 'week') {
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
            <CardTitle>Container Overview</CardTitle>
            <CardDescription>
                {period === 'week' ? 'Weekly' : period === 'year' ? 'Yearly' : 'Monthly'} cleared container volume
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
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart data={chartData} margin={{ left: -20, right: 16, top: 8, bottom: 8 }}>
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
            <Bar dataKey="containers" fill="var(--color-containers)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-4 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          Total Cleared Containers: <Badge variant="secondary">{totalForSelection}</Badge>
        </div>
        <div className="leading-none">
            <p className="font-medium mb-2">Source Breakdown:</p>
            <div className="flex flex-wrap gap-2">
                {(selectedSources.length ? Object.entries(data.sourceData).filter(([s]) => selectedSources.includes(s)) : Object.entries(data.sourceData)).map(([source, count]) => (
                    <Badge key={source} variant="outline">{source}: {count}</Badge>
                ))}
            </div>
        </div>
      </CardFooter>
    </Card>
  );
}
