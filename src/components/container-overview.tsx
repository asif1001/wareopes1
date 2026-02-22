
"use client";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import type { ClearedContainerSummary } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
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
    const useAllSources = selectedSources.length === 0;

    let rawData: { label: string; containers: number }[] = [];

    if (period === "month") {
      if (useAllSources) {
        rawData = data.monthlyData.map((d) => ({ label: d.month, containers: d.containers }));
      } else {
        const acc: Record<string, number> = {};
        for (const src of selectedSources) {
          const series = data.bySource?.monthly?.[src] || [];
          for (const item of series) {
            acc[item.month] = (acc[item.month] ?? 0) + item.containers;
          }
        }
        rawData = Object.entries(acc).map(([label, containers]) => ({ label, containers }));
        rawData.sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime());
      }
    } else if (period === "week") {
      if (useAllSources) {
        rawData = data.weeklyData.map((d) => ({ label: d.week, containers: d.containers }));
      } else {
        const acc: Record<string, number> = {};
        for (const src of selectedSources) {
          const series = data.bySource?.weekly?.[src] || [];
          for (const item of series) {
            acc[item.week] = (acc[item.week] ?? 0) + item.containers;
          }
        }
        rawData = Object.entries(acc).map(([label, containers]) => ({ label, containers }));
        // Sort weeks: W1 2024
        rawData.sort((a, b) => {
          const [wa, ya] = a.label.replace("W", "").split(" ");
          const [wb, yb] = b.label.replace("W", "").split(" ");
          if (ya !== yb) return Number(ya) - Number(yb);
          return Number(wa) - Number(wb);
        });
      }
    } else {
      // year
      if (useAllSources) {
        rawData = data.yearlyData.map((d) => ({ label: d.year, containers: d.containers }));
      } else {
        const acc: Record<string, number> = {};
        for (const src of selectedSources) {
          const series = data.bySource?.yearly?.[src] || [];
          for (const item of series) {
            acc[item.year] = (acc[item.year] ?? 0) + item.containers;
          }
        }
        rawData = Object.entries(acc).map(([label, containers]) => ({ label, containers }));
        rawData.sort((a, b) => Number(a.label) - Number(b.label));
      }
    }

    return rawData;
  }, [data, period, selectedSources]);

  const allSources = useMemo(() => Object.keys(data.sourceData), [data.sourceData]);
  const totalForSelection = useMemo(() => {
    if (selectedSources.length === 0) return data.totalContainers;
    return selectedSources.reduce((sum, s) => sum + (data.sourceData[s] ?? 0), 0);
  }, [selectedSources, data.sourceData, data.totalContainers]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Container Overview</CardTitle>
            <CardDescription>Monthly cleared container volume</CardDescription>
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
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
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
