"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { RATE_TYPES, type AttendanceRules } from "@/lib/attendance/config";
import { api, errorMessage } from "./api";
import { useAttendance } from "./context";
import { WEEKDAYS } from "./format";
import { Field, Pick } from "./staff-tab";

const rateOptions = RATE_TYPES.map((r) => ({ value: r, label: r }));

export function SettingsTab() {
  const { rules, approvers, me, reload } = useAttendance();
  const { toast } = useToast();
  const [draft, setDraft] = useState<AttendanceRules | null>(rules);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(rules), [rules]);
  if (!draft || !rules) return null;

  const editable = !!me?.canEdit;
  const set = <K extends keyof AttendanceRules>(key: K, value: AttendanceRules[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const num = (key: keyof AttendanceRules) => (e: React.ChangeEvent<HTMLInputElement>) => set(key, Number(e.target.value) as never);

  async function save() {
    if (!draft || !rules) return;
    const changes = Object.fromEntries(
      Object.entries(draft).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(rules[k as keyof AttendanceRules])),
    );
    if (!Object.keys(changes).length) return;
    setSaving(true);
    try {
      await api("/settings", { method: "PUT", body: changes });
      toast({ title: "Settings saved", description: "New rules apply to days recalculated from now on." });
      await reload();
    } catch (error) {
      toast({ variant: "destructive", title: "Could not save settings", description: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <fieldset disabled={!editable} className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Week and overtime rates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>Weekly off-days</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {WEEKDAYS.map((day, i) => (
                <label key={day} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.weeklyOffDays.includes(i)}
                    onCheckedChange={(checked) =>
                      set("weeklyOffDays", checked ? [...draft.weeklyOffDays, i].sort() : draft.weeklyOffDays.filter((d) => d !== i))
                    }
                  />
                  {day}
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {draft.weeklyOffDays.map((d) => (
                <Field key={d} label={`OT rate on ${WEEKDAYS[d]}`}>
                  <Pick
                    value={draft.offDayRateTypes[String(d)] ?? draft.workdayRateType}
                    onChange={(v) => set("offDayRateTypes", { ...draft.offDayRateTypes, [String(d)]: v as AttendanceRules["workdayRateType"] })}
                    options={rateOptions}
                  />
                </Field>
              ))}
              <Field label="OT rate on workdays">
                <Pick value={draft.workdayRateType} onChange={(v) => set("workdayRateType", v as AttendanceRules["workdayRateType"])} options={rateOptions} />
              </Field>
              <Field label="OT rate on holidays">
                <Pick value={draft.holidayRateType} onChange={(v) => set("holidayRateType", v as AttendanceRules["holidayRateType"])} options={rateOptions} />
              </Field>
            </div>
            <Toggle
              label="Work on an off-day or holiday counts entirely as overtime"
              checked={draft.offDayWorkIsOvertime}
              onChange={(v) => set("offDayWorkIsOvertime", v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daily rules</CardTitle>
            <CardDescription>The IN / OUT window sizes are set per shift in Setup.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Late means">
              <Pick
                value={draft.lateThreshold}
                onChange={(v) => set("lateThreshold", v as AttendanceRules["lateThreshold"])}
                options={[
                  { value: "AFTER_GRACE", label: "After start + window (e.g. 07:15)" },
                  { value: "AFTER_START", label: "Any time after shift start" },
                ]}
              />
            </Field>
            <Field label="Leaving before the OUT window">
              <Pick
                value={draft.earlyOutPolicy}
                onChange={(v) => set("earlyOutPolicy", v as AttendanceRules["earlyOutPolicy"])}
                options={[
                  { value: "FLAG_EARLY_OUT", label: "Flag 'left early', pay to exit time" },
                  { value: "MISSING_OUT", label: "Treat as missing OUT" },
                ]}
              />
            </Field>
            <Field label="Rounding step (min)">
              <Input type="number" min={1} max={60} value={draft.roundingStepMin} onChange={num("roundingStepMin")} />
            </Field>
            <Field label="Rounding">
              <Pick
                value={draft.roundingMode}
                onChange={(v) => set("roundingMode", v as AttendanceRules["roundingMode"])}
                options={[
                  { value: "DOWN", label: "Down (safest for invoice checks)" },
                  { value: "NEAREST", label: "Nearest" },
                  { value: "UP", label: "Up" },
                ]}
              />
            </Field>
            <div className="sm:col-span-2 space-y-2">
              <Toggle label="On-time arrival is paid from shift start" checked={draft.payFromShiftStartWhenOnTime} onChange={(v) => set("payFromShiftStartWhenOnTime", v)} />
              <Toggle label="OUT inside the OUT window is paid to shift end" checked={draft.payToShiftEndWhenInWindow} onChange={(v) => set("payToShiftEndWhenInWindow", v)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Overtime</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="OT In allowed from (min after shift end)">
              <Input type="number" min={0} value={draft.otStartAfterShiftEndMin} onChange={num("otStartAfterShiftEndMin")} />
            </Field>
            <Field label="Auto-close after (min)">
              <Input type="number" min={15} value={draft.otAutoCloseAfterMin} onChange={num("otAutoCloseAfterMin")} />
            </Field>
            <Field label="…or at this time, whichever is first">
              <Input type="time" value={draft.otAutoCloseAtLocal ?? ""} onChange={(e) => set("otAutoCloseAtLocal", e.target.value || null)} />
            </Field>
            <div />
            <Field label="Reminder after (hours)">
              <Input type="number" min={1} value={draft.otReminderAfterHours} onChange={num("otReminderAfterHours")} />
            </Field>
            <Field label="Escalate after (hours)">
              <Input type="number" min={1} value={draft.otEscalateAfterHours} onChange={num("otEscalateAfterHours")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Month end, privacy and alerts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Lock month on day … of next month">
              <Input type="number" min={1} max={28} value={draft.monthLockDay} onChange={num("monthLockDay")} />
            </Field>
            <Field label="Keep selfies for (days)">
              <Input type="number" min={1} value={draft.selfieRetentionDays} onChange={num("selfieRetentionDays")} />
            </Field>
            <Field label="Flag phone clock wrong by more than (min)">
              <Input type="number" min={0} value={draft.clockDriftToleranceMin} onChange={num("clockDriftToleranceMin")} />
            </Field>
            <Field label="Flag GPS accuracy worse than (m)">
              <Input type="number" min={5} value={draft.poorAccuracyM} onChange={num("poorAccuracyM")} />
            </Field>
            <Field label="Alert when a phone has not synced for (hours)">
              <Input type="number" min={1} value={draft.noSyncAlertHours} onChange={num("noSyncAlertHours")} />
            </Field>
            <Field label="Contractor comparison tolerance (min)">
              <Input type="number" min={0} value={draft.compareToleranceMin} onChange={num("compareToleranceMin")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Report viewers (read-only)</CardTitle>
            <CardDescription>
              These users can view and download reports for every staff member but cannot edit, approve or see selfies. Only an admin can change this list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset disabled={!me?.isAdmin} className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {approvers.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.reportViewerIds.includes(a.id)}
                    onCheckedChange={(checked) =>
                      set("reportViewerIds", checked ? [...draft.reportViewerIds, a.id] : draft.reportViewerIds.filter((id) => id !== a.id))
                    }
                  />
                  {a.name}
                  {a.role && <span className="text-xs text-muted-foreground">· {a.role}</span>}
                </label>
              ))}
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Staff app update</CardTitle>
            <CardDescription>Phones check this and offer the download. Below the minimum version the app asks staff to update.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Latest version">
              <Input value={draft.latestAppVersion} onChange={(e) => set("latestAppVersion", e.target.value)} />
            </Field>
            <Field label="Minimum version">
              <Input value={draft.minAppVersion} onChange={(e) => set("minAppVersion", e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="APK download link (HTTPS)">
                <Input value={draft.apkUrl} onChange={(e) => set("apkUrl", e.target.value)} placeholder="https://…/ekk-attendance-1.0.0.apk" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="APK SHA-256 (optional)">
                <Input value={draft.apkSha256} onChange={(e) => set("apkSha256", e.target.value)} />
              </Field>
            </div>
          </CardContent>
        </Card>
      </div>

      {editable && (
        <div className="flex gap-2">
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save settings
          </Button>
          <Button variant="outline" onClick={() => setDraft(rules)}>
            Undo changes
          </Button>
        </div>
      )}
    </fieldset>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}
