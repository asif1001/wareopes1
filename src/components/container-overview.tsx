
'use client';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import type { ClearedContainerSummary } from '@/lib/types';
import { Badge } from './ui/badge';

const chartConfig = {
  containers: {
    label: 'Containers',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

export function ContainerOverview({ data }: { data: ClearedContainerSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Container Overview</CardTitle>
        <CardDescription>Monthly cleared container volume</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart data={data.monthlyData} margin={{ left: -20, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
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
          Total Cleared Containers: <Badge variant="secondary">{data.totalContainers}</Badge>
        </div>
        <div className="leading-none">
            <p className="font-medium mb-2">Source Breakdown:</p>
            <div className="flex flex-wrap gap-2">
                {Object.entries(data.sourceData).map(([source, count]) => (
                    <Badge key={source} variant="outline">{source}: {count}</Badge>
                ))}
            </div>
        </div>
      </CardFooter>
    </Card>
  );
}
