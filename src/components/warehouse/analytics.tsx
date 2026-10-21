"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatNumber, formatPct } from "@/lib/warehouse/palette";
import type { WarehouseReport } from "@/lib/warehouse/types";

function Bar({ pct }: { pct: number }) {
  const color =
    pct >= 90
      ? "#dc2626"
      : pct >= 75
        ? "#f97316"
        : pct >= 50
          ? "#eab308"
          : "#16a34a";
  return (
    <div className="flex min-w-[130px] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, pct)}%`, background: color }}
        />
      </div>
      <span className="w-12 text-right text-xs tabular-nums" style={{ color }}>
        {formatPct(pct)}
      </span>
    </div>
  );
}

function EmptyRows({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function WarehouseAnalytics({ report }: { report: WarehouseReport }) {
  const { summary } = report;
  const levels = summary.levelRows.map((row) => row.level);
  const [search, setSearch] = useState("");
  const brands = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return summary.brandRows;
    return summary.brandRows.filter((row) =>
      row.brand.toLowerCase().includes(query),
    );
  }, [search, summary.brandRows]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Brand-wise occupancy</CardTitle>
            <CardDescription>
              Share of the total warehouse capacity occupied by each brand.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-center gap-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter brands…"
                className="h-8 max-w-xs"
              />
              <span className="text-xs text-muted-foreground">
                {brands.length} brands
              </span>
            </div>
            {!summary.brandRows.length ? (
              <EmptyRows message="No brand data yet. Upload an inventory file to see the occupancy split." />
            ) : (
              <div className="max-h-[420px] overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-left text-xs">
                    <tr>
                      <th className="p-2 font-medium">Brand</th>
                      <th className="p-2 text-right font-medium">Locations</th>
                      <th className="p-2 text-right font-medium">LPNs</th>
                      <th className="p-2 text-right font-medium">On-hand</th>
                      <th className="p-2 font-medium">% of capacity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brands.map((row) => (
                      <tr key={row.brand} className="border-t">
                        <td className="p-2 font-medium">{row.brand}</td>
                        <td className="p-2 text-right tabular-nums">
                          {formatNumber(row.locations)}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {formatNumber(row.lpns)}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {formatNumber(row.onHand)}
                        </td>
                        <td className="p-2">
                          <Bar pct={row.pct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Level-wise occupancy</CardTitle>
            <CardDescription>
              Racking level utilisation from the bottom (A) to the top.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!summary.levelRows.length ? (
              <EmptyRows message="No levels configured yet." />
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs">
                    <tr>
                      <th className="p-2 font-medium">Level</th>
                      <th className="p-2 text-right font-medium">Total</th>
                      <th className="p-2 text-right font-medium">Occupied</th>
                      <th className="p-2 text-right font-medium">Empty</th>
                      <th className="p-2 font-medium">Occupancy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.levelRows.map((row) => (
                      <tr key={row.level} className="border-t">
                        <td className="p-2 font-medium">{row.level}</td>
                        <td className="p-2 text-right tabular-nums">
                          {formatNumber(row.total)}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {formatNumber(row.occupied)}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {formatNumber(row.empty)}
                        </td>
                        <td className="p-2">
                          <Bar pct={row.pct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Zone-wise occupancy</CardTitle>
            <CardDescription>
              Each zone / sub-inventory compared against its configured
              capacity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!summary.subRows.length ? (
              <EmptyRows message="No zones configured." />
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs">
                    <tr>
                      <th className="p-2 font-medium">Zone</th>
                      <th className="p-2 font-medium">Type</th>
                      <th className="p-2 text-right font-medium">Locations</th>
                      <th className="p-2 text-right font-medium">On-hand</th>
                      <th className="p-2 font-medium">Occupancy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.subRows.map((row) => (
                      <tr key={row.sub} className="border-t">
                        <td className="p-2">
                          <div className="font-mono font-medium">{row.sub}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.name}
                          </div>
                        </td>
                        <td className="p-2 capitalize text-muted-foreground">
                          {row.kind}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {formatNumber(row.occupied)}/{formatNumber(row.total)}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {formatNumber(row.onHand)}
                        </td>
                        <td className="p-2">
                          <Bar pct={row.pct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Row-wise occupancy</CardTitle>
            <CardDescription>
              All zones combined, grouped by row number.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!summary.aisleRows.length ? (
              <EmptyRows message="No rows configured." />
            ) : (
              <div className="max-h-[360px] overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-left text-xs">
                    <tr>
                      <th className="p-2 font-medium">Row</th>
                      <th className="p-2 text-right font-medium">Total</th>
                      <th className="p-2 text-right font-medium">Occupied</th>
                      <th className="p-2 text-right font-medium">Empty</th>
                      <th className="p-2 font-medium">Occupancy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.aisleRows.map((row) => (
                      <tr key={row.aisle} className="border-t">
                        <td className="p-2 font-medium">Row {row.aisle}</td>
                        <td className="p-2 text-right tabular-nums">
                          {formatNumber(row.total)}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {formatNumber(row.occupied)}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {formatNumber(row.empty)}
                        </td>
                        <td className="p-2">
                          <Bar pct={row.pct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Brand × level matrix</CardTitle>
          <CardDescription>
            Number of occupied locations per brand and racking level.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!summary.brandRows.length ? (
            <EmptyRows message="No data to cross-tabulate yet." />
          ) : (
            <div className="overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs">
                  <tr>
                    <th className="p-2 font-medium">Brand</th>
                    {levels.map((level) => (
                      <th key={level} className="p-2 text-center font-medium">
                        {level}
                      </th>
                    ))}
                    <th className="p-2 text-center font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.brandRows.map((row) => {
                    const total = levels.reduce(
                      (sum, level) =>
                        sum + (summary.crossTab[row.brand]?.[level] ?? 0),
                      0,
                    );
                    return (
                      <tr key={row.brand} className="border-t">
                        <td className="p-2 font-medium">{row.brand}</td>
                        {levels.map((level) => {
                          const value =
                            summary.crossTab[row.brand]?.[level] ?? 0;
                          return (
                            <td
                              key={level}
                              className={`p-2 text-center tabular-nums ${value ? "" : "text-muted-foreground/50"}`}
                            >
                              {value || "–"}
                            </td>
                          );
                        })}
                        <td className="p-2 text-center font-semibold tabular-nums">
                          {formatNumber(total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function WarehouseLocationsTable({
  report,
}: {
  report: WarehouseReport;
}) {
  const [search, setSearch] = useState("");
  const [onlyOccupied, setOnlyOccupied] = useState(false);
  const [limit, setLimit] = useState(100);

  const rows = useMemo(() => {
    const query = search.trim().toUpperCase();
    const all = [...report.locations.values()].sort((a, b) =>
      a.meta.locator.localeCompare(b.meta.locator),
    );
    return all
      .filter((location) => {
        if (onlyOccupied && !location.occupied) return false;
        if (!query) return true;
        if (location.meta.locator.includes(query)) return true;
        return location.records.some(
          (record) =>
            (record.lpn || "").toUpperCase().includes(query) ||
            (record.brand || "").toUpperCase().includes(query) ||
            (record.item || "").toUpperCase().includes(query) ||
            (record.description || "").toUpperCase().includes(query),
        );
      })
      .slice(0, limit);
  }, [report, search, onlyOccupied, limit]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Storage locations</CardTitle>
        <CardDescription>
          {formatNumber(report.summary.totalLocations)} planned locations ·{" "}
          {formatNumber(report.unplanned.length)} outside the layout
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="h-8 max-w-sm"
            placeholder="Search locator, LPN, brand or item…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={onlyOccupied}
              onChange={(event) => setOnlyOccupied(event.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Occupied only
          </label>
          {search && rows.length >= limit && (
            <span className="text-xs text-muted-foreground">
              Showing first {limit} matches
            </span>
          )}
        </div>
        <div className="overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs">
              <tr>
                <th className="p-2 font-medium">Locator</th>
                <th className="p-2 font-medium">Zone</th>
                <th className="p-2 font-medium">Level</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Brands</th>
                <th className="p-2 text-right font-medium">LPNs</th>
                <th className="p-2 text-right font-medium">On-hand</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((location) => (
                <tr key={location.meta.locator} className="border-t">
                  <td className="p-2 font-mono">{location.meta.locator}</td>
                  <td className="p-2">
                    {location.meta.sub}
                    {location.meta.aisle !== null && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · Row {location.meta.aisle}
                      </span>
                    )}
                    {location.meta.rackCode && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · Rack {location.meta.rackCode}
                      </span>
                    )}
                  </td>
                  <td className="p-2">{location.meta.level}</td>
                  <td className="p-2">
                    <Badge
                      variant={location.occupied ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {location.occupied
                        ? location.mixed
                          ? "Mixed"
                          : "Occupied"
                        : "Empty"}
                    </Badge>
                  </td>
                  <td className="p-2 text-xs">
                    {location.brands.join(", ") || "—"}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {formatNumber(location.lpnCount)}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {formatNumber(location.onHand)}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-6 text-center text-sm text-muted-foreground"
                  >
                    No locations match the search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length >= limit && (
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={() => setLimit((value) => value + 200)}
          >
            Show more locations
          </button>
        )}
      </CardContent>
    </Card>
  );
}
