"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DAY_STATUSES, type AttendanceDay, type AttendanceEvent, type Correction, type CorrectionField } from "@/lib/attendance/types";
import { api, errorMessage } from "./api";
import { useAttendance, type StaffRow } from "./context";
import { DEVICE_ISSUE_LABELS, FLAG_LABELS, fmtDateTime, fmtMinutes, fmtTime, localToIso, mapsLink, todayLocal } from "./format";

export function FlagBadges({ flags }: { flags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <Badge key={f} variant={f === "MOCK_LOCATION" || f === "ROOTED" ? "destructive" : "secondary"} className="text-[11px]">
          {FLAG_LABELS[f] ?? f}
        </Badge>
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variant = status === "PRESENT" ? "default" : status === "OFF" || status === "LEAVE" || status === "PENDING" ? "outline" : "destructive";
  return <Badge variant={variant}>{status.replace("_", " ")}</Badge>;
}

type Props = {
  staffId: string | null;
  date: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
};

export function DayReviewDialog({ staffId, date, open, onOpenChange, onChanged }: Props) {
  const { staffById, manages, me, userName, shifts } = useAttendance();
  const { toast } = useToast();
  const staff = staffId ? staffById.get(staffId) : undefined;
  const canCorrect = !!me?.canEdit && manages(staff);

  const [day, setDay] = useState<AttendanceDay | null>(null);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(false);

  const [field, setField] = useState<CorrectionField>("lastOut");
  const [time, setTime] = useState("");
  const [status, setStatus] = useState("PRESENT");
  const [leave, setLeave] = useState("true");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!staffId || !date) return;
    setLoading(true);
    try {
      const month = date.slice(0, 7);
      const [days, ev, corr] = await Promise.all([
        api<{ items: AttendanceDay[] }>(`/days?month=${month}&staffId=${encodeURIComponent(staffId)}`),
        api<{ items: AttendanceEvent[] }>(`/events?staffId=${encodeURIComponent(staffId)}&date=${date}`),
        api<{ items: Correction[] }>(`/corrections?staffId=${encodeURIComponent(staffId)}&date=${date}`),
      ]);
      setDay(days.items.find((d) => d.date === date) ?? null);
      setEvents(ev.items);
      setCorrections(corr.items);
    } catch (error) {
      toast({ variant: "destructive", title: "Could not load the day", description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [staffId, date, toast]);

  useEffect(() => {
    if (open) {
      setReason("");
      setTime("");
      void load();
    }
  }, [open, load]);

  async function save() {
    if (!staffId || !date) return;
    let newValue: string | boolean | null;
    if (field === "firstIn" || field === "lastOut") {
      if (!time) {
        newValue = null;
      } else {
        // On a night shift, an OUT earlier than the shift start is on the next calendar day.
        const shift = shifts.find((s) => s.id === staff?.shiftId);
        const nextDay = field === "lastOut" && !!shift?.crossesMidnight && time < shift.startTime;
        const d = new Date(`${date}T00:00:00Z`);
        if (nextDay) d.setUTCDate(d.getUTCDate() + 1);
        newValue = localToIso(d.toISOString().slice(0, 10), time);
      }
    } else if (field === "status") {
      newValue = status;
    } else {
      newValue = leave === "true";
    }
    setSaving(true);
    try {
      await api("/corrections", { method: "POST", body: { staffId, date, field, newValue, reason } });
      toast({ title: "Correction saved", description: "The original record is kept and the change is logged." });
      setReason("");
      await load();
      onChanged?.();
    } catch (error) {
      toast({ variant: "destructive", title: "Could not save", description: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {staff ? `${staff.staffCode} · ${staff.name}` : "Staff"} — {date}
          </DialogTitle>
          <DialogDescription>Original values are never overwritten. Corrections are listed below with who made them.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-5">
            {staff && <StaffAndPhone staff={staff} />}
            {day ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ValuesCard title="Current (used in reports)" values={day} />
                <ValuesCard title="Original from the phone" values={day.computed} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No day record yet.</p>
            )}

            <section>
              <h3 className="mb-2 font-semibold">Events</h3>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>How</TableHead>
                      <TableHead>GPS</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead>Photo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((e) => {
                      const link = mapsLink(e.lat, e.lng);
                      return (
                        <TableRow key={e.id} className={e.status === "REJECTED" ? "opacity-60" : undefined}>
                          <TableCell>{fmtDateTime(e.effectiveTime)}</TableCell>
                          <TableCell>
                            {e.type}
                            {e.status === "REJECTED" && <div className="text-xs text-destructive">{e.rejectReason}</div>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {e.source} · {e.trigger.replace("_", " ").toLowerCase()}
                          </TableCell>
                          <TableCell className="text-xs">
                            {link ? (
                              <a className="underline" href={link} target="_blank" rel="noreferrer">
                                {e.distanceM ?? "?"} m · ±{Math.round(e.accuracyM ?? 0)} m
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <FlagBadges flags={e.flags} />
                          </TableCell>
                          <TableCell>
                            {e.photoRef && manages(staff) ? (
                              <a href={`/api/attendance/photos/${e.photoRef}`} target="_blank" rel="noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`/api/attendance/photos/${e.photoRef}`} alt="Selfie" className="h-12 w-12 rounded object-cover" />
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </section>

            {!!day?.staffComments?.length && (
              <section>
                <h3 className="mb-2 font-semibold">Staff comments</h3>
                <ul className="space-y-1 text-sm">
                  {day.staffComments.map((c, i) => (
                    <li key={i}>
                      <span className="text-muted-foreground">{fmtDateTime(c.at)}:</span> {c.text}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {corrections.length > 0 && (
              <section>
                <h3 className="mb-2 font-semibold">Corrections</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Old → new</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {corrections.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{fmtDateTime(c.createdAt)}</TableCell>
                        <TableCell>{c.field}</TableCell>
                        <TableCell className="text-xs">
                          {show(c.oldValue)} → {show(c.newValue)}
                        </TableCell>
                        <TableCell className="text-xs">{c.reason}</TableCell>
                        <TableCell className="text-xs">{userName(c.editedBy)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            )}

            {canCorrect && (
              <section className="space-y-3 rounded-md border p-3">
                <h3 className="font-semibold">Add a correction</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>What to correct</Label>
                    <Select value={field} onValueChange={(v) => setField(v as CorrectionField)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="firstIn">IN time</SelectItem>
                        <SelectItem value="lastOut">OUT time</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="leave">Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>New value</Label>
                    {field === "firstIn" || field === "lastOut" ? (
                      <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} placeholder="Empty clears it" />
                    ) : field === "status" ? (
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_STATUSES.filter((s) => s !== "PENDING").map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select value={leave} onValueChange={setLeave}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">On leave</SelectItem>
                          <SelectItem value="false">Not on leave</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Reason (required)</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Phone battery died, confirmed on CCTV" />
                </div>
                <Button onClick={save} disabled={saving || reason.trim().length < 3}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save correction
                </Button>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function expiryBadge(date: string | null | undefined) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${todayLocal()}T00:00:00Z`)) / 86400000);
  const tone = days < 0 ? "destructive" : days <= 30 ? "secondary" : "outline";
  return (
    <Badge variant={tone}>
      {date}
      {days < 0 ? " · expired" : days <= 30 ? ` · ${days} d left` : ""}
    </Badge>
  );
}

function StaffAndPhone({ staff }: { staff: StaffRow }) {
  const { contractorName, userName } = useAttendance();
  const h = staff.deviceHealth;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1 rounded-md border p-3 text-sm">
        <div className="mb-1 font-medium">Staff</div>
        <div>CPR: {staff.cprNo ?? "—"} · expiry {expiryBadge(staff.cprExpiry)}</div>
        <div>Visa expiry: {expiryBadge(staff.visaExpiry)}</div>
        <div>Contact: {staff.phone ? <a className="underline" href={`tel:${staff.phone}`}>{staff.phone}</a> : "—"}</div>
        <div>Contract company: {contractorName(staff.contractorId)}</div>
        <div>
          Supervisors: {userName(staff.supervisorId)}
          {staff.supervisor2Id ? `, ${userName(staff.supervisor2Id)}` : ""}
        </div>
      </div>
      <div className={`space-y-1 rounded-md border p-3 text-sm ${staff.deviceIssues.length ? "border-orange-400 bg-orange-50" : ""}`}>
        <div className="mb-1 font-medium">Phone</div>
        {staff.deviceId ? (
          <>
            <div>
              {h?.manufacturer} {h?.model} {h?.osVersion ? `· ${h.osVersion}` : ""} {h?.appVersion ? `· app ${h.appVersion}` : ""}
            </div>
            <div>Last sync: {fmtDateTime(h?.lastSync)}</div>
            <div>Location permission: {h?.locationPermission ?? "—"}</div>
          </>
        ) : (
          <div className="text-muted-foreground">Not logged in on a phone yet.</div>
        )}
        <div className="flex flex-wrap gap-1 pt-1">
          {staff.deviceIssues.length ? (
            staff.deviceIssues.map((i) => (
              <Badge key={i} className="bg-orange-500 hover:bg-orange-500">
                {DEVICE_ISSUE_LABELS[i] ?? i}
              </Badge>
            ))
          ) : (
            <Badge variant="outline">No phone problems</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function show(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return fmtDateTime(value);
  return String(value);
}

function ValuesCard({ title, values }: { title: string; values: Pick<AttendanceDay, "status" | "firstIn" | "lastOut" | "regularMinutes" | "flags"> }) {
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="mb-2 font-medium">{title}</div>
      <div className="flex items-center gap-2">
        <StatusBadge status={values.status} />
        <span>
          IN {fmtTime(values.firstIn)} · OUT {fmtTime(values.lastOut)} · {fmtMinutes(values.regularMinutes)} h
        </span>
      </div>
      <div className="mt-2">
        <FlagBadges flags={values.flags} />
      </div>
    </div>
  );
}
