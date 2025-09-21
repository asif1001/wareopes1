'use client';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';

const chartConfig = {
  domLines: {
    label: 'DOM Lines',
    color: 'hsl(var(--chart-1))',
  },
  bulkLines: {
    label: 'Bulk Lines',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

export function OverviewChart({ data }: { data: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shipment Overview</CardTitle>
        <CardDescription>Monthly DOM vs. Bulk lines for cleared shipments</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data} margin={{ left: -20, right: 16, top: 8, bottom: 8 }}>
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
