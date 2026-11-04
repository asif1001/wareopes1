"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Crosshair, Loader2, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { Contractor, Geofence, Holiday, Shift } from "@/lib/attendance/types";
import { api, errorMessage } from "./api";
import { useAttendance } from "./context";
import { mapsLink } from "./format";
import { GateSiteActions, useGateSites } from "./gate-tab";
import { EmptyRow, RowActions, SectionHeader, StatusBadge, matches } from "./section-layout";
import { Field, Pick } from "./staff-tab";

type Entity = "contractors" | "shifts" | "geofences" | "holidays";

function useSave() {
  const { reload } = useAttendance();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  async function run(path: string, method: string, body?: unknown, done = "Saved") {
    setSaving(true);
    try {
      await api(path, { method, body });
      toast({ title: done });
      await reload();
      return true;
    } catch (error) {
      toast({ variant: "destructive", title: "Could not save", description: errorMessage(error) });
      return false;
    } finally {
      setSaving(false);
    }
  }
  return { saving, run };
}

/** Activate / deactivate items in the row menu (items in use cannot be deactivated — the server explains why). */
function activeActions(entity: Entity, item: { id: string; name: string; active: boolean }, run: ReturnType<typeof useSave>["run"], can: { edit: boolean; remove: boolean }) {
  return item.active
    ? {
        label: "Deactivate",
        danger: true,
        separatorBefore: true,
        hidden: !can.remove,
        onSelect: () => confirm(`Deactivate ${item.name}? It can be activated again later.`) && void run(`/setup/${entity}/${item.id}`, "DELETE", undefined, "Deactivated"),
      }
    : { label: "Activate", separatorBefore: true, hidden: !can.edit, onSelect: () => void run(`/setup/${entity}/${item.id}`, "PATCH", { active: true }, "Activated") };
}

function Toolbar({ search, onSearch, showInactive, onShowInactive, summary }: { search: string; onSearch: (v: string) => void; showInactive?: boolean; onShowInactive?: (v: boolean) => void; summary: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b p-3">
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search…" className="pl-8" />
      </div>
      {onShowInactive && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={!!showInactive} onCheckedChange={onShowInactive} /> Show inactive
        </label>
      )}
      <span className="ml-auto text-xs text-muted-foreground">{summary}</span>
    </div>
  );
}

function FormDialog({
  open,
  title,
  description,
  onClose,
  onSave,
  valid,
  saving,
  children,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  onSave: () => void;
  valid: boolean;
  saving: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!valid || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useList<T extends { active?: boolean }>(items: T[], text: (item: T) => (string | number | null | undefined)[]) {
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const rows = useMemo(
    () => items.filter((i) => (showInactive || i.active !== false) && matches(search, ...text(i))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, search, showInactive],
  );
  const inactive = items.filter((i) => i.active === false).length;
  const summary = `${items.length - inactive} active${inactive ? ` · ${inactive} inactive` : ""}`;
  return { rows, search, setSearch, showInactive, setShowInactive, summary };
}

// ---------------------------------------------------------------------------
// Contract companies
// ---------------------------------------------------------------------------

export function CompaniesSection() {
  const { contractors, staff, me } = useAttendance();
  const { run, saving } = useSave();
  const list = useList(contractors, (c) => [c.name]);
  const [editing, setEditing] = useState<Contractor | "new" | null>(null);
  const [name, setName] = useState("");
  const open = (target: Contractor | "new") => {
    setName(target === "new" ? "" : target.name);
    setEditing(target);
  };
  const can = { edit: !!me?.canEdit, remove: !!me?.canDelete };

  async function save() {
    const ok =
      editing === "new"
        ? await run("/setup/contractors", "POST", { name }, "Contract company added")
        : editing && (await run(`/setup/contractors/${editing.id}`, "PATCH", { name }, "Contract company updated"));
    if (ok) setEditing(null);
  }

  return (
    <>
      <SectionHeader
        title="Contract companies"
        description="The manpower companies your staff belong to. Used in reports and invoice checks."
        actions={
          me?.canAdd && (
            <Button onClick={() => open("new")}>
              <Plus className="mr-1 h-4 w-4" /> Add company
            </Button>
          )
        }
      />
      <Card>
        <Toolbar search={list.search} onSearch={list.setSearch} showInactive={list.showInactive} onShowInactive={list.setShowInactive} summary={list.summary} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!list.rows.length && <EmptyRow colSpan={4}>No contract companies.</EmptyRow>}
            {list.rows.map((c) => (
              <TableRow key={c.id} className={c.active ? undefined : "opacity-60"}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{staff.filter((s) => s.contractorId === c.id && !s.deleted).length}</TableCell>
                <TableCell>
                  <StatusBadge active={c.active} />
                </TableCell>
                <TableCell className="text-right">
                  <RowActions actions={[{ label: "Edit", hidden: !can.edit, onSelect: () => open(c) }, activeActions("contractors", c, run, can)]} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <FormDialog
        open={!!editing}
        title={editing === "new" ? "Add contract company" : "Edit contract company"}
        onClose={() => setEditing(null)}
        onSave={() => void save()}
        valid={!!name.trim()}
        saving={saving}
      >
        <div className="sm:col-span-2">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Manpower" autoFocus />
          </Field>
        </div>
      </FormDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

const emptyShift = { name: "", startTime: "07:00", endTime: "16:00", graceBeforeMin: "15", graceAfterMin: "15", breakMinutes: "0" };

export function ShiftsSection() {
  const { shifts, staff, me } = useAttendance();
  const { run, saving } = useSave();
  const list = useList(shifts, (s) => [s.name, s.startTime, s.endTime]);
  const [editing, setEditing] = useState<Shift | "new" | null>(null);
  const [form, setForm] = useState(emptyShift);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const can = { edit: !!me?.canEdit, remove: !!me?.canDelete };
  const open = (target: Shift | "new") => {
    setForm(
      target === "new"
        ? emptyShift
        : {
            name: target.name,
            startTime: target.startTime,
            endTime: target.endTime,
            graceBeforeMin: String(target.graceBeforeMin),
            graceAfterMin: String(target.graceAfterMin),
            breakMinutes: String(target.breakMinutes),
          },
    );
    setEditing(target);
  };

  async function save() {
    const body = {
      name: form.name,
      startTime: form.startTime,
      endTime: form.endTime,
      graceBeforeMin: Number(form.graceBeforeMin),
      graceAfterMin: Number(form.graceAfterMin),
      breakMinutes: Number(form.breakMinutes),
    };
    const ok =
      editing === "new" ? await run("/setup/shifts", "POST", body, "Shift added") : editing && (await run(`/setup/shifts/${editing.id}`, "PATCH", body, "Shift updated"));
    if (ok) setEditing(null);
  }

  return (
    <>
      <SectionHeader
        title="Shifts"
        description="Working hours and the check-in / check-out windows around them. An end time earlier than the start means the shift crosses midnight."
        actions={
          me?.canAdd && (
            <Button onClick={() => open("new")}>
              <Plus className="mr-1 h-4 w-4" /> Add shift
            </Button>
          )
        }
      />
      <Card>
        <Toolbar search={list.search} onSearch={list.setSearch} showInactive={list.showInactive} onShowInactive={list.setShowInactive} summary={list.summary} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shift</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Check-in window</TableHead>
              <TableHead>Unpaid break</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!list.rows.length && <EmptyRow colSpan={7}>No shifts.</EmptyRow>}
            {list.rows.map((s) => (
              <TableRow key={s.id} className={s.active ? undefined : "opacity-60"}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="tabular-nums">
                  {s.startTime}–{s.endTime} {s.crossesMidnight && <Badge variant="outline">night</Badge>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  −{s.graceBeforeMin} / +{s.graceAfterMin} min
                </TableCell>
                <TableCell>{s.breakMinutes} min</TableCell>
                <TableCell>{staff.filter((x) => x.shiftId === s.id && !x.deleted).length}</TableCell>
                <TableCell>
                  <StatusBadge active={s.active} />
                </TableCell>
                <TableCell className="text-right">
                  <RowActions actions={[{ label: "Edit", hidden: !can.edit, onSelect: () => open(s) }, activeActions("shifts", s, run, can)]} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <FormDialog
        open={!!editing}
        title={editing === "new" ? "Add shift" : "Edit shift"}
        description="Staff can check in from the start time minus the window before, and check out up to the end time plus the window after."
        onClose={() => setEditing(null)}
        onSave={() => void save()}
        valid={!!form.name.trim() && !!form.startTime && !!form.endTime}
        saving={saving}
      >
        <div className="sm:col-span-2">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Day shift" autoFocus />
          </Field>
        </div>
        <Field label="Start">
          <Input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
        </Field>
        <Field label="End">
          <Input type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
        </Field>
        <Field label="Window before (min)">
          <Input type="number" min={0} value={form.graceBeforeMin} onChange={(e) => set("graceBeforeMin", e.target.value)} />
        </Field>
        <Field label="Window after (min)">
          <Input type="number" min={0} value={form.graceAfterMin} onChange={(e) => set("graceAfterMin", e.target.value)} />
        </Field>
        <Field label="Unpaid break (min)">
          <Input type="number" min={0} value={form.breakMinutes} onChange={(e) => set("breakMinutes", e.target.value)} />
        </Field>
      </FormDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Work sites
// ---------------------------------------------------------------------------

const emptySite = { name: "", lat: "", lng: "", radiusM: "200" };

export function SitesSection() {
  const { geofences, staff, me } = useAttendance();
  const { run, saving } = useSave();
  const { toast } = useToast();
  const gateSites = new Set(useGateSites().map((g) => g.id));
  const list = useList(geofences, (g) => [g.name]);
  const [editing, setEditing] = useState<Geofence | "new" | null>(null);
  const [form, setForm] = useState(emptySite);
  const [locating, setLocating] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const can = { edit: !!me?.canEdit, remove: !!me?.canDelete };
  const open = (target: Geofence | "new") => {
    setForm(target === "new" ? emptySite : { name: target.name, lat: String(target.lat), lng: String(target.lng), radiusM: String(target.radiusM) });
    setEditing(target);
  };

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }));
        toast({ title: "Location filled in", description: `Accuracy ±${Math.round(pos.coords.accuracy)} m` });
        setLocating(false);
      },
      (err) => {
        toast({ variant: "destructive", title: "Could not get location", description: err.message });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20000 },
    );
  }

  async function save() {
    const body = { name: form.name, lat: Number(form.lat), lng: Number(form.lng), radiusM: Number(form.radiusM) };
    const ok =
      editing === "new" ? await run("/setup/geofences", "POST", body, "Site added") : editing && (await run(`/setup/geofences/${editing.id}`, "PATCH", body, "Site updated"));
    if (ok) setEditing(null);
  }

  const validCoords = Number.isFinite(Number(form.lat)) && Number.isFinite(Number(form.lng)) && !!form.lat && !!form.lng;

  return (
    <>
      <SectionHeader
        title="Work sites"
        description="Each site is a circle on the map. Check In with GPS only works inside it. Use a generous radius (150–300 m) so a weak GPS reading inside the warehouse still counts."
        actions={
          me?.canAdd && (
            <Button onClick={() => open("new")}>
              <Plus className="mr-1 h-4 w-4" /> Add site
            </Button>
          )
        }
      />
      <Card>
        <Toolbar search={list.search} onSearch={list.setSearch} showInactive={list.showInactive} onShowInactive={list.setShowInactive} summary={list.summary} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Site</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Circle</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Gate screen</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!list.rows.length && <EmptyRow colSpan={7}>No work sites.</EmptyRow>}
            {list.rows.map((g) => (
              <TableRow key={g.id} className={g.active ? undefined : "opacity-60"}>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell>
                  <a className="text-sm text-primary underline-offset-2 hover:underline" href={mapsLink(g.lat, g.lng) ?? "#"} target="_blank" rel="noreferrer">
                    {g.lat.toFixed(5)}, {g.lng.toFixed(5)}
                  </a>
                </TableCell>
                <TableCell>{g.radiusM} m</TableCell>
                <TableCell>{staff.filter((s) => !s.deleted && s.geofenceIds?.includes(g.id)).length}</TableCell>
                <TableCell>
                  <StatusBadge active={g.active} />
                </TableCell>
                <TableCell className="text-right">{g.active && gateSites.has(g.id) ? <GateSiteActions siteId={g.id} compact /> : "—"}</TableCell>
                <TableCell className="text-right">
                  <RowActions actions={[{ label: "Edit", hidden: !can.edit, onSelect: () => open(g) }, activeActions("geofences", g, run, can)]} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <FormDialog
        open={!!editing}
        title={editing === "new" ? "Add work site" : "Edit work site"}
        description="Stand at the middle of the site and press “Use my current location”, or paste the coordinates from Google Maps."
        onClose={() => setEditing(null)}
        onSave={() => void save()}
        valid={!!form.name.trim() && validCoords && Number(form.radiusM) >= 50}
        saving={saving}
      >
        <div className="sm:col-span-2">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Main warehouse" autoFocus />
          </Field>
        </div>
        <Field label="Latitude">
          <Input value={form.lat} onChange={(e) => set("lat", e.target.value)} placeholder="26.19209" />
        </Field>
        <Field label="Longitude">
          <Input value={form.lng} onChange={(e) => set("lng", e.target.value)} placeholder="50.53752" />
        </Field>
        <Field label="Radius (m)">
          <Input type="number" min={50} max={2000} value={form.radiusM} onChange={(e) => set("radiusM", e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button variant="outline" className="w-full" onClick={useMyLocation} disabled={locating}>
            {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crosshair className="mr-2 h-4 w-4" />}
            Use my current location
          </Button>
        </div>
      </FormDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Holidays
// ---------------------------------------------------------------------------

const emptyHoliday = { date: "", name: "", type: "PUBLIC" };

export function HolidaysSection() {
  const { holidays, me } = useAttendance();
  const { run, saving } = useSave();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyHoliday);
  const years = [...new Set([String(new Date().getFullYear()), ...holidays.map((h) => h.date.slice(0, 4))])].sort();
  const rows = (holidays as (Holiday & { id: string })[])
    .filter((h) => h.date.startsWith(year) && matches(search, h.name, h.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  async function save() {
    if (await run("/setup/holidays", "POST", form, "Holiday added")) {
      setAdding(false);
      setForm(emptyHoliday);
    }
  }

  return (
    <>
      <SectionHeader
        title="Holidays"
        description="Public and company holidays. Work on these dates counts as overtime at the holiday rate."
        actions={
          me?.canAdd && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add holiday
            </Button>
          )
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b p-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8" />
          </div>
          <div className="w-32">
            <Pick value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y }))} />
          </div>
          <span className="ml-auto text-xs text-muted-foreground">{rows.length} in {year}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Holiday</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows.length && <EmptyRow colSpan={4}>No holidays in {year}.</EmptyRow>}
            {rows.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="tabular-nums">
                  {new Date(`${h.date}T00:00:00`).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                </TableCell>
                <TableCell className="font-medium">{h.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{h.type === "PUBLIC" ? "Public" : "Company"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <RowActions
                    actions={[
                      {
                        label: "Delete",
                        danger: true,
                        hidden: !me?.canDelete,
                        onSelect: () => confirm(`Delete ${h.name}?`) && void run(`/setup/holidays/${h.id}`, "DELETE", undefined, "Holiday deleted"),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <FormDialog open={adding} title="Add holiday" onClose={() => setAdding(false)} onSave={() => void save()} valid={!!form.date && !!form.name.trim()} saving={saving}>
        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </Field>
        <Field label="Type">
          <Pick
            value={form.type}
            onChange={(v) => setForm((f) => ({ ...f, type: v }))}
            options={[
              { value: "PUBLIC", label: "Public" },
              { value: "COMPANY", label: "Company" },
            ]}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="National Day" />
          </Field>
        </div>
      </FormDialog>
    </>
  );
}
