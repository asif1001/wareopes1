"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Download, Info, Plus, Trash2, Upload, Wand2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/lib/warehouse/palette";
import {
  BIN_STYLE_LABELS,
  DESIGN_LIMITS,
  LAYOUT_LABELS,
  LEVEL_STYLE_LABELS,
  NUMBERING_LABELS,
  RACK_STYLE_LABELS,
  autoCodeByAisle,
  bayText,
  binLabel,
  buildLayoutWithDesign,
  buildZoneModel,
  clampNumber,
  compassOf,
  countDesignLocations,
  countZoneLocations,
  defaultZone,
  designForLayout,
  designLocationsCsv,
  equipmentHint,
  formatLabel,
  levelLabel,
  locationCode,
  nextRow,
  normalizeRackDesign,
  parseLabel,
  rackCode,
  rackLabel,
  rowLevels,
  rowPitch,
  suggestZoneCode,
  validateZone,
  type BinLabelStyle,
  type DesignZone,
  type LevelLabelStyle,
  type LocationSeparator,
  type RackDesign,
  type RackLabelStyle,
} from "@/lib/warehouse/rack-design";
import type { WarehouseLayout } from "@/lib/warehouse/types";

type Props = {
  layout: WarehouseLayout;
  onChange: (layout: WarehouseLayout) => void;
  /** Live preview shown beside the form (3D view / floor plan) for the zone being edited. */
  renderPreview?: (zoneIndex: number) => ReactNode;
  readOnly?: boolean;
};

/** Applies on blur or Enter, like the designer, so the 3D preview updates once per change. */
function CommitInput({
  value,
  onCommit,
  ...props
}: { value: string | number; onCommit: (value: string) => void } & Omit<ComponentProps<typeof Input>, "value" | "onChange">) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <Input
      {...props}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (text !== String(value)) onCommit(text);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
    />
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Addressing = Pick<DesignZone, "zone" | "sep" | "rackStyle" | "levelStyle" | "binStyle">;

function ZoneDialog({
  open,
  mode,
  initial,
  existing,
  onCancel,
  onApply,
}: {
  open: boolean;
  mode: "new" | "edit";
  initial: Addressing;
  existing: string[];
  onCancel: () => void;
  onApply: (addressing: Addressing, copy: boolean) => void;
}) {
  const [a, setA] = useState<Addressing>(initial);
  const [copy, setCopy] = useState(false);
  const initialRef = useRef(initial);
  initialRef.current = initial;
  useEffect(() => {
    if (open) {
      setA(initialRef.current);
      setCopy(false);
    }
  }, [open]);

  const code = a.zone.trim().toUpperCase();
  const error = !code
    ? "Enter a zone code."
    : !/^[A-Z0-9]+$/.test(code)
      ? "Zone code: letters and numbers only (no spaces or separators)."
      : existing.includes(code)
        ? `Zone ${code} already exists.`
        : "";
  const tip =
    a.rackStyle === "alpha" && a.levelStyle === "alpha" && a.binStyle === "alpha"
      ? "Tip: all-letter codes are hard to read aloud and to tell apart on labels. Most sites keep at least one of rack, level or bin numeric."
      : a.rackStyle === "alpha"
        ? "Letter racks run A … Z, then AA, AB … — fine for short rows; numbers sort better in reports beyond 26 racks."
        : "";
  const examples: [number, number, number, string][] = [
    [1, 1, 1, "first rack, floor level, left bin"],
    [2, 3, 2, "rack 2, level 3, bin 2"],
    [27, 6, 3, "rack 27, level 6, bin 3"],
  ];

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? `Edit addressing — zone ${initial.zone}` : "Create new zone"}</DialogTitle>
          <DialogDescription>
            Set how every location in this zone will be coded <b>before</b> you build its racking. Each zone keeps its own settings.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Zone code">
            <Input
              maxLength={6}
              value={a.zone}
              className={`font-mono uppercase ${error ? "border-destructive" : ""}`}
              onChange={(event) => setA({ ...a, zone: event.target.value.toUpperCase() })}
              placeholder="e.g. A6"
            />
          </Field>
          <Field label="Separator">
            <Select value={a.sep} onValueChange={(value) => setA({ ...a, sep: value as LocationSeparator })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=".">Dot ( . )</SelectItem>
                <SelectItem value="-">Dash ( - )</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Rack labels">
            <Select value={a.rackStyle} onValueChange={(value) => setA({ ...a, rackStyle: value as RackLabelStyle })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RACK_STYLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Level labels (bottom = first)">
            <Select value={a.levelStyle} onValueChange={(value) => setA({ ...a, levelStyle: value as LevelLabelStyle })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LEVEL_STYLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Bin labels (left = first)">
            <Select value={a.binStyle} onValueChange={(value) => setA({ ...a, binStyle: value as BinLabelStyle })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BIN_STYLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {mode === "new" && (
            <Field label="Start racking from">
              <Select value={copy ? "copy" : "blank"} onValueChange={(value) => setCopy(value === "copy")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">Default layout</SelectItem>
                  <SelectItem value="copy">Copy current zone&apos;s racking</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
        <div className="rounded-md bg-[#152b48] p-3 font-mono text-sm leading-7 text-white">
          {examples.map(([r, l, b, text]) => (
            <div key={text}>
              {[code || "ZONE", "01", formatLabel(r, a.rackStyle), formatLabel(l, a.levelStyle), formatLabel(b, a.binStyle)].join(a.sep)}
              <span className="ml-2 font-sans text-[11px] text-slate-300">{text}</span>
            </div>
          ))}
        </div>
        {(error || tip) && <p className={`text-xs ${error ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{error || tip}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={!!error} onClick={() => onApply({ ...a, zone: code }, copy)}>
            {mode === "edit" ? "Apply to zone" : "Create zone → set up racking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CHECK_STYLE = {
  ok: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" },
  err: { icon: XCircle, cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200" },
  warn: { icon: AlertTriangle, cls: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" },
  info: { icon: Info, cls: "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200" },
} as const;

export function WarehouseLayoutEditor({ layout, onChange, renderPreview, readOnly = false }: Props) {
  const design = useMemo(() => designForLayout(layout), [layout]);
  const [active, setActive] = useState(0);
  const [dialog, setDialog] = useState<"new" | "edit" | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const zoneIndex = Math.min(active, design.zones.length - 1);
  const z = design.zones[zoneIndex];
  const model = useMemo(() => buildZoneModel(z), [z]);
  const checks = useMemo(() => validateZone(z, model), [z, model]);

  useEffect(() => {
    if (!deleteArmed) return;
    const t = setTimeout(() => setDeleteArmed(false), 4000);
    return () => clearTimeout(t);
  }, [deleteArmed]);

  const apply = (next: RackDesign) => onChange(buildLayoutWithDesign(layout, next));
  const setZone = (next: DesignZone) => apply({ ...design, zones: design.zones.map((entry, i) => (i === zoneIndex ? next : entry)) });
  const patch = (p: Partial<DesignZone>) => setZone({ ...z, ...p });
  const patchRow = (i: number, p: Partial<DesignZone["rows"][number]>) =>
    patch({ rows: z.rows.map((row, idx) => (idx === i ? { ...row, ...p } : row)) });
  const num = (v: string, key: keyof typeof DESIGN_LIMITS, fallback: number, round = false) => {
    const [min, max] = DESIGN_LIMITS[key];
    const n = clampNumber(v, fallback, min, max);
    return round ? Math.round(n) : n;
  };

  const racks = model.racks.length;
  const zoneLocations = countZoneLocations(z);
  const area = (model.bounds.x1 - model.bounds.x0) * (model.bounds.y1 - model.bounds.y0);
  const levelSet = [...new Set(model.racks.map((r) => r.levels))].sort((a, b) => a - b);
  const levelText = levelSet.length > 1 ? `${levelSet[0]}–${levelSet[levelSet.length - 1]} levels` : `${levelSet[0] ?? z.levels} levels`;
  const firstRack = model.racks[0];
  const topBase = (z.levels - 1) * (z.heightMode === "frame" ? z.frameH / z.levels : z.levelH);
  const hasDuplicates = checks.some((c) => c.level === "err");

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = normalizeRackDesign(JSON.parse(String(reader.result)));
        apply(next);
        setActive(0);
        setMessage({ text: `Imported ${file.name}: ${next.zones.length} zone(s), ${formatNumber(countDesignLocations(next))} locations.`, tone: "ok" });
      } catch {
        setMessage({ text: "That file is not a valid rack layout JSON.", tone: "err" });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <fieldset disabled={readOnly} className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">1 · Zone &amp; addressing</CardTitle>
              <CardDescription>Changes apply when you leave a field (Tab / Enter). The preview updates straight away.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end gap-2">
                <Field label="Active zone" className="flex-1">
                  <Select value={String(zoneIndex)} onValueChange={(value) => setActive(Number(value))}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {design.zones.map((entry, i) => (
                        <SelectItem key={entry.zone} value={String(i)}>
                          Zone {entry.zone} · {entry.rows.reduce((t, r) => t + r.count, 0)} racks · {entry.levels}×{entry.bins}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Button type="button" size="sm" className="h-9" onClick={() => setDialog("new")}>
                  <Plus className="mr-1 h-4 w-4" /> New zone
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setDialog("edit")}>
                  Edit addressing…
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={deleteArmed ? "destructive" : "outline"}
                  disabled={design.zones.length < 2}
                  onClick={() => {
                    if (!deleteArmed) {
                      setDeleteArmed(true);
                      return;
                    }
                    setDeleteArmed(false);
                    apply({ ...design, zones: design.zones.filter((_, i) => i !== zoneIndex) });
                    setActive(0);
                    setMessage({ text: `Zone ${z.zone} deleted.`, tone: "ok" });
                  }}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  {deleteArmed ? `Click again to delete ${z.zone}` : "Delete zone"}
                </Button>
              </div>
              <div className="rounded-md bg-muted/60 p-3 text-xs leading-6">
                <b>Zone {z.zone}</b> · separator <code className="font-bold">{z.sep}</code>
                <br />
                Rack: {RACK_STYLE_LABELS[z.rackStyle]}
                <br />
                Level: {LEVEL_STYLE_LABELS[z.levelStyle]} ({levelLabel(z, 0)} = floor)
                <br />
                Bin: {BIN_STYLE_LABELS[z.binStyle]} ({binLabel(z, 1)} = left)
                <br />
                Format{" "}
                <code className="font-bold">
                  ZONE{z.sep}AISLE{z.sep}RACK{z.sep}LEVEL{z.sep}BIN
                </code>
                <br />
                First location: <code className="font-bold">{firstRack ? locationCode(z, firstRack.id, 0, 1) : "—"}</code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">2 · Rack structure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Default levels (max 20)">
                  <CommitInput type="number" min={1} max={20} className="h-9" value={z.levels} onCommit={(v) => patch({ levels: num(v, "levels", z.levels, true) })} />
                </Field>
                <Field label="Bins per level">
                  <CommitInput type="number" min={1} max={12} className="h-9" value={z.bins} onCommit={(v) => patch({ bins: num(v, "bins", z.bins, true) })} />
                </Field>
                <Field label="Rack bay width (m)">
                  <CommitInput type="number" min={0.5} max={6} step={0.1} className="h-9" value={z.rackW} onCommit={(v) => patch({ rackW: num(v, "rackW", z.rackW) })} />
                </Field>
                <Field label="Rack depth (m)">
                  <CommitInput type="number" min={0.3} max={3} step={0.1} className="h-9" value={z.rackD} onCommit={(v) => patch({ rackD: num(v, "rackD", z.rackD) })} />
                </Field>
                <Field label="Height rule" className="col-span-2">
                  <Select value={z.heightMode} onValueChange={(value) => patch({ heightMode: value as DesignZone["heightMode"] })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pitch">Fixed level pitch: frame grows as levels are added</SelectItem>
                      <SelectItem value="frame">Fixed frame height: more levels = tighter pitch</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Frame height (m)">
                  {z.heightMode === "frame" ? (
                    <CommitInput type="number" min={1} max={40} step={0.1} className="h-9" value={z.frameH} onCommit={(v) => patch({ frameH: num(v, "frameH", z.frameH) })} />
                  ) : (
                    <Input className="h-9" disabled value={(z.levels * z.levelH).toFixed(2)} />
                  )}
                </Field>
                <Field label="Level pitch (m)">
                  {z.heightMode === "pitch" ? (
                    <CommitInput type="number" min={0.3} max={4} step={0.05} className="h-9" value={z.levelH} onCommit={(v) => patch({ levelH: num(v, "levelH", z.levelH) })} />
                  ) : (
                    <Input className="h-9" disabled value={(z.frameH / z.levels).toFixed(3)} />
                  )}
                </Field>
                <Field label="Top level base">
                  <Input className="h-9" disabled value={`${topBase.toFixed(2)} m`} />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                {z.heightMode === "frame"
                  ? `Frame stays ${z.frameH.toFixed(1)} m. Pitch = frame ÷ levels: 4 levels → ${(z.frameH / 4).toFixed(2)} m, ${z.levels} → ${(z.frameH / z.levels).toFixed(2)} m, ${z.levels + 2} → ${(z.frameH / (z.levels + 2)).toFixed(2)} m. Give a row its own level count in section 4.`
                  : `Each level is ${z.levelH.toFixed(2)} m, so frame height = levels × pitch. Rows with more levels are taller.`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">3 · Floor layout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Layout type" className="col-span-2">
                  <Select value={z.layout} onValueChange={(value) => patch({ layout: value as DesignZone["layout"] })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LAYOUT_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Rack numbering direction" className="col-span-2">
                  <Select value={z.numbering} onValueChange={(value) => patch({ numbering: value as DesignZone["numbering"] })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(NUMBERING_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Aisle width (m)">
                  <CommitInput type="number" min={0.8} max={8} step={0.1} className="h-9" value={z.aisle} onCommit={(v) => patch({ aisle: num(v, "aisle", z.aisle) })} />
                </Field>
                <Field label="Back-to-back flue (m)">
                  <CommitInput type="number" min={0} max={1.5} step={0.05} className="h-9" value={z.flue} onCommit={(v) => patch({ flue: num(v, "flue", z.flue) })} />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">{equipmentHint(z.aisle)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">4 · Physical rack rows</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {z.rows.map((row, i) => {
                  const end = row.start + row.count - 1;
                  const g = model.geo[i];
                  const aisle = model.aisles[model.rowAisle[i]];
                  return (
                    <div key={i} className="rounded-lg border p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <b className="text-sm">Row {i + 1}</b>
                        <Badge variant="secondary" className="font-normal">
                          {g ? compassOf(g.n) : ""} face · {aisle?.label ?? ""}
                        </Badge>
                        {z.rows.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-destructive"
                            onClick={() => patch({ rows: z.rows.filter((_, idx) => idx !== i) })}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <p className="mb-2 text-xs text-muted-foreground">
                        <b className="font-mono text-foreground">
                          {rackCode(z, row, row.start)} → {rackCode(z, row, end)}
                        </b>{" "}
                        · {g?.rev ? "reverse" : "forward"} numbering
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <Field label="Aisle / bay code">
                          <CommitInput maxLength={8} className="h-8 font-mono uppercase" value={row.bay} onCommit={(v) => patchRow(i, { bay: bayText(v) || "01" })} />
                        </Field>
                        <Field label="Starting rack">
                          <CommitInput
                            maxLength={4}
                            className="h-8 font-mono uppercase"
                            value={rackLabel(z, row.start)}
                            onCommit={(v) => {
                              const n = parseLabel(v);
                              if (Number.isNaN(n)) setMessage({ text: `“${v}” is not a valid rack label.`, tone: "err" });
                              else patchRow(i, { start: Math.round(clampNumber(n, 1, 1, 9999)) });
                            }}
                          />
                        </Field>
                        <Field label="Number of racks">
                          <CommitInput type="number" min={1} max={50} className="h-8" value={row.count} onCommit={(v) => patchRow(i, { count: num(v, "rowRacks", row.count, true) })} />
                        </Field>
                        <Field label={`Levels (blank = ${z.levels})`}>
                          <CommitInput
                            type="number"
                            min={1}
                            max={20}
                            className="h-8"
                            placeholder={String(z.levels)}
                            value={row.levels ?? ""}
                            onCommit={(v) => {
                              const next = { ...row };
                              if (!v.trim() || Number(v) === z.levels) delete next.levels;
                              else next.levels = num(v, "levels", z.levels, true);
                              patch({ rows: z.rows.map((entry, idx) => (idx === i ? next : entry)) });
                            }}
                          />
                        </Field>
                        <Field label="Pitch · height">
                          <Input className="h-8" disabled value={`${rowPitch(z, i).toFixed(2)} m · ${(rowLevels(z, i) * rowPitch(z, i)).toFixed(1)} m`} />
                        </Field>
                        <Field label="End rack">
                          <Input className="h-8 font-mono" disabled value={rackLabel(z, end)} />
                        </Field>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" size="sm" disabled={z.rows.length >= DESIGN_LIMITS.rows[1]} onClick={() => patch({ rows: [...z.rows, nextRow(z)] })}>
                  <Plus className="mr-1 h-4 w-4" /> Add next row
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setZone(autoCodeByAisle(z));
                    setMessage({ text: "Codes re-assigned: one code per aisle, racks numbered continuously along both faces of that aisle.", tone: "ok" });
                  }}
                >
                  <Wand2 className="mr-1 h-4 w-4" /> Auto-code by aisle
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setZone({ ...defaultZone(z.zone), sep: z.sep, rackStyle: z.rackStyle, levelStyle: z.levelStyle, binStyle: z.binStyle });
                    setMessage({ text: `Zone ${z.zone} racking reset (addressing kept).`, tone: "ok" });
                  }}
                >
                  Reset
                </Button>
              </div>
              <ul className="space-y-1 pt-2 text-xs">
                {checks.map((check) => {
                  const S = CHECK_STYLE[check.level];
                  return (
                    <li key={check.text} className={`flex gap-2 rounded-md px-2 py-1.5 ${S.cls}`}>
                      <S.icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {check.text}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </fieldset>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Brand rules</CardTitle>
            <CardDescription>
              LPN prefixes are matched longest-first. For example <code className="font-mono">VALVOLINE-123</code> maps to{" "}
              <span className="font-medium">VAL - Drum</span> before the shorter <code className="font-mono">VAL</code> rule applies.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <fieldset disabled={readOnly} className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1 text-xs font-medium text-muted-foreground">
                <span>LPN prefix</span>
                <span>Brand name</span>
                <span />
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {layout.brandRules.map((rule, index) => (
                  <div key={`${rule.prefix}-${index}`} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                    <Input
                      className="h-8 font-mono uppercase"
                      value={rule.prefix}
                      onChange={(event) =>
                        onChange({
                          ...layout,
                          brandRules: layout.brandRules.map((entry, i) => (i === index ? { ...entry, prefix: event.target.value.toUpperCase() } : entry)),
                        })
                      }
                    />
                    <Input
                      className="h-8"
                      value={rule.brand}
                      onChange={(event) =>
                        onChange({
                          ...layout,
                          brandRules: layout.brandRules.map((entry, i) => (i === index ? { ...entry, brand: event.target.value } : entry)),
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => onChange({ ...layout, brandRules: layout.brandRules.filter((_, i) => i !== index) })}
                      title="Remove rule"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...layout, brandRules: [...layout.brandRules, { prefix: "", brand: "" }] })}>
                Add brand rule
              </Button>
            </fieldset>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-6">
          {[
            ["Rows", String(z.rows.length), `zone ${z.zone}`],
            ["Racks (bays)", formatNumber(racks), ""],
            ["Bin locations", formatNumber(zoneLocations), design.zones.length > 1 ? `${formatNumber(countDesignLocations(design))} all zones` : ""],
            ["Footprint", `${formatNumber(Math.round(area))} m²`, `${(model.bounds.x1 - model.bounds.x0).toFixed(1)} × ${(model.bounds.y1 - model.bounds.y0).toFixed(1)} m`],
            ["Rack height", `${model.height.toFixed(1)} m`, z.heightMode === "frame" ? `fixed frame · ${levelText}` : `${levelText} × ${z.levelH.toFixed(2)} m`],
            ["Zones", String(design.zones.length), ""],
          ].map(([label, value, hint]) => (
            <div key={label} className="rounded-lg border bg-card p-2.5">
              <div className="text-[11px] text-muted-foreground">{label}</div>
              <div className="text-lg font-semibold leading-tight">{value}</div>
              {hint && <div className="truncate text-[11px] text-muted-foreground">{hint}</div>}
            </div>
          ))}
        </div>

        {renderPreview?.(zoneIndex)}

        {message && <p className={`text-xs ${message.tone === "err" ? "text-destructive" : "text-emerald-700"}`}>{message.text}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly}
            onClick={() => fileRef.current?.click()}
            title="Load a layout exported from the Warehouse Rack Layout Designer"
          >
            <Upload className="mr-1 h-4 w-4" /> Import designer JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importFile(file);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={hasDuplicates}
            onClick={() =>
              download(
                "warehouse-rack-layout.json",
                JSON.stringify({ version: 5, active: zoneIndex, zones: design.zones.map((entry) => ({ ...entry, status: {} })) }, null, 2),
                "application/json",
              )
            }
          >
            <Download className="mr-1 h-4 w-4" /> Export JSON
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={hasDuplicates}
            onClick={() => download(design.zones.length > 1 ? "locations-all-zones.csv" : `locations-${z.zone}.csv`, designLocationsCsv(design), "text/csv")}
          >
            <Download className="mr-1 h-4 w-4" /> Export locations CSV
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/70 text-left">
              <tr>
                {["Row", "Aisle", "Start", "End", "Racks", "Levels", "Pitch", "Height", "Length", "Pick face", "Numbering"].map((h) => (
                  <th key={h} className="whitespace-nowrap p-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {z.rows.map((row, i) => {
                const g = model.geo[i];
                return (
                  <tr key={i} className="border-t">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">{model.aisles[model.rowAisle[i]]?.label}</td>
                    <td className="p-2 font-mono">{rackCode(z, row, row.start)}</td>
                    <td className="p-2 font-mono">{rackCode(z, row, row.start + row.count - 1)}</td>
                    <td className="p-2">{row.count}</td>
                    <td className="p-2">{rowLevels(z, i)}</td>
                    <td className="p-2">{rowPitch(z, i).toFixed(2)} m</td>
                    <td className="p-2">{(rowLevels(z, i) * rowPitch(z, i)).toFixed(1)} m</td>
                    <td className="p-2">{g?.len.toFixed(1)} m</td>
                    <td className="p-2">{g ? compassOf(g.n) : ""}</td>
                    <td className="p-2">{g?.rev ? "Reverse" : "Forward"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ZoneDialog
        open={dialog !== null}
        mode={dialog ?? "new"}
        initial={
          dialog === "edit"
            ? { zone: z.zone, sep: z.sep, rackStyle: z.rackStyle, levelStyle: z.levelStyle, binStyle: z.binStyle }
            : { zone: suggestZoneCode(design, z.zone), sep: z.sep, rackStyle: z.rackStyle, levelStyle: z.levelStyle, binStyle: z.binStyle }
        }
        existing={design.zones.filter((_, i) => dialog !== "edit" || i !== zoneIndex).map((entry) => entry.zone)}
        onCancel={() => setDialog(null)}
        onApply={(addressing, copy) => {
          if (dialog === "edit") {
            const prev = z.zone;
            setZone({ ...z, ...addressing });
            setMessage({ text: `Zone ${prev}${prev !== addressing.zone ? ` → ${addressing.zone}` : ""}: addressing updated. All location codes regenerated.`, tone: "ok" });
          } else {
            const base = copy ? { ...z, rows: z.rows.map((r) => ({ ...r })) } : defaultZone(addressing.zone);
            apply({ ...design, zones: [...design.zones, { ...base, ...addressing }] });
            setActive(design.zones.length);
            setMessage({ text: `Zone ${addressing.zone} created. Next: set its rack structure, floor layout and rows in sections 2–4.`, tone: "ok" });
          }
          setDialog(null);
        }}
      />
    </div>
  );
}
