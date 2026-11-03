"use client";

import { useState } from "react";
import { Copy, Crosshair, ExternalLink, Loader2, Plus, QrCode, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { api, errorMessage } from "./api";
import { useAttendance } from "./context";
import { mapsLink } from "./format";
import { ReminderSetupCard } from "./reminder-setup-card";
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

export function SetupTab() {
  const { me } = useAttendance();
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {me?.isAdmin && <ReminderSetupCard />}
      <ContractorsCard />
      <ShiftsCard />
      <GeofencesCard />
      <HolidaysCard />
    </div>
  );
}

function ActiveToggle({ entity, id, active }: { entity: Entity; id: string; active: boolean }) {
  const { me } = useAttendance();
  const { run, saving } = useSave();
  if (active && !me?.canDelete) return null;
  if (!active && !me?.canEdit) return null;
  return active ? (
    <Button size="sm" variant="ghost" disabled={saving} onClick={() => void run(`/setup/${entity}/${id}`, "DELETE", undefined, "Deactivated")}>
      Deactivate
    </Button>
  ) : (
    <Button size="sm" variant="ghost" disabled={saving} onClick={() => void run(`/setup/${entity}/${id}`, "PATCH", { active: true }, "Activated")}>
      Activate
    </Button>
  );
}

function ContractorsCard() {
  const { contractors, me } = useAttendance();
  const { run, saving } = useSave();
  const [name, setName] = useState("");
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Contractors</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {me?.canAdd && (
          <div className="flex gap-2">
            <Input placeholder="Contractor name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              disabled={!name.trim() || saving}
              onClick={async () => (await run("/setup/contractors", "POST", { name }, "Contractor added")) && setName("")}
            >
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        )}
        <Table>
          <TableBody>
            {contractors.map((c) => (
              <TableRow key={c.id} className={c.active ? undefined : "opacity-50"}>
                <TableCell>{c.name}</TableCell>
                <TableCell className="text-right">
                  <ActiveToggle entity="contractors" id={c.id} active={c.active} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ShiftsCard() {
  const { shifts, me } = useAttendance();
  const { run, saving } = useSave();
  const [form, setForm] = useState({ name: "", startTime: "07:00", endTime: "16:00", graceBeforeMin: "15", graceAfterMin: "15", breakMinutes: "0" });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Shifts</CardTitle>
        <CardDescription>End time earlier than start time means the shift crosses midnight.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {me?.canAdd && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Day shift" />
            </Field>
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
            <Button
              className="col-span-2 sm:col-span-3"
              disabled={!form.name.trim() || saving}
              onClick={async () =>
                (await run(
                  "/setup/shifts",
                  "POST",
                  {
                    name: form.name,
                    startTime: form.startTime,
                    endTime: form.endTime,
                    graceBeforeMin: Number(form.graceBeforeMin),
                    graceAfterMin: Number(form.graceAfterMin),
                    breakMinutes: Number(form.breakMinutes),
                  },
                  "Shift added",
                )) && set("name", "")
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add shift
            </Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shift</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Windows</TableHead>
              <TableHead>Break</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.map((s) => (
              <TableRow key={s.id} className={s.active ? undefined : "opacity-50"}>
                <TableCell>{s.name}</TableCell>
                <TableCell>
                  {s.startTime}–{s.endTime} {s.crossesMidnight && <Badge variant="outline">night</Badge>}
                </TableCell>
                <TableCell>
                  −{s.graceBeforeMin} / +{s.graceAfterMin} min
                </TableCell>
                <TableCell>{s.breakMinutes} min</TableCell>
                <TableCell className="text-right">
                  <ActiveToggle entity="shifts" id={s.id} active={s.active} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function GeofencesCard() {
  const { geofences, me } = useAttendance();
  const { run, saving } = useSave();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", lat: "", lng: "", radiusM: "200" });
  const [locating, setLocating] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Work sites (geofences)</CardTitle>
        <CardDescription>Use a generous radius (150–300 m) so a weak GPS reading inside the warehouse still counts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {me?.canAdd && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Main warehouse" />
            </Field>
            <Field label="Latitude">
              <Input value={form.lat} onChange={(e) => set("lat", e.target.value)} />
            </Field>
            <Field label="Longitude">
              <Input value={form.lng} onChange={(e) => set("lng", e.target.value)} />
            </Field>
            <Field label="Radius (m)">
              <Input type="number" min={50} max={2000} value={form.radiusM} onChange={(e) => set("radiusM", e.target.value)} />
            </Field>
            <Button variant="outline" className="col-span-2" onClick={useMyLocation} disabled={locating}>
              {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crosshair className="mr-2 h-4 w-4" />}
              Use my current location
            </Button>
            <Button
              className="col-span-2"
              disabled={!form.name.trim() || !form.lat || !form.lng || saving}
              onClick={async () =>
                (await run(
                  "/setup/geofences",
                  "POST",
                  { name: form.name, lat: Number(form.lat), lng: Number(form.lng), radiusM: Number(form.radiusM) },
                  "Site added",
                )) && setForm({ name: "", lat: "", lng: "", radiusM: "200" })
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add site
            </Button>
          </div>
        )}
        <Table>
          <TableBody>
            {geofences.map((g) => (
              <TableRow key={g.id} className={g.active ? undefined : "opacity-50"}>
                <TableCell>{g.name}</TableCell>
                <TableCell>
                  <a className="text-sm underline" href={mapsLink(g.lat, g.lng) ?? "#"} target="_blank" rel="noreferrer">
                    {g.lat.toFixed(5)}, {g.lng.toFixed(5)}
                  </a>
                </TableCell>
                <TableCell>{g.radiusM} m</TableCell>
                <TableCell className="text-right">
                  {me?.isAdmin && g.active && <GateScreenButton siteId={g.id} siteName={g.name} />}
                  <ActiveToggle entity="geofences" id={g.id} active={g.active} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Admin only: the link for the rotating check-in QR shown on a screen at this site's gate. */
function GateScreenButton({ siteId, siteName }: { siteId: string; siteName: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(regenerate: boolean) {
    setBusy(true);
    try {
      const res = await api<{ url: string }>("/gate-key", { method: "POST", body: { site: siteId, regenerate } });
      setUrl(res.url);
      if (regenerate) toast({ title: "New gate link created", description: "The old link has stopped working. Open the new one on the gate screen." });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not get the gate link", description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setOpen(true);
          if (!url) void load(false);
        }}
      >
        <QrCode className="mr-1 h-4 w-4" /> Gate screen
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gate screen · {siteName}</DialogTitle>
            <DialogDescription>
              Open this link on a tablet or PC at the gate (keep it plugged in and online). It shows a QR code that changes every 30 seconds.
              Staff tap “Scan site QR” in the app (Android or iPhone) to check in or out when GPS is off or there is no internet on their phone.
              Late check-outs become overtime claims for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <code className="block break-all rounded bg-muted px-2 py-1.5 text-xs">{url ?? (busy ? "Loading…" : "—")}</code>
            <p className="text-xs text-muted-foreground">
              Keep this link private: anyone with it can show this site&apos;s check-in code. If it leaks, create a new link.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" disabled={busy} onClick={() => void load(true)}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} New link
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!url}
                onClick={() => url && void navigator.clipboard.writeText(url).then(() => toast({ title: "Gate link copied" }))}
              >
                <Copy className="mr-1 h-4 w-4" /> Copy
              </Button>
              <Button disabled={!url} onClick={() => url && window.open(url, "_blank", "noopener")}>
                <ExternalLink className="mr-1 h-4 w-4" /> Open
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HolidaysCard() {
  const { holidays, me } = useAttendance();
  const { run, saving } = useSave();
  const [form, setForm] = useState({ date: "", name: "", type: "PUBLIC" });
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Holiday calendar</CardTitle>
        <CardDescription>Overtime on these dates uses the holiday rate.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {me?.canAdd && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Date">
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </Field>
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="National Day" />
            </Field>
            <Field label="Type">
              <Pick value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={[{ value: "PUBLIC", label: "Public" }, { value: "COMPANY", label: "Company" }]} />
            </Field>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={!form.date || !form.name.trim() || saving}
                onClick={async () => (await run("/setup/holidays", "POST", form, "Holiday added")) && setForm({ date: "", name: "", type: "PUBLIC" })}
              >
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
          </div>
        )}
        <Table>
          <TableBody>
            {holidays.map((h) => (
              <TableRow key={h.id}>
                <TableCell>{h.date}</TableCell>
                <TableCell>{h.name}</TableCell>
                <TableCell className="text-xs">{h.type.toLowerCase()}</TableCell>
                <TableCell className="text-right">
                  {me?.canDelete && (
                    <Button size="icon" variant="ghost" onClick={() => confirm(`Delete ${h.name}?`) && void run(`/setup/holidays/${h.id}`, "DELETE", undefined, "Holiday deleted")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
