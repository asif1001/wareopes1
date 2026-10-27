"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Lock, Unlock, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { MonthReport, Mismatch } from "@/lib/attendance/report";
import { parseContractorSheet } from "@/lib/attendance/sheet";
import type { AttendanceDay, OvertimeRequest } from "@/lib/attendance/types";
import { api, errorMessage } from "./api";
import { useAttendance } from "./context";
import { exportMonthWorkbook, readSheet } from "./excel";
import { hours, thisMonth } from "./format";

type Report = MonthReport & { lock: { locked: boolean; autoLockDate: string; doc: { unlockReason?: string | null } | null } };

const MISMATCH_LABELS: Record<Mismatch["kind"], string> = {
  UNKNOWN_STAFF: "Staff code not in our system",
  NOT_IN_OUR_RECORDS: "Contractor says present, we have no record",
  NOT_IN_CONTRACTOR_SHEET: "We have them present, contractor sheet has no line",
  PRESENCE_MISMATCH: "Present / absent differs",
  HOURS_MISMATCH: "Regular hours differ",
  OT_MISMATCH: "Overtime differs (ours = approved only)",
};

export function ReportsTab() {
  const { contractors, staffById, contractorName, userName, me } = useAttendance();
  const { toast } = useToast();
  const [month, setMonth] = useState(thisMonth());
  const [contractorId, setContractorId] = useState("ALL");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [mismatches, setMismatches] = useState<Mismatch[] | null>(null);
  const [comparing, setComparing] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const query = `month=${month}${contractorId !== "ALL" ? `&contractorId=${contractorId}` : ""}`;

  const load = useCallback(async () => {
    setLoading(true);
    setMismatches(null);
    try {
      const res = await api<{ report: Report }>(`/reports/month?${query}`);
      setReport(res.report);
    } catch (error) {
      toast({ variant: "destructive", title: "Could not load the report", description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [query, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportExcel() {
    if (!report) return;
    setExporting(true);
    try {
      const [days, ot] = await Promise.all([
        api<{ items: AttendanceDay[] }>(`/days?month=${month}`),
        api<{ items: OvertimeRequest[] }>(`/overtime?month=${month}&status=APPROVED`),
      ]);
      const ids = new Set(report.staff.map((s) => s.staffId));
      await exportMonthWorkbook({
        report,
        days: days.items.filter((d) => ids.has(d.staffId)),
        overtime: ot.items.filter((o) => ids.has(o.staffId)),
        staff: (id) => {
          const s = staffById.get(id);
          return s ? { staffCode: s.staffCode, name: s.name, contractor: contractorName(s.contractorId) } : undefined;
        },
        userName: (id) => userName(id),
        generatedBy: userName(me?.userId),
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Export failed", description: errorMessage(error) });
    } finally {
      setExporting(false);
    }
  }

  async function compare(file: File) {
    setComparing(true);
    try {
      const records = await readSheet(file);
      const parsed = parseContractorSheet(records, month);
      if (parsed.layout === "unknown" || !parsed.rows.length) {
        toast({
          variant: "destructive",
          title: "Could not read the sheet",
          description: "Need a staff code column and either a date column or day columns 1–31.",
        });
        return;
      }
      const res = await api<{ mismatches: Mismatch[]; rowsChecked: number }>("/reports/compare", {
        method: "POST",
        body: { month, contractorId: contractorId !== "ALL" ? contractorId : undefined, rows: parsed.rows },
      });
      setMismatches(res.mismatches);
      toast({
        title: `Checked ${res.rowsChecked} lines`,
        description: `${res.mismatches.length} mismatches${parsed.skipped ? ` · ${parsed.skipped} lines skipped` : ""}`,
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Comparison failed", description: errorMessage(error) });
    } finally {
      setComparing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function setLock(action: "lock" | "unlock") {
    try {
      await api("/month-lock", { method: "POST", body: { month, action, reason: unlockReason } });
      toast({ title: action === "lock" ? `${month} locked` : `${month} unlocked` });
      setUnlockReason("");
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: "Could not change the lock", description: errorMessage(error) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <div className="text-sm text-muted-foreground">Month</div>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Contractor</div>
          <Select value={contractorId} onValueChange={setContractorId}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All contractors</SelectItem>
              {contractors.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {me?.canExport && (
          <Button onClick={() => void exportExcel()} disabled={!report || exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download Excel
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && void compare(e.target.files[0])}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={comparing}>
          {comparing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Compare contractor sheet
        </Button>
        {loading && <Loader2 className="mb-2 h-4 w-4 animate-spin" />}
      </div>

      {report && (
        <Alert variant={report.lock.locked ? "default" : "destructive"}>
          {report.lock.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          <AlertTitle>{report.lock.locked ? `${month} is locked` : `${month} is open`}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              {report.lock.locked
                ? "No edits are possible. An admin can unlock it with a reason; the unlock is logged."
                : `Figures can still change. It locks automatically on ${report.lock.autoLockDate}.`}
            </p>
            {me?.canEdit && !report.lock.locked && (
              <Button size="sm" variant="outline" onClick={() => void setLock("lock")}>
                Lock now
              </Button>
            )}
            {me?.isAdmin && report.lock.locked && (
              <div className="flex flex-wrap items-end gap-2">
                <Textarea className="h-10 max-w-md" placeholder="Reason for unlocking (required)" value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} />
                <Button size="sm" variant="outline" disabled={unlockReason.trim().length < 3} onClick={() => void setLock("unlock")}>
                  Unlock
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {mismatches && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contractor sheet vs our records</CardTitle>
            <CardDescription>{mismatches.length === 0 ? "No mismatches." : `${mismatches.length} mismatches, by staff and date.`}</CardDescription>
          </CardHeader>
          {mismatches.length > 0 && (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Problem</TableHead>
                    <TableHead>Contractor</TableHead>
                    <TableHead>Ours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mismatches.map((m, i) => (
                    <TableRow key={`${m.staffCode}-${m.date}-${m.kind}-${i}`}>
                      <TableCell>{m.staffCode}</TableCell>
                      <TableCell>{m.date}</TableCell>
                      <TableCell>{MISMATCH_LABELS[m.kind]}</TableCell>
                      <TableCell className="text-xs">
                        {m.contractor ? `${m.contractor.status ?? ""} ${m.contractor.hours ?? ""}h${m.contractor.otHours != null ? ` · OT ${m.contractor.otHours}h` : ""}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {m.ours ? `${m.ours.status} ${m.ours.regularHours}h · OT ${m.ours.approvedOtHours}h` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      )}

      {report && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Per contractor</CardTitle>
              <CardDescription>Only approved overtime is counted.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contractor</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>Regular h</TableHead>
                    <TableHead>OT weekday</TableHead>
                    <TableHead>OT Friday</TableHead>
                    <TableHead>OT holiday</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.contractors.map((c) => (
                    <TableRow key={c.contractorId}>
                      <TableCell>{c.contractorName}</TableCell>
                      <TableCell>{c.staffCount}</TableCell>
                      <TableCell>{c.daysPresent}</TableCell>
                      <TableCell>{c.daysLate}</TableCell>
                      <TableCell>{c.daysAbsent}</TableCell>
                      <TableCell>{hours(c.regularMinutes)}</TableCell>
                      <TableCell>{hours(c.otMinutes.WEEKDAY)}</TableCell>
                      <TableCell>{hours(c.otMinutes.FRIDAY)}</TableCell>
                      <TableCell>{hours(c.otMinutes.HOLIDAY)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Per staff</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>Leave</TableHead>
                    <TableHead>Missing</TableHead>
                    <TableHead>Regular h</TableHead>
                    <TableHead>OT h (W / F / H)</TableHead>
                    <TableHead>Exceptions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.staff.map((r) => (
                    <TableRow key={r.staffId}>
                      <TableCell>
                        <div className="font-medium">{r.staffCode}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.name} · {r.contractorName}
                        </div>
                      </TableCell>
                      <TableCell>{r.daysPresent}</TableCell>
                      <TableCell>{r.daysLate}</TableCell>
                      <TableCell>{r.daysAbsent}</TableCell>
                      <TableCell>{r.daysLeave}</TableCell>
                      <TableCell>{r.daysMissingIn + r.daysMissingOut}</TableCell>
                      <TableCell>{hours(r.regularMinutes)}</TableCell>
                      <TableCell>
                        {hours(r.otMinutes.WEEKDAY)} / {hours(r.otMinutes.FRIDAY)} / {hours(r.otMinutes.HOLIDAY)}
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="flex flex-wrap gap-1">
                          {r.exceptions.slice(0, 6).map((e) => (
                            <Badge key={e.date} variant="outline" className="text-[11px]">
                              {e.date.slice(8)} {e.status.replace("_", " ").toLowerCase()}
                            </Badge>
                          ))}
                          {r.exceptions.length > 6 && <span className="text-xs">+{r.exceptions.length - 6}</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
