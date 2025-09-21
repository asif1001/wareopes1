import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StatCard as StatCardType } from "@/lib/types";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function StatCard({ card }: { card: StatCardType }) {
  const { title, value, change, changeType, icon: Icon } = card;
  const isIncrease = changeType === 'increase';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className={cn("flex items-center gap-1", isIncrease ? "text-green-600" : "text-red-600")}>
            {isIncrease ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {change}
          </span>
          <span>from last month</span>
        </div>
      </CardContent>
    </Card>
  );
}
