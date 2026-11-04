"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Loader2, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { api, errorMessage } from "./api";
import { useAttendance, type StaffRow } from "./context";
import { DEVICE_ISSUE_LABELS, fmtDateTime, todayLocal } from "./format";
import { EmptyRow, RowActions, matches } from "./section-layout";

const NONE = "__none__";
const PASSWORD_MIN = 4;
const PASSWORD_MAX = 32;

type FormState = {
  cprNo: string;
  cprExpiry: string;
  visaExpiry: string;
  phone: string;
  staffCode: string;
  name: string;
  contractorId: string;
  supervisorId: string;
  supervisor2Id: string;
  shiftId: string;
  geofenceIds: string[];
  webCheckin: boolean;
  password: string;
};

const emptyForm: FormState = {
  cprNo: "",
  cprExpiry: "",
  visaExpiry: "",
  phone: "",
  staffCode: "",
  name: "",
  contractorId: "",
  supervisorId: "",
  supervisor2Id: NONE,
  shiftId: "",
  geofenceIds: [],
  webCheckin: false,
  password: "",
};

const validPassword = (p: string) => p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX && p.trim() === p;

function daysUntil(date: string | null | undefined) {
  if (!date) return null;
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${todayLocal()}T00:00:00Z`)) / 86400000);
}

function ExpiryLine({ label, date }: { label: string; date: string | null | undefined }) {
  const days = daysUntil(date);
  const cls = days == null ? "text-muted-foreground" : days < 0 ? "font-semibold text-red-600" : days <= 30 ? "font-semibold text-orange-600" : "";
  return (
    <div className={`text-xs ${cls}`}>
      {label}: {date ?? "—"}
      {days != null && days < 0 && " (expired)"}
      {days != null && days >= 0 && days <= 30 && ` (${days} d)`}
    </div>
  );
}

type StatusFilter = "all" | "active" | "blocked" | "problems" | "no-phone";
const ALL = "__all__";

export function StaffTab() {
  const { staff, contractors, shifts, geofences, me, manages, userName, contractorName, reload } = useAttendance();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState(ALL);
  const [site, setSite] = useState(ALL);
  const [supervisor, setSupervisor] = useState(ALL);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [showDeleted, setShowDeleted] = useState(false);
  const [editing, setEditing] = useState<StaffRow | "new" | null>(null);
  const [passwordFor, setPasswordFor] = useState<StaffRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const issuesOf = (s: StaffRow) => s.deviceIssues.filter((i) => s.deviceId || i !== "NO_DATA");
  const rows = useMemo(
    () =>
      [...staff]
        .filter((s) => showDeleted || !s.deleted)
        .filter((s) => company === ALL || s.contractorId === company)
        .filter((s) => site === ALL || s.geofenceIds?.includes(site))
        .filter((s) => supervisor === ALL || s.supervisorId === supervisor || s.supervisor2Id === supervisor)
        .filter((s) =>
          status === "all"
            ? true
            : status === "active"
              ? s.active && !s.deleted
              : status === "blocked"
                ? !s.active && !s.deleted
                : status === "problems"
                  ? issuesOf(s).length > 0
                  : !s.deviceId && !s.deleted,
        )
        .filter((s) => matches(search, s.staffCode, s.name, s.cprNo, s.phone?.replace(/\s/g, ""), contractorName(s.contractorId)))
        .sort((a, b) => Number(!!a.deleted) - Number(!!b.deleted) || Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staff, search, company, site, supervisor, status, showDeleted],
  );

  const current = staff.filter((s) => !s.deleted);
  const summary = [
    `${current.length} staff`,
    `${current.filter((s) => s.active).length} can use the app`,
    `${current.filter((s) => !s.deviceId).length} not logged in yet`,
    `${current.filter((s) => issuesOf(s).length).length} with phone problems`,
  ].join(" · ");

  async function action(row: StaffRow, body: Record<string, unknown>, done: string) {
    setBusy(row.id);
    try {
      await api(`/staff/${row.id}`, { method: "PATCH", body });
      toast({ title: done });
      await reload();
      return true;
    } catch (error) {
      toast({ variant: "destructive", title: "Could not update", description: errorMessage(error) });
      return false;
    } finally {
      setBusy(null);
    }
  }

  const shiftName = (id: string) => {
    const s = shifts.find((x) => x.id === id);
    return s ? `${s.name} (${s.startTime}–${s.endTime})` : "—";
  };
  const supervisorIds = [...new Set(staff.flatMap((s) => [s.supervisorId, s.supervisor2Id].filter((x): x is string => !!x)))];
  const filtered = company !== ALL || site !== ALL || supervisor !== ALL || status !== "all" || !!search;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name, CPR, code, phone" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <div className="w-44">
            <Pick
              value={company}
              onChange={setCompany}
              options={[{ value: ALL, label: "All companies" }, ...contractors.filter((c) => c.active).map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <div className="w-44">
            <Pick value={site} onChange={setSite} options={[{ value: ALL, label: "All sites" }, ...geofences.filter((g) => g.active).map((g) => ({ value: g.id, label: g.name }))]} />
          </div>
          <div className="w-48">
            <Pick value={supervisor} onChange={setSupervisor} options={[{ value: ALL, label: "All supervisors" }, ...supervisorIds.map((id) => ({ value: id, label: userName(id) }))]} />
          </div>
          <div className="w-44">
            <Pick
              value={status}
              onChange={(v) => setStatus(v as StatusFilter)}
              options={[
                { value: "all", label: "Any status" },
                { value: "active", label: "Can use the app" },
                { value: "blocked", label: "Access blocked" },
                { value: "problems", label: "Phone problems" },
                { value: "no-phone", label: "Not logged in yet" },
              ]}
            />
          </div>
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setCompany(ALL);
                setSite(ALL);
                setSupervisor(ALL);
                setStatus("all");
              }}
            >
              Clear filters
            </Button>
          )}
          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={showDeleted} onCheckedChange={setShowDeleted} /> Show deleted
            </label>
            {me?.canAdd && (
              <Button onClick={() => setEditing("new")} disabled={!contractors.length || !shifts.length}>
                <Plus className="mr-1 h-4 w-4" /> Add staff
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
          <span>{summary}</span>
          {filtered && <span>{rows.length} shown</span>}
          {me?.canAdd && (!contractors.length || !shifts.length) && <span>Add a contract company and a shift first (Administration).</span>}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Supervisors</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows.length && <EmptyRow colSpan={8}>{filtered ? "No staff match these filters." : "No staff yet."}</EmptyRow>}
            {rows.map((s) => {
              const canManage = manages(s) && !!me?.canEdit && !s.deleted;
              const issues = issuesOf(s);
              return (
                <TableRow key={s.id} className={s.active && !s.deleted ? undefined : "opacity-60"}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      CPR <span className="font-mono">{s.cprNo ?? "—"}</span>
                      {s.staffCode !== s.cprNo && <> · code {s.staffCode}</>}
                    </div>
                    {s.phone && (
                      <a className="text-xs text-primary underline-offset-2 hover:underline" href={`tel:${s.phone}`}>
                        {s.phone}
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{contractorName(s.contractorId)}</TableCell>
                  <TableCell className="text-sm">
                    <div>{userName(s.supervisorId)}</div>
                    {s.supervisor2Id && <div className="text-muted-foreground">{userName(s.supervisor2Id)}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{shiftName(s.shiftId)}</TableCell>
                  <TableCell>
                    <ExpiryLine label="CPR" date={s.cprExpiry} />
                    <ExpiryLine label="Visa" date={s.visaExpiry} />
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    {s.deviceId ? (
                      <div className="text-xs text-muted-foreground">
                        {s.deviceHealth?.model ? `${s.deviceHealth.manufacturer ?? ""} ${s.deviceHealth.model}` : "Linked"}
                        {s.deviceHealth?.appVersion && ` · v${s.deviceHealth.appVersion}`}
                        <div>since {fmtDateTime(s.deviceBoundAt)}</div>
                      </div>
                    ) : (
                      !s.deleted && <span className="text-xs text-muted-foreground">Not logged in yet</span>
                    )}
                    {issues.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {issues.map((i) => (
                          <Badge key={i} variant="outline" className="border-orange-300 bg-orange-50 text-[11px] text-orange-700">
                            {DEVICE_ISSUE_LABELS[i] ?? i}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.deleted ? (
                      <Badge variant="outline">Deleted</Badge>
                    ) : s.active ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
                    ) : (
                      <Badge variant="destructive">Blocked</Badge>
                    )}
                    {s.webCheckin && !s.deleted && (
                      <div className="mt-1">
                        <Badge variant="outline" className="text-[11px]">
                          iPhone page
                        </Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        {busy === s.id && <Loader2 className="h-4 w-4 animate-spin" />}
                        <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                          Edit
                        </Button>
                        <RowActions
                          actions={[
                            { label: "Change password", hidden: !me?.isAdmin, onSelect: () => setPasswordFor(s) },
                            {
                              label: "Reset phone",
                              hidden: !s.deviceId,
                              onSelect: () =>
                                confirm(`Unlink ${s.name}'s phone? They can then log in on a new phone.`) && void action(s, { action: "resetDevice" }, "Phone unlinked"),
                            },
                            s.active
                              ? {
                                  label: "Block access",
                                  hidden: !me?.canDelete,
                                  onSelect: () =>
                                    confirm(`Block ${s.name} from the app? They are logged out at once and cannot log in until you allow access again.`) &&
                                    void action(s, { action: "deactivate" }, "Access blocked"),
                                }
                              : { label: "Allow access again", onSelect: () => void action(s, { action: "activate" }, "Access allowed again") },
                            {
                              label: "Delete staff",
                              danger: true,
                              separatorBefore: true,
                              hidden: !me?.canDelete,
                              onSelect: () =>
                                confirm(
                                  `Delete ${s.name} (CPR ${s.cprNo ?? s.staffCode})?\n\nTheir app login is removed permanently and the CPR number can be registered again. Past attendance stays in the reports. This cannot be undone.`,
                                ) && void action(s, { action: "delete" }, "Staff deleted"),
                            },
                          ]}
                        />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <StaffDialog
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await reload();
        }}
      />
      <PasswordDialog
        staff={passwordFor}
        onClose={() => setPasswordFor(null)}
        onSave={async (password) => {
          if (!passwordFor) return;
          const done = await action(passwordFor, { action: "setPassword", password }, "Password changed — the staff member must log in again with the new password");
          if (done) setPasswordFor(null);
        }}
      />
    </div>
  );
}
function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="new-password" />
      <button type="button" className="absolute right-2 top-2.5 text-muted-foreground" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function StaffDialog({ target, onClose, onSaved }: { target: StaffRow | "new" | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const { contractors, shifts, geofences, approvers } = useAttendance();
  const { toast } = useToast();
  const isNew = target === "new";
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [lastTarget, setLastTarget] = useState<typeof target>(null);

  if (target !== lastTarget) {
    setLastTarget(target);
    if (target && target !== "new") {
      setForm({
        cprNo: target.cprNo ?? "",
        cprExpiry: target.cprExpiry ?? "",
        visaExpiry: target.visaExpiry ?? "",
        phone: target.phone ?? "",
        staffCode: target.staffCode,
        name: target.name,
        contractorId: target.contractorId,
        supervisorId: target.supervisorId,
        supervisor2Id: target.supervisor2Id ?? NONE,
        shiftId: target.shiftId,
        geofenceIds: target.geofenceIds ?? [],
        webCheckin: !!target.webCheckin,
        password: "",
      });
    } else if (target === "new") {
      setForm(emptyForm);
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const cprDigits = form.cprNo.replace(/\D/g, "");

  async function save() {
    setSaving(true);
    const fields = {
      cprNo: cprDigits,
      cprExpiry: form.cprExpiry || null,
      visaExpiry: form.visaExpiry || null,
      phone: form.phone.trim() || null,
      ...(form.staffCode.trim() ? { staffCode: form.staffCode.trim() } : {}),
      name: form.name,
      contractorId: form.contractorId,
      supervisorId: form.supervisorId,
      supervisor2Id: form.supervisor2Id === NONE ? null : form.supervisor2Id,
      shiftId: form.shiftId,
      geofenceIds: form.geofenceIds,
      webCheckin: form.webCheckin,
    };
    try {
      if (isNew) await api("/staff", { method: "POST", body: { ...fields, password: form.password } });
      else if (target) await api(`/staff/${target.id}`, { method: "PATCH", body: { action: "update", changes: fields } });
      toast({
        title: isNew ? "Staff added" : "Staff updated",
        description: isNew ? `App login: CPR ${cprDigits} with the password you set.` : undefined,
      });
      await onSaved();
    } catch (error) {
      toast({ variant: "destructive", title: "Could not save", description: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  const valid =
    /^\d{9}$/.test(cprDigits) &&
    form.name.trim() &&
    form.contractorId &&
    form.supervisorId &&
    form.shiftId &&
    form.supervisor2Id !== form.supervisorId &&
    (!isNew || validPassword(form.password));

  const approverOptions = approvers.map((a) => ({ value: a.id, label: `${a.name}${a.role ? ` · ${a.role}` : ""}` }));

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add staff" : "Edit staff"}</DialogTitle>
          <DialogDescription>
            The staff member logs in to the app with their CPR number and the password set here. Only Supervisor 1, Supervisor 2 and admins can see, correct and approve this
            person. The phone is linked on first login.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Contact number">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+973 3xxx xxxx" inputMode="tel" />
          </Field>
          <Field label="CPR number (app user ID)">
            <Input value={form.cprNo} onChange={(e) => set("cprNo", e.target.value)} placeholder="9 digits" inputMode="numeric" maxLength={11} />
            {form.cprNo && !/^\d{9}$/.test(cprDigits) && <p className="text-xs text-red-600">CPR number must be 9 digits</p>}
          </Field>
          <Field label="CPR expiry date">
            <Input type="date" value={form.cprExpiry} onChange={(e) => set("cprExpiry", e.target.value)} />
          </Field>
          <Field label="Visa expiry date">
            <Input type="date" value={form.visaExpiry} onChange={(e) => set("visaExpiry", e.target.value)} />
          </Field>
          <Field label="Staff / badge code (optional)">
            <Input value={form.staffCode} onChange={(e) => set("staffCode", e.target.value)} placeholder="Defaults to the CPR number" />
          </Field>
          <Field label="Contract company">
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
            <Pick value={form.supervisorId} onChange={(v) => set("supervisorId", v)} options={approverOptions} />
          </Field>
          <Field label="Supervisor 2 (optional)">
            <Pick
              value={form.supervisor2Id}
              onChange={(v) => set("supervisor2Id", v)}
              options={[{ value: NONE, label: "None" }, ...approverOptions.filter((a) => a.value !== form.supervisorId)]}
            />
          </Field>
          {isNew && (
            <Field label={`App password (${PASSWORD_MIN}–${PASSWORD_MAX} characters)`}>
              <PasswordInput value={form.password} onChange={(v) => set("password", v)} />
              <p className="text-xs text-muted-foreground">Only admins can change it later.</p>
            </Field>
          )}
          <div className="space-y-1 sm:col-span-2">
            <Label>Work sites (none ticked = all sites)</Label>
            <div className="flex flex-wrap gap-3">
              {geofences
                .filter((g) => g.active || form.geofenceIds.includes(g.id))
                .map((g) => (
                  <label key={g.id} className={`flex items-center gap-2 text-sm ${g.active ? "" : "text-destructive"}`}>
                    <Checkbox
                      checked={form.geofenceIds.includes(g.id)}
                      onCheckedChange={(checked) => set("geofenceIds", checked ? [...form.geofenceIds, g.id] : form.geofenceIds.filter((id) => id !== g.id))}
                    />
                    {g.name}
                    {!g.active && " (inactive — untick)"}
                  </label>
                ))}
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <Checkbox checked={form.webCheckin} onCheckedChange={(checked) => set("webCheckin", checked === true)} />
            <span>
              <span className="font-medium">Allow iPhone check-in</span>
              <span className="block text-xs text-muted-foreground">
                Lets this person use the iPhone check-in page (/checkin, any browser) instead of the Android app. Same three ways to check in: GPS, site QR or My QR.
              </span>
            </span>
          </label>
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

function PasswordDialog({ staff, onClose, onSave }: { staff: StaffRow | null; onClose: () => void; onSave: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const close = () => {
    setPassword("");
    setConfirmPassword("");
    onClose();
  };
  return (
    <Dialog open={!!staff} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change app password</DialogTitle>
          <DialogDescription>
            {staff?.name} (CPR {staff?.cprNo ?? staff?.staffCode}). Give the new password to the staff member in person; their phone is logged out.
          </DialogDescription>
        </DialogHeader>
        <PasswordInput value={password} onChange={setPassword} placeholder={`${PASSWORD_MIN}–${PASSWORD_MAX} characters`} />
        <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Type it again" />
        {confirmPassword && confirmPassword !== password && <p className="text-xs text-red-600">The passwords do not match</p>}
        <DialogFooter>
          <Button
            disabled={!validPassword(password) || password !== confirmPassword}
            onClick={async () => {
              await onSave(password);
              setPassword("");
              setConfirmPassword("");
            }}
          >
            Save password
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
