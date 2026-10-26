"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { OvertimeEventSummary } from "@/lib/attendance/overtime";
import type { OvertimeRequest } from "@/lib/attendance/types";
import { api, errorMessage } from "./api";
import { useAttendance } from "./context";
import { FlagBadges } from "./day-review-dialog";
import { fmtDateTime, fmtMinutes, fmtTime, mapsLink, thisMonth } from "./format";

type OtRow = OvertimeRequest & { inEvent: OvertimeEventSummary | null; outEvent: OvertimeEventSummary | null };
type Filter = "WAITING" | "PENDING" | "AUTO_CLOSED" | "APPROVED" | "REJECTED" | "ALL";

export function OvertimeTab() {
  const { staffById, manages, me, userName } = useAttendance();
  const { toast } = useToast();
  const [month, setMonth] = useState(thisMonth());
  const [filter, setFilter] = useState<Filter>("WAITING");
  const [items, setItems] = useState<OtRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<OtRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = filter === "ALL" || filter === "WAITING" ? "" : `&status=${filter}`;
      const res = await api<{ items: OtRow[] }>(`/overtime?month=${month}${status}`);
      setItems(
        filter === "WAITING" ? res.items.filter((o) => (o.status === "PENDING" || o.status === "AUTO_CLOSED")) : res.items,
      );
    } catch (error) {
      toast({ variant: "destructive", title: "Could not load overtime", description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [month, filter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <div className="text-sm text-muted-foreground">Month</div>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Show</div>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WAITING">Waiting for decision</SelectItem>
              <SelectItem value="AUTO_CLOSED">Auto-closed</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="ALL">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {loading && <Loader2 className="mb-2 h-4 w-4 animate-spin" />}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Staff</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>OT In → Out</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                Nothing here.
              </TableCell>
            </TableRow>
          )}
          {items.map((o) => {
            const staff = staffById.get(o.staffId);
            return (
              <TableRow key={o.id}>
                <TableCell>
                  <div className="font-medium">{staff?.staffCode}</div>
                  <div className="text-xs text-muted-foreground">{staff?.name}</div>
                </TableCell>
                <TableCell>{o.date}</TableCell>
                <TableCell>
                  {fmtTime(o.otIn)} → {o.otOut ? fmtTime(o.otOut) : <Badge variant="outline">in progress</Badge>}
                </TableCell>
                <TableCell>{fmtMinutes(o.minutes)}</TableCell>
                <TableCell>{o.rateType}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={o.status === "APPROVED" ? "default" : o.status === "REJECTED" ? "outline" : "destructive"}>
                      {o.status.replace("_", " ")}
                    </Badge>
                    {o.escalatedAt && !o.decidedAt && <Badge variant="destructive">Over 48 h</Badge>}
                    {o.reminderAt && !o.escalatedAt && !o.decidedAt && <Badge variant="secondary">Over 24 h</Badge>}
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-xs">{o.reason || "—"}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setSelected(o)}>
                    {manages(staff) && me?.canEdit && o.otOut && (o.status === "PENDING" || o.status === "AUTO_CLOSED") ? "Review" : "View"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <DecisionDialog
        ot={selected}
        canDecide={!!selected && !!me?.canEdit && manages(staffById.get(selected.staffId))}
        showPhotos={!!selected && manages(staffById.get(selected.staffId))}
        userName={userName}
        onClose={() => setSelected(null)}
        onDone={() => {
          setSelected(null);
          void load();
        }}
      />
    </div>
  );
}

function DecisionDialog({
  ot,
  canDecide,
  showPhotos,
  userName,
  onClose,
  onDone,
}: {
  ot: OtRow | null;
  canDecide: boolean;
  showPhotos: boolean;
  userName: (id: string | null) => string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNote("");
    setMinutes(ot?.minutes != null ? String(ot.minutes) : "");
  }, [ot]);

  const undecided = ot && ot.otOut && (ot.status === "PENDING" || ot.status === "AUTO_CLOSED");

  async function decide(action: "APPROVE" | "REJECT" | "EDIT") {
    if (!ot) return;
    setSaving(true);
    try {
      await api(`/overtime/${ot.id}`, {
        method: "POST",
        body: { action, note, ...(action === "EDIT" ? { minutes: Number(minutes) } : {}) },
      });
      toast({ title: action === "REJECT" ? "Overtime rejected" : "Overtime approved" });
      onDone();
    } catch (error) {
      toast({ variant: "destructive", title: "Could not save", description: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  const edited = minutes !== "" && Number(minutes) !== (ot?.minutes ?? 0);

  return (
    <Dialog open={!!ot} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Overtime {ot?.date}</DialogTitle>
          <DialogDescription>
            {ot?.rateType} rate · claimed {fmtMinutes(ot?.claimedMinutes)} h
            {ot?.autoClosed && " · closed automatically because OT Out was missing"}
          </DialogDescription>
        </DialogHeader>
        {ot && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <EventCard title={`OT In ${fmtDateTime(ot.otIn)}`} event={ot.inEvent} showPhoto={showPhotos} />
              <EventCard title={`OT Out ${fmtDateTime(ot.otOut)}`} event={ot.outEvent} showPhoto={showPhotos} />
            </div>
            <div className="text-sm">
              <span className="font-medium">Reason from staff:</span> {ot.reason || "—"}
            </div>
            {ot.decidedAt && (
              <div className="rounded-md bg-muted p-3 text-sm">
                {ot.status} by {userName(ot.approverId)} on {fmtDateTime(ot.decidedAt)} — {ot.decisionNote}
              </div>
            )}
            {canDecide && undecided && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Minutes to pay</Label>
                    <Input type="number" min={0} step={15} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Note (required)</Label>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Approved for container unloading" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {canDecide && undecided && (
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={saving || note.trim().length < 3} onClick={() => void decide("REJECT")}>
              Reject
            </Button>
            <Button disabled={saving || note.trim().length < 3} onClick={() => void decide(edited ? "EDIT" : "APPROVE")}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {edited ? `Approve ${fmtMinutes(Number(minutes))} h` : "Approve"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventCard({ title, event, showPhoto }: { title: string; event: OvertimeEventSummary | null; showPhoto: boolean }) {
  const link = mapsLink(event?.lat, event?.lng);
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <div className="font-medium">{title}</div>
      {!event ? (
        <div className="text-muted-foreground">No event</div>
      ) : (
        <>
          <div>
            {link ? (
              <a className="underline" href={link} target="_blank" rel="noreferrer">
                {event.distanceM ?? "?"} m from site · ±{Math.round(event.accuracyM ?? 0)} m
              </a>
            ) : (
              "No GPS"
            )}
            {!event.insideGeofence && <Badge variant="destructive" className="ml-2">Outside</Badge>}
          </div>
          <FlagBadges flags={event.flags} />
          {showPhoto && event.photoRef ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/attendance/photos/${event.photoRef}`} alt="Selfie" className="h-40 w-full rounded object-cover" />
          ) : (
            <div className="text-xs text-muted-foreground">{event.photoRef ? "Selfie hidden (read-only access)" : "No selfie"}</div>
          )}
        </>
      )}
    </div>
  );
}
