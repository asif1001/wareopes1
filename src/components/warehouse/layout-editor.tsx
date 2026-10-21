"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  capacityOf,
  createSubInventory,
  describeSub,
  padNumber,
} from "@/lib/warehouse/layout";
import { LAYOUT_PRESETS, buildLayoutPreset } from "@/lib/warehouse/presets";
import { formatNumber } from "@/lib/warehouse/palette";
import type {
  NumberRange,
  SubInventoryLayout,
  WarehouseLayout,
} from "@/lib/warehouse/types";

type Props = {
  layout: WarehouseLayout;
  onChange: (layout: WarehouseLayout) => void;
};

function SeriesFields({
  label,
  range,
  values,
  onChangeRange,
  onChangeValues,
}: {
  label: string;
  range: NumberRange;
  values?: string[];
  onChangeRange: (range: NumberRange) => void;
  onChangeValues: (values: string[] | undefined) => void;
}) {
  const isAlpha = Boolean(values?.length);
  const from = values?.[0]?.toUpperCase() ?? "A";
  const to = values?.[values.length - 1]?.toUpperCase() ?? "F";
  const [alphaFrom, setAlphaFrom] = useState(from);
  const [alphaTo, setAlphaTo] = useState(to);

  useEffect(() => {
    setAlphaFrom(from);
    setAlphaTo(to);
  }, [from, to]);

  const setAlpha = (nextFrom: string, nextTo: string) => {
    const start = nextFrom.trim().toUpperCase();
    const end = nextTo.trim().toUpperCase();
    if (!/^[A-Z]$/.test(start) || !/^[A-Z]$/.test(end)) return;
    const first = start.charCodeAt(0);
    const last = end.charCodeAt(0);
    const low = Math.min(first, last);
    const high = Math.max(first, last);
    onChangeValues(
      Array.from({ length: high - low + 1 }, (_, index) =>
        String.fromCharCode(low + index),
      ),
    );
  };

  const handleAlphaChange = (nextFrom: string, nextTo: string) => {
    const clean = (value: string) =>
      value
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 1);
    const start = clean(nextFrom);
    const end = clean(nextTo);
    setAlphaFrom(start);
    setAlphaTo(end);
    if (start && end) setAlpha(start, end);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Select
          value={isAlpha ? "alpha" : "number"}
          onValueChange={(value) => {
            if (value === "number") onChangeValues(undefined);
            else onChangeValues(alphaRange("A", "F"));
          }}
        >
          <SelectTrigger className="h-6 w-[104px] text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="number">Numbers</SelectItem>
            <SelectItem value="alpha">Alphabet</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isAlpha ? (
        <div className="flex items-center gap-1">
          <Input
            className="h-8 w-14 text-center font-mono uppercase"
            maxLength={1}
            value={alphaFrom}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => handleAlphaChange(event.target.value, alphaTo)}
            onBlur={() => {
              if (!alphaFrom) setAlphaFrom(from);
              if (!alphaTo) setAlphaTo(to);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label={`${label} first letter`}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            className="h-8 w-14 text-center font-mono uppercase"
            maxLength={1}
            value={alphaTo}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) =>
              handleAlphaChange(alphaFrom, event.target.value)
            }
            onBlur={() => {
              if (!alphaFrom) setAlphaFrom(from);
              if (!alphaTo) setAlphaTo(to);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label={`${label} last letter`}
          />
          <span className="ml-auto text-[11px] text-muted-foreground">
            {values?.length ?? 0} values
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={1}
            className="h-8 w-16"
            value={range.min}
            onChange={(event) =>
              onChangeRange({
                ...range,
                min: Math.max(1, Number(event.target.value) || 1),
              })
            }
            aria-label={`${label} first number`}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="number"
            min={1}
            className="h-8 w-16"
            value={range.max}
            onChange={(event) =>
              onChangeRange({
                ...range,
                max: Math.max(1, Number(event.target.value) || 1),
              })
            }
            aria-label={`${label} last number`}
          />
          <span className="text-xs text-muted-foreground">digits</span>
          <Input
            type="number"
            min={1}
            max={6}
            className="h-8 w-14"
            value={range.pad}
            onChange={(event) =>
              onChangeRange({
                ...range,
                pad: Math.min(6, Math.max(1, Number(event.target.value) || 1)),
              })
            }
            aria-label={`${label} digits`}
          />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        {isAlpha
          ? `Example: ${from} … ${to}`
          : `Example: 3 → ${padNumber(3, range.pad)}`}
      </p>
    </div>
  );
}

function alphaRange(from: string, to: string): string[] {
  const start = Math.min(from.charCodeAt(0), to.charCodeAt(0));
  const end = Math.max(from.charCodeAt(0), to.charCodeAt(0));
  return Array.from({ length: end - start + 1 }, (_, index) =>
    String.fromCharCode(start + index),
  );
}

function AreaRow({
  sub,
  onChange,
  onRemove,
}: {
  sub: SubInventoryLayout;
  onChange: (sub: SubInventoryLayout) => void;
  onRemove: () => void;
}) {
  const [locatorDraft, setLocatorDraft] = useState(
    (sub.locations ?? []).join("\n"),
  );
  const [showLocatorList, setShowLocatorList] = useState(false);
  useEffect(() => {
    setLocatorDraft((sub.locations ?? []).join("\n"));
  }, [sub.locations]);

  const isU = (sub.uTurnAfter ?? 10) > 0;
  const turnAfter = sub.uTurnAfter && sub.uTurnAfter > 0 ? sub.uTurnAfter : 10;

  const applyLocatorList = () => {
    const locations = [
      ...new Set(
        locatorDraft
          .split(/[\s,;]+/)
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];
    onChange({ ...sub, locations: locations.length ? locations : undefined });
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Zone code</Label>
          <Input
            className="h-8 w-20 font-mono uppercase"
            value={sub.code}
            onChange={(event) =>
              onChange({ ...sub, code: event.target.value.toUpperCase() })
            }
          />
        </div>
        <div className="min-w-[140px] flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">Zone name</Label>
          <Input
            className="h-8"
            value={sub.name ?? ""}
            placeholder="e.g. VNA main racking"
            onChange={(event) => onChange({ ...sub, name: event.target.value })}
          />
        </div>
        <div className="w-28 space-y-1">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select
            value={sub.kind}
            onValueChange={(value) =>
              onChange({ ...sub, kind: value as SubInventoryLayout["kind"] })
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rack">Racking</SelectItem>
              <SelectItem value="bulk">Floor / bulk</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={onRemove}
          title="Remove area"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {!sub.locations?.length && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SeriesFields
            label="Rows"
            range={sub.aisles}
            values={sub.rowValues}
            onChangeRange={(range) => onChange({ ...sub, aisles: range })}
            onChangeValues={(values) => onChange({ ...sub, rowValues: values })}
          />
          <SeriesFields
            label="Racks"
            range={sub.bays}
            values={sub.rackValues}
            onChangeRange={(range) => onChange({ ...sub, bays: range })}
            onChangeValues={(values) =>
              onChange({ ...sub, rackValues: values })
            }
          />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Bins (e.g. 1,2,3 or A,B,C,D)
            </Label>
            <Input
              className="h-8 font-mono uppercase"
              value={sub.bins.values.join(",")}
              onChange={(event) => {
                const values = [
                  ...new Set(
                    event.target.value
                      .split(/[,\s]+/)
                      .map((value) => value.trim().toUpperCase())
                      .filter(Boolean),
                  ),
                ];
                const allNumeric = values.every((value) => /^\d+$/.test(value));
                onChange({
                  ...sub,
                  bins: {
                    values: values.length ? values : ["1"],
                    pad: allNumeric
                      ? Math.max(1, ...values.map((value) => value.length))
                      : undefined,
                  },
                });
              }}
              placeholder="1,2,3"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Levels (bottom → top)
            </Label>
            <Input
              className="h-8 font-mono uppercase"
              value={sub.levels.join(",")}
              onChange={(event) => {
                const levels = [
                  ...new Set(
                    event.target.value
                      .split(/[,\s]+/)
                      .map((level) => level.trim().toUpperCase())
                      .filter(Boolean),
                  ),
                ];
                onChange({ ...sub, levels: levels.length ? levels : ["A"] });
              }}
              placeholder="A,B,C,D,E,F,G"
            />
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Type of picking route
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={isU ? "u" : "straight"}
              onValueChange={(value) =>
                onChange({
                  ...sub,
                  uTurnAfter: value === "u" ? turnAfter : 0,
                })
              }
            >
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="straight">Straight run</SelectItem>
                <SelectItem value="u">U-shape (turn around)</SelectItem>
              </SelectContent>
            </Select>
            {isU && (
              <>
                <span className="text-xs text-muted-foreground">at rack</span>
                <Input
                  type="number"
                  min={1}
                  className="h-8 w-20"
                  value={turnAfter}
                  onChange={(event) =>
                    onChange({
                      ...sub,
                      uTurnAfter: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                />
              </>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            U-shape sends the racks after this number to the return leg. Use
            “Straight run” for a normal aisle.
          </p>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-xs"
          onClick={() => setShowLocatorList((value) => !value)}
        >
          <span className="font-medium">Advanced: exact location list</span>
          <Badge variant="secondary">
            {formatNumber(sub.locations?.length ?? 0)} listed
          </Badge>
        </button>
        {showLocatorList && (
          <div className="mt-2 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Paste one locator per line (or comma-separated). This overrides
              rows, racks, levels and bins — use it for letter racks or
              irregular locations. Saving replaces the previous list.
            </p>
            <Textarea
              className="min-h-[120px] font-mono text-[11px]"
              value={locatorDraft}
              onChange={(event) => setLocatorDraft(event.target.value)}
              placeholder={"T.01.A.1.A\nT.01.A.2.A"}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={applyLocatorList}>
                Apply list
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setLocatorDraft("");
                  onChange({ ...sub, locations: undefined });
                }}
              >
                Clear list and use ranges
              </Button>
              <span className="self-center text-[11px] text-muted-foreground">
                {formatNumber(
                  locatorDraft.split(/[\s,;]+/).filter(Boolean).length,
                )}{" "}
                locators in the box
              </span>
            </div>
          </div>
        )}
      </div>

      {sub.locations?.length ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <span>
            Imported location list: <b>{formatNumber(sub.locations.length)}</b>{" "}
            exact locations. Ranges and U-turn settings are ignored while this
            list is present.
          </span>
          <label className="flex items-center gap-2">
            Extra aisle every
            <Input
              type="number"
              min={0}
              className="h-8 w-16"
              value={sub.rowGroupSize ?? 0}
              onChange={(event) =>
                onChange({
                  ...sub,
                  rowGroupSize: Math.max(0, Number(event.target.value) || 0),
                })
              }
            />
            rows
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => onChange({ ...sub, locations: undefined })}
          >
            Clear list and use ranges
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">
          {formatNumber(describeSubCapacity(sub))} locations
        </Badge>
        {describeSub(sub) && <span>{describeSub(sub)}</span>}
        <Input
          className="ml-auto h-8 max-w-[220px]"
          value={sub.locType ?? ""}
          placeholder="Storage type (optional)"
          onChange={(event) =>
            onChange({ ...sub, locType: event.target.value })
          }
        />
      </div>
    </div>
  );
}

function describeSubCapacity(sub: SubInventoryLayout): number {
  if (sub.locations?.length) return sub.locations.length;
  const aisles = Math.max(0, sub.aisles.max - sub.aisles.min + 1);
  const bays = Math.max(0, sub.bays.max - sub.bays.min + 1);
  const bins = Math.max(1, sub.bins.values.length);
  return aisles * bays * Math.max(1, sub.levels.length) * Math.max(1, bins);
}

export function WarehouseLayoutEditor({ layout, onChange }: Props) {
  const totalCapacity = capacityOf(layout);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Warehouse layout</CardTitle>
          <CardDescription>
            Define each zone and its racking for this branch. Every combination
            of Zone → Row → Rack → Level → Bin becomes a location — including
            empty ones — so occupancy percentages are measured against real
            capacity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              How to read a locator:
            </span>{" "}
            <code className="font-mono">A5.03.15.F.2</code> = Zone{" "}
            <span className="font-medium">A5</span> · Row{" "}
            <span className="font-medium">03</span> · Rack{" "}
            <span className="font-medium">15</span> · Level{" "}
            <span className="font-medium">F</span> · Bin{" "}
            <span className="font-medium">2</span>. “Digits” is the zero-padding
            used in the code: 2 digits turns 3 into{" "}
            <span className="font-mono">03</span>.
          </div>

          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="text-sm font-medium">Load racking preset</div>
              <div className="text-xs text-muted-foreground">
                Start from the VNA data layout or the Zone · Row · Rack · Level
                · Bin diagram, then adjust the ranges.
              </div>
            </div>
            <Select
              value=""
              onValueChange={(value) => {
                const preset = buildLayoutPreset(
                  value,
                  layout.branchId,
                  layout.branchName,
                );
                if (!preset) return;
                onChange({
                  ...preset,
                  id: layout.id,
                  name: layout.name || preset.name,
                  notes: layout.notes,
                  brandRules: layout.brandRules.length
                    ? layout.brandRules
                    : preset.brandRules,
                });
              }}
            >
              <SelectTrigger className="h-9 w-full sm:w-[280px]">
                <SelectValue placeholder="Choose a preset…" />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Warehouse / site name
              </Label>
              <Input
                value={layout.name}
                onChange={(event) =>
                  onChange({ ...layout, name: event.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Input
                value={layout.notes ?? ""}
                placeholder="Optional, e.g. VNA — Salmabad"
                onChange={(event) =>
                  onChange({ ...layout, notes: event.target.value })
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Configured capacity:{" "}
              <span className="font-semibold text-foreground">
                {formatNumber(totalCapacity)}
              </span>{" "}
              locations
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...layout,
                  subInventories: [
                    ...layout.subInventories,
                    createSubInventory("NEW"),
                  ],
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add zone
            </Button>
          </div>

          <div className="space-y-3">
            {layout.subInventories.map((sub, index) => (
              <AreaRow
                key={`${sub.code}-${index}`}
                sub={sub}
                onChange={(next) => {
                  const subInventories = layout.subInventories.map(
                    (entry, entryIndex) =>
                      entryIndex === index ? next : entry,
                  );
                  onChange({ ...layout, subInventories });
                }}
                onRemove={() => {
                  const subInventories = layout.subInventories.filter(
                    (_, entryIndex) => entryIndex !== index,
                  );
                  onChange({ ...layout, subInventories });
                }}
              />
            ))}
            {!layout.subInventories.length && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No zones yet. Upload a file to auto-detect them, or add a zone
                manually.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Brand rules</CardTitle>
          <CardDescription>
            LPN prefixes are matched longest-first. For example{" "}
            <code className="font-mono">VALVOLINE-123</code> maps to{" "}
            <span className="font-medium">VAL - Drum</span> before the shorter{" "}
            <code className="font-mono">VAL</code> rule applies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1 text-xs font-medium text-muted-foreground">
            <span>LPN prefix</span>
            <span>Brand name</span>
            <span />
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {layout.brandRules.map((rule, index) => (
              <div
                key={`${rule.prefix}-${index}`}
                className="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
              >
                <Input
                  className="h-8 font-mono uppercase"
                  value={rule.prefix}
                  onChange={(event) => {
                    const brandRules = layout.brandRules.map(
                      (entry, entryIndex) =>
                        entryIndex === index
                          ? {
                              ...entry,
                              prefix: event.target.value.toUpperCase(),
                            }
                          : entry,
                    );
                    onChange({ ...layout, brandRules });
                  }}
                />
                <Input
                  className="h-8"
                  value={rule.brand}
                  onChange={(event) => {
                    const brandRules = layout.brandRules.map(
                      (entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, brand: event.target.value }
                          : entry,
                    );
                    onChange({ ...layout, brandRules });
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() =>
                    onChange({
                      ...layout,
                      brandRules: layout.brandRules.filter(
                        (_, entryIndex) => entryIndex !== index,
                      ),
                    })
                  }
                  title="Remove rule"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...layout,
                brandRules: [...layout.brandRules, { prefix: "", brand: "" }],
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Add brand rule
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
