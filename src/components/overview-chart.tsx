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

export function OverviewChart({ data }: { data: any }) {
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const monthlyDataAll = useMemo(() => {
    if (Array.isArray(data)) return data as Array<{ month: string; domLines: number; bulkLines: number }>;
    return (data?.monthlyData ?? []) as Array<{ month: string; domLines: number; bulkLines: number }>;
  }, [data]);

  const monthlyBySource = useMemo(() => {
    if (Array.isArray(data)) return {} as Record<string, Array<{ month: string; domLines: number; bulkLines: number }>>;
    return (data?.monthlyBySource ?? {}) as Record<string, Array<{ month: string; domLines: number; bulkLines: number }>>;
  }, [data]);

  const allSources = useMemo(() => {
    if (Array.isArray(data)) return [] as string[];
    return Object.keys(data?.sourceData ?? {});
  }, [data]);

  const baseMonthly = useMemo(() => {
    if (selectedSources.length === 0 || !monthlyBySource || Object.keys(monthlyBySource).length === 0) {
      return monthlyDataAll;
    }
    const acc: Record<string, { domLines: number; bulkLines: number }> = {};
    for (const src of selectedSources) {
      const series = monthlyBySource[src] || [];
      for (const item of series) {
        acc[item.month] = acc[item.month] || { domLines: 0, bulkLines: 0 };
        acc[item.month].domLines += item.domLines;
        acc[item.month].bulkLines += item.bulkLines;
      }
    }
    const months = Object.keys(acc).sort((a, b) => {
      const da = new Date(a);
      const db = new Date(b);
      return da.getTime() - db.getTime();
    });
    return months.map((m) => ({ month: m, domLines: acc[m].domLines, bulkLines: acc[m].bulkLines }));
  }, [monthlyDataAll, monthlyBySource, selectedSources]);

  const chartData = useMemo(() => {
    if (period === "month") {
      return baseMonthly;
    }
    if (period === "week") {
      const len = baseMonthly.length;
      if (len <= 4) return baseMonthly;
      return baseMonthly.slice(len - 4);
    }
    const yearMap: Record<string, { domLines: number; bulkLines: number }> = {};
    for (const item of baseMonthly) {
      const parts = item.month.split(" ");
      const rawYear = parts[1] ?? parts[0];
      const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
      yearMap[year] = yearMap[year] || { domLines: 0, bulkLines: 0 };
      yearMap[year].domLines += item.domLines;
      yearMap[year].bulkLines += item.bulkLines;
    }
    return Object.entries(yearMap).map(([year, v]) => ({
      month: year,
      domLines: v.domLines,
      bulkLines: v.bulkLines,
    }));
  }, [baseMonthly, period]);

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
              dataKey="month"
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
