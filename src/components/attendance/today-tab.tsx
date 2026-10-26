"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { DailyExceptions, DayIssue } from "@/lib/attendance/exceptions";
import { api, errorMessage } from "./api";
import { DayReviewDialog, FlagBadges, StatusBadge } from "./day-review-dialog";
import { DEVICE_ISSUE_LABELS, fmtDateTime, fmtMinutes, fmtTime, todayLocal } from "./format";

export function TodayTab({ onOpenOvertime }: { onOpenOvertime: () => void }) {
  const { toast } = useToast();
  const [date, setDate] = useState(todayLocal());
  const [data, setData] = useState<DailyExceptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<{ staffId: string; date: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ exceptions: DailyExceptions }>(`/exceptions?date=${date}`);
      setData(res.exceptions);
    } catch (error) {
      toast({ variant: "destructive", title: "Could not load exceptions", description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [date, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const empty =
    data &&
    !data.missingIn.length &&
    !data.missingOut.length &&
    !data.late.length &&
    !data.earlyOut.length &&
    !data.manualIn.length &&
    !data.locationFlags.length &&
    !data.overtimePending.length &&
    !data.overtimeAutoClosed.length &&
    !data.devices.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <div className="text-sm text-muted-foreground">Date</div>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
        <p className="text-sm text-muted-foreground">Only problems are listed. Click a row to review or correct it.</p>
      </div>

      {empty && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">No problems for this day.</CardContent>
        </Card>
      )}

      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <IssueCard title="Missing IN / absent" items={data.missingIn} onOpen={setReview} />
          <IssueCard title="Missing OUT" items={data.missingOut} onOpen={setReview} />
          <IssueCard title="Late arrivals" items={data.late} onOpen={setReview} />
          <IssueCard title="Left early" items={data.earlyOut} onOpen={setReview} />
          <IssueCard title="Manual check-ins (review selfie)" items={data.manualIn} onOpen={setReview} />
          <IssueCard title="Location warnings (fake GPS, outside area…)" items={data.locationFlags} onOpen={setReview} />

          {(data.overtimePending.length > 0 || data.overtimeAutoClosed.length > 0 || data.overtimeInProgress.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Overtime waiting</CardTitle>
                <CardDescription>
                  {data.overtimePending.length} pending · {data.overtimeAutoClosed.length} auto-closed · {data.overtimeInProgress.length} in progress
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {[...data.overtimeAutoClosed, ...data.overtimePending].slice(0, 8).map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2">
                    <span>
                      {o.staff.staffCode} · {o.staff.name} · {o.date} {fmtTime(o.otIn)}–{fmtTime(o.otOut)} ({fmtMinutes(o.minutes)} h)
                    </span>
                    <span className="flex gap-1">
                      {o.status === "AUTO_CLOSED" && <Badge variant="destructive">Auto-closed</Badge>}
                      {o.escalatedAt ? <Badge variant="destructive">Over 48 h</Badge> : o.reminderAt ? <Badge variant="secondary">Over 24 h</Badge> : null}
                    </span>
                  </div>
                ))}
                <Button size="sm" variant="link" className="px-0" onClick={onOpenOvertime}>
                  Open overtime approvals →
                </Button>
              </CardContent>
            </Card>
          )}

          {data.devices.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Phone problems</CardTitle>
                <CardDescription>Fix these so check-in keeps working automatically.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.devices.map((d) => (
                  <div key={d.staff.id}>
                    <div className="font-medium">
                      {d.staff.staffCode} · {d.staff.name}
                      {d.health?.lastSync && <span className="ml-2 text-xs text-muted-foreground">last sync {fmtDateTime(d.health.lastSync)}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {d.issues.map((i) => (
                        <Badge key={i} variant="outline">
                          {DEVICE_ISSUE_LABELS[i] ?? i}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <DayReviewDialog
        staffId={review?.staffId ?? null}
        date={review?.date ?? null}
        open={!!review}
        onOpenChange={(open) => !open && setReview(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}

function IssueCard({ title, items, onOpen }: { title: string; items: DayIssue[]; onOpen: (r: { staffId: string; date: string }) => void }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {title} <Badge variant="secondary">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map(({ staff, day }) => (
          <button
            key={`${staff.id}-${day.date}`}
            type="button"
            onClick={() => onOpen({ staffId: staff.id, date: day.date })}
            className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted"
          >
            <span>
              <span className="font-medium">{staff.staffCode}</span> · {staff.name}
              <span className="ml-2 text-muted-foreground">
                IN {fmtTime(day.firstIn)} · OUT {fmtTime(day.lastOut)}
              </span>
              {day.staffComments?.length ? <span className="ml-2 text-xs">💬 {day.staffComments.length}</span> : null}
            </span>
            <span className="flex items-center gap-1">
              <StatusBadge status={day.status} />
              <FlagBadges flags={day.flags.filter((f) => f !== "LATE" && f !== "MISSING_IN" && f !== "MISSING_OUT")} />
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
