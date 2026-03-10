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

  const chartData = useMemo(() => {
    const useAllSources = selectedSources.length === 0;
    let rawData: { label: string; domLines: number; bulkLines: number }[] = [];

    if (period === "month") {
      if (useAllSources) {
        rawData = data.monthlyData.map((d) => ({ label: d.month, domLines: d.domLines, bulkLines: d.bulkLines }));
      } else {
        const acc: Record<string, { domLines: number; bulkLines: number }> = {};
        for (const src of selectedSources) {
          const series = data.bySource?.monthly?.[src] || [];
          for (const item of series) {
            acc[item.month] = acc[item.month] || { domLines: 0, bulkLines: 0 };
            acc[item.month].domLines += item.domLines;
            acc[item.month].bulkLines += item.bulkLines;
          }
        }
        rawData = Object.entries(acc).map(([label, v]) => ({ label, ...v }));
        rawData.sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime());
      }
    } else if (period === "week") {
      if (useAllSources) {
        rawData = data.weeklyData.map((d) => ({ label: d.week, domLines: d.domLines, bulkLines: d.bulkLines }));
      } else {
        const acc: Record<string, { domLines: number; bulkLines: number }> = {};
        for (const src of selectedSources) {
          const series = data.bySource?.weekly?.[src] || [];
          for (const item of series) {
            acc[item.week] = acc[item.week] || { domLines: 0, bulkLines: 0 };
            acc[item.week].domLines += item.domLines;
            acc[item.week].bulkLines += item.bulkLines;
          }
        }
        rawData = Object.entries(acc).map(([label, v]) => ({ label, ...v }));
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
        rawData = data.yearlyData.map((d) => ({ label: d.year, domLines: d.domLines, bulkLines: d.bulkLines }));
      } else {
        const acc: Record<string, { domLines: number; bulkLines: number }> = {};
        for (const src of selectedSources) {
          const series = data.bySource?.yearly?.[src] || [];
          for (const item of series) {
            acc[item.year] = acc[item.year] || { domLines: 0, bulkLines: 0 };
            acc[item.year].domLines += item.domLines;
            acc[item.year].bulkLines += item.bulkLines;
          }
        }
        rawData = Object.entries(acc).map(([label, v]) => ({ label, ...v }));
        rawData.sort((a, b) => Number(a.label) - Number(b.label));
      }
    }

    return rawData;
  }, [data, period, selectedSources]);

  const allSources = useMemo(() => Object.keys(data.sourceData ?? {}), [data.sourceData]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Shipment Overview</CardTitle>
            <CardDescription>Monthly DOM vs. Bulk lines for cleared shipments</CardDescription>
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
        {!Array.isArray(data) && (
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
        )}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={chartData} margin={{ left: -20, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
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
