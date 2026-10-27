"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { DailyExceptions, RosterRow } from "@/lib/attendance/exceptions";
import { cn } from "@/lib/utils";
import { api, errorMessage } from "./api";
import { useAttendance } from "./context";
import { DayReviewDialog, StatusBadge } from "./day-review-dialog";
import { DEVICE_ISSUE_LABELS, FLAG_LABELS, fmtMinutes, fmtTime, todayLocal } from "./format";

type Tone = "red" | "orange" | "yellow" | "ok" | "off";

const RED_STATUSES = ["ABSENT", "MISSING_IN", "MISSING_OUT"];
const RED_FLAGS = ["MOCK_LOCATION", "ROOTED"];
const YELLOW_FLAGS = ["LATE", "EARLY_OUT", "MANUAL_IN", "OUTSIDE_GEOFENCE", "POOR_ACCURACY", "CLOCK_DRIFT"];

/** Red = missing / absent / fake GPS; orange = phone problem; yellow = late, left early, manual or GPS warning. */
export function rowTone(row: RosterRow): Tone {
  const day = row.day;
  const flags = day?.flags ?? [];
  if (day && (RED_STATUSES.includes(day.status) || flags.some((f) => RED_FLAGS.includes(f)))) return "red";
  if (row.deviceIssues.length) return "orange";
  if (day && flags.some((f) => YELLOW_FLAGS.includes(f))) return "yellow";
  if (!day || ["OFF", "LEAVE", "PENDING"].includes(day.status)) return "off";
  return "ok";
}

const TONE_ROW: Record<Tone, string> = {
  red: "bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500",
  orange: "bg-orange-50 hover:bg-orange-100 border-l-4 border-l-orange-500",
  yellow: "bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-400",
  ok: "hover:bg-muted border-l-4 border-l-green-500",
  off: "hover:bg-muted border-l-4 border-l-transparent text-muted-foreground",
};

const TONE_ORDER: Record<Tone, number> = { red: 0, orange: 1, yellow: 2, ok: 3, off: 4 };

/** Every staff member for the day in one table, coloured by the most serious problem. */
export function TodayTab() {
  const { shifts, contractorName } = useAttendance();
  const { toast } = useToast();
  const [date, setDate] = useState(todayLocal());
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [review, setReview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ exceptions: DailyExceptions }>(`/exceptions?date=${date}`);
      setRows(res.exceptions.roster);
    } catch (error) {
      toast({ variant: "destructive", title: "Could not load today's attendance", description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [date, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const shiftLabel = (id: string) => {
    const s = shifts.find((x) => x.id === id);
    return s ? `${s.startTime}–${s.endTime}` : "—";
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .map((r) => ({ row: r, tone: rowTone(r) }))
      .filter(({ tone }) => !problemsOnly || tone === "red" || tone === "orange" || tone === "yellow")
      .filter(({ row }) => !q || row.staff.staffCode.toLowerCase().includes(q) || row.staff.name.toLowerCase().includes(q) || (row.staff.cprNo ?? "").includes(q))
      .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || a.row.staff.staffCode.localeCompare(b.row.staff.staffCode));
  }, [rows, search, problemsOnly]);

  const counts = useMemo(() => {
    const c: Record<Tone, number> = { red: 0, orange: 0, yellow: 0, ok: 0, off: 0 };
    for (const r of rows) c[rowTone(r)] += 1;
    return c;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <div className="text-sm text-muted-foreground">Date</div>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
        <Input placeholder="Search name, staff code or CPR" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        <label className="flex items-center gap-2 pb-2 text-sm">
          <Checkbox checked={problemsOnly} onCheckedChange={(v) => setProblemsOnly(!!v)} />
          Problems only
        </label>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <Legend className="bg-red-500" label={`Missing IN / OUT, absent or fake GPS (${counts.red})`} />
        <Legend className="bg-orange-500" label={`Phone problem (${counts.orange})`} />
        <Legend className="bg-amber-400" label={`Late, left early, manual check-in or GPS warning (${counts.yellow})`} />
        <Legend className="bg-green-500" label={`OK (${counts.ok})`} />
        <Legend className="bg-gray-300" label={`Not started / day off / leave (${counts.off})`} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Staff</TableHead>
            <TableHead>Contract company</TableHead>
            <TableHead>Shift</TableHead>
            <TableHead>IN</TableHead>
            <TableHead>OUT</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Problems</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                {loading ? "Loading…" : "No staff to show."}
              </TableCell>
            </TableRow>
          )}
          {visible.map(({ row, tone }) => {
            const day = row.day;
            const flags = (day?.flags ?? []).filter((f) => f !== "MISSING_IN" && f !== "MISSING_OUT");
            return (
              <TableRow key={row.staff.id} className={cn("cursor-pointer", TONE_ROW[tone])} onClick={() => setReview(row.staff.id)}>
                <TableCell>
                  <div className="font-medium">{row.staff.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.staff.staffCode}
                    {row.staff.cprNo && row.staff.cprNo !== row.staff.staffCode ? ` · CPR ${row.staff.cprNo}` : ""}
                  </div>
                </TableCell>
                <TableCell>{contractorName(row.staff.contractorId)}</TableCell>
                <TableCell>{shiftLabel(row.staff.shiftId)}</TableCell>
                <TableCell className={cn(!day?.firstIn && tone === "red" && "font-semibold text-red-600")}>{day?.firstIn ? fmtTime(day.firstIn) : "—"}</TableCell>
                <TableCell className={cn(!day?.lastOut && day?.status === "MISSING_OUT" && "font-semibold text-red-600")}>
                  {day?.lastOut ? fmtTime(day.lastOut) : "—"}
                </TableCell>
                <TableCell>{day ? fmtMinutes(day.regularMinutes) : "—"}</TableCell>
                <TableCell>{day ? <StatusBadge status={day.status} /> : <span className="text-xs">—</span>}</TableCell>
                <TableCell className="max-w-[320px]">
                  <div className="flex flex-wrap gap-1">
                    {flags.map((f) => (
                      <Badge key={f} variant={RED_FLAGS.includes(f) ? "destructive" : "secondary"} className="text-[11px]">
                        {FLAG_LABELS[f] ?? f}
                      </Badge>
                    ))}
                    {row.deviceIssues.map((i) => (
                      <Badge key={i} className="bg-orange-500 text-[11px] hover:bg-orange-500">
                        {DEVICE_ISSUE_LABELS[i] ?? i}
                      </Badge>
                    ))}
                    {row.overtimeOpen && (
                      <Badge variant="outline" className="text-[11px]">
                        OT in progress
                      </Badge>
                    )}
                    {day?.staffComments?.length ? <span className="text-xs">💬 {day.staffComments.length}</span> : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <DayReviewDialog staffId={review} date={review ? date : null} open={!!review} onOpenChange={(open) => !open && setReview(null)} onChanged={() => void load()} />
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("inline-block h-3 w-3 rounded-sm", className)} />
      {label}
    </span>
  );
}
