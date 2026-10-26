"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { api, errorMessage } from "./api";
import { useAttendance, type StaffRow } from "./context";
import { DEVICE_ISSUE_LABELS, fmtDateTime } from "./format";

const NONE = "__none__";

type FormState = {
  staffCode: string;
  name: string;
  contractorId: string;
  supervisorId: string;
  supervisor2Id: string;
  shiftId: string;
  geofenceIds: string[];
  pin: string;
};

const emptyForm: FormState = {
  staffCode: "",
  name: "",
  contractorId: "",
  supervisorId: "",
  supervisor2Id: NONE,
  shiftId: "",
  geofenceIds: [],
  pin: "",
};

export function StaffTab() {
  const { staff, contractors, shifts, geofences, approvers, me, manages, userName, contractorName, reload } = useAttendance();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<StaffRow | "new" | null>(null);
  const [pinFor, setPinFor] = useState<StaffRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...staff]
      .filter((s) => !q || s.staffCode.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .sort((a, b) => Number(b.active) - Number(a.active) || a.staffCode.localeCompare(b.staffCode));
  }, [staff, search]);

  async function action(row: StaffRow, body: Record<string, unknown>, done: string) {
    setBusy(row.id);
    try {
      await api(`/staff/${row.id}`, { method: "PATCH", body });
      toast({ title: done });
      await reload();
    } catch (error) {
      toast({ variant: "destructive", title: "Could not update", description: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  const shiftName = (id: string) => shifts.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search staff ID or name" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        {me?.canAdd && (
          <Button onClick={() => setEditing("new")} disabled={!contractors.length || !shifts.length}>
            <Plus className="mr-2 h-4 w-4" /> Add staff
          </Button>
        )}
        {me?.canAdd && (!contractors.length || !shifts.length) && (
          <span className="text-sm text-muted-foreground">Add a contractor and a shift in Setup first.</span>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Staff</TableHead>
            <TableHead>Contractor</TableHead>
            <TableHead>Supervisor 1</TableHead>
            <TableHead>Supervisor 2</TableHead>
            <TableHead>Shift</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => {
            const canManage = manages(s) && !!me?.canEdit;
            return (
              <TableRow key={s.id} className={s.active ? undefined : "opacity-50"}>
                <TableCell>
                  <div className="font-medium">{s.staffCode}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.name}
                    {!s.active && " · inactive"}
                  </div>
                </TableCell>
                <TableCell>{contractorName(s.contractorId)}</TableCell>
                <TableCell>{userName(s.supervisorId)}</TableCell>
                <TableCell>{s.supervisor2Id ? userName(s.supervisor2Id) : "—"}</TableCell>
                <TableCell>{shiftName(s.shiftId)}</TableCell>
                <TableCell className="max-w-[240px]">
                  {s.deviceId ? (
                    <div className="text-xs">
                      Linked {fmtDateTime(s.deviceBoundAt)}
                      {s.deviceHealth?.model && ` · ${s.deviceHealth.manufacturer ?? ""} ${s.deviceHealth.model}`}
                      {s.deviceHealth?.appVersion && ` · v${s.deviceHealth.appVersion}`}
                    </div>
                  ) : (
                    <Badge variant="outline">Not logged in yet</Badge>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.deviceIssues
                      .filter((i) => s.deviceId || i !== "NO_DATA")
                      .map((i) => (
                        <Badge key={i} variant="secondary" className="text-[11px]">
                          {DEVICE_ISSUE_LABELS[i] ?? i}
                        </Badge>
                      ))}
                  </div>
                </TableCell>
                <TableCell>
                  {canManage && (
                    <div className="flex flex-wrap justify-end gap-1">
                      {busy === s.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPinFor(s)}>
                        Set PIN
                      </Button>
                      {s.deviceId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            confirm(`Unlink ${s.name}'s phone? They can then log in on a new phone.`) &&
                            void action(s, { action: "resetDevice" }, "Phone unlinked")
                          }
                        >
                          Reset phone
                        </Button>
                      )}
                      {me?.canDelete &&
                        (s.active ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => confirm(`Deactivate ${s.name}? They will be logged out.`) && void action(s, { action: "deactivate" }, "Staff deactivated")}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => void action(s, { action: "activate" }, "Staff activated")}>
                            Activate
                          </Button>
                        ))}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <StaffDialog
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await reload();
        }}
        contractors={contractors}
        shifts={shifts}
        geofences={geofences}
        approvers={approvers}
      />
      <PinDialog
        staff={pinFor}
        onClose={() => setPinFor(null)}
        onSave={async (pin) => {
          if (!pinFor) return;
          await action(pinFor, { action: "setPin", pin }, "PIN changed — the staff member must log in again");
          setPinFor(null);
        }}
      />
    </div>
  );
}

function StaffDialog({
  target,
  onClose,
  onSaved,
  contractors,
  shifts,
  geofences,
  approvers,
}: {
  target: StaffRow | "new" | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  contractors: { id: string; name: string; active: boolean }[];
  shifts: { id: string; name: string; startTime: string; endTime: string; active: boolean }[];
  geofences: { id: string; name: string; active: boolean }[];
  approvers: { id: string; name: string; role: string }[];
}) {
  const { toast } = useToast();
  const isNew = target === "new";
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [lastTarget, setLastTarget] = useState<typeof target>(null);

  if (target !== lastTarget) {
    setLastTarget(target);
    if (target && target !== "new") {
      setForm({
        staffCode: target.staffCode,
        name: target.name,
        contractorId: target.contractorId,
        supervisorId: target.supervisorId,
        supervisor2Id: target.supervisor2Id ?? NONE,
        shiftId: target.shiftId,
        geofenceIds: target.geofenceIds ?? [],
        pin: "",
      });
    } else if (target === "new") {
      setForm(emptyForm);
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setSaving(true);
    const fields = {
      staffCode: form.staffCode,
      name: form.name,
      contractorId: form.contractorId,
      supervisorId: form.supervisorId,
      supervisor2Id: form.supervisor2Id === NONE ? null : form.supervisor2Id,
      shiftId: form.shiftId,
      geofenceIds: form.geofenceIds,
    };
    try {
      if (isNew) await api("/staff", { method: "POST", body: { ...fields, pin: form.pin } });
      else if (target) await api(`/staff/${target.id}`, { method: "PATCH", body: { action: "update", changes: fields } });
      toast({ title: isNew ? "Staff added" : "Staff updated" });
      await onSaved();
    } catch (error) {
      toast({ variant: "destructive", title: "Could not save", description: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  const valid =
    form.staffCode.trim() &&
    form.name.trim() &&
    form.contractorId &&
    form.supervisorId &&
    form.shiftId &&
    form.supervisor2Id !== form.supervisorId &&
    (!isNew || /^\d{4,8}$/.test(form.pin));

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add staff" : "Edit staff"}</DialogTitle>
          <DialogDescription>
            Only Supervisor 1, Supervisor 2 and admins can see, correct and approve this person. The phone is linked on first login.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Staff ID">
            <Input value={form.staffCode} onChange={(e) => set("staffCode", e.target.value)} placeholder="e.g. AC-1023" />
          </Field>
          <Field label="Name">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Contractor">
            <Pick value={form.contractorId} onChange={(v) => set("contractorId", v)} options={contractors.filter((c) => c.active).map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
          <Field label="Shift">
            <Pick
              value={form.shiftId}
              onChange={(v) => set("shiftId", v)}
              options={shifts.filter((s) => s.active).map((s) => ({ value: s.id, label: `${s.name} (${s.startTime}–${s.endTime})` }))}
            />
          </Field>
          <Field label="Supervisor 1">
            <Pick value={form.supervisorId} onChange={(v) => set("supervisorId", v)} options={approvers.map((a) => ({ value: a.id, label: `${a.name}${a.role ? ` · ${a.role}` : ""}` }))} />
          </Field>
          <Field label="Supervisor 2 (optional)">
            <Pick
              value={form.supervisor2Id}
              onChange={(v) => set("supervisor2Id", v)}
              options={[{ value: NONE, label: "None" }, ...approvers.filter((a) => a.id !== form.supervisorId).map((a) => ({ value: a.id, label: `${a.name}${a.role ? ` · ${a.role}` : ""}` }))]}
            />
          </Field>
          {isNew && (
            <Field label="First PIN (4–8 digits)">
              <Input inputMode="numeric" value={form.pin} onChange={(e) => set("pin", e.target.value.replace(/\D/g, ""))} />
            </Field>
          )}
          <div className="space-y-1 sm:col-span-2">
            <Label>Work sites (none ticked = all sites)</Label>
            <div className="flex flex-wrap gap-3">
              {geofences.filter((g) => g.active).map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.geofenceIds.includes(g.id)}
                    onCheckedChange={(checked) =>
                      set("geofenceIds", checked ? [...form.geofenceIds, g.id] : form.geofenceIds.filter((id) => id !== g.id))
                    }
                  />
                  {g.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!valid || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PinDialog({ staff, onClose, onSave }: { staff: StaffRow | null; onClose: () => void; onSave: (pin: string) => Promise<void> }) {
  const [pin, setPin] = useState("");
  return (
    <Dialog open={!!staff} onOpenChange={(open) => !open && (setPin(""), onClose())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set PIN for {staff?.name}</DialogTitle>
          <DialogDescription>Give the new PIN to the staff member in person. Their current session ends.</DialogDescription>
        </DialogHeader>
        <Input inputMode="numeric" placeholder="4–8 digits" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        <DialogFooter>
          <Button
            disabled={!/^\d{4,8}$/.test(pin)}
            onClick={async () => {
              await onSave(pin);
              setPin("");
            }}
          >
            Save PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function Pick({ value, onChange, options, placeholder = "Choose…" }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
