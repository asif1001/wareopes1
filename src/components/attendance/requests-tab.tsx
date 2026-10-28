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
import type { StaffRequest } from "@/lib/attendance/requests";
import { api, errorMessage } from "./api";
import { useAttendance } from "./context";
import { fmtDateTime } from "./format";

type Filter = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "ALL";

const KIND_LABELS: Record<string, string> = {
  MISSING_IN: "Missing check-in",
  MISSING_OUT: "Missing check-out",
  WRONG_IN: "Wrong check-in time",
  WRONG_OUT: "Wrong check-out time",
};
const LEAVE_LABELS: Record<string, string> = { ANNUAL: "Annual leave", SICK: "Sick leave", EMERGENCY: "Emergency leave", OTHER: "Other leave" };

export function describeRequest(r: StaffRequest) {
  if (r.type === "CORRECTION") return `${KIND_LABELS[r.correctionKind ?? ""] ?? "Correction"}${r.time ? ` · ${r.time}` : ""}`;
  return `${LEAVE_LABELS[r.leaveType ?? ""] ?? "Leave"}${r.endDate !== r.date ? ` · ${r.date} → ${r.endDate}` : ""}`;
}

export function RequestsTab({ onChanged }: { onChanged?: () => void }) {
  const { staffById, manages, me, userName } = useAttendance();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [items, setItems] = useState<StaffRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<StaffRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ items: StaffRequest[] }>(`/requests?status=${filter}`);
      setItems(res.items);
    } catch (error) {
      toast({ variant: "destructive", title: "Could not load requests", description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <div className="text-sm text-muted-foreground">Show</div>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Waiting for decision</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="CANCELLED">Withdrawn by staff</SelectItem>
              <SelectItem value="ALL">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {loading && <Loader2 className="mb-2 h-4 w-4 animate-spin" />}
        <p className="ml-auto max-w-md text-xs text-muted-foreground">
          Staff send these from the app. Approving a time correction adds a normal correction to the day; approving leave marks the days as leave.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Staff</TableHead>
            <TableHead>Day</TableHead>
            <TableHead>Request</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Nothing here.
              </TableCell>
            </TableRow>
          )}
          {items.map((r) => {
            const staff = staffById.get(r.staffId);
            const canDecide = r.status === "PENDING" && !!me?.canApprove && manages(staff);
            return (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{staff?.name ?? r.staffId}</div>
                  <div className="text-xs text-muted-foreground">{staff?.staffCode}</div>
                </TableCell>
                <TableCell>{r.date}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="mr-1">
                    {r.type === "LEAVE" ? "Leave" : "Time"}
                  </Badge>
                  {describeRequest(r)}
                </TableCell>
                <TableCell className="max-w-[260px] truncate text-xs">{r.reason}</TableCell>
                <TableCell className="text-xs">{fmtDateTime(r.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "APPROVED" ? "default" : r.status === "PENDING" ? "destructive" : "outline"}>{r.status.toLowerCase()}</Badge>
                  {r.decidedBy && <div className="text-xs text-muted-foreground">{userName(r.decidedBy)}</div>}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setSelected(r)}>
                    {canDecide ? "Review" : "View"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <RequestDialog
        request={selected}
        staffName={selected ? (staffById.get(selected.staffId)?.name ?? "") : ""}
        canDecide={!!selected && selected.status === "PENDING" && !!me?.canApprove && manages(staffById.get(selected.staffId))}
        showPhoto={!!selected && manages(staffById.get(selected.staffId))}
        onClose={() => setSelected(null)}
        onDone={() => {
          setSelected(null);
          void load();
          onChanged?.();
        }}
      />
    </div>
  );
}

function RequestDialog({
  request,
  staffName,
  canDecide,
  showPhoto,
  onClose,
  onDone,
}: {
  request: StaffRequest | null;
  staffName: string;
  canDecide: boolean;
  showPhoto: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState<"APPROVE" | "REJECT" | null>(null);

  useEffect(() => {
    setNote("");
    setTime(request?.time ?? "");
  }, [request]);

  async function decide(decision: "APPROVE" | "REJECT") {
    if (!request) return;
    setBusy(decision);
    try {
      await api(`/requests/${request.id}`, { method: "POST", body: { decision, note: note.trim() || undefined, time: time || undefined } });
      toast({ title: decision === "APPROVE" ? "Request approved" : "Request rejected" });
      onDone();
    } catch (error) {
      toast({ variant: "destructive", title: "Not saved", description: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        {request && (
          <>
            <DialogHeader>
              <DialogTitle>
                {staffName} · {request.date}
              </DialogTitle>
              <DialogDescription>{describeRequest(request)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Reason from staff</div>
                <p className="whitespace-pre-wrap">{request.reason}</p>
              </div>
              {request.photoRef && showPhoto && (
                <a href={`/api/attendance/photos/${request.photoRef}`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/attendance/photos/${request.photoRef}`} alt="Attached photo" className="h-40 rounded object-cover" />
                </a>
              )}
              {request.decisionNote && (
                <div>
                  <div className="text-xs text-muted-foreground">Supervisor note</div>
                  <p>{request.decisionNote}</p>
                </div>
              )}
              {canDecide && (
                <>
                  {request.type === "CORRECTION" && (
                    <div className="space-y-1">
                      <Label>Correct time (local)</Label>
                      <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-36" />
                      <p className="text-xs text-muted-foreground">Required to approve. Pre-filled with the time the staff member gave.</p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label>Note to staff (required when rejecting)</Label>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {canDecide && (
                <>
                  <Button variant="destructive" disabled={!!busy || !note.trim()} onClick={() => void decide("REJECT")}>
                    {busy === "REJECT" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Reject
                  </Button>
                  <Button disabled={!!busy || (request.type === "CORRECTION" && !time)} onClick={() => void decide("APPROVE")}>
                    {busy === "APPROVE" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Approve
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
