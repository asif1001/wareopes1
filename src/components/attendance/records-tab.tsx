"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { AttendanceDay } from "@/lib/attendance/types";
import { api, errorMessage } from "./api";
import { useAttendance } from "./context";
import { DayReviewDialog, FlagBadges, StatusBadge } from "./day-review-dialog";
import { fmtMinutes, fmtTime, thisMonth } from "./format";

/** One staff member's month, day by day. */
export function RecordsTab() {
  const { staff } = useAttendance();
  const { toast } = useToast();
  const sorted = useMemo(() => [...staff].sort((a, b) => a.staffCode.localeCompare(b.staffCode)), [staff]);
  const [staffId, setStaffId] = useState<string>("");
  const [month, setMonth] = useState(thisMonth());
  const [days, setDays] = useState<AttendanceDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<string | null>(null);

  useEffect(() => {
    if (!staffId && sorted.length) setStaffId(sorted[0].id);
  }, [sorted, staffId]);

  const load = useCallback(async () => {
    if (!staffId) return;
    setLoading(true);
    try {
      const res = await api<{ items: AttendanceDay[] }>(`/days?month=${month}&staffId=${encodeURIComponent(staffId)}`);
      setDays(res.items);
    } catch (error) {
      toast({ variant: "destructive", title: "Could not load records", description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [staffId, month, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = days.reduce((sum, d) => sum + d.regularMinutes, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <div className="text-sm text-muted-foreground">Staff</div>
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Choose staff" />
            </SelectTrigger>
            <SelectContent>
              {sorted.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.staffCode} · {s.name}
                  {!s.active && " (inactive)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Month</div>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        </div>
        {loading && <Loader2 className="mb-2 h-4 w-4 animate-spin" />}
        <div className="mb-2 ml-auto text-sm">
          Regular hours this month: <span className="font-semibold">{fmtMinutes(total)}</span>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Day</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>IN</TableHead>
            <TableHead>OUT</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead>Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {days.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No records for this month yet.
              </TableCell>
            </TableRow>
          )}
          {days.map((d) => (
            <TableRow key={d.id} className="cursor-pointer" onClick={() => setReview(d.date)}>
              <TableCell>{d.date}</TableCell>
              <TableCell className="text-xs">{d.dayType.replace("_", " ").toLowerCase()}</TableCell>
              <TableCell>
                <StatusBadge status={d.status} />
              </TableCell>
              <TableCell>{fmtTime(d.firstIn)}</TableCell>
              <TableCell>{fmtTime(d.lastOut)}</TableCell>
              <TableCell>{fmtMinutes(d.regularMinutes)}</TableCell>
              <TableCell>
                <FlagBadges flags={d.flags} />
                {d.staffComments?.length ? <span className="text-xs">💬 {d.staffComments.length}</span> : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <DayReviewDialog
        staffId={staffId || null}
        date={review}
        open={!!review}
        onOpenChange={(open) => !open && setReview(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}
