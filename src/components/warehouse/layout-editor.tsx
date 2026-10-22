"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildLayoutWithRackBuilder,
  buildRackLocations,
  countRackLocations,
  createRackRows,
  deriveRackBuilderConfig,
} from "@/lib/warehouse/rack-builder";
import { formatNumber } from "@/lib/warehouse/palette";
import type {
  RackBuilderConfig,
  RackRowConfig,
  WarehouseLayout,
} from "@/lib/warehouse/types";

type Props = {
  layout: WarehouseLayout;
  onChange: (layout: WarehouseLayout) => void;
};

export function WarehouseLayoutEditor({ layout, onChange }: Props) {
  const config = layout.rackBuilder ?? deriveRackBuilderConfig(layout);
  const [rowCount, setRowCount] = useState(config.rows.length);
  const [bays, setBays] = useState(config.rows[0]?.bays ?? 19);
  const [levels, setLevels] = useState(config.rows[0]?.levels ?? 4);
  const [bins, setBins] = useState(config.rows[0]?.bins ?? 3);

  useEffect(() => {
    setRowCount(config.rows.length);
    setBays(config.rows[0]?.bays ?? 19);
    setLevels(config.rows[0]?.levels ?? 4);
    setBins(config.rows[0]?.bins ?? 3);
  }, [
    config.rows.length,
    config.rows[0]?.bays,
    config.rows[0]?.levels,
    config.rows[0]?.bins,
  ]);

  const apply = (next: RackBuilderConfig) => {
    onChange(buildLayoutWithRackBuilder(layout, next));
  };

  const updateConfig = (patch: Partial<RackBuilderConfig>) => {
    apply({ ...config, ...patch });
  };

  const updateRow = (index: number, patch: Partial<RackRowConfig>) => {
    const rows = config.rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, ...patch } : row,
    );
    updateConfig({ rows });
  };

  const resetRows = () => {
    updateConfig({ rows: createRackRows(rowCount, bays, levels, bins) });
  };

  const sample = buildRackLocations(config)[0]?.locator ?? "—";
  const total = countRackLocations(config);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Rack structure</CardTitle>
          <CardDescription>
            Build the warehouse the same way as the rack builder: choose the
            zone, number of rows, bays, levels and bins, then fine-tune each
            row.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Zone</Label>
              <Input
                className="h-9 font-mono uppercase"
                value={config.zone}
                onChange={(event) =>
                  updateConfig({ zone: event.target.value.toUpperCase() })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Rows</Label>
              <Input
                type="number"
                min={1}
                max={20}
                className="h-9"
                value={rowCount}
                onChange={(event) =>
                  setRowCount(Number(event.target.value) || 1)
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Bays / row
              </Label>
              <Input
                type="number"
                min={1}
                max={40}
                className="h-9"
                value={bays}
                onChange={(event) => setBays(Number(event.target.value) || 1)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Levels</Label>
              <Input
                type="number"
                min={1}
                max={10}
                className="h-9"
                value={levels}
                onChange={(event) => setLevels(Number(event.target.value) || 1)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Bins / level
              </Label>
              <Input
                type="number"
                min={1}
                max={6}
                className="h-9"
                value={bins}
                onChange={(event) => setBins(Number(event.target.value) || 1)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Bay numbering
              </Label>
              <Select
                value={config.numbering.direction}
                onValueChange={(value) =>
                  updateConfig({
                    numbering: {
                      ...config.numbering,
                      direction: value as "ltr" | "rtl",
                    },
                  })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ltr">Left → Right</SelectItem>
                  <SelectItem value="rtl">Right → Left</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetRows}
            >
              Create / reset rows
            </Button>
            <span className="text-xs text-muted-foreground">
              {formatNumber(total)} locations · sample{" "}
              <span className="font-mono">{sample}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dimensions (mm)</CardTitle>
          <CardDescription>
            Physical sizes used by the 3D model. Verify against your actual rack
            and safety requirements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {(
              [
                ["bayWidth", "Bay width"],
                ["rackDepth", "Rack depth"],
                ["levelHeight", "Level height"],
                ["aisleWidth", "Aisle width"],
                ["backToBackGap", "Back-to-back gap"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  type="number"
                  min={100}
                  step={50}
                  className="h-9"
                  value={config.dimensions[key]}
                  onChange={(event) =>
                    updateConfig({
                      dimensions: {
                        ...config.dimensions,
                        [key]: Math.max(100, Number(event.target.value) || 100),
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configure each row</CardTitle>
          <CardDescription>
            Each row can have its own bays, levels and bins. Choose how it joins
            the next row: a normal aisle or back-to-back racking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {config.rows.map((row, index) => (
              <div
                key={index}
                className="grid items-end gap-2 rounded-lg border p-2 sm:grid-cols-[70px_1fr_1fr_1fr_1.2fr]"
              >
                <div className="text-xs font-medium">Row {index + 1}</div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Bays
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={40}
                    className="h-8"
                    value={row.bays}
                    onChange={(event) =>
                      updateRow(index, {
                        bays: Math.max(1, Number(event.target.value) || 1),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Levels
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    className="h-8"
                    value={row.levels}
                    onChange={(event) =>
                      updateRow(index, {
                        levels: Math.max(1, Number(event.target.value) || 1),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Bins / level
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={6}
                    className="h-8"
                    value={row.bins}
                    onChange={(event) =>
                      updateRow(index, {
                        bins: Math.max(1, Number(event.target.value) || 1),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    To next row
                  </Label>
                  <Select
                    value={row.join}
                    onValueChange={(value) =>
                      updateRow(index, { join: value as RackRowConfig["join"] })
                    }
                    disabled={index === config.rows.length - 1}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aisle">Aisle</SelectItem>
                      <SelectItem value="b2b">Back-to-back</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Location numbering</CardTitle>
          <CardDescription>
            Choose letters or numbers for bays, levels and bins. The locator is
            built as Zone.Row.Bay.Level.Bin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bay</Label>
              <Select
                value={config.numbering.bay}
                onValueChange={(value) =>
                  updateConfig({
                    numbering: {
                      ...config.numbering,
                      bay: value as "num" | "alpha",
                    },
                  })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="num">01, 02…</SelectItem>
                  <SelectItem value="alpha">A, B…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Level</Label>
              <Select
                value={config.numbering.level}
                onValueChange={(value) =>
                  updateConfig({
                    numbering: {
                      ...config.numbering,
                      level: value as "num" | "alpha",
                    },
                  })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="num">1, 2…</SelectItem>
                  <SelectItem value="alpha">A, B…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bin</Label>
              <Select
                value={config.numbering.bin}
                onValueChange={(value) =>
                  updateConfig({
                    numbering: {
                      ...config.numbering,
                      bin: value as "num" | "alpha",
                    },
                  })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alpha">A, B…</SelectItem>
                  <SelectItem value="num">1, 2…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Bin orientation
              </Label>
              <Select
                value={config.numbering.binOrientation}
                onValueChange={(value) =>
                  updateConfig({
                    numbering: {
                      ...config.numbering,
                      binOrientation: value as "side" | "depth",
                    },
                  })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="side">Side by side</SelectItem>
                  <SelectItem value="depth">Front to back</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="secondary">{formatNumber(total)} locations</Badge>
            <span className="text-muted-foreground">
              Example locator: <span className="font-mono">{sample}</span>
            </span>
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
                  ×
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
            Add brand rule
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
